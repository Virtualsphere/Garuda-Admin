# Land → Work Allotment → Villages Allotment — Design

Date: 2026-08-12
Status: Approved (pending final review)

## Purpose

The Land section's top-tab bar already lists a "Work allotment" tab (`App.jsx` `landTopTabs`), but it renders "Page coming soon...". This spec covers building its first sub-tab, **Villages Allotment**: an admin picks a field executive ("Land Verification Executive") and allots villages to them, seeing live per-village data-quality stats (total land parcels, verified count, physical-audit count, fill-details count) so they can prioritize which villages still need coverage.

Reference: a target-design screenshot showing a green-themed page with a personnel selector, a village card grid (LIST/MAP toggle, search), and an "Allot Village" action per card.

## Scope

**In scope:**
- The `VILLAGES ALLOTMENT` sub-tab, fully functional.
- `DATA TASKS` and `MISSION PROFILE` sub-tabs rendered as disabled/greyed placeholders (no content), matching how the rest of the app stubs unbuilt sections.
- LIST view of the village grid. The MAP toggle button is present but disabled ("coming soon") — no mapping library exists in this project (`package.json` has no leaflet/mapbox/etc.), and adding one is out of scope here.
- A new backend endpoint for live per-village stats, reusing the existing land-verification pipeline's status fields.
- Reusing the existing `assigned_village` creation endpoint for the actual "allot" action — no new write endpoint.

**Out of scope:**
- Data Tasks and Mission Profile content/behavior (undefined by the reference design; would need its own brainstorming pass).
- Map view / any mapping dependency.
- Retrofitting the existing (currently unauthenticated) assigned-village routes' auth gap — noted as a pre-existing issue, not fixed here except that the *new* route follows the correct convention.
- Reconciling the pre-existing drift between `assigned_village`'s JSONB snapshot arrays and live `land` status (a known, separate issue; this feature sidesteps it by not depending on those arrays for the stats shown here).

## Architecture decisions

