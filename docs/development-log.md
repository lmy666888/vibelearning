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

## 2026-10-14 — Day 4 AI-assisted simulation control

After explicit user authorization, merged Day 3 PR #1 with normal merge commit `5af5490e718f299650ce14eb5e577751edce1dab`, retaining both parents and the remote Day 3 branch. Created `feat/day4-ai-simulation-control` from ff-only synchronized main. GitHub confirmed successful CI on both the final Day 3 head and main merge.

Implemented four strictly allowlisted action variants, `/api/ai/plan-action`, one-call Gemini planning, deterministic previews, shared parameter constraints, explicit confirm/cancel, revision-based stale/ABA protection and atomic paused/reset Zustand updates in the existing tutor. Context v1 and the explanation API are preserved. Automated tests use mocks: 106 Vitest, 126 Pytest and 24 Chromium E2E pass, strict TypeScript and production build pass. Real Gemini returned four successful operation proposals and the original Chinese negative-charge explanation still passed; a real React proposal was explicitly confirmed. No credentials are included in code or tests. Full evidence, files, limitations and decisions are in [Day 4](development/2026-10-14-day4.md#authorized-day-4-implementation).

## 2026-10-14 — Day 5 AI-guided learning workflow

With explicit conditional authorization and all prerequisites verified, merged PR #2 using normal merge commit `a76f23bb16fcdc472ec0819a51a6f1bf1d196047`, preserved Day 4 remote branch, ff-only synchronized main and created `feat/day5-ai-guided-learning`. Added strict bounded lesson generation, sequential deterministic step predictions, observation feedback, a controlled learning state machine, human-confirmed atomic step application, rollback/restart previews and shared zh-CN/en preferences with bounded language-error fallback. Reused existing simulation, actions, constraints and preview components. Session persistence is explicitly deferred; one in-memory session survives mode switches but not refresh.

Local final results: 128 Vitest, 169 Pytest and 26 Chromium E2E passed; strict TypeScript and production build passed. Real Gemini Chinese lesson and both correct/incorrect observation requests returned 200, correct structured assessment and sequential physics +0.4/−0.4/−0.8 m/s². Real React generation → confirmation → playback → Chinese feedback succeeded. See [Day 5 log](development/2026-10-14-day5.md), [API](api.md) and [ADR 0001](decisions/0001-deterministic-human-confirmed-learning.md). Remote Day 5 PR/CI are verified after push; local results alone do not claim remote success.

## 2026-10-15 — Day 6–7 multi-experiment platform

PR #3 was conditionally authorized and merged normally after passing checks, mergeability, review and remote secret inspection: `d5acaa48e2edb2e0b01da3b094160d47a4e78354`. Day 5 branch retained; created `feat/day6-day7-multi-experiment-platform` from ff-only updated main. Architecture audit and electric-only adapter regression were completed before Lorentz implementation.

Added explicit scientific plugin/renderer/runtime boundaries, canonical shared registry, deterministic input-bit Context v2, experiment-aware shared AI/action/lesson workflows, isolated switching and a Lorentz plugin using centered Boris/Cayley plus trapezoidal position. Original electric presentation and v1 APIs remain through explicit adapters/compatibility UI. Added five Lorentz presets, fixed-tick RAF, vector display, bounded trace, DPR/responsive behavior and scientific error budgets. Browser recovery is explicitly deferred.

Final local results: 154 Vitest, 225 Pytest, 29 Chromium E2E passed, strict typecheck/build passed. Original tests remain, with old browser journeys explicitly using ?context=v1 and new journeys covering both default-workbench plugins. Independent continuous-orbit tests check no-field/electric-only equivalence, magnetic energy/circle, sign reversal, radius scaling, E×B drift and second-order convergence. Initial real Gemini electric/action requests succeeded; Lorentz explanation/lesson initially failed language checks. After localizing manifest prose/plain-math instructions, final real-provider retries succeeded in Chinese, with radii 3/3/1.5 m. Full actual-date report, limitations and failures: [Day 6–7](development/2026-10-15-day6-day7.md). Remote CI is verified only after push; no local pass is claimed as remote success.

## 2026-10-15 — Unified workspace and multi-zone electromagnetic editor

Under explicit conditional authorization, normally merged PR #4 as `9360626634f04b4ca85fd1588f1df4b59a0b79dd` after exact-head CI/merge/secret/review checks, preserving prior feature branches. New branch `feat/unified-experiment-workspace`. Added one shared instrument-style layout/camera/presentation for current particle plugins, separate multi-zone scientific plugin, validated region editing/superposition/bounded boundary integration, shared regional AI/lesson actions and paused local restoration. Latest local verification: 176 Vitest, 264 Pytest, 35 Chromium, strict TypeScript/build passed. Two real Gemini region-aware Chinese explanation/action requests returned HTTP 200; CI remains mocked. Known corner/convergence/budget/local-progress limits are explicit. See [actual-date detailed report](development/2026-10-15-unified-workspace.md) and [spatial field developer guide](spatial-field-experiment-guide.md). Remote CI/push status is confirmed after delivery, never inferred from local tests.

## 2026-10-15 — Milestone 1: AI guardrails and usage governance

Authorized normal merge PR #5 as ab696edf07bf5b9667252342610301623d4ce757; feature branch feat/ai-guardrails-usage-governance. All real provider entry points share signed session/scope/reservation/output governance. Local 179 Vitest, 286 Pytest + 3 local Redis skips, 36 Chromium, type/build pass. Real scope routing diagnostics and limitations are documented in [Milestone 1 log](development/2026-10-15-m1-governance.md); no downstream milestone begins before exact-head CI including Redis passes.

## 2026-10-15 — Milestone 2: independent double-slit optics

Stacked from verified Milestone1 head3e61e2b (PR#6, unmerged). Added independent scalar Fraunhofer optics, exact screen angles, finite-width envelope, seeded discrete detection statistics, specialized Canvas, six presets, bilingual content and generic event-count runtime; shared AI/usage policy unchanged. See [Milestone2 log](development/2026-10-15-m2-double-slit.md) and [scientific model](physics-double-slit.md). Exact tests/PR/CI are recorded after verification.

## 2026-10-15 — Milestone3: Keplerian two-body relative orbits

Stacked from verified Milestone2 head09f7f44, no merges of new feature PRs. Independent safeguarded Kepler solution, three-law visuals, six presets, compact SI context and inherited governance. Full assumptions, units/bounds/root method/independent tests in [scientific contract](physics-kepler.md); actual milestone record in [dated log](development/2026-10-15-m3-kepler.md). Counts and exact-head CI confirmed in delivery report.

## 2026-10-15 — Milestone4: Momentum & Collisions

Sequential start after verified M3 head7663dc5 CI190/333/39. Independent1D/2D event model with analytical continuous impact, restitution/COM,7presets and charts, shared six-plugin workflows. See [daily details](development/2026-10-15-m4-collisions.md), [physics](physics-collisions.md). Earlier stacked PRs remain unmerged. Final actual tests and CI recorded after verification in the PR/acceptance report.

## 2026-10-15–16 — Milestone5 integration and controlled beta hardening

Normal-merge PR6→7→8→9 after exact-head CI/review/credential/target checks; finalmain ee31ae64c6cb5aeae10dda2f068ccfff69b6d49a. Full baseline198Vitest/371Pytest+3localRedis skips/41Chromium/type/build. Independent hardening worktree preserves the source folder's uncommitted whitespace edit. Details in [2026-10-16 release log](development/2026-10-16-m5-release-hardening.md). No public deployment, paid infrastructure or large real Gemini evaluation.
