# Land Verification Queues — Date & Field Executive Filters — Design

Date: 2026-08-13
Status: Approved

## Purpose

The Land → Land data → Verification tab has three built list-views (`PhoneVerificationList`, `PhysicalVerificationList`, `VerifiedLandsList`), each currently offering only a farmer-name/ID search box. Admins need to narrow each queue down to a specific field executive and a submission-date range, so they can audit an individual's work ("check individual works") instead of scanning the entire queue.

## Scope

**In scope:**
- A Date (From/To) filter and a Field Executive filter, added identically to all three list-views.
- A prerequisite correctness fix (see below) without which the new filters would sit on top of queues that don't actually show what their headers claim.

**Out of scope:**
- The `Verify details` / `Review details` sub-tabs — not built yet ("Page coming soon"), nothing to add filters to.
- The pre-existing lack of `verifyToken` on `GET /land` and the dedicated `pending-*` routes' read access — unrelated to this change, not touched.
- Real "assigned to" data for physical verification — `PhysicalVerificationList`'s `ALLOTTED TO` column stays mocked; no backend field exists for it (confirmed against the `Land` model — there's no `physical_verified_by` column, unlike `call_verification_by` and `verified_by`).

## Prerequisite fix: queues aren't actually filtered server-side

Confirmed by reading `Garuda-Backend-2` directly (available locally as a sibling repo):

