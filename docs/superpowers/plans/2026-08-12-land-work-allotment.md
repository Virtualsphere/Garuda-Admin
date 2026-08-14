# Land Work Allotment (Villages Allotment) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "Villages Allotment" sub-tab of Land → Work Allotment: a live per-village land-stats grid (from `Garuda-Backend-2`) plus a personnel selector that lets an admin allot a village to a field executive.

**Architecture:** A new read-only aggregation endpoint (`GET /fieldwork/village-stats`) groups `land` rows by `(village, mandal)` and counts by existing status enums. The frontend adds one new page component that fetches this endpoint and reuses the *existing* `POST /fieldwork/assigned-village` endpoint to perform the actual allotment — no new write path, no new DB table.

**Tech Stack:** Backend: Node.js + Express 5 + Sequelize (Postgres), ES modules. Frontend: React + Vite, plain CSS with CSS custom properties, axios.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-12-land-work-allotment-design.md` — this plan implements it in full for the "Villages Allotment" sub-tab; Data Tasks / Mission Profile and the MAP toggle are explicitly out of scope (disabled placeholders only).
- No test suite exists in either repo. Verification is manual: PowerShell `Invoke-RestMethod` against the already-running local backend (port 5000) for Task 1, and the Playwright browser tool against the already-running local frontend dev server (port 5173) for Task 2. Login credentials for verification: `test@garuda.io` / `password123`.
- Backend response shape convention: `{ message, result, count? }` on success, `{ message }` on error (matches every existing handler in `fieldWorkController.js`).
- Backend aggregation must use `fn`/`col`/`literal` imported from the `"sequelize"` package (not the `sequelize` db instance) — this matches the only existing precedent (`src/service/agentService.js`'s `getAgentsByLocation`).
- Frontend must reuse existing CSS custom properties (`var(--accent)`, `var(--accent-shadow)`, etc.) — no hardcoded hex colors for themeable elements — matching every other component in `src/components/Land/` and `src/components/Farmers/`.
- Frontend employee fetch must use the same defensive-unwrap pattern already used elsewhere: `data.data || data.employees || data || []`.
- oxlint's `react/rules-of-hooks` is an error — all hooks must be called unconditionally at the top of the component.

---

### Task 1: Backend — village-stats aggregation endpoint

**Files:**
- Modify: `d:\development\Garuda-Backend-2\src\service\landService.js:18` (import line) and after `landService.js:654` (new function)
- Modify: `d:\development\Garuda-Backend-2\src\controller\fieldWorkController.js` (after line 113, end of `getAllAssignedVillages`)
- Modify: `d:\development\Garuda-Backend-2\src\routes\fieldWorkRoutes.js` (after line 199, before the `SESSION MANAGEMENT` comment block at line 201)

**Interfaces:**
- Produces: `GET /api/fieldwork/village-stats?employeeId=<optional integer>` (protected by `verifyToken`), returning `{ message: string, count: number, result: Array<{ village: string, mandal: string, total: number, verified: number, physicalAudit: number, fillDetails: number }> }`. When `employeeId` is provided, villages already assigned to that employee (via `assigned_village.assigned_employee_id`) are excluded from `result`.
- Consumes: existing `Land` and `AssignedVillage` Sequelize models (already imported in `landService.js`), existing `verifyToken` middleware (already imported in `fieldWorkRoutes.js`).

- [ ] **Step 1: Update the sequelize import in `landService.js`**

In `d:\development\Garuda-Backend-2\src\service\landService.js`, change line 18 from:
```js
import { Op } from "sequelize";
```
to:
```js
import { Op, fn, col, literal } from "sequelize";
```

- [ ] **Step 2: Add `getVillageAllotmentStats` to `landService.js`**

Insert this new exported function immediately after line 653 (the closing `};` of `getAssignedVillagesByEmployee`) and before the `// Paths` section comment on line 655:

