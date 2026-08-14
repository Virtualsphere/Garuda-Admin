# Land Signal Hub — Design Spec

Date: 2026-08-12
Status: Approved (frontend + backend sections both confirmed by user)

## Summary

Add a "Land Signal Hub" — a calls/signal-tracking page — under the Land section's existing "Calls" top tab (currently a "coming soon" placeholder in `App.jsx`). It follows the same pattern already built for `FarmersCallsPage.jsx` (tiered ledger + metrics + trend chart), extended with real Head/Team Leader/Executive tier derivation and land-record linkage.

Two repos are touched:
- `d:\development\garuda ui` (frontend, this repo)
- `d:\development\Garuda-Backend-2` (backend, Express 5 + Sequelize 6 + Postgres)

## Context / what already exists

- `App.jsx`'s `landTopTabs` already lists Land data / Work allotment / Wallet / Department / **Calls** / Boards / Dashboard, but the `calls` tab currently falls through to a generic placeholder — no `LandCallsPage` component exists.
- `src/components/Farmers/FarmersCallsPage.jsx` is the closest existing template: Head/Team Leader/Executive sub-tabs, a signal ledger table, a metrics card, a "Squad Performance Audit" table, a static 7-day trend SVG chart, and click-to-call wiring via `callingService.clickToCall`.
- `src/components/SignalAuditHub/SignalAuditHub.jsx` is a second, separately-built version (used for Call Center) with an inline inbound panel and a decorative (non-functional) trend section — not the template to follow here, since `FarmersCallsPage` is the closer visual/functional match to the two reference screenshots.
- `src/components/InboundSignals/InboundSignals.jsx` is a global floating "Inbound Signals (N)" bar rendered by `App.jsx` for every section except Call Center's Calls tab. Land's Calls tab will get this automatically with no changes needed.
- `src/services/callSignalService.js` (`getAll`, `getMetrics`, `create`, `updateStatus`) and `src/services/callingService.js` (`clickToCall`) are generic across `department_type` and already accept `landId` — confirmed end-to-end in the backend's `callingController.js`, which already threads `landId` into the created `CallSignal` row.
- `src/services/departmentLeaderService.js` (`setAllotment`, `getRoster`, `removeAllotment`) wraps the backend's `department_leaders` table — a flat `leader_id → employee_id` mapping per `department_type`, with **no explicit tier/rank field**.
- `src/components/Land/PhoneVerificationList.jsx` is the existing "pending phone verification" queue for land records (each row has a `land.farmerDetails.farmer_name` / `farmer_phone` and a land `id`), but has no calling capability today — only a "START VETTING" button.
- Backend `CallSignal` model (`callSignalModel.js`) already has `land_id`, `department_type`, `employee_id`, `direction`, `duration_seconds`, `missed`, `status`, `mission_context`, `caller_name`, `caller_phone` — no migration needed. `department_type` and `status` are free-text strings with no enum/whitelist anywhere in the backend, so `'land'` is already a legal value.
- Backend `Land` model has no human-readable `land_code` field — the `LC00X`/`L00X` codes are a frontend-only formatting of the numeric `id` (already done this way in `PhoneVerificationList.jsx`: `` `L${String(land.id).padStart(3, '0')}` ``).

## Backend changes (Garuda-Backend-2)

1. **New endpoint**: `GET /api/department-leader/tree?departmentType=land`
   - Returns all `department_leaders` rows for the given `department_type` (i.e. `[{ employee_id, leader_id }, ...]`, no filtering by a specific leader).
   - Implemented as a new function in `departmentLeaderService.js` (e.g. `getDepartmentTree`), a matching controller function, and a new route in `departmentLeaderRoutes.js`, following the existing `verifyToken`-only pattern used by the other department-leader routes.
   - Purpose: lets the frontend compute each employee's tier by chain position without needing a new schema field (see "Tier derivation" below).

2. **Add `land_id` as an optional filter** on:
   - `GET /call-signal` (`getAllCallSignals` in `callSignalService.js`) — add `if (land_id) whereClause.land_id = land_id;` alongside the existing `department_type`/`employee_id`/`direction`/`status` filters.
   - `GET /call-signal/metrics` (`getCallSignalMetrics`) — same addition, so land-scoped metrics are possible later if needed (not required by this feature's UI, but trivial to include for consistency and used by the design if a specific land's metrics are ever needed).

3. **No model or migration changes.** `department_type: 'land'` and `land_id` already flow end-to-end via the existing MyOperator click-to-call integration (`callingController.js` → `callSignalService.createCallSignal`).

## Frontend changes (garuda ui)

### 1. `src/components/Land/LandCallsPage.jsx` + `.css` (new)

Modeled on `FarmersCallsPage.jsx`'s structure and CSS conventions (new `.css` file, not shared with Farmers', per the codebase's per-component-CSS convention), with these Land-specific differences:

