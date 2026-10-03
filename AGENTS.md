# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project

Garuda UI — a React 19 + Vite admin dashboard for managing farmer/land/buyer/agent operations (call center, land acquisition, farmer onboarding, buyers, agents, HR, settings). Talks to a separate backend API (not in this repo; a sibling `Garuda-Backend-2` repo is sometimes available locally).

## Commands

```
npm run dev       # start Vite dev server
npm run build     # production build (outputs to dist/)
npm run preview   # preview the production build
npm run lint      # oxlint
```

There is no test suite configured in this repo. Verification is manual: hit the API directly (PowerShell `Invoke-RestMethod`) or drive the dev server in a browser.

**API base URL.** [apiClient.js](src/services/apiClient.js) uses `VITE_API_URL` from `.env`, falling back to `http://localhost:5000/api`. `.env` currently holds an *absolute* remote URL (`https://backend.garudalands.com/api`), so requests go straight to the remote server and the `/api` proxy in [vite.config.js](vite.config.js) is bypassed entirely. To run against a local backend, point `VITE_API_URL` at it directly (e.g. `http://localhost:5000/api`) — editing the proxy alone has no effect unless `VITE_API_URL` is also made relative (`/api`).

## Architecture

**No router.** [src/App.jsx](src/App.jsx) is a single component that manages navigation via `useState`: one `activeSection` (from the sidebar) plus a *separate* `activeTab` state per section, so switching sections remembers each one's last tab. Adding a new top-level page means: add an entry to the relevant `*TopTabs` array, add an icon case to `TopTabIcon`, and add a conditional render block under `activeSection === '...'`.

Two render conventions coexist and both are current — match whichever the section already uses:
- Most sections (callcenter, land, farmers, buyers, agents) render child pages *inline* in App.jsx per `activeTab`, with an `activeTab !== 'a' && activeTab !== 'b'` catch-all rendering "Page coming soon...".
- HR and Settings instead receive `activeTab` as a **prop** ([HRPage.jsx](src/components/HR/HRPage.jsx), [SettingsPage.jsx](src/components/Settings/SettingsPage.jsx)) and do their own switching.

[Sidebar.jsx](src/components/Sidebar/Sidebar.jsx) lists more sections than are implemented — `finance`, `locations`, and `dashboard` intentionally fall through to a "Section coming soon..." placeholder.

**Section-based theming.** App.jsx sets `document.documentElement`'s `data-theme` from `activeSection`. [src/index.css](src/index.css) defines shared tokens on `:root`, then a full color/sidebar variable set per theme under `[data-theme="..."]` (callcenter, land, farmers, buyers, agents, hr, settings). Style components against these CSS variables (`--accent`, `--bg-main`, `--border`, `--text-primary`, `--text-secondary`, `--text-muted`, `--sidebar-bg`) — never hardcoded hex for themeable elements — so a component renders correctly in whichever section hosts it. An unknown section falls back to the `callcenter` theme.

**The Agents section is a deliberate exception to all of the above.** It was rebuilt to match the `garuda firebase` prototype verbatim, so `src/components/Agents/**` is styled with **Tailwind 4** and hardcoded prototype hex (`#2563EB` blue with a stone/neutral palette) instead of the theme variables — it does not re-theme, by design. [src/styles/agents-tailwind.css](src/styles/agents-tailwind.css) makes that cohabit safely and explains the two constraints in comments:
- Utilities are imported **unlayered**, because `index.css` is unlayered too and its `button { border: none; background: none }` / `input { border: none }` element rules would beat any *layered* utility (unlayered always wins over layered). Unlayered, a single-class utility (0,1,0) outranks an element selector (0,0,1).
- Tailwind **Preflight is not imported** — it is a global reset and would restyle every other section. `index.css` already does most of its job; only the border default is re-added, scoped to `.garuda-agents`.
- Spacing and text tokens are pinned in **px**, because `html { font-size: 14px }` would otherwise render this section ~12% smaller than the Firebase original.

Every Agents component must render inside the `.garuda-agents` wrapper ([AgentsModule.jsx](src/components/Agents/AgentsModule.jsx)) or the scoped reset will not apply.

**Component organization.** [src/components/](src/components/) is grouped by business domain (Agents, Auth, Buyers, Department, Farmers, HR, InboundSignals, Land, Settings, Sidebar, SignalAuditHub), not by UI type. Each domain folder typically has a top-level `*Page.jsx` owning its own sub-tab state and rendering child pages (e.g. [DepartmentPage.jsx](src/components/Department/DepartmentPage.jsx) → CrewPage / AttendancePage / HierarchyPage), mirroring the section/tab pattern used at the App level. Most `.jsx` components have a co-located `.css` file of the same name; small list components extracted from a bigger page (e.g. [PhoneVerificationList.jsx](src/components/Land/PhoneVerificationList.jsx)) instead rely on the parent page's stylesheet.

**This codebase duplicates per-page markup rather than extracting shared presentational components.** Filter bars, tables, and modals are repeated across sibling pages. Follow that — extract shared *hooks* for state/logic, not shared JSX.

The Agents section is again the exception: it ports the Firebase design's shared components into [src/components/Agents/common/](src/components/Agents/common/) (`StatCard`, `DataTable`, `Badge`, `CallButton`, `Modal`). Use those inside Agents; keep duplicating markup everywhere else.

