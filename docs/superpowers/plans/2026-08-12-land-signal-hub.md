# Land Signal Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working "Land Signal Hub" Calls tab for the Land section (frontend) backed by two small additions to the existing call-signal / department-leader APIs (backend), so calls placed from a land record show up in a tiered (Head/Team Leader/Executive) ledger with real metrics.

**Architecture:** Two repos, touched in this order: backend first (`Garuda-Backend-2`, Express 5 + Sequelize 6 + Postgres) to add a department-leader "tree" endpoint and a `land_id` filter on the existing call-signal endpoints, then frontend (`garuda ui`, React + Vite) to add a `LandCallsPage` component modeled on the existing `FarmersCallsPage.jsx`, wire it into `App.jsx`, and add a "Call" action to `PhoneVerificationList.jsx` that originates land-linked calls.

**Tech Stack:** Express 5, Sequelize 6, PostgreSQL, React 19, Vite, axios.

## Global Constraints

- Neither repo has an automated test suite (`npm test` in the backend is a stub; `CLAUDE.md` confirms none in the frontend) — every task's verification step is a manual curl check (backend) or a manual dev-server/browser check (frontend), not an automated test run.
- Follow the existing route → controller → service → model layering in `Garuda-Backend-2`; don't introduce a different pattern.
- Follow the existing one-`.jsx`-plus-one-co-located-`.css` convention in `garuda ui`.
- `department_type` is always the literal string `'land'` for every new call in this feature — no enum exists to enforce it, so get the literal right by hand.
- No new npm dependencies in either repo.
- All new/modified backend routes stay behind `verifyToken`, matching every existing call-signal and department-leader route.

---

### Task 1: Backend — department-leader tree endpoint

**Files:**
- Modify: `Garuda-Backend-2/src/service/departmentLeaderService.js`
- Modify: `Garuda-Backend-2/src/controller/departmentLeaderController.js`
- Modify: `Garuda-Backend-2/src/routes/departmentLeaderRoutes.js`

**Interfaces:**
- Produces: `GET /api/department-leader/tree?departmentType=<string>` → `{ message: string, data: Array<{ id, employee_id, leader_id, department_type, created_at, updated_at }> }` — every `department_leaders` row for that department type, unfiltered by leader. Consumed by Task 3's `departmentLeaderService.getTree` on the frontend.

- [ ] **Step 1: Add the `getDepartmentTree` service function**

In `Garuda-Backend-2/src/service/departmentLeaderService.js`, add this function (keep the existing three functions unchanged, add this at the end of the file):

```js
export const getDepartmentTree = async (departmentType) => {
  return await DepartmentLeader.findAll({
    where: { department_type: departmentType },
    order: [["created_at", "DESC"]],
  });
};
```

- [ ] **Step 2: Add the `getDepartmentTree` controller function**

In `Garuda-Backend-2/src/controller/departmentLeaderController.js`, add this function at the end of the file (after `removeAllotment`):

```js
export const getDepartmentTree = async (req, res) => {
  try {
    const { departmentType } = req.query;

    if (!departmentType) {
      return res.status(400).json({ message: "departmentType is required" });
    }

    const tree = await departmentLeaderService.getDepartmentTree(departmentType);
    return res.status(200).json({ message: "Department tree fetched successfully", data: tree });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
```

- [ ] **Step 3: Add the route with swagger doc**

In `Garuda-Backend-2/src/routes/departmentLeaderRoutes.js`, add this block after the `GET ROSTER` block (after line 75, before the `REMOVE ALLOTMENT` comment block):

```js
/* =====================================================
   GET DEPARTMENT TREE (PROTECTED)
===================================================== */

/**
 * @swagger
 * /api/department-leader/tree:
 *   get:
 *     summary: Get every leader/employee pairing for a department, unfiltered by leader (JWT required)
 *     tags: [DepartmentLeader]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: departmentType
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Department tree fetched successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.get("/department-leader/tree", verifyToken, departmentLeaderController.getDepartmentTree);
```

- [ ] **Step 4: Start the backend dev server**

Run: `cd Garuda-Backend-2 && npm run dev`
Expected: console prints `Server running on http://localhost:5000` and `Swagger UI available at http://localhost:5000/api-docs` with no errors. Leave this running in the background for the next step.

- [ ] **Step 5: Verify the endpoint manually with curl**

First get a JWT for any valid employee account in your local Postgres DB:

```bash
curl -s -X POST http://localhost:5000/api/employee/login \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_TEST_EMAIL","password":"YOUR_TEST_PASSWORD"}'
```

Copy the `accessToken` from the response, then:

```bash
curl -s "http://localhost:5000/api/department-leader/tree?departmentType=land" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Expected: `200` with `{"message":"Department tree fetched successfully","data":[]}` (empty array is correct if no `land` department_leader rows exist yet — the important thing is a 200 with a `data` array, not an error). Also confirm `curl -s "http://localhost:5000/api/department-leader/tree" -H "Authorization: Bearer YOUR_ACCESS_TOKEN"` (no `departmentType`) returns `400`.

- [ ] **Step 6: Commit**

```bash
cd Garuda-Backend-2
git add src/service/departmentLeaderService.js src/controller/departmentLeaderController.js src/routes/departmentLeaderRoutes.js
git commit -m "feat: add department-leader tree endpoint for tier derivation"
```

---

### Task 2: Backend — `land_id` filter on call-signal endpoints

**Files:**
- Modify: `Garuda-Backend-2/src/service/callSignalService.js`
- Modify: `Garuda-Backend-2/src/controller/callSignalController.js`
- Modify: `Garuda-Backend-2/src/routes/callSignalRoutes.js`

**Interfaces:**
- Produces: `GET /api/call-signal?land_id=<int>` and `GET /api/call-signal/metrics?land_id=<int>` now accept an optional `land_id` query param, in addition to the existing `department_type`/`employee_id`/`direction`/`status` params. No change to response shape.

- [ ] **Step 1: Add the `land_id` filter to `getAllCallSignals`**

In `Garuda-Backend-2/src/service/callSignalService.js`, replace:

```js
export const getAllCallSignals = async (filters = {}) => {
  const { department_type, employee_id, direction, status } = filters;

  const whereClause = {};
  if (department_type) whereClause.department_type = department_type;
  if (employee_id) whereClause.employee_id = employee_id;
  if (direction) whereClause.direction = direction;
  if (status) whereClause.status = status;

  return await CallSignal.findAll({
    where: whereClause,
    order: [["created_at", "DESC"]],
  });
};
```

with:

```js
export const getAllCallSignals = async (filters = {}) => {
  const { department_type, employee_id, direction, status, land_id } = filters;

  const whereClause = {};
  if (department_type) whereClause.department_type = department_type;
  if (employee_id) whereClause.employee_id = employee_id;
  if (direction) whereClause.direction = direction;
  if (status) whereClause.status = status;
  if (land_id) whereClause.land_id = land_id;

  return await CallSignal.findAll({
    where: whereClause,
    order: [["created_at", "DESC"]],
  });
};
```

- [ ] **Step 2: Add the `land_id` filter to `getCallSignalMetrics`**

In the same file, replace:

```js
export const getCallSignalMetrics = async (filters = {}) => {
  const { department_type, employee_id } = filters;

  const whereClause = {};
  if (department_type) whereClause.department_type = department_type;
  if (employee_id) whereClause.employee_id = employee_id;

  const calls = await CallSignal.findAll({ where: whereClause });
```

with:

```js
export const getCallSignalMetrics = async (filters = {}) => {
  const { department_type, employee_id, land_id } = filters;

  const whereClause = {};
  if (department_type) whereClause.department_type = department_type;
  if (employee_id) whereClause.employee_id = employee_id;
  if (land_id) whereClause.land_id = land_id;

  const calls = await CallSignal.findAll({ where: whereClause });
```

(Leave the rest of the function — the `totalTalkTimeSeconds`/`missedCount`/`attendedCount` reduction — unchanged.)

- [ ] **Step 3: Pass `land_id` through in the controller**

In `Garuda-Backend-2/src/controller/callSignalController.js`, replace:

```js
export const getAllCallSignals = async (req, res) => {
  try {
    const { department_type, employee_id, direction, status } = req.query;
    const signals = await callSignalService.getAllCallSignals({ department_type, employee_id, direction, status });
```

with:

```js
export const getAllCallSignals = async (req, res) => {
  try {
    const { department_type, employee_id, direction, status, land_id } = req.query;
    const signals = await callSignalService.getAllCallSignals({ department_type, employee_id, direction, status, land_id });
```

and replace:

```js
export const getCallSignalMetrics = async (req, res) => {
  try {
    const { department_type, employee_id } = req.query;
    const metrics = await callSignalService.getCallSignalMetrics({ department_type, employee_id });
```

with:

```js
export const getCallSignalMetrics = async (req, res) => {
  try {
    const { department_type, employee_id, land_id } = req.query;
    const metrics = await callSignalService.getCallSignalMetrics({ department_type, employee_id, land_id });
```

- [ ] **Step 4: Update the swagger docs**

In `Garuda-Backend-2/src/routes/callSignalRoutes.js`, in the `GET /api/call-signal` swagger block, add this entry to the `parameters` array right after the `status` parameter (after line 88, before `responses:`):

```yaml
 *       - in: query
 *         name: land_id
 *         schema:
 *           type: integer
```

And in the `GET /api/call-signal/metrics` swagger block, add the same entry after the `employee_id` parameter (after line 117, before `responses:`):

```yaml
 *       - in: query
 *         name: land_id
 *         schema:
 *           type: integer
```

- [ ] **Step 5: Verify manually with curl**

With the dev server still running from Task 1 (restart if needed: `cd Garuda-Backend-2 && npm run dev`):

```bash
curl -s "http://localhost:5000/api/call-signal?department_type=land&land_id=1" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

curl -s "http://localhost:5000/api/call-signal/metrics?department_type=land&land_id=1" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Expected: both return `200` with `{"message": "...", "data": ...}` — an empty array / zeroed metrics object is fine if no matching rows exist, the important thing is no `500` and no "unknown column" Sequelize error (which would indicate a typo in `land_id`).

- [ ] **Step 6: Commit**

```bash
cd Garuda-Backend-2
git add src/service/callSignalService.js src/controller/callSignalController.js src/routes/callSignalRoutes.js
git commit -m "feat: add land_id filter to call-signal list and metrics endpoints"
```

---

### Task 3: Frontend — `departmentLeaderService.getTree` + tier-derivation util

**Files:**
- Modify: `garuda ui/src/services/departmentLeaderService.js`
- Create: `garuda ui/src/utils/departmentTier.js`

**Interfaces:**
- Consumes: `GET /api/department-leader/tree?departmentType=` from Task 1.
- Produces:
  - `departmentLeaderService.getTree(departmentType: string) => Promise<{ message: string, data: Array<{ employee_id: number, leader_id: number }> }>`
  - `computeTier(tree: Array<{employee_id, leader_id}>, employeeId: number|string) => 'head' | 'team_leader' | 'executive'`
  - `TIER_RANK: { head: 3, team_leader: 2, executive: 1 }`
  - `isTierEnabled(tab: 'head'|'team_leader'|'executive', userTier: 'head'|'team_leader'|'executive') => boolean`
  Consumed by Task 4's `LandCallsPage.jsx`.

- [ ] **Step 1: Add `getTree` to `departmentLeaderService.js`**

In `garuda ui/src/services/departmentLeaderService.js`, add this method inside the `departmentLeaderService` object, after `getRoster`:

```js
  async getTree(departmentType) {
    const { data } = await apiClient.get('/department-leader/tree', { params: { departmentType } });
    return data;
  },
```

- [ ] **Step 2: Write `src/utils/departmentTier.js`**

```js
export const TIER_RANK = { head: 3, team_leader: 2, executive: 1 };

export function computeTier(tree, employeeId) {
  if (!employeeId) return 'executive';
  const id = Number(employeeId);
  const isEmployee = tree.some((row) => Number(row.employee_id) === id);
  const isLeader = tree.some((row) => Number(row.leader_id) === id);
  if (isLeader && !isEmployee) return 'head';
  if (isLeader && isEmployee) return 'team_leader';
  return 'executive';
}

export function isTierEnabled(tab, userTier) {
  return TIER_RANK[tab] <= TIER_RANK[userTier];
}
```

- [ ] **Step 3: Verify `computeTier` manually with a throwaway script**

Create a temporary file `garuda ui/scratch-tier-check.mjs`:

```js
import { computeTier, isTierEnabled } from './src/utils/departmentTier.js';

const tree = [
  { employee_id: 2, leader_id: 1 }, // employee 2 reports to 1 -> 1 is a leader
  { employee_id: 3, leader_id: 2 }, // employee 3 reports to 2 -> 2 is both employee and leader
];

console.assert(computeTier(tree, 1) === 'head', 'employee 1 should be head');
console.assert(computeTier(tree, 2) === 'team_leader', 'employee 2 should be team_leader');
console.assert(computeTier(tree, 3) === 'executive', 'employee 3 should be executive');
console.assert(computeTier(tree, 999) === 'executive', 'unknown employee should default to executive');
console.assert(isTierEnabled('executive', 'executive') === true, 'own tier always enabled');
console.assert(isTierEnabled('team_leader', 'executive') === false, 'higher tier disabled for executive');
console.assert(isTierEnabled('executive', 'head') === true, 'head can view executive tab');

console.log('All tier checks passed');
```

Run: `cd "garuda ui" && node scratch-tier-check.mjs`
Expected: prints `All tier checks passed` with no assertion errors in the console output.

- [ ] **Step 4: Delete the scratch file**

```bash
cd "garuda ui"
rm scratch-tier-check.mjs
```

- [ ] **Step 5: Commit**

```bash
cd "garuda ui"
git add src/services/departmentLeaderService.js src/utils/departmentTier.js
git commit -m "feat: add department tree fetch and tier-derivation util for Land Calls"
```

---

### Task 4: Frontend — `LandCallsPage.jsx` + `.css`

**Files:**
- Create: `garuda ui/src/components/Land/LandCallsPage.jsx`
- Create: `garuda ui/src/components/Land/LandCallsPage.css`

**Interfaces:**
- Consumes: `callSignalService.getAll`/`getMetrics` (existing), `callingService.clickToCall` (existing), `employeeService.getAll` (existing), `departmentLeaderService.getRoster`/`getTree` (existing + Task 3), `useAuth()` from `src/context/AuthContext.jsx` (existing, provides `user.id`), `computeTier`/`isTierEnabled`/`TIER_RANK` from `src/utils/departmentTier.js` (Task 3).
- Produces: default export `LandCallsPage` — a self-contained page component with no required props. Consumed by Task 5's `App.jsx` wiring.

- [ ] **Step 1: Write `LandCallsPage.jsx`**

```jsx
import React, { useState, useEffect } from 'react';
import callSignalService from '../../services/callSignalService';
import employeeService from '../../services/employeeService';
import callingService from '../../services/callingService';
import departmentLeaderService from '../../services/departmentLeaderService';
import { useAuth } from '../../context/AuthContext';
import { computeTier, isTierEnabled } from '../../utils/departmentTier';
import './LandCallsPage.css';

const formatDuration = (seconds) => {
  if (!seconds) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const formatLandCode = (landId) => (landId ? `L${String(landId).padStart(3, '0')}` : 'N/A');

export default function LandCallsPage() {
  const { user } = useAuth();

  const [userTier, setUserTier] = useState('executive');
  const [activeTab, setActiveTab] = useState('executive');
  const [searchQuery, setSearchQuery] = useState('');

  const [calls, setCalls] = useState([]);
  const [metrics, setMetrics] = useState({ totalTalkTimeSeconds: 0, attendedCount: 0, missedCount: 0 });
  const [squadAudit, setSquadAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialingNumber, setDialingNumber] = useState(null);
  const [callError, setCallError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [callsData, metricsData, treeData] = await Promise.all([
          callSignalService.getAll({ department_type: 'land' }),
          callSignalService.getMetrics({ department_type: 'land' }),
          departmentLeaderService.getTree('land'),
        ]);
        setCalls(callsData.data || []);
        setMetrics(metricsData.data || { totalTalkTimeSeconds: 0, attendedCount: 0, missedCount: 0 });

        const tree = treeData.data || [];
        const tier = computeTier(tree, user?.id);
        setUserTier(tier);
        setActiveTab(tier);

        if (tier === 'team_leader' || tier === 'head') {
          const rosterData = await departmentLeaderService.getRoster(user.id, 'land');
          const roster = rosterData.data || [];

          const employeesData = await employeeService.getAll();
          const empList = employeesData.data || employeesData.employees || employeesData || [];
          const empById = new Map((Array.isArray(empList) ? empList : []).map((e) => [e.id, e]));

          const squadMetrics = await Promise.all(
            roster.map((r) => callSignalService.getMetrics({ department_type: 'land', employee_id: r.employee_id }))
          );

          setSquadAudit(roster.map((r, i) => {
            const emp = empById.get(r.employee_id);
            const m = squadMetrics[i]?.data || { totalTalkTimeSeconds: 0, missedCount: 0 };
            const hours = Math.floor(m.totalTalkTimeSeconds / 3600);
            const mins = Math.floor((m.totalTalkTimeSeconds % 3600) / 60);
            return {
              name: (emp?.name || `EMP #${r.employee_id}`).toUpperCase(),
              time: `${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`,
              msd: String(m.missedCount),
              danger: m.missedCount >= 2,
              avatar: emp?.photo || `https://i.pravatar.cc/150?u=${r.employee_id}`,
            };
          }));
        }
      } catch (err) {
        console.error('Failed to fetch land call signals:', err);
      } finally {
        setLoading(false);
      }
    };
    if (user?.id) fetchData();
  }, [user?.id]);

  const handleDial = async (customerNumber, { callerName, missionContext, landId } = {}) => {
    if (!customerNumber || dialingNumber) return;
    setCallError(null);
    setDialingNumber(customerNumber);
    try {
      await callingService.clickToCall({
        customerNumber,
        departmentType: 'land',
        callerName,
        missionContext,
        landId,
      });
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to place call.';
      setCallError(message);
    } finally {
      setDialingNumber(null);
    }
  };

  const filteredCalls = calls.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.caller_name?.toLowerCase().includes(q) || c.caller_phone?.includes(q) || c.mission_context?.toLowerCase().includes(q);
  });

  const ledgerRows = filteredCalls.map((c) => ({
    id: c.caller_phone || 'N/A',
    name: c.caller_name?.toUpperCase() || 'UNKNOWN',
    landCode: formatLandCode(c.land_id),
    context: c.mission_context || 'No context provided',
    exec: c.employee_id ? `EMP #${c.employee_id}` : 'UNASSIGNED',
    time: c.missed ? 'MISSED' : formatDuration(c.duration_seconds),
    subTime: formatTime(c.created_at),
    missed: c.missed,
  }));

  const showExecutiveColumn = activeTab === 'team_leader' || activeTab === 'head';
  const colSpan = showExecutiveColumn ? 5 : 4;

  const tierLabel = activeTab === 'head' ? 'HEAD' : activeTab === 'team_leader' ? 'TL' : 'EXEC';

  return (
    <div className="l-calls-page">
      {/* Tier Tabs */}
      <div className="l-calls-sub-tabs">
        {['head', 'team_leader', 'executive'].map((tier) => (
          <div
            key={tier}
            className={`l-calls-sub-tab${activeTab === tier ? ' active' : ''}${!isTierEnabled(tier, userTier) ? ' disabled' : ''}`}
            onClick={() => isTierEnabled(tier, userTier) && setActiveTab(tier)}
          >
            {tier === 'team_leader' ? 'TEAM LEADER' : tier.toUpperCase()}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="l-calls-header">
        <div className="l-calls-title-group">
          <svg className="l-calls-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <div className="l-calls-title-texts">
            <span className="l-calls-title">LANDS SIGNAL HUB</span>
            <span className="l-calls-subtitle">TIER: {tierLabel} OVERSIGHT</span>
          </div>
        </div>
        <div className="l-calls-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Filter signals..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* Main Layout */}
      <div className="l-calls-layout">
        {/* Left Column */}
        <div className="l-calls-main-col">
          <div className="l-calls-card-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            LANDS MISSION SIGNAL LEDGER
          </div>
          <div className="l-ledger-table-wrap">
            <table className="l-ledger-table">
              <thead>
                <tr>
                  <th>SIGNAL IDENTITY</th>
                  <th>MISSION CONTEXT</th>
                  {showExecutiveColumn && <th>EXECUTIVE</th>}
                  <th>DURATION</th>
                  <th>VOICE REGISTRY</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={colSpan} style={{ textAlign: 'center', padding: '24px' }}>Loading...</td></tr>
                ) : ledgerRows.length === 0 ? (
                  <tr><td colSpan={colSpan} style={{ textAlign: 'center', padding: '24px' }}>No signals found.</td></tr>
                ) : ledgerRows.map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      <div className="l-ledger-identity">
                        <span className="l-ledger-name">{row.name}</span>
                        <div className="l-ledger-phone">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                            <line x1="12" y1="18" x2="12.01" y2="18" />
                          </svg>
                          {row.id}
                        </div>
                        <span className="l-ledger-code">{row.landCode}</span>
                      </div>
                    </td>
                    <td>
                      <span className="l-ledger-context">{row.context}</span>
                    </td>
                    {showExecutiveColumn && (
                      <td>
                        <span className="l-ledger-exec">{row.exec}</span>
                      </td>
                    )}
                    <td>
                      <div className="l-ledger-duration">
                        <span className={`l-ledger-dur-time ${row.missed ? 'missed' : ''}`}>{row.time}</span>
                        <span className="l-ledger-dur-sub">{row.subTime}</span>
                      </div>
                    </td>
                    <td>
                      <div className="l-ledger-voice">
                        {!row.missed && (
                          <button className="l-voice-btn play" disabled title="Recording playback not available yet">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                          </button>
                        )}
                        <button
                          className="l-voice-btn"
                          title={`Call ${row.id}`}
                          disabled={row.id === 'N/A' || dialingNumber === row.id}
                          onClick={() => handleDial(row.id, { callerName: row.name, missionContext: row.context })}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column */}
        <div className="l-calls-side-col">
          {/* Metrics Card */}
          <div className="l-calls-card">
            <div className="l-calls-card-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              LANDS SIGNAL METRICS
            </div>
            <div className="l-metrics-content">
              <div className="l-metric-label">LANDS TALK TIME (TODAY)</div>
              <div className="l-metric-val">{formatDuration(metrics.totalTalkTimeSeconds).replace(':', 'm ')}s</div>
              <div className="l-metrics-split">
                <div className="l-metric-box">
                  <div className="l-metric-label">ATTENDED</div>
                  <div className="l-metric-stat success">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    {metrics.attendedCount}
                  </div>
                </div>
                <div className="l-metric-box">
                  <div className="l-metric-label">MISSED</div>
                  <div className="l-metric-stat danger">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    {metrics.missedCount}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Squad Performance Audit - Team Leader / Head only */}
          {showExecutiveColumn && (
            <div className="l-calls-card">
              <div className="l-calls-card-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                SQUAD PERFORMANCE AUDIT
              </div>
              <table className="l-squad-table">
                <thead>
                  <tr>
                    <th>STAFF</th>
                    <th>TALK TIME</th>
                    <th>MSD.</th>
                  </tr>
                </thead>
                <tbody>
                  {squadAudit.length === 0 ? (
                    <tr><td colSpan={3} style={{ textAlign: 'center', padding: '16px' }}>No direct reports found.</td></tr>
                  ) : squadAudit.map((row, idx) => (
                    <tr key={idx}>
                      <td>
                        <div className="l-squad-staff">
                          <div className="l-squad-avatar">
                            <img src={row.avatar} alt={row.name} />
                          </div>
                          <span className="l-squad-name">{row.name}</span>
                        </div>
                      </td>
                      <td><span className="l-squad-val">{row.time}</span></td>
                      <td>
                        <span className={`l-squad-badge ${row.danger ? 'danger' : 'safe'}`}>
                          {row.msd}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Trend Chart */}
          <div className="l-calls-card" style={{ flex: 1 }}>
            <div className="l-calls-card-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              7-DAY TREND (M)
            </div>
            <div className="l-trend-content">
              <svg className="l-trend-line" viewBox="0 0 300 60" preserveAspectRatio="none">
                <path
                  d="M0,50 Q40,50 60,35 T120,30 T180,40 T220,20 T280,50 L300,55"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Call error toast */}
      {callError && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '24px',
            zIndex: 20,
            padding: '10px 16px',
            borderRadius: '6px',
            background: '#fee2e2',
            color: '#991b1b',
            border: '1px solid #fecaca',
          }}
        >
          {callError}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `LandCallsPage.css`**

```css
/* ── Land Calls Page Layout ── */
.l-calls-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0 24px;
}

/* ── Sub Tabs ── */
.l-calls-sub-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-main);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 4px;
  width: fit-content;
  margin-top: 20px;
  margin-bottom: 24px;
}

.l-calls-sub-tab {
  padding: 8px 24px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: all 0.2s;
  cursor: pointer;
}

.l-calls-sub-tab.active {
  background: var(--accent);
  color: #ffffff;
}

.l-calls-sub-tab.disabled {
  color: var(--text-muted);
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Header ── */
.l-calls-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}

.l-calls-title-group {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.l-calls-icon {
  color: var(--accent);
  width: 28px;
  height: 28px;
  margin-top: 2px;
}

.l-calls-title-texts {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.l-calls-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.l-calls-subtitle {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.l-calls-search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-white);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 10px 16px;
  min-width: 280px;
}

.l-calls-search svg {
  color: var(--text-muted);
}

.l-calls-search input {
  font-size: 13px;
  color: var(--text-primary);
  width: 100%;
}

.l-calls-search input::placeholder {
  color: var(--text-muted);
}

/* ── Layout ── */
.l-calls-layout {
  display: flex;
  gap: 24px;
  flex: 1;
  overflow: hidden;
  margin-bottom: 24px;
}

.l-calls-main-col {
  flex: 2.2;
  display: flex;
  flex-direction: column;
  background: var(--bg-white);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.l-calls-side-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
  padding-right: 4px;
}

/* ── Card Styling ── */
.l-calls-card {
  background: var(--bg-white);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.l-calls-card-header {
  padding: 16px 24px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  gap: 8px;
}

.l-calls-card-header svg {
  color: var(--accent);
}

.l-calls-main-col .l-calls-card-header {
  border-top: 4px solid var(--text-primary);
}

.l-calls-side-col .l-calls-card-header {
  border-top: 4px solid var(--accent);
}

/* ── Ledger Table ── */
.l-ledger-table-wrap {
  flex: 1;
  overflow-y: auto;
}

.l-ledger-table {
  width: 100%;
  border-collapse: collapse;
}

.l-ledger-table th,
.l-ledger-table td {
  padding: 16px 24px;
  text-align: left;
  border-bottom: 1px solid var(--border-light);
  vertical-align: middle;
}

.l-ledger-table th {
  position: sticky;
  top: 0;
  background: var(--bg-white);
  z-index: 2;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.l-ledger-table tbody tr:last-child td {
  border-bottom: none;
}

/* Ledger Cells */
.l-ledger-identity {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.l-ledger-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
}

.l-ledger-phone {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--text-muted);
}

.l-ledger-phone svg {
  color: var(--accent);
}

.l-ledger-code {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  font-size: 9px;
  font-weight: 700;
  color: #ffffff;
  background: #2563eb;
  padding: 2px 8px;
  border-radius: 10px;
  text-transform: uppercase;
}

.l-ledger-context {
  font-size: 12px;
  color: var(--text-secondary);
}

.l-ledger-exec {
  font-size: 11px;
  font-weight: 700;
  color: #3b82f6;
  text-transform: uppercase;
}

.l-ledger-duration {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.l-ledger-dur-time {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.l-ledger-dur-time.missed {
  color: var(--red);
}

.l-ledger-dur-sub {
  font-size: 9px;
  color: var(--text-muted);
  text-transform: uppercase;
}

.l-ledger-voice {
  display: flex;
  align-items: center;
  gap: 8px;
}

.l-voice-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  transition: all 0.2s;
  background: var(--bg-white);
}

.l-voice-btn:hover:not(:disabled) {
  background: var(--bg-main);
  color: var(--text-primary);
}

.l-voice-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.l-voice-btn.play svg {
  color: var(--accent);
  fill: var(--accent);
}

/* ── Real-time Metrics ── */
.l-metrics-content {
  padding: 24px;
}

.l-metric-label {
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.l-metric-val {
  font-size: 24px;
  font-weight: 800;
  color: var(--accent);
}

.l-metrics-split {
  display: flex;
  align-items: center;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-light);
}

.l-metric-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.l-metric-stat {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
}

.l-metric-stat.success svg { color: var(--green); }
.l-metric-stat.danger svg { color: var(--red); }

/* ── Squad Performance Audit ── */
.l-squad-table {
  width: 100%;
  border-collapse: collapse;
}

.l-squad-table th {
  padding: 12px 24px;
  font-size: 9px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-align: right;
  border-bottom: 1px solid var(--border-light);
}

.l-squad-table th:first-child {
  text-align: left;
}

.l-squad-table td {
  padding: 12px 24px;
  text-align: right;
  border-bottom: 1px solid var(--border-light);
  vertical-align: middle;
}

.l-squad-table td:first-child {
  text-align: left;
}

.l-squad-table tbody tr:last-child td {
  border-bottom: none;
}

.l-squad-staff {
  display: flex;
  align-items: center;
  gap: 12px;
}

.l-squad-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #e2e8f0;
  overflow: hidden;
}

.l-squad-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.l-squad-name {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-primary);
  text-transform: uppercase;
}

.l-squad-val {
  font-size: 12px;
  color: var(--text-primary);
}

.l-squad-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 700;
}

.l-squad-badge.danger {
  background: #fee2e2;
  color: #ef4444;
}

.l-squad-badge.safe {
  background: #dcfce7;
  color: #22c55e;
}

/* ── 7-Day Trend ── */
.l-trend-content {
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.l-trend-line {
  width: 100%;
  height: 60px;
}
```

- [ ] **Step 3: Lint check**

Run: `cd "garuda ui" && npm run lint`
Expected: no new oxlint errors from `LandCallsPage.jsx` (pre-existing warnings elsewhere in the repo, if any, are not this task's concern).

- [ ] **Step 4: Commit**

```bash
cd "garuda ui"
git add src/components/Land/LandCallsPage.jsx src/components/Land/LandCallsPage.css
git commit -m "feat: add LandCallsPage with tiered ledger, metrics, and trend chart"
```

---

### Task 5: Frontend — wire `LandCallsPage` into `App.jsx`

**Files:**
- Modify: `garuda ui/src/App.jsx`

**Interfaces:**
- Consumes: `LandCallsPage` default export from Task 4.

- [ ] **Step 1: Import `LandCallsPage`**

In `garuda ui/src/App.jsx`, add this import near the other Land imports (after the `LandWorkAllotmentPage` import, matching existing import grouping):

```js
import LandCallsPage from './components/Land/LandCallsPage';
```

- [ ] **Step 2: Replace the "coming soon" placeholder for Land's Calls tab**

Replace:

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

with:

```jsx
          {activeSection === 'land' && (
            <>
              {activeTab === 'wallet' && <LandWalletPage />}
              {activeTab === 'land-data' && <LandDataPage />}
              {activeTab === 'work-allotment' && <LandWorkAllotmentPage />}
              {activeTab === 'department' && <LandPage />}
              {activeTab === 'calls' && <LandCallsPage />}
              {activeTab !== 'wallet' && activeTab !== 'department' && activeTab !== 'land-data' && activeTab !== 'work-allotment' && activeTab !== 'calls' && (
                <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Page coming soon...</div>
              )}
            </>
          )}
```

- [ ] **Step 3: Verify in the browser**

Run: `cd "garuda ui" && npm run dev` (leave running)

Open the printed local URL, log in, click "Land" in the sidebar, then click the "Calls" top tab.

Expected: the Lands Signal Hub renders (tier tabs, ledger — empty state "No signals found." is fine if no `land`-department calls exist yet, metrics card showing zeros, trend chart) instead of "Page coming soon...". Confirm no console errors in devtools. Confirm the floating "Inbound Signals" bar still appears in the bottom-right (unrelated to this change, but confirms nothing broke that global render).

- [ ] **Step 4: Commit**

```bash
cd "garuda ui"
git add src/App.jsx
git commit -m "feat: wire LandCallsPage into Land section's Calls tab"
```

---

### Task 6: Frontend — "Call" action on `PhoneVerificationList`

**Files:**
- Modify: `garuda ui/src/components/Land/PhoneVerificationList.jsx`
- Modify: `garuda ui/src/components/Land/LandDataPage.css`

**Interfaces:**
- Consumes: `callingService.clickToCall` (existing, from Task 4's usage pattern).
- Produces: calls placed from this page carry `land_id`, so they appear in `LandCallsPage`'s ledger (Task 4) with an `L{id}` badge.

- [ ] **Step 1: Add the `.action-btn.call` CSS variant**

In `garuda ui/src/components/Land/LandDataPage.css`, add this after the existing `.action-btn.start` rule (after line 322):

```css
.action-btn.call {
  background: #ffffff;
  color: var(--accent);
  border: 1px solid var(--accent);
  padding: 8px 16px;
  border-radius: 20px;
}

.action-btn.call:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 2: Add calling state and handler to `PhoneVerificationList.jsx`**

In `garuda ui/src/components/Land/PhoneVerificationList.jsx`, replace the import block:

```jsx
import React, { useState, useEffect } from 'react';
import landService from '../../services/landService';
```

with:

```jsx
import React, { useState, useEffect } from 'react';
import landService from '../../services/landService';
import callingService from '../../services/callingService';
```

Then, inside the component function, replace:

```jsx
  const [lands, setLands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
```

with:

```jsx
  const [lands, setLands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialingLandId, setDialingLandId] = useState(null);
  const [callError, setCallError] = useState(null);

  const handleCall = async (land, name, code) => {
    const phone = land.farmerDetails?.farmer_phone;
    if (!phone || dialingLandId) return;
    setCallError(null);
    setDialingLandId(land.id);
    try {
      await callingService.clickToCall({
        customerNumber: phone,
        departmentType: 'land',
        callerName: name,
        missionContext: `Inquiry about ${code} verification status`,
        landId: land.id,
      });
    } catch (err) {
      setCallError(err.response?.data?.message || 'Failed to place call.');
    } finally {
      setDialingLandId(null);
    }
  };
```

- [ ] **Step 3: Render the "Call" button**

Replace the `ACTION` cell:

```jsx
                <td>
                  <button className="action-btn start">
                    START VETTING
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                  </button>
                </td>
```

with:

```jsx
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="action-btn call"
                      disabled={!land.farmerDetails?.farmer_phone || dialingLandId === land.id}
                      onClick={() => handleCall(land, name, code)}
                    >
                      {dialingLandId === land.id ? 'CALLING...' : 'CALL'}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </button>
                    <button className="action-btn start">
                      START VETTING
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                    </button>
                  </div>
                </td>
```

- [ ] **Step 4: Surface call errors**

Replace the end of the component's returned JSX:

```jsx
      <div className="ledger-table-wrap">
        <table className="ledger-table">
          ...
        </table>
      </div>
    </div>
  );
}
```

with (adding the error block between the closing `ledger-table-wrap` div and the closing `ledger-card` div — leave the `<table>...</table>` contents exactly as they are, only the two lines around them change):

```jsx
      <div className="ledger-table-wrap">
        <table className="ledger-table">
          ...
        </table>
      </div>
      {callError && (
        <div style={{ padding: '12px 24px', color: '#991b1b', fontSize: '12px' }}>
          {callError}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify in the browser**

With the dev server from Task 5 still running, navigate to Land → Land data → the Phone Verification queue (the tab path that renders `PhoneVerificationList`, per `LandDataPage.jsx`'s `activeLevel1 === 'verification' && activeLevel2 === 'phone'`).

Expected: each row now shows a "CALL" button next to "START VETTING". If any pending-phone-verification land record with a `farmerDetails.farmer_phone` exists in your local DB, click it — the button should show "CALLING..." briefly, then return to "CALL" with no error toast (a `MYOPERATOR_*` misconfiguration in your local `.env` will surface as a `callError` toast, which is an environment issue, not a code defect — confirm the request at least reaches the backend by checking the `Garuda-Backend-2` terminal log for the incoming `POST /calling/click-to-call`). Then reload Land → Calls (Task 5) and confirm the new call appears in the ledger with the correct `L{id}` badge and mission context.

- [ ] **Step 6: Commit**

```bash
cd "garuda ui"
git add src/components/Land/PhoneVerificationList.jsx src/components/Land/LandDataPage.css
git commit -m "feat: add Call action to Phone Verification queue, linking calls to land records"
```