- **Header**: title "LANDS SIGNAL HUB", subtitle "TIER: {HEAD|TL|EXEC} OVERSIGHT" driven by `activeTab` state (`'head' | 'team_leader' | 'executive'`), search input ("Filter signals...").
- **Tier tabs with real access derivation** (this is the key difference from `FarmersCallsPage`, which has no real tier logic):
  - On mount, fetch `departmentLeaderService.getTree('land')` and the current logged-in employee's id (from `useAuth()`).
  - Compute the current user's tier from the tree:
    - Appears as `leader_id` but never as `employee_id` → **Head**
    - Appears as both `employee_id` and `leader_id` → **Team Leader**
    - Appears as `employee_id` only → **Executive**
    - Doesn't appear at all → treat as Executive-level (most restrictive) as a safe default
  - Tabs for tiers *above* the user's own tier are rendered disabled/greyed (not clickable): a Head sees all three enabled; a Team Leader sees Team Leader + Executive enabled, Head disabled; an Executive sees only Executive enabled. Default `activeTab` is the user's own tier.
  - This matches the two reference screenshots: screenshot 1 (Executive-tier view) shows Head/Team Leader greyed out; screenshot 2 (Team Leader-tier view) shows Head greyed out with Team Leader active and Executive available.
- **Ledger table** ("LANDS MISSION SIGNAL LEDGER"), columns:
  - Signal Identity: caller name, phone, and an `L{id}`-style badge built from `call.land_id`, using the exact same format `PhoneVerificationList.jsx` already uses (`` `L${String(id).padStart(3, '0')}` ``) — standardizing on one land-code format across the app rather than introducing a second "LC"-prefixed variant
  - Mission Context
  - Executive (shown only in Team Leader/Head views, same conditional pattern as `FarmersCallsPage`)
  - Duration + call timestamp
  - Voice Registry: play icon (decorative/disabled — see limitations) + call icon wired to `callingService.clickToCall`
  - Data source: `callSignalService.getAll({ department_type: 'land' })`, optionally further filtered client-side by the roster under the active tier (e.g. Team Leader view shows only calls from their direct-report executives, from `departmentLeaderService.getRoster(currentUserId, 'land')`)
- **Right column**:
  - Signal Metrics card: talk time today, attended count, missed count via `callSignalService.getMetrics({ department_type: 'land' })`
  - Squad Performance Audit (Team Leader/Head views only): per-employee metrics for direct reports, same pattern as `FarmersCallsPage`'s squad audit but sourced from the real roster (`departmentLeaderService.getRoster`) instead of a role-string filter
  - 7-Day Trend chart: static illustrative SVG curve, same as `FarmersCallsPage` (see limitations)
- **No inline inbound panel** — relies on the existing global `<InboundSignals />` floating bar already rendered by `App.jsx`.

### 2. `App.jsx`

Replace the placeholder for `activeSection === 'land' && activeTab === 'calls'` with `<LandCallsPage />`. No changes needed to the `InboundSignals` exclusion condition (it already only excludes Call Center's Calls tab).

### 3. `src/components/Land/PhoneVerificationList.jsx`

Add a "Call" action button per row, alongside the existing "START VETTING" button, calling:

```js
callingService.clickToCall({
  customerNumber: land.farmerDetails?.farmer_phone,
  departmentType: 'land',
  callerName: land.farmerDetails?.farmer_name,
  missionContext: `Inquiry about ${code} verification status`,
  landId: land.id,
});
```

This is the "call originates from a land record" flow — the resulting `CallSignal` carries `land_id`, so it appears in the new Land Signal Hub ledger with its `L{id}` badge. Button should show a loading/disabled state while dialing and surface errors the same way `FarmersCallsPage.handleDial` does.

### 4. `src/services/departmentLeaderService.js`

Add `getTree(departmentType)`:

```js
async getTree(departmentType) {
  const { data } = await apiClient.get('/department-leader/tree', { params: { departmentType } });
  return data;
},
```

## Known limitations (explicitly deferred, YAGNI)

- **7-day trend chart is static/illustrative**, not real historical data — no backend daily-aggregation endpoint exists for call signals, and `FarmersCallsPage`'s existing chart is already the same static shape, so this matches existing fidelity rather than under-delivering relative to the current codebase.
- **Voice "play" button stays decorative/disabled** — no recording URL field or telephony recording webhook exists in the backend (`CallSignal` has no `recording_url` column).
- **Call action added only to `PhoneVerificationList`**, not `VerifiedLandsList`/`PhysicalVerificationList` — that page is specifically the "call farmers about their land" workflow; other list pages can get a call button later if wanted.
- **No backend enum/whitelist added** for `department_type` or `status` — none currently exists anywhere in the backend codebase, so this feature doesn't introduce inconsistency, just follows existing convention.

## Testing

No test suite is configured in either repo (per `CLAUDE.md`). Verification will be manual: run both dev servers, exercise the Land Calls tab in each tier (by adjusting `department_leaders` rows for a test account), and confirm a call placed from `PhoneVerificationList` appears in the ledger with the correct land badge.
