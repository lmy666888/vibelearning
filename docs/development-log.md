# Development Log

## Day 1 — 2026-10-14

- Created the project in the user-designated empty source folder `/Users/mingyi/Projects/vibelearning-ai`; no pre-existing files were overwritten.
- Inspected Node 24.20.0, npm 12.0.2, uv 0.12.7 and system Python 3.14. Installed independent Python 3.13.15 and built the backend virtual environment. Redirected restricted caches; inability to create a global Python shortcut did not affect the venv.
- Implemented analytical SI physics, explicit coordinate conversion, Canvas rendering, parameter controls, Zustand time/state management and live readings.
- Implemented FastAPI health/CORS and typed frontend API health monitoring. Offline simulation remains local.
- Verified 31 frontend and 3 backend tests, strict TypeScript, production build and browser behavior. Replaced deprecated TestClient usage with HTTPX ASGITransport; backend tests passed without warnings.
- Verified default ay=0.2 m/s², negative-charge reversal, field/mass scaling, play/pause/reset, trajectory and offscreen notice. npm audit reported zero vulnerabilities; an optional fsevents script remained blocked without affecting Vite.
- Known Day 1 follow-ups included presets, pedagogy, repeatable browser tests and DPR changes without CSS resizing.

## Day 2 — 2026-10-14

### Inspection and scope

Read the source, README, architecture, development log, original tests, scripts and lockfiles before editing. Baseline rerun passed 31 Vitest and 3 Pytest tests and production build. Source folder has no `.git`; Git status therefore cannot report a working-tree diff. No Git repository or commit was created. Existing runtime dependencies and backend source/tests were retained.

### Implemented

1. Four typed, frozen presets with descriptions, learning objectives, SI parameters and expected behavior. Store application validates and commits one atomic reset/pause/identity transition. Manual edits clear identity.
2. Frozen detached baseline snapshots and a pure comparison model with all eleven required quantities, signed and absolute differences, classified percentage changes and safe zero/overflow handling. Comparison subscribes only to parameter references, not per-frame time.
3. Four authored lesson steps in a separate data module. Previous/Next clamps at boundaries and preserves the experiment. A separate explicit action applies suggestions through the common preset path.
4. Schema-versioned pure SI Simulation Context builder, with field allowlisting, detached vectors, analytical state and explicit optional IDs. No provider calls were introduced.
5. Playwright Test 1.64.0 as the only new direct dependency, an isolated 5174 webServer, Chromium tests, failure traces and stable accessible selectors. Vitest discovery remains separate.
6. DPR resolution query, window resize handling and a lightweight per-frame DPR comparison, preserving the RAF and cleanup lifecycle.
7. Existing input error text now has aria-describedby; transient drafts support keyboard negative entry and reset stale errors when applying presets. Responsive panels and an accessible scrollable comparison table extend the existing theme.

### Bugs found and fixed

- A new zero-component assertion encountered IEEE-754 negative zero under negative charge. Changed that new numerical assertion to tolerance comparison; did not alter original tests or physics behavior.
- Existing controlled number fields prevented natural intermediate negative/empty keyboard input. Added transient drafts without changing committed physical state; a keyboard-entry E2E verifies the fix.
- Input validation errors could remain after applying a valid preset. Committed parameter changes now synchronize drafts and clear those stale messages.
- Resolution-query-only DPR handling failed an actual Chromium emulation regression test. Added a cheap RAF ratio comparison; dynamic DPR 2 → 1.5 → 1 now updates the bitmap without a CSS width change.
- Reviewed relative-difference arithmetic for negative and zero baselines, overflowing subtraction and nearby large values. Added explicit reasons/null outputs and a precision regression test.
- Context field spreading could accidentally copy untyped extra runtime data. The builder now explicitly picks allowed physical fields; a unit test verifies that extra properties do not enter serialized output.

### Final automated checks