```js

export const getVillageAllotmentStats = async (employeeId) => {
  const rows = await Land.findAll({
    attributes: [
      "village",
      "mandal",
      [fn("COUNT", col("id")), "total"],
      [fn("COUNT", literal("CASE WHEN verification_status = 'complete' THEN 1 END")), "verified"],
      [fn("COUNT", literal("CASE WHEN physcial_verification_status = 'complete' THEN 1 END")), "physical_audit"],
      [fn("COUNT", literal("CASE WHEN form_status = 'complete' THEN 1 END")), "fill_details"],
    ],
    where: { trainee: false },
    group: ["village", "mandal"],
    raw: true,
  });

  let excluded = new Set();
  if (employeeId) {
    const assigned = await AssignedVillage.findAll({
      where: { assigned_employee_id: employeeId },
      attributes: ["village", "mandal"],
      raw: true,
    });
    excluded = new Set(assigned.map((a) => `${a.village}|${a.mandal}`));
  }

  return rows
    .filter((row) => !excluded.has(`${row.village}|${row.mandal}`))
    .map((row) => ({
      village: row.village,
      mandal: row.mandal,
      total: parseInt(row.total, 10),
      verified: parseInt(row.verified, 10),
      physicalAudit: parseInt(row.physical_audit, 10),
      fillDetails: parseInt(row.fill_details, 10),
    }));
};
```

- [ ] **Step 3: Add the controller handler**

In `d:\development\Garuda-Backend-2\src\controller\fieldWorkController.js`, insert this new exported function immediately after line 113 (the closing `};` of `getAllAssignedVillages`):

```js

export const getVillageAllotmentStats = async (req, res) => {
  try {
    const { employeeId } = req.query;
    const result = await landService.getVillageAllotmentStats(
      employeeId ? Number(employeeId) : undefined
    );

    return res.status(200).json({
      message: "Village allotment stats fetched successfully",
      count: result.length,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Something went wrong",
    });
  }
};
```

- [ ] **Step 4: Add the route**

In `d:\development\Garuda-Backend-2\src\routes\fieldWorkRoutes.js`, insert this immediately after line 199 (`router.delete("/fieldwork/assigned-village/:id", ...)`) and before the `SESSION MANAGEMENT` section comment on line 201:

```js

/**
 * @swagger
 * /api/fieldwork/village-stats:
 *   get:
 *     summary: Get live per-village land stats for allotment (JWT required)
 *     tags: [FieldWork]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: employeeId
 *         schema:
 *           type: integer
 *         description: When provided, excludes villages already assigned to this employee
 *     responses:
 *       200:
 *         description: Village stats fetched successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/fieldwork/village-stats", verifyToken, fieldWorkController.getVillageAllotmentStats);
```

- [ ] **Step 5: Verify the backend picks up the change**

The local backend (port 5000) runs via a file-watcher (confirmed already running against this codebase). Confirm it reloaded without syntax errors by checking it's still listening:

Run (PowerShell):
```powershell
Test-NetConnection -ComputerName localhost -Port 5000 | Select-Object TcpTestSucceeded
```
Expected: `TcpTestSucceeded : True`. If the process crashed on reload, restart it with `npm run dev` (or the project's configured start script) from `d:\development\Garuda-Backend-2` and re-check.

- [ ] **Step 6: Verify the new endpoint end-to-end**

Run (PowerShell):
```powershell
$login = Invoke-RestMethod -Uri "http://localhost:5000/api/employee/login" -Method Post -ContentType "application/json" -Body (@{ email = "test@garuda.io"; password = "password123" } | ConvertTo-Json)
$token = $login.accessToken
Invoke-RestMethod -Uri "http://localhost:5000/api/fieldwork/village-stats" -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json -Depth 5
```
Expected: JSON with `message`, `count`, and a `result` array containing at least one entry with `village` set (e.g. `"Kondapur"`) and numeric `total`/`verified`/`physicalAudit`/`fillDetails` fields.

Then verify the `employeeId` exclusion path doesn't error (any employee id works, e.g. the logged-in test admin's own id from `$login.data.id`):
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/fieldwork/village-stats?employeeId=$($login.data.id)" -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json -Depth 5
```
Expected: 200 response with a `result` array (same shape, possibly fewer/equal entries).

Also verify the route is actually protected:
```powershell
try { Invoke-RestMethod -Uri "http://localhost:5000/api/fieldwork/village-stats" } catch { $_.Exception.Response.StatusCode.value__ }
```
Expected: `401`.

- [ ] **Step 7: Commit**

```bash
cd "/d/development/Garuda-Backend-2"
git add src/service/landService.js src/controller/fieldWorkController.js src/routes/fieldWorkRoutes.js
git commit -m "Add village-stats aggregation endpoint for Land work allotment"
```

---

### Task 2: Frontend — Villages Allotment page

**Files:**
- Modify: `d:\development\garuda ui\src\services\assignedVillageService.js` (add `getVillageStats`)
- Create: `d:\development\garuda ui\src\components\Land\LandWorkAllotmentPage.css`
- Create: `d:\development\garuda ui\src\components\Land\LandWorkAllotmentPage.jsx`
- Modify: `d:\development\garuda ui\src\App.jsx` (import + render block)

**Interfaces:**
- Consumes: `assignedVillageService.getVillageStats({ employeeId })` → `Promise<{ message, count, result: Array<{ village, mandal, total, verified, physicalAudit, fillDetails }> }>` (Task 1's endpoint); `assignedVillageService.create({ target, assignedEmployeeId, village, mandal, assignedStatus })` (pre-existing); `employeeService.getAll()` (pre-existing).
- Produces: `LandWorkAllotmentPage` default-exported React component, rendered by `App.jsx` when `activeSection === 'land' && activeTab === 'work-allotment'`.

- [ ] **Step 1: Add `getVillageStats` to `assignedVillageService.js`**

In `d:\development\garuda ui\src\services\assignedVillageService.js`, insert this method immediately after `getByEmployee` (after line 12, before `create`):

```js

  async getVillageStats({ employeeId } = {}) {
    const { data } = await apiClient.get('/fieldwork/village-stats', {
      params: employeeId ? { employeeId } : {},
    });
    return data;
  },
```

- [ ] **Step 2: Write `LandWorkAllotmentPage.css`**

Create `d:\development\garuda ui\src\components\Land\LandWorkAllotmentPage.css`:

```css
/* ── Land Work Allotment Page Layout ── */
.lwa-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 24px;
  height: 100%;
  overflow: hidden;
}

/* ── Sub Tabs ── */
.lwa-sub-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  margin: 24px 0 16px 0;
  background: var(--bg-white);
  border-radius: 30px;
  width: fit-content;
  box-shadow: var(--shadow);
}

.lwa-sub-tab {
  padding: 8px 20px;
  border-radius: 24px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  background: none;
  border: none;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
}

.lwa-sub-tab:hover:not(:disabled) {
  color: var(--text-primary);
  background: rgba(128, 128, 128, 0.06);
}

.lwa-sub-tab.active {
  background: var(--bg-white);
  color: var(--accent);
  border: 1px solid var(--accent);
  box-shadow: 0 2px 6px var(--accent-shadow);
}

.lwa-sub-tab:disabled {
  color: var(--text-muted);
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── LVE Context Banner ── */
.lwa-banner {
  background: var(--accent-gradient);
  border-radius: var(--radius-xl);
  padding: 20px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  color: #ffffff;
}

.lwa-banner-person {
  display: flex;
  align-items: center;
  gap: 16px;
}

.lwa-banner-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
}

.lwa-banner-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lwa-banner-name {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.lwa-banner-role {
  display: inline-block;
  margin-top: 6px;
  padding: 4px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.2);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.lwa-banner-context {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.lwa-banner-context-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.75);
}

.lwa-banner-context select {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  padding: 8px 16px;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  min-width: 220px;
  appearance: auto;
}

.lwa-banner-context select option {
  color: #1a1a2e;
}

/* ── Body: Personnel + Villages ── */
.lwa-body {
  flex: 1;
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 20px;
  overflow: hidden;
  padding-bottom: 16px;
}

