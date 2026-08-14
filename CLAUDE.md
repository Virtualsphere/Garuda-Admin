# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Garuda UI — a React + Vite admin dashboard for managing farmer/land/agent operations (call center, land acquisition, farmer onboarding, agents, HR, settings). Talks to a separate backend API (not in this repo).

## Commands

```
npm run dev       # start Vite dev server (proxies /api -> http://localhost:5000)
npm run build     # production build (outputs to dist/)
npm run preview   # preview the production build
npm run lint      # oxlint
```

There is no test suite configured in this repo.

Backend API base URL comes from `VITE_API_URL` in `.env` (currently pointed at a remote server, not localhost). When running against a local backend on port 5000, either update `.env` or rely on the Vite dev-server proxy in [vite.config.js](vite.config.js), which forwards `/api` to `http://localhost:5000`.

## Architecture

**No router.** [src/App.jsx](src/App.jsx) is a single component that manages navigation via `useState` — one `activeSection` (from the sidebar: callcenter, land, farmers, agents, hr, settings, ...) and one `activeTab` per section (persisted independently so switching sections remembers the last tab). Adding a new top-level page means: add an entry to the relevant `*TopTabs` array, add an icon case to `TopTabIcon`, and add a conditional render block under `activeSection === '...'`.

**Section-based theming.** [src/App.jsx](src/App.jsx) sets `document.documentElement.dataset.theme` based on `activeSection`. [src/index.css](src/index.css) defines shared tokens on `:root` and then a full color/sidebar variable set per theme under `[data-theme="..."]` selectors (callcenter=pink, land=green, farmers=rust, agents=slate/indigo, hr=monochrome, settings=monochrome). Components style against these CSS variables (`--accent`, `--sidebar-bg`, etc.) rather than hardcoded colors, so a component works correctly in whichever section renders it.

**Component organization.** [src/components/](src/components/) is grouped by business domain (Department, Farmers, Land, Agents, HR, Settings, SignalAuditHub, InboundSignals, Auth, Sidebar), not by UI type. Each domain folder typically has a top-level `*Page.jsx` that owns its own sub-tab state and renders child pages (e.g. [DepartmentPage.jsx](src/components/Department/DepartmentPage.jsx) → CrewPage / AttendancePage / HierarchyPage), mirroring the same section/tab pattern used at the App level. Every `.jsx` component has a co-located `.css` file of the same name.

**Services layer.** [src/services/](src/services/) has one file per backend resource (`employeeService.js`, `landService.js`, `agentService.js`, `attendanceService.js`, `callingService.js`, etc.), each exporting a plain object of async functions that call [apiClient.js](src/services/apiClient.js) and return `data`. Follow this pattern for new backend resources rather than calling axios directly from components.

**API client & auth.** [src/services/apiClient.js](src/services/apiClient.js) is an axios instance with:
- request interceptor attaching `Bearer` token from `localStorage.garuda_access_token`
- response interceptor that on `401` auto-refreshes via `POST /employee/refresh` using `garuda_refresh_token`, queues concurrent requests during refresh, and retries them once the new token lands
- on refresh failure, clears all `garuda_*` localStorage keys and dispatches a `garuda:auth:expired` window event

[src/context/AuthContext.jsx](src/context/AuthContext.jsx) provides `useAuth()` (`user`, `isAuthenticated`, `login`, `logout`, `fetchProfile`), listens for `garuda:auth:expired` to force logout client-side, and validates the stored token against `/employee/profile` on mount. `App.jsx` renders `LoginPage` whenever `isAuthenticated` is false — there's no route guarding, just this one conditional.

**Cascading location data.** [src/hooks/useLocations.js](src/hooks/useLocations.js) is the shared pattern for state → district → mandal → village cascading dropdowns (used across Land/Farmers forms), fetching each level from `/location/*` endpoints as the parent selection changes and resetting child levels on change. Reuse this hook instead of re-implementing cascading selects.

## Conventions

- Functional components with hooks only; no class components.
- oxlint is configured with the `react` and `oxc` plugins ([.oxlintrc.json](.oxlintrc.json)); `react/rules-of-hooks` is an error.
- Section-local UI strings (tab labels, icon keys) are defined as plain arrays/objects at the top of the owning component file, not in a shared constants module.