**Maps.** The Agents section uses real **Leaflet** tile maps (`leaflet` + CartoDB/Esri tiles), not the CSS-projected scatter the older `AgentTacticalMap`/`AgentAllotmentMap` used. [useLeafletMap.js](src/hooks/useLeafletMap.js) owns the map lifecycle — it destroys the map on unmount rather than caching it, because React StrictMode double-mounts effects in dev and a map left attached to its container throws "Map container is already initialized". Markers are `L.divIcon` with inline styles (Tailwind classes do not apply inside a divIcon's HTML). Call `invalidateSize()` after anything that resizes the container (fullscreen, a drawer) or the map paints grey. The two maps are [AgentsRecruitmentMap.jsx](src/components/Agents/maps/AgentsRecruitmentMap.jsx) (village nodes, 3 heat-metric modes) and [AgentAttachLandMap.jsx](src/components/Agents/maps/AgentAttachLandMap.jsx) (land parcels + surveyed boundary polygons).

**Services layer.** [src/services/](src/services/) has one file per backend resource (`employeeService.js`, `landService.js`, `buyerService.js`, `agentService.js`, `attendanceService.js`, `callingService.js`, `callSignalService.js`, `settingsService.js`, `assignedVillageService.js`, `departmentLeaderService.js`), each exporting a plain object of async functions that call [apiClient.js](src/services/apiClient.js) and return `data`. Add new backend resources here rather than calling axios from components. Some methods deliberately swallow errors and return an empty envelope — e.g. [buyerService.js](src/services/buyerService.js)'s `/buyer/payment` calls require a *buyer* JWT and 401 in the admin context, so they catch and return `{ data: [] }`.

**API client & auth.** [apiClient.js](src/services/apiClient.js) is an axios instance (15s timeout) with:
- request interceptor attaching `Bearer` token from `localStorage.garuda_access_token`
- response interceptor that on `401` auto-refreshes via `POST /employee/refresh` using `garuda_refresh_token`, queues concurrent requests during the refresh, and retries them once the new token lands (login/refresh URLs are excluded to avoid loops)
- on refresh failure or missing refresh token, clears the `garuda_*` localStorage keys and dispatches a `garuda:auth:expired` window event

[AuthContext.jsx](src/context/AuthContext.jsx) provides `useAuth()` (`user`, `isAuthenticated`, `isLoading`, `error`, `login`, `logout`, `fetchProfile`), seeds state from localStorage, listens for `garuda:auth:expired` to force client-side logout, and validates the stored token against `/employee/profile` on mount. App.jsx renders `LoginPage` whenever `isAuthenticated` is false — there is no route guarding, just that one conditional. The three auth keys are `garuda_access_token`, `garuda_refresh_token`, `garuda_user`.

## Shared hooks & utils

- [useLocations.js](src/hooks/useLocations.js) — cascading state → district → mandal → village (+ towns) dropdowns used across Land/Farmers forms, fetching each level from `/location/*` as the parent changes and resetting child levels. Reuse it instead of re-implementing cascading selects.
- [useFieldExecutiveFilter.js](src/hooks/useFieldExecutiveFilter.js) — employee roster plus date-range/executive filter state, exposing a `matchesFilters(land)` predicate, `hasActiveFilters`, and `resetFilters`. Used by the Land verification list views; reuse for any "filter by who created it and when" bar.
- [departmentTier.js](src/utils/departmentTier.js) — derives a user's tier (`head` / `team_leader` / `executive`) from a hierarchy tree: a leader who is never an employee is `head`, one who is both is `team_leader`. `isTierEnabled(tab, userTier)` gates tabs by rank (see [LandCallsPage.jsx](src/components/Land/LandCallsPage.jsx)).

## Conventions

- Functional components with hooks only; no class components.
- oxlint runs with the `react` and `oxc` plugins ([.oxlintrc.json](.oxlintrc.json)); `react/rules-of-hooks` is an **error**, so call every hook unconditionally at the top of the component.
- **Defensive response unwrapping.** The backend is inconsistent about its envelope, so unwrap with a fallback chain rather than assuming a shape: `data.data || data.employees || data || []`, `data.result || data.data || []`, `data.data || []`. This appears ~60 times; match the local variant.
- **Coerce both sides before comparing IDs.** `<select>` values are strings while API ids come back as numbers — always compare via `String(a) === String(b)` (or `Number(...)` on both), never `===` on raw values.
- Section-local UI strings (tab labels, icon keys) and inline SVG icon maps are defined as plain arrays/objects at the top of the owning component file, not in a shared constants module.
- Unbuilt tabs render an inline `<div style={{ padding: '24px', color: 'var(--text-muted)' }}>… coming soon...</div>` placeholder rather than being omitted from the tab bar.

## Design docs

[docs/superpowers/](docs/superpowers/) holds paired, dated design specs (`specs/YYYY-MM-DD-<feature>-design.md`) and implementation plans (`plans/YYYY-MM-DD-<feature>.md`) for larger features. When working on an area covered there, read the spec first — several record backend quirks confirmed against `Garuda-Backend-2` (e.g. `GET /land` ignoring its query params, which is why the Land verification queues call the dedicated `pending-*` endpoints instead).
