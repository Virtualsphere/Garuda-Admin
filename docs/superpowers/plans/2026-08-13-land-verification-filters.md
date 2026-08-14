# Land Verification Queues — Date & Field Executive Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a submission-date range filter and a field-executive filter to all three built Land → Land data → Verification list views (Phone list, Physical list, Verified lands), after first fixing a pre-existing bug where those three views all silently render the same unfiltered full list of lands.

**Architecture:** A one-line backend route fix (wrong controller wired to the physical-verification endpoint) plus a frontend service change to call the three already-correct, dedicated `pending-*` endpoints instead of `/land` (which ignores its query params). On top of that, a new shared React hook (`useFieldExecutiveFilter`) fetches the employee roster and owns the new filter state/predicate; each of the three list components consumes it and renders an identical filter-bar row, following this codebase's existing convention of duplicating per-page markup rather than extracting a shared component.

**Tech Stack:** Backend: Node.js + Express 5 + Sequelize (Postgres), ES modules (`Garuda-Backend-2`). Frontend: React + Vite, plain CSS with CSS custom properties, axios (`garuda ui`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-13-land-verification-filters-design.md` — this plan implements it in full.
- No test suite exists in either repo (per `CLAUDE.md`, confirmed for the backend too). Verification is manual: PowerShell `Invoke-RestMethod` against the local backend (port 5000) for Task 1, and the Playwright browser tool against the local frontend dev server for Tasks 2–5. Login: `test@garuda.io` / `password123` (the established local test admin account per the existing `2026-08-12-land-work-allotment.md` plan) — if that account no longer works, use whatever admin session is already active in the browser tool instead.
- Employee list fetch must use the existing defensive-unwrap pattern used everywhere else in this codebase: `data.data || data.employees || data || []`.
- Field-executive matching must coerce both sides to the same type before comparing (`<select>` values are strings; `created_by` comes back as a number) — use `String(a) === String(b)`, matching how `BuyerEnquiry.jsx`'s `getMediator` and other pickers in this codebase avoid type-mismatch bugs.
- Frontend must reuse existing CSS custom properties (`var(--accent)`, `var(--bg-main)`, `var(--border)`, `var(--text-muted)`, `var(--text-primary)`, `var(--text-secondary)`) — no hardcoded hex colors for themeable elements, matching every other component in `src/components/Land/`.
- oxlint's `react/rules-of-hooks` is an error — all hooks (including the new `useFieldExecutiveFilter()` call) must be called unconditionally at the top of each component, alongside the existing `useState` calls.
- **Git safety:** after every `git add`, run `git status --short` and confirm the staged file list exactly matches what that task's Commit step names, before running `git commit`. Never use `git add -A` or `git add .` anywhere in this plan — name files explicitly.

---

### Task 1: Backend — fix the physical-verification route wiring bug

**Files:**
- Modify: `d:\development\Garuda-Backend-2\src\routes\landRoutes.js:1530`

**Interfaces:**
- Produces: `GET /api/land/pending-physical-verification/:status` now correctly calls `landController.getPendingPhysicalVerificationLands` (which was already implemented and exported, just never wired to a route).
- Consumes: nothing new — `landController.getPendingPhysicalVerificationLands` already exists at `d:\development\Garuda-Backend-2\src\controller\landController.js:283-299` and its underlying service function already exists at `d:\development\Garuda-Backend-2\src\service\landService.js:508-514`.

- [ ] **Step 1: Confirm the local backend is running**

Run (PowerShell):
```powershell
Test-NetConnection -ComputerName localhost -Port 5000 | Select-Object TcpTestSucceeded
```
Expected: `TcpTestSucceeded : True`. If `False`, start it from `d:\development\Garuda-Backend-2` with its configured dev script (check `package.json`'s `scripts` for the exact command, e.g. `npm run dev`) before continuing.

- [ ] **Step 2: Reproduce the bug**

Run (PowerShell):
```powershell
$login = Invoke-RestMethod -Uri "http://localhost:5000/api/employee/login" -Method Post -ContentType "application/json" -Body (@{ email = "test@garuda.io"; password = "password123" } | ConvertTo-Json)
$token = $login.accessToken
$before = Invoke-RestMethod -Uri "http://localhost:5000/api/land/pending-physical-verification/pending" -Headers @{ Authorization = "Bearer $token" }
$before.data | ForEach-Object { $_.call_verification_status }
```
Expected: at least one entry NOT equal to `"complete"` — proving this route is currently returning call-verification-scoped data (the wrong controller) rather than physical-verification-scoped data. (If every entry happens to already be `"complete"`, that's inconclusive but not a blocker — proceed anyway, since the code mismatch is confirmed by reading the source, independent of current data.)

- [ ] **Step 3: Fix the route**

In `d:\development\Garuda-Backend-2\src\routes\landRoutes.js`, line 1530, change:
```js
router.get("/land/pending-physical-verification/:status", verifyToken, landController.getPendingCallVerificationLands);
```
to:
```js
router.get("/land/pending-physical-verification/:status", verifyToken, landController.getPendingPhysicalVerificationLands);
```

- [ ] **Step 4: Verify the fix**

Run (PowerShell):
```powershell
$after = Invoke-RestMethod -Uri "http://localhost:5000/api/land/pending-physical-verification/pending" -Headers @{ Authorization = "Bearer $token" }
$after.data | ForEach-Object { "$($_.call_verification_status) / $($_.physcial_verification_status)" }
```
Expected: every row shows `complete / pending` — confirming the route now returns lands whose call verification is done and physical verification is still pending (matching `getPendingPhysicalVerificationLands`'s actual `where` clause), not the previous (wrong) call-verification-scoped set.

Also confirm the route is still protected:
```powershell
try { Invoke-RestMethod -Uri "http://localhost:5000/api/land/pending-physical-verification/pending" } catch { $_.Exception.Response.StatusCode.value__ }
```
Expected: `401`.

- [ ] **Step 5: Commit**

```bash
cd "/d/development/Garuda-Backend-2"
git status --short
```
Confirm only `src/routes/landRoutes.js` is listed as modified before proceeding.
```bash
git add src/routes/landRoutes.js
git status --short
```
Confirm the staged list shows exactly `src/routes/landRoutes.js` and nothing else, then:
```bash
git commit -m "fix: wire physical-verification route to its own controller

Was calling getPendingCallVerificationLands (a copy-paste mismatch),
so the physical-verification queue returned call-verification-scoped
data instead of its own."
```

---

### Task 2: Frontend — point landService at the correct dedicated endpoints

**Files:**
- Modify: `d:\development\garuda ui\src\services\landService.js:46-74`

**Interfaces:**
- Consumes: Task 1's fixed backend routes — `GET /land/pending-call-verification/:status`, `GET /land/pending-physical-verification/:status`, `GET /land/pending-final-verification/:status` (all pre-existing except the fix from Task 1).
- Produces: `landService.getByVerificationStatus(status)`, `landService.getByCallVerificationStatus(status)`, `landService.getByPhysicalVerificationStatus(status)` keep their existing signatures and `{ success, data }` return shape — no call-site changes needed in `PhoneVerificationList.jsx`, `PhysicalVerificationList.jsx`, or `VerifiedLandsList.jsx` for this task.

- [ ] **Step 1: Replace the three status-filter methods**

In `d:\development\garuda ui\src\services\landService.js`, replace (lines 46-74):
```js
  /**
   * Get lands filtered by verification status
   */
  async getByVerificationStatus(status) {
    const { data } = await apiClient.get('/land', {
      params: { verification_status: status },
    });
    return data;
  },

  /**
   * Get lands filtered by call verification status
   */
  async getByCallVerificationStatus(status) {
    const { data } = await apiClient.get('/land', {
      params: { call_verification_status: status },
    });
    return data;
  },

  /**
   * Get lands filtered by physical verification status
   */
  async getByPhysicalVerificationStatus(status) {
    const { data } = await apiClient.get('/land', {
      params: { physcial_verification_status: status },
    });
    return data;
  },
```
with:
```js
  /**
   * Get lands pending final verification (physical verification already complete)
   */
  async getByVerificationStatus(status) {
    const { data } = await apiClient.get(`/land/pending-final-verification/${status}`);
    return data;
  },

  /**
   * Get lands pending call verification
   */
  async getByCallVerificationStatus(status) {
    const { data } = await apiClient.get(`/land/pending-call-verification/${status}`);
    return data;
  },

  /**
   * Get lands pending physical verification (call verification already complete)
   */
  async getByPhysicalVerificationStatus(status) {
    const { data } = await apiClient.get(`/land/pending-physical-verification/${status}`);
    return data;
  },
```

- [ ] **Step 2: Lint**

```bash
cd "/d/development/garuda ui" && npm run lint
```
Expected: no new errors from `landService.js`.

- [ ] **Step 3: Verify in the browser**

The frontend dev server should be running on port 5173 (`npm run dev` from `d:\development\garuda ui` if not). Using the Playwright browser tool:
1. Navigate to `http://localhost:5173`, log in if needed (`test@garuda.io` / `password123`, or whatever admin session is already active).
2. Click "Land" in the sidebar → "Land data" top tab → "Verification" sub-tab.
3. Note the row count/content on "Phone list".
4. Switch to "Physical list" — confirm the rows shown are now different from "Phone list" (before this task, all three tabs showed the identical full list).
5. Switch to "Verified lands" — confirm this list is different again from the other two.

If any two tabs still show identical content, stop and re-check Task 1's fix landed and the backend picked it up (restart it if it uses a file watcher that may have missed the change).

- [ ] **Step 4: Commit**

```bash
cd "/d/development/garuda ui"
git status --short
```
Confirm only `src/services/landService.js` is listed as modified before proceeding.
```bash
git add src/services/landService.js
git status --short
```
Confirm the staged list shows exactly `src/services/landService.js` and nothing else, then:
```bash
git commit -m "fix: point verification queue fetches at their dedicated endpoints

GET /land ignores its status query params, so getByVerificationStatus,
getByCallVerificationStatus, and getByPhysicalVerificationStatus were
all silently returning the same unfiltered full land list. Switch to
the dedicated pending-* endpoints, which actually filter server-side."
```

---

### Task 3: Frontend — filter hook + wire into Phone list

**Files:**
- Create: `d:\development\garuda ui\src\hooks\useFieldExecutiveFilter.js`
- Modify: `d:\development\garuda ui\src\components\Land\LandDataPage.css` (insert after line 186, before the `.ledger-table-wrap` rule at line 188)
- Modify: `d:\development\garuda ui\src\components\Land\PhoneVerificationList.jsx`

**Interfaces:**
- Produces (hook): `useFieldExecutiveFilter()` → `{ executives: Array<{id, name, ...}>, dateFrom: string, setDateFrom: (string) => void, dateTo: string, setDateTo: (string) => void, executiveId: string, setExecutiveId: (string) => void, matchesFilters: (land) => boolean, hasActiveFilters: boolean, resetFilters: () => void }`.
- Consumes (hook): `employeeService.getAll()` (pre-existing, `src/services/employeeService.js`).
- Consumes (component): `useFieldExecutiveFilter()`, applied to the `land` objects already in each component's `lands` state (each has `.created_by: number` and `.created_at: string` — confirmed against the `Land` Sequelize model in `Garuda-Backend-2`).

- [ ] **Step 1: Write the hook**

Create `d:\development\garuda ui\src\hooks\useFieldExecutiveFilter.js`:
```js
import { useState, useEffect } from 'react';
import employeeService from '../services/employeeService';

const startOfDay = (dateStr) => {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (dateStr) => {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d;
};

export default function useFieldExecutiveFilter() {
  const [executives, setExecutives] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [executiveId, setExecutiveId] = useState('');

  useEffect(() => {
    const fetchExecutives = async () => {
      try {
        const data = await employeeService.getAll();
        const empList = data.data || data.employees || data || [];
        setExecutives(Array.isArray(empList) ? empList : []);
      } catch (err) {
        console.error('Failed to fetch field executives:', err);
      }
    };
    fetchExecutives();
  }, []);

  const matchesFilters = (land) => {
    if (executiveId && String(land.created_by) !== String(executiveId)) return false;
    if (dateFrom || dateTo) {
      if (!land.created_at) return false;
      const created = new Date(land.created_at);
      if (dateFrom && created < startOfDay(dateFrom)) return false;
      if (dateTo && created > endOfDay(dateTo)) return false;
    }
    return true;
  };

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setExecutiveId('');
  };

  return {
    executives,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    executiveId, setExecutiveId,
    matchesFilters,
    hasActiveFilters: Boolean(dateFrom || dateTo || executiveId),
    resetFilters,
  };
}
```

- [ ] **Step 2: Add filter-bar CSS**

In `d:\development\garuda ui\src\components\Land\LandDataPage.css`, insert immediately after line 186 (`.ledger-search input { ... }`'s closing `}`) and before line 188 (`.ledger-table-wrap {`):
```css

/* ── Ledger Filters ── */
.ledger-filters {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  padding: 0 24px 16px 24px;
}

.ledger-filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ledger-filter-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ledger-filter-group input[type="date"],
.ledger-filter-group select {
  background: var(--bg-main);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 13px;
  color: var(--text-primary);
  font-family: inherit;
}

.ledger-filter-group input[type="date"]:focus,
.ledger-filter-group select:focus {
  outline: none;
  border-color: var(--accent);
}

.ledger-filter-clear {
  background: none;
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-family: inherit;
}

.ledger-filter-clear:hover {
  color: var(--accent);
  border-color: var(--accent);
}
```

- [ ] **Step 3: Wire the hook into `PhoneVerificationList.jsx`**

In `d:\development\garuda ui\src\components\Land\PhoneVerificationList.jsx`, replace the imports and state block:
```jsx
import React, { useState, useEffect } from 'react';
import landService from '../../services/landService';
import callingService from '../../services/callingService';

export default function PhoneVerificationList() {
  const [lands, setLands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialingLandId, setDialingLandId] = useState(null);
  const [callError, setCallError] = useState(null);
```
with:
```jsx
import React, { useState, useEffect } from 'react';
import landService from '../../services/landService';
import callingService from '../../services/callingService';
import useFieldExecutiveFilter from '../../hooks/useFieldExecutiveFilter';

export default function PhoneVerificationList() {
  const [lands, setLands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialingLandId, setDialingLandId] = useState(null);
  const [callError, setCallError] = useState(null);
  const {
    executives, dateFrom, setDateFrom, dateTo, setDateTo,
    executiveId, setExecutiveId, matchesFilters, hasActiveFilters, resetFilters,
  } = useFieldExecutiveFilter();
```

- [ ] **Step 4: Combine the new filters with the existing search filter**

In the same file, replace:
```jsx
  const filteredLands = lands.filter(land => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const farmerName = land.farmerDetails?.farmer_name?.toLowerCase() || '';
    return farmerName.includes(q) || String(land.id).includes(q);
  });
```
with:
```jsx
  const filteredLands = lands.filter(land => {
    if (!matchesFilters(land)) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const farmerName = land.farmerDetails?.farmer_name?.toLowerCase() || '';
    return farmerName.includes(q) || String(land.id).includes(q);
  });
```

- [ ] **Step 5: Render the filter bar**

In the same file, replace:
```jsx
        <div className="ledger-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Search Identity..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>
      <div className="ledger-table-wrap">
```
with:
```jsx
        <div className="ledger-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Search Identity..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>
      <div className="ledger-filters">
        <div className="ledger-filter-group">
          <span className="ledger-filter-label">From</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} max={dateTo || undefined} />
        </div>
        <div className="ledger-filter-group">
          <span className="ledger-filter-label">To</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom || undefined} />
        </div>
        <div className="ledger-filter-group">
          <span className="ledger-filter-label">Field executive</span>
          <select value={executiveId} onChange={(e) => setExecutiveId(e.target.value)}>
            <option value="">All executives</option>
            {executives.map((exec) => (
              <option key={exec.id} value={exec.id}>{exec.name}</option>
            ))}
          </select>
        </div>
        {hasActiveFilters && (
          <button type="button" className="ledger-filter-clear" onClick={resetFilters}>
            Clear filters
          </button>
        )}
      </div>
      <div className="ledger-table-wrap">
```

- [ ] **Step 6: Lint**

```bash
cd "/d/development/garuda ui" && npm run lint
```
Expected: no new errors from `useFieldExecutiveFilter.js`, `PhoneVerificationList.jsx`, or `LandDataPage.css`.

- [ ] **Step 7: Verify in the browser**

Using the Playwright browser tool (same session as Task 2's Step 3, or freshly navigate + log in):
1. Go to Land → Land data → Verification → Phone list.
2. Confirm a "From" date box, "To" date box, and "Field executive" dropdown now render below the search bar, and the dropdown is populated with real employee names.
3. Pick a "From" date in the future (after all existing records) — confirm the table shows the empty state ("No pending phone verifications found.").
4. Clear it, instead pick a "From" date far in the past — confirm rows reappear.
5. Pick a specific executive from the dropdown — confirm the row count changes (narrows) unless that executive happens to own every visible row.
6. Confirm the "Clear filters" button appears only once a filter is active, and clicking it resets the table to the full (unfiltered) queue and hides the button again.

Take a screenshot after step 2 to confirm the filter bar's visual placement and styling.

- [ ] **Step 8: Commit**

```bash
cd "/d/development/garuda ui"
git status --short
```
Confirm exactly these three files are listed: `src/hooks/useFieldExecutiveFilter.js` (untracked), `src/components/Land/LandDataPage.css` (modified), `src/components/Land/PhoneVerificationList.jsx` (modified) — and nothing else.
```bash
git add src/hooks/useFieldExecutiveFilter.js src/components/Land/LandDataPage.css src/components/Land/PhoneVerificationList.jsx
git status --short
```
Confirm the staged list matches exactly those three files, then:
```bash
git commit -m "feat: add date and field executive filters to Phone verification queue"
```

---

### Task 4: Frontend — wire filters into Physical list

**Files:**
- Modify: `d:\development\garuda ui\src\components\Land\PhysicalVerificationList.jsx`

**Interfaces:**
- Consumes: `useFieldExecutiveFilter()` from Task 3 (`src/hooks/useFieldExecutiveFilter.js`) and the `.ledger-filters` CSS from Task 3 (`LandDataPage.css`, already shared/loaded).

- [ ] **Step 1: Wire the hook**

In `d:\development\garuda ui\src\components\Land\PhysicalVerificationList.jsx`, replace:
```jsx
import React, { useState, useEffect } from 'react';
import landService from '../../services/landService';

export default function PhysicalVerificationList() {
  const [lands, setLands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
```
with:
```jsx
import React, { useState, useEffect } from 'react';
import landService from '../../services/landService';
import useFieldExecutiveFilter from '../../hooks/useFieldExecutiveFilter';

export default function PhysicalVerificationList() {
  const [lands, setLands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const {
    executives, dateFrom, setDateFrom, dateTo, setDateTo,
    executiveId, setExecutiveId, matchesFilters, hasActiveFilters, resetFilters,
  } = useFieldExecutiveFilter();
```

- [ ] **Step 2: Combine filters**

In the same file, replace:
```jsx
  const filteredLands = lands.filter(land => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const farmerName = land.farmerDetails?.farmer_name?.toLowerCase() || '';
    return farmerName.includes(q) || String(land.id).includes(q);
  });
```
with:
```jsx
  const filteredLands = lands.filter(land => {
    if (!matchesFilters(land)) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const farmerName = land.farmerDetails?.farmer_name?.toLowerCase() || '';
    return farmerName.includes(q) || String(land.id).includes(q);
  });
```

- [ ] **Step 3: Render the filter bar**

In the same file, replace:
```jsx
        <div className="ledger-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Search Identity..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>
      <div className="ledger-table-wrap">
```
with:
```jsx
        <div className="ledger-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Search Identity..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>
      <div className="ledger-filters">
        <div className="ledger-filter-group">
          <span className="ledger-filter-label">From</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} max={dateTo || undefined} />
        </div>
        <div className="ledger-filter-group">
          <span className="ledger-filter-label">To</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom || undefined} />
        </div>
        <div className="ledger-filter-group">
          <span className="ledger-filter-label">Field executive</span>
          <select value={executiveId} onChange={(e) => setExecutiveId(e.target.value)}>
            <option value="">All executives</option>
            {executives.map((exec) => (
              <option key={exec.id} value={exec.id}>{exec.name}</option>
            ))}
          </select>
        </div>
        {hasActiveFilters && (
          <button type="button" className="ledger-filter-clear" onClick={resetFilters}>
            Clear filters
          </button>
        )}
      </div>
      <div className="ledger-table-wrap">
```

- [ ] **Step 4: Lint**

```bash
cd "/d/development/garuda ui" && npm run lint
```
Expected: no new errors from `PhysicalVerificationList.jsx`.

- [ ] **Step 5: Verify in the browser**

Using the Playwright browser tool:
1. Navigate to Land → Land data → Verification → Physical list.
2. Confirm a "From" date box, "To" date box, and "Field executive" dropdown render below the search bar, and the dropdown is populated with real employee names.
3. Pick a "From" date in the future (after all existing records) — confirm the table shows the empty state ("No pending physical verifications found.").
4. Clear it, instead pick a "From" date far in the past — confirm rows reappear.
5. Pick a specific executive from the dropdown — confirm the row count changes (narrows) unless that executive happens to own every visible row.
6. Confirm the "Clear filters" button appears only once a filter is active, and clicking it resets the table to the full (unfiltered) queue and hides the button again.

Take a screenshot after step 2 to confirm the filter bar's visual placement and styling.

- [ ] **Step 6: Commit**

```bash
cd "/d/development/garuda ui"
git status --short
```
Confirm exactly `src/components/Land/PhysicalVerificationList.jsx` is listed as modified.
```bash
git add src/components/Land/PhysicalVerificationList.jsx
git status --short
```
Confirm the staged list matches exactly that one file, then:
```bash
git commit -m "feat: add date and field executive filters to Physical verification queue"
```

---

### Task 5: Frontend — wire filters into Verified lands

**Files:**
- Modify: `d:\development\garuda ui\src\components\Land\VerifiedLandsList.jsx`

**Interfaces:**
- Consumes: `useFieldExecutiveFilter()` from Task 3 and the `.ledger-filters` CSS from Task 3 (same as Task 4).

- [ ] **Step 1: Wire the hook**

In `d:\development\garuda ui\src\components\Land\VerifiedLandsList.jsx`, replace:
```jsx
import React, { useState, useEffect } from 'react';
import landService from '../../services/landService';

export default function VerifiedLandsList() {
  const [lands, setLands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
```
with:
```jsx
import React, { useState, useEffect } from 'react';
import landService from '../../services/landService';
import useFieldExecutiveFilter from '../../hooks/useFieldExecutiveFilter';

export default function VerifiedLandsList() {
  const [lands, setLands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const {
    executives, dateFrom, setDateFrom, dateTo, setDateTo,
    executiveId, setExecutiveId, matchesFilters, hasActiveFilters, resetFilters,
  } = useFieldExecutiveFilter();
```

- [ ] **Step 2: Combine filters**

In the same file, replace:
```jsx
  const filteredLands = lands.filter(land => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const farmerName = land.farmerDetails?.farmer_name?.toLowerCase() || '';
    return farmerName.includes(q) || String(land.id).includes(q);
  });
```
with:
```jsx
  const filteredLands = lands.filter(land => {
    if (!matchesFilters(land)) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const farmerName = land.farmerDetails?.farmer_name?.toLowerCase() || '';
    return farmerName.includes(q) || String(land.id).includes(q);
  });
```

- [ ] **Step 3: Render the filter bar**

In the same file, replace:
```jsx
        <div className="ledger-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Search Identity..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>
      <div className="ledger-table-wrap">
```
with:
```jsx
        <div className="ledger-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Search Identity..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>
      <div className="ledger-filters">
        <div className="ledger-filter-group">
          <span className="ledger-filter-label">From</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} max={dateTo || undefined} />
        </div>
        <div className="ledger-filter-group">
          <span className="ledger-filter-label">To</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom || undefined} />
        </div>
        <div className="ledger-filter-group">
          <span className="ledger-filter-label">Field executive</span>
          <select value={executiveId} onChange={(e) => setExecutiveId(e.target.value)}>
            <option value="">All executives</option>
            {executives.map((exec) => (
              <option key={exec.id} value={exec.id}>{exec.name}</option>
            ))}
          </select>
        </div>
        {hasActiveFilters && (
          <button type="button" className="ledger-filter-clear" onClick={resetFilters}>
            Clear filters
          </button>
        )}
      </div>
      <div className="ledger-table-wrap">
```

- [ ] **Step 4: Lint**

```bash
cd "/d/development/garuda ui" && npm run lint
```
Expected: no new errors from `VerifiedLandsList.jsx`.

- [ ] **Step 5: Verify in the browser**

Using the Playwright browser tool:
1. Navigate to Land → Land data → Verification → Verified lands.
2. Confirm a "From" date box, "To" date box, and "Field executive" dropdown render below the search bar, and the dropdown is populated with real employee names.
3. Pick a "From" date in the future (after all existing records) — confirm the table shows the empty state ("No verified lands found.").
4. Clear it, instead pick a "From" date far in the past — confirm rows reappear.
5. Pick a specific executive from the dropdown — confirm the row count changes (narrows) unless that executive happens to own every visible row.
6. Confirm the "Clear filters" button appears only once a filter is active, and clicking it resets the table to the full (unfiltered) queue and hides the button again.

Take a screenshot after step 2 to confirm the filter bar's visual placement and styling.

As a final end-to-end check, confirm all three tabs (Phone list, Physical list, Verified lands) now each show their own distinct queue (different row sets from one another) and each has a working filter bar.

- [ ] **Step 6: Commit**

```bash
cd "/d/development/garuda ui"
git status --short
```
Confirm exactly `src/components/Land/VerifiedLandsList.jsx` is listed as modified.
```bash
git add src/components/Land/VerifiedLandsList.jsx
git status --short
```
Confirm the staged list matches exactly that one file, then:
```bash
git commit -m "feat: add date and field executive filters to Verified lands ledger"
```