.lwa-personnel-card {
  background: var(--bg-white);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow);
  padding: 20px;
  align-self: start;
}

.lwa-personnel-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 16px;
}

.lwa-personnel-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  display: block;
}

.lwa-personnel-card select {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-main);
  appearance: auto;
}

/* ── Villages Panel ── */
.lwa-villages-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lwa-villages-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.lwa-view-toggle {
  display: flex;
  align-items: center;
  background: var(--bg-white);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 4px;
}

.lwa-view-toggle button {
  padding: 8px 20px;
  border-radius: 16px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
}

.lwa-view-toggle button.active {
  background: var(--accent);
  color: #ffffff;
}

.lwa-view-toggle button:disabled {
  color: var(--text-muted);
  opacity: 0.5;
  cursor: not-allowed;
}

.lwa-allotable-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.lwa-search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-white);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 8px 16px;
  min-width: 220px;
}

.lwa-search input {
  background: transparent;
  font-size: 13px;
  color: var(--text-primary);
  width: 100%;
}

.lwa-grid-scroll {
  flex: 1;
  overflow-y: auto;
}

.lwa-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  padding-bottom: 16px;
}

.lwa-card {
  background: var(--bg-white);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lwa-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.lwa-card-village {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.lwa-card-mandal {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-top: 2px;
}

.lwa-card-target {
  background: #3b82f6;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 12px;
  flex-shrink: 0;
}

.lwa-card-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lwa-card-stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
}

.lwa-card-stat-label {
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.lwa-card-stat-value {
  font-weight: 700;
  color: var(--text-primary);
}

.lwa-card-stat-value.zero {
  color: var(--text-muted);
}

.lwa-allot-btn {
  background: var(--accent);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 12px 20px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px var(--accent-shadow);
}

.lwa-allot-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px var(--accent-shadow-lg);
}

.lwa-allot-btn:disabled {
  background: var(--border);
  color: var(--text-muted);
  cursor: not-allowed;
  box-shadow: none;
}

.lwa-error-banner {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  font-size: 12px;
  font-weight: 600;
  padding: 10px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.lwa-empty,
.lwa-loading {
  padding: 40px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.lwa-placeholder {
  padding: 24px;
  color: var(--text-muted);
}
```

- [ ] **Step 3: Write `LandWorkAllotmentPage.jsx`**

Create `d:\development\garuda ui\src\components\Land\LandWorkAllotmentPage.jsx`:

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import employeeService from '../../services/employeeService';
import assignedVillageService from '../../services/assignedVillageService';
import './LandWorkAllotmentPage.css';

export default function LandWorkAllotmentPage() {
  const [activeSubTab, setActiveSubTab] = useState('villages');

  const [employees, setEmployees] = useState([]);
  const [selectedExecutiveId, setSelectedExecutiveId] = useState('');

  const [villages, setVillages] = useState([]);
  const [villagesLoading, setVillagesLoading] = useState(true);
  const [villagesError, setVillagesError] = useState(null);

  const [search, setSearch] = useState('');
  const [allottingKey, setAllottingKey] = useState(null);
  const [allotError, setAllotError] = useState(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const data = await employeeService.getAll();
        const empList = data.data || data.employees || data || [];
        setEmployees(Array.isArray(empList) ? empList : []);
      } catch (err) {
        console.error('Failed to fetch employees:', err);
      }
    };
    fetchEmployees();
  }, []);

  const fetchVillages = useCallback(async () => {
    setVillagesLoading(true);
    setVillagesError(null);
    try {
      const data = await assignedVillageService.getVillageStats(
        selectedExecutiveId ? { employeeId: selectedExecutiveId } : {}
      );
      setVillages(data.result || []);
    } catch (err) {
      console.error('Failed to fetch village stats:', err);
      setVillagesError('Failed to load villages. Please try again.');
    } finally {
      setVillagesLoading(false);
    }
  }, [selectedExecutiveId]);

  useEffect(() => {
    fetchVillages();
  }, [fetchVillages]);

  const selectedExecutive = employees.find((e) => String(e.id) === String(selectedExecutiveId));

  const filteredVillages = villages.filter((v) => {
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return v.village?.toLowerCase().includes(term) || v.mandal?.toLowerCase().includes(term);
  });

  const handleAllot = async (villageStat) => {
    if (!selectedExecutiveId) return;
    const key = `${villageStat.village}|${villageStat.mandal}`;
    setAllottingKey(key);
    setAllotError(null);
    try {
      await assignedVillageService.create({
        target: villageStat.total,
        assignedEmployeeId: selectedExecutiveId,
        village: villageStat.village,
        mandal: villageStat.mandal,
        assignedStatus: 'ongoing',
      });
      await fetchVillages();
    } catch (err) {
      console.error('Failed to allot village:', err);
      setAllotError(`Failed to allot ${villageStat.village}. Please try again.`);
    } finally {
      setAllottingKey(null);
    }
  };

  return (
    <div className="lwa-page">
      <div className="lwa-sub-tabs">
        <button
          className={`lwa-sub-tab${activeSubTab === 'villages' ? ' active' : ''}`}
          onClick={() => setActiveSubTab('villages')}
        >
          Villages allotment
        </button>
        <button className="lwa-sub-tab" disabled title="Coming soon">
          Data tasks
        </button>
        <button className="lwa-sub-tab" disabled title="Coming soon">
          Mission profile
        </button>
      </div>

      {activeSubTab !== 'villages' ? (
        <div className="lwa-placeholder">Page coming soon...</div>
      ) : (
        <>
          <div className="lwa-banner">
            <div className="lwa-banner-person">
              <div className="lwa-banner-avatar">
                <img
                  src={selectedExecutive?.photo || `https://i.pravatar.cc/150?u=${selectedExecutive?.id || 'lve'}`}
                  alt={selectedExecutive?.name || 'No executive selected'}
                />
              </div>
              <div>
                <div className="lwa-banner-name">
                  {selectedExecutive?.name || 'Select an executive'}
                </div>
                <span className="lwa-banner-role">Land Verification Executive</span>
              </div>
            </div>
            <div className="lwa-banner-context">
              <span className="lwa-banner-context-label">LVE Context</span>
              <select
                value={selectedExecutiveId}
                onChange={(e) => setSelectedExecutiveId(e.target.value)}
              >
                <option value="">Select executive</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="lwa-body">
            <div className="lwa-personnel-card">
              <div className="lwa-personnel-title">Personnel Selection</div>
              <label className="lwa-personnel-label" htmlFor="lwa-active-executive">Active Executive</label>
              <select
                id="lwa-active-executive"
                value={selectedExecutiveId}
                onChange={(e) => setSelectedExecutiveId(e.target.value)}
              >
                <option value="">Select an executive</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>

            <div className="lwa-villages-panel">
              <div className="lwa-villages-header">
                <div className="lwa-view-toggle">
                  <button className="active">List</button>
                  <button disabled title="Coming soon">Map</button>
                </div>
                <span className="lwa-allotable-label">Allotable villages</span>
                <div className="lwa-search">
                  <input
                    type="text"
                    placeholder="Search node..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {allotError && <div className="lwa-error-banner">{allotError}</div>}
              {villagesError && <div className="lwa-error-banner">{villagesError}</div>}

              <div className="lwa-grid-scroll">
                {villagesLoading ? (
                  <div className="lwa-loading">Loading villages...</div>
                ) : filteredVillages.length === 0 ? (
                  <div className="lwa-empty">No allotable villages found.</div>
                ) : (
                  <div className="lwa-grid">
                    {filteredVillages.map((v) => {
                      const key = `${v.village}|${v.mandal}`;
                      return (
                        <div className="lwa-card" key={key}>
                          <div className="lwa-card-head">
                            <div>
                              <div className="lwa-card-village">{v.village}</div>
                              <div className="lwa-card-mandal">{v.mandal}</div>
                            </div>
                            <span className="lwa-card-target">T: {v.total}</span>
                          </div>
                          <div className="lwa-card-stats">
                            <div className="lwa-card-stat-row">
                              <span className="lwa-card-stat-label">Verified</span>
                              <span className={`lwa-card-stat-value${v.verified === 0 ? ' zero' : ''}`}>{v.verified}</span>
                            </div>
                            <div className="lwa-card-stat-row">
                              <span className="lwa-card-stat-label">Physical audit</span>
                              <span className={`lwa-card-stat-value${v.physicalAudit === 0 ? ' zero' : ''}`}>{v.physicalAudit}</span>
                            </div>
                            <div className="lwa-card-stat-row">
                              <span className="lwa-card-stat-label">Fill details</span>
                              <span className={`lwa-card-stat-value${v.fillDetails === 0 ? ' zero' : ''}`}>{v.fillDetails}</span>
                            </div>
                          </div>
                          <button
                            className="lwa-allot-btn"
                            disabled={!selectedExecutiveId || allottingKey === key}
                            onClick={() => handleAllot(v)}
                          >
                            {allottingKey === key ? 'Allotting...' : '+ Allot village'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire the page into `App.jsx`**

In `d:\development\garuda ui\src\App.jsx`, add the import after line 9 (`import LandDataPage from './components/Land/LandDataPage';`):

```js
import LandWorkAllotmentPage from './components/Land/LandWorkAllotmentPage';
```

Then replace the Land render block (currently lines 280-289):

```jsx
          {activeSection === 'land' && (
            <>
              {activeTab === 'wallet' && <LandWalletPage />}
              {activeTab === 'land-data' && <LandDataPage />}
              {activeTab === 'department' && <LandPage />}
              {activeTab !== 'wallet' && activeTab !== 'department' && activeTab !== 'land-data' && (
                <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Page coming soon...</div>
              )}
            </>
          )}
```

with:

```jsx
          {activeSection === 'land' && (
            <>
              {activeTab === 'wallet' && <LandWalletPage />}
              {activeTab === 'land-data' && <LandDataPage />}
              {activeTab === 'work-allotment' && <LandWorkAllotmentPage />}
              {activeTab === 'department' && <LandPage />}
              {activeTab !== 'wallet' && activeTab !== 'department' && activeTab !== 'land-data' && activeTab !== 'work-allotment' && (
                <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Page coming soon...</div>
              )}
            </>
          )}
```

- [ ] **Step 5: Lint**

Run:
```bash
cd "/d/development/garuda ui" && npm run lint
```
Expected: no new errors from `LandWorkAllotmentPage.jsx`, `App.jsx`, or `assignedVillageService.js`.

- [ ] **Step 6: Verify in the browser**

The dev server is already running on port 5173 and the backend on port 5000 with Task 1's endpoint live. Using the Playwright browser tool:
1. Navigate to `http://localhost:5173`, log in with `test@garuda.io` / `password123` if not already logged in.
2. Click "Land" in the sidebar, then the "Work allotment" top tab.
3. Confirm "Villages allotment" is the active sub-tab and "Data tasks"/"Mission profile" render disabled.
4. Confirm the village grid renders real cards (e.g. a card for "Kondapur") with non-placeholder `T:`, Verified, Physical audit, and Fill details numbers, and that the "Allot village" button is disabled.
5. Select an executive from either dropdown (Personnel Selection card or the LVE Context dropdown in the banner) and confirm the banner updates and the "Allot village" buttons become enabled.
6. Click "Allot village" on one card, confirm it disappears from the grid after the refetch (no page reload).
7. Type into the search box and confirm the grid filters client-side by village/mandal name.

Take a screenshot at step 4 and step 6 to visually confirm against the target design.

- [ ] **Step 7: Commit**

```bash
cd "/d/development/garuda ui"
git add src/services/assignedVillageService.js src/components/Land/LandWorkAllotmentPage.jsx src/components/Land/LandWorkAllotmentPage.css src/App.jsx
git commit -m "Add Villages Allotment page under Land > Work allotment"
```