- `landController.getAllLands` (bound to `GET /land`, which is what `landService.js`'s `getByCallVerificationStatus`/`getByPhysicalVerificationStatus`/`getByVerificationStatus` all call today) ignores `req.query` entirely and always returns every non-trainee land. So today, Phone list / Physical list / Verified lands all render the identical, full, unfiltered list — the query params the frontend sends (`call_verification_status`, `physcial_verification_status`, `verification_status`) are silently dropped.
- Dedicated, correctly-filtering endpoints already exist and are correctly implemented service-side, but one is wired to the wrong controller function:
  - `GET /land/pending-call-verification/:status` → `getPendingCallVerificationLands` ✓ correct
  - `GET /land/pending-physical-verification/:status` → wired to `getPendingCallVerificationLands` ✗ **bug** (should be `getPendingPhysicalVerificationLands`, which exists and is correctly implemented but never referenced by any route)
  - `GET /land/pending-final-verification/:status` → `getPendingFinalVerificationLands` ✓ correct

**Fix:**
1. `Garuda-Backend-2/src/routes/landRoutes.js`: change the `pending-physical-verification` route's handler from `landController.getPendingCallVerificationLands` to `landController.getPendingPhysicalVerificationLands`.
2. `src/services/landService.js` (this repo): repoint the three status-filter methods at the dedicated endpoints instead of `/land` with (ignored) query params:
   - `getByCallVerificationStatus(status)` → `GET /land/pending-call-verification/${status}`
   - `getByPhysicalVerificationStatus(status)` → `GET /land/pending-physical-verification/${status}`
   - `getByVerificationStatus(status)` → `GET /land/pending-final-verification/${status}`

   Response envelope is unchanged (`{ success, data }`), so the three list components' existing `data.data || []` handling needs no change. These endpoints use Sequelize's `VERIFICATION_INCLUDE`, which additionally embeds `land.creator` (the `Employee` joined via `Land.belongsTo(Employee, { foreignKey: 'created_by', as: 'creator' })`) and `land.verifier` — richer than what these lists get today, though the new filter logic (below) doesn't depend on that embed and uses a separately-fetched employee list instead, for consistency with the rest of the codebase.

All three `pending-*` routes already require `verifyToken`; `apiClient.js`'s request interceptor already attaches the bearer token, so no auth-handling changes are needed on the frontend.

## Filter semantics

- **Field Executive** filters on `land.created_by` — the employee who submitted/onboarded the land. Applied identically on all three tabs (confirmed over the alternative of using `verified_by` on the Verified tab, in order to keep one consistent meaning: "everything this executive brought into the system," at whatever stage it's currently at). This is also the only "who did it" field guaranteed to be populated on pending queue items — `call_verification_by`/`verified_by` are null until those stages complete.
- **Date** filters on `land.created_at` — the only timestamp column on the `Land` model (no separate per-stage completion timestamps exist). From/To range, inclusive of the full To day.

## Frontend design

**New file:** `src/hooks/useFieldExecutiveFilter.js` — mirrors the existing `useLocations` hook precedent (shared cross-cutting concern → hook in `src/hooks/`, reused by multiple sibling list components instead of each re-implementing it).

```js
function useFieldExecutiveFilter() {
  // fetches employeeService.getAll() once on mount → executives: [{id, name, ...}]
  // owns: dateFrom, dateTo, executiveId (all '' by default = no filter)
  // returns: { executives, dateFrom, setDateFrom, dateTo, setDateTo,
  //            executiveId, setExecutiveId, matchesFilters(land), resetFilters, hasActiveFilters }
}
```

`matchesFilters(land)`:
- If `executiveId` set and `land.created_by !== Number(executiveId)` → false.
- If `dateFrom` set and `land.created_at < startOfDay(dateFrom)` → false.
- If `dateTo` set and `land.created_at > endOfDay(dateTo)` → false.
- Else → true.

Employee list population follows the existing defensive-unwrap convention used everywhere else in this codebase: `data.data || data.employees || data || []`.

**Modified files:** `PhoneVerificationList.jsx`, `PhysicalVerificationList.jsx`, `VerifiedLandsList.jsx` — each:
- Calls `useFieldExecutiveFilter()`.
- Combines it with the existing local `searchQuery` state: `lands.filter(l => matchesSearch(l) && matchesFilters(l))`.
- Renders a new filter-bar row (JSX duplicated per component, per this codebase's established convention of keeping section-local UI in the owning file rather than extracting shared components — see `CLAUDE.md` conventions and the existing triplicated `ledger-header`/`ledger-search` markup across these same three files).
- Resolves the executive's display name for read-only cells (if ever needed) the same way `BuyerEnquiry.jsx` does: `executives.find(e => e.id === land.created_by)`.

**Modified file:** `src/services/landService.js` — the three endpoint-URL changes described above.

**Modified file:** `src/components/Land/LandDataPage.css` (already the single shared stylesheet loaded for all three list components) — new classes:
- `.ledger-filters` — a row between `.ledger-header` and `.ledger-table-wrap`, flex layout, same card padding rhythm as the rest of the ledger card.
- Date inputs and the executive `<select>` styled consistently with existing native-input conventions in this file (bordered pill/box, `--accent` on focus — matching `.ledger-search`'s existing look rather than introducing a new visual style).
- A "Clear filters" button/link, shown only when `hasActiveFilters` is true.

## Error handling

| Case | Behavior |
|---|---|
| Employee list fetch fails | Executive dropdown shows only "All executives"; `console.error` logged (matches existing convention) |
| `land.created_by` doesn't match any fetched employee | Row is simply excluded when that specific executive is selected (no crash — filter is a strict equality check) |
| `land.created_at` missing/null | Row is excluded whenever a date filter is active (a land record with no timestamp can't be said to fall inside a range) |
| No rows match combined filters | Reuses each table's existing empty-state row (e.g. "No pending phone verifications found.") |

## Verification plan

- No test suite in this repo (per `CLAUDE.md`) — manual verification.
- Backend: restart/reload `Garuda-Backend-2` (local, port 5000 per `vite.config.js` proxy target), confirm `/land/pending-physical-verification/pending` now returns physical-verification-scoped rows instead of call-verification-scoped ones.
- Frontend: `npm run dev`, log in, navigate Land → Land data → Verification, and for each of the three tabs:
  - Confirm the queue now shows a distinct (and plausibly smaller) set of records than the other two tabs, where before all three were identical.
  - Pick a From/To range and confirm only matching-`created_at` rows remain.
  - Pick a specific executive and confirm only their submitted (`created_by`) rows remain.
  - Combine both filters, then Clear, and confirm the full queue returns.