- Vitest: 64 passed (original 31 unchanged + 33 new), 7 test files.
- Pytest: original 3 passed, no application warnings.
- Playwright: 14 Chromium tests passed with zero retries.
- Strict TypeScript: passed, including tests and configuration files.
- Production build: passed.
- npm dependency audit at installation: zero vulnerabilities. Existing runtime package versions retained.

Playwright covers all four presets applied to a running experiment, controls and AI placeholder, playback/pause/resume/reset, baseline edit/stability/clear, signed reversal versus magnitude, explicit lesson application/navigation, input errors and negative keyboard entry, offline simulation, 1280/1024/390-width layout, Retina 2× and dynamic DPR. The Node launcher emitted an environment-only NO_COLOR/FORCE_COLOR warning; it did not affect test results.

### Review and remaining debt

Reviewed SI conversions, pure physics reuse, atomic preset metadata, immutable baseline vectors, zero-baseline percentages, lesson/experiment separation, narrow subscriptions, RAF/listener cleanup, contextual accessibility labels and transport detachment. No unresolved critical or high-severity issue was found within Day 2 scope.

Real multi-monitor moves and browser zoom controls, Safari/Firefox, mobile hardware, persistence, comprehensive screen-reader audits and deployment remain unverified. UI intentionally retains Day 1 Chinese labels beside English learning panels. The frontend context still needs matching server-side runtime validation before Day 3 integration. No LLM, auth, PostgreSQL or Docker was added.

### Live browser smoke and visual review

A separate real-backend Chromium smoke check on port 5173 verified API connected through the Vite proxy, applied Positive Charge, saved a baseline, applied Stronger Electric Field, played beyond 3 seconds, paused, and confirmed ay=0.4 m/s² and +100% comparison. Captured and visually reviewed full-page 1440px desktop and 1024px laptop screenshots. No browser console errors or uncaught page errors occurred. The long-running Day 1 Vite process initially served stale transformed modules; restarting that owned development server exposed the updated source and resolved the smoke check. The current server on 5173 serves Day 2.

## Day 3 — Context-Aware AI Tutor and Git initialization

See `development/2026-10-14-day3.md` for the dated record and `development/workflow.md` for the daily GitHub procedure. Day 3 adds verified backend physics/context validation, an async configurable provider, safe local API and a snapshot-associated tutor UI. Automated tests use mocks; real provider verification remains pending without credentials. The stable Day 1/2 source is committed as `79cbb32`; development continues on `feat/day3-ai-tutor`. Remote authentication/push status is recorded separately and is never inferred from a local commit.

## Gemini configuration follow-up

Added backend-local .env loading, Gemini endpoint regression tests and safe model-unavailable errors. The real model-list endpoint returned 200, but the requested gemini-2.5-flash-lite generation returned 404: Google says it is unavailable to new users. No live explanation success is claimed; see the Day 3 daily log.

## Gemini integration completed with real generation

The user-authorized gemini-3.5-flash-lite now returned real HTTP 200 through the production adapter, all three requested physics scenarios and the React interface. Correct force/acceleration directions and SI values were manually reviewed, including Chinese output and doubled-field behavior. Regression suites passed (76 Vitest, 79 Pytest, 19 Chromium; strict/build). Exact remaining project quota is not available; no billing configuration was changed. See development/gemini-live-validation-2026-10-14.md and the Day 3 daily log.

## Day 4 Phase 0 — CI and merge gate

Inspected PR #1 and confirmed it is still open. Added a two-job GitHub Actions workflow on the Day 3 branch; local and remote validation outcomes are recorded in development/2026-10-14-day4.md. Day 4 application development waits for the explicit Day 3 merge gate.

Phase 0 remote CI confirmed successful for commit 802ad52: https://github.com/lmy666888/vibelearning/actions/runs/38674626707 . Both Ubuntu jobs passed, including 76 Vitest, 79 Pytest and 19 Chromium E2E. Day 4 application work remains gated by explicit approval to merge PR #1.