1. **Village stats are computed live from `land`, not read from `assigned_village`.** The reference design shows stats (e.g. "T: 12", "Verified: 1") on villages that haven't been allotted to anyone yet ("ALLOTABLE VILLAGES"). `assigned_village`'s JSONB snapshot arrays (`verified`, `physical_verified`, `complete_details`) only exist once an assignment row is created, so they can't be the source for unassigned villages. Instead, a new endpoint aggregates `land` rows grouped by `(village, mandal)`, counting by the existing status enums:
   - `T` (total) → `COUNT(*)`
   - `Verified` → `COUNT(*) WHERE verification_status = 'complete'`
   - `Physical Audit` → `COUNT(*) WHERE physcial_verification_status = 'complete'` (existing DB typo preserved, not renamed)
   - `Fill Details` → `COUNT(*) WHERE form_status = 'complete'`

   This follows the one existing precedent for grouped counts in the backend (`agentService.js`'s mandal-count query using Sequelize `fn("COUNT", col("id"))` + `group`), applied to `Land` instead of `Agent`.

2. **"Allotable" is scoped per selected executive, not global.** A village already assigned to Executive A can still be shown as allotable for Executive B — the grid excludes only villages that already have an `assigned_village` row for the *currently selected* executive. This avoids blocking legitimate cases (a village needing multiple people across different work types) while preventing duplicate assignment of the same village to the same person.

3. **"Allot Village" reuses the existing POST `/fieldwork/assigned-village` endpoint.** No new write path. The call is `{ target: <village's live total count>, assignedEmployeeId: <selected executive id>, village, mandal, assignedStatus: 'ongoing' }`. Target defaults to the village's current total land count and is not editable in this first version (no modal) — clicking the button is a single, immediate action. The button is disabled until an executive is selected, so there's no click-time validation error state to design for.

4. **Personnel selection lists all employees, unfiltered by role.** The codebase already established (in `FarmersAreaAllotment.jsx`) that employee `role` text has no reliable department tag to filter on, so any employee can be picked. This feature follows the same convention rather than inventing new role filtering.

## Frontend

**New files:**
- `src/components/Land/LandWorkAllotmentPage.jsx`
- `src/components/Land/LandWorkAllotmentPage.css`

**Wiring:** `App.jsx`'s Land render block gets a new case:
```jsx
{activeTab === 'work-allotment' && <LandWorkAllotmentPage />}
```
(and the existing catch-all "Page coming soon..." condition is updated to exclude `work-allotment`).

**Component structure:**
- Sub-tab row: `VILLAGES ALLOTMENT` (active), `DATA TASKS`, `MISSION PROFILE` (both disabled, no `onClick`), styled with the existing `land-sub-tab` pill pattern from `LandPage.css`/`LandDataPage.css`.
- A single `selectedExecutiveId` state drives both:
  - The top green banner (executive photo placeholder, name, role badge — styled after `FarmersAreaAllotment.css`'s `.f-area-mission-lead` block, recolored to the Land theme's `--accent`).
  - A "Personnel Selection" card (left column) with an "Active Executive" `<select>`, populated from `employeeService.getAll()` using the same defensive-unwrap pattern already used elsewhere (`data.data || data.employees || data || []`).
- Right side: "Allotable Villages" panel — LIST/MAP toggle (MAP disabled), a search input filtering the fetched village list client-side by village/mandal name, and a responsive card grid.
- Each village card: village name + mandal, `T: <total>` badge (styled after `.f-roster-badge`'s blue pill), three stat rows (Verified / Physical Audit / Fill Details), and an "Allot Village" button (styled after `.f-exec-commit-btn`) disabled when no executive is selected.
- Data fetch: on mount and whenever `selectedExecutiveId` changes, call the new service function (below) with `employeeId = selectedExecutiveId || undefined`. Loading and empty states follow existing conventions (centered muted uppercase text).
- On successful allot: refetch the village list so the allotted village drops out of the grid; show a transient inline confirmation near the card (no toast library in this project — reuse the existing inline-banner convention).
- Errors (fetch or allot failures): inline banner + `console.error`, matching existing components.

**Services:** extend `src/services/assignedVillageService.js` with:
```js
getVillageStats: (params) => apiClient.get('/fieldwork/village-stats', { params }).then(res => res.data)
```
(`params` = `{ employeeId, search }`; `search` may be handled client-side only if the dataset stays small — decided at implementation time based on actual data volume, not a blocking design question).

## Backend (`Garuda-Backend-2`)

**New route** in `src/routes/fieldWorkRoutes.js` (co-located with the existing assigned-village routes, since this is conceptually part of the same fieldwork/village-assignment domain):
```
GET /fieldwork/village-stats
```
Protected with `verifyToken` (the existing sibling assigned-village routes currently lack this; the new route does not repeat that gap, per project convention of protecting reads that expose personnel/operational data).

**New controller function** in `src/controller/fieldWorkController.js`, following the existing `try { const result = await service.fn(...); res.status(200).json({ message, result }) } catch { res.status(500).json({ message: error.message }) }` shape used by sibling assigned-village handlers.

**New service function** `getVillageAllotmentStats(employeeId, filters)` in `src/service/landService.js` (co-located with the existing assigned-village service logic, which already lives in this file):
- Base query: `Land.findAll({ attributes: ['village', 'mandal', [fn('COUNT', col('id')), 'total'], [fn('COUNT', literal("CASE WHEN verification_status = 'complete' THEN 1 END")), 'verified'], [fn('COUNT', literal("CASE WHEN physcial_verification_status = 'complete' THEN 1 END")), 'physical_audit'], [fn('COUNT', literal("CASE WHEN form_status = 'complete' THEN 1 END")), 'fill_details']], where: { trainee: false }, group: ['village', 'mandal'], raw: true })` — mirrors `agentService.js`'s existing grouped-count pattern.
- If `employeeId` is provided: separately query `AssignedVillage.findAll({ where: { assigned_employee_id: employeeId }, attributes: ['village', 'mandal'], raw: true })`, build a `Set` of `village|mandal` keys, and filter those out of the aggregated result before returning.
- No new model, no new table, no schema migration.

## Error handling

| Case | Behavior |
|---|---|
| Village-stats fetch fails | Inline error banner in the grid area, `console.error` logged, existing data (if any) left in place |
| Employee list fetch fails | Inline error banner in the Personnel Selection card |
| Allot action fails (network/500) | Inline error near the affected card, button re-enabled, no optimistic removal |
| No executive selected | "Allot Village" buttons are disabled (not a runtime error state) |

## Verification plan

- No test suite exists in this repo (per `CLAUDE.md`); verification is manual.
- Frontend: run `npm run dev`, log in, navigate Land → Work allotment → Villages Allotment, confirm the grid renders real village stats (confirmed during design that at least one real `land` record with a village name — "Kondapur" — exists in the connected dev database), select an executive, allot a village, confirm it disappears from the grid.
- Backend: exercised live against the already-running local `Garuda-Backend-2` instance (confirmed listening on port 5000 during design) and its connected Postgres database — no separate test harness needed since the same manual browser flow above exercises the new endpoint end-to-end.
