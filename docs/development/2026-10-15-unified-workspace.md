# Unified Experiment Workspace & Multi-Zone Electromagnetic Editor

## 1. Date and objective

Actual development date: 2026-10-15, America/New_York. Unify the two existing experiments and implement an actual prescribed multi-region electromagnetic laboratory, retaining the shared AI/lesson infrastructure and old scientific engines.

## 2. GitHub preparation and audit

Verified PR #4 OPEN/main, CLEAN/MERGEABLE, both exact-head CI jobs successful, no reviews or issue/review comments blocking it. Remote head scanned for the configured key and credential signatures. Under the attached explicit authorization, normally merged as `9360626634f04b4ca85fd1588f1df4b59a0b79dd`, preserving the Day 6–7 remote branch. Updated main ff-only and created `feat/unified-experiment-workspace`. No force push, branch deletion or history rewrite. Architecture/UX findings and ordered plan were written before implementation in [workspace audit](2026-10-15-workspace-audit.md).

## 3. Features implemented

- One scoped design system and shared scientific workspace: header/selector/playback, consistent numeric controls/sliders and preset cards, resizable/collapsible sidebars, focus mode, mobile tabs, collapsible metrics/comparison and ten-section bilingual education.
- One particle Canvas presentation for the three current particle experiments, with explicit separate presentation bindings for future domain renderers/editors. Responsive CSS/DPR backing dimensions, isotropic world mapping, zoom/pan/reset/fit-all/fit-selected, native/keyboard height resizing, axes/grid/force and field legend/toggles.
- New explicit `multi-zone-em` v1 plugin, strict versioned rectangles, stable IDs, half-open boundaries, zero outside, deterministic electromagnetic superposition. Five physically simulated presets.
- Region create/select/rename/move/resize/duplicate/delete/enable/fields/color, exact SI inspector, adjacent alignment/snapping, preview-only drags and atomic validated commits. All physical edits pause/reset. Bounded undo/redo (40 parameter states, no trajectories), invalidated across external revisions.
- Conservative geometry/speed/gyro substeps plus ballistic-chord edge cuts; no recursive unbounded integration. Independent scientific verification and cross-runtime contexts.
- Strict regional AI action variants through the same existing tutor/action/lesson/feedback infrastructure. Verified current local fields/IDs/force, displacement, velocity/energy-change summaries; no full trajectory sent. Explicit confirmation, identity and stale-revision protection preserved.
- Versioned bounded whitelisted local restoration, including camera/height/visibility/language and compatible advisory lesson progress. Restore paused t=0; fresh lesson setup preview/confirmation required. Corrupt/unknown/oversized state fails to defaults. Optional v1 height defaults to 560; no earlier persisted workspace schema existed.

## 4. Files added/modified

Scientific: shared/experiments.json, shared/education.json, shared/fixtures/spatial-contexts.json; frontend experiments spatial/regionActions plus registry/runtime/actions/validation/learning; backend experiments spatial/region_actions plus registry/ai. UI: workspace camera/editor/persistence/presentations/WorkspaceCanvas/RegionEditor/Education/workspace.css; existing Platform/PlatformAI/Controls/Observables. Tests: backend test_spatial/test_experiments; frontend workspace pure/UI tests, experiment registry assertions, platform fixture and platform/workspace Chromium journeys. Documentation: README, architecture, API, generic plugin guide, spatial-field-experiment-guide, physics verification, audit, dated daily report and development-log.

## 5. Architecture decisions

A separate third scientific plugin preserves uniform engines and avoids forcing future experiments to have electromagnetic regions. The shared manifest declares capabilities; strict domain action handlers are separate from generic orchestration. Presentation bindings are explicit, never user-provided dynamic imports. Camera is outside physical snapshots. Existing classic v1 UI/API and all historical tests remain; default workbench now uses the shared presentation rather than the previous unequal pages. AI stays one component/endpoint workflow for every registered experiment.

## 6. Tests executed and results

Before coding: 154 Vitest, 225 Pytest, 29 Chromium passed; strict TypeScript/build passed. Latest local suites: **176 Vitest, 264 Pytest, 35 Chromium**, all passed; strict TypeScript and production build passed. CI continues to use deterministic mocked providers, never a paid/external API. Final exact-head remote CI is verified after push, with run/head/results recorded in the delivery report and PR description.

Coverage includes all prior regressions, new registry/presentation selection, independent field/trajectory references, half-open/corner/thin-slab behavior, overlap cancellation, deterministic sampling, action schemas/atomicity/cross-plugin rejection, sequential region lessons and tamper rejection, region-aware endpoint mocks, camera transforms, keyboard drafts, undo/redo, safe restore, localized education, actual drag/handles/resize, responsive/DPR layout, cancellation/staleness and complete lesson observation/progress restoration.

## 7. Scientific outcomes

Covering electric region matches independent constant acceleration at 1e−10 SI. Covering magnetic circle/crossed-field reference matches continuous trig solution at 1e−5 position, 1e−6 velocity. A 0.1 m electric slab traversed at 10 m/s produces analytic Δvy=.01 m/s. Adjacent opposite electric fields preserve velocity/position, and two opposite magnetic regions match independent two-arc solution within 2e−4 m. Pure magnetic speed relative tolerance 5e−10; opposite overlaps cancel; neutral motion is straight. Excluded top-edge grazing has zero force; included lower-corner entry is tested. Boundary-entry circle refinement .02/.01/.005 s gives errors <.3 of previous and final <1e−6 m. These selected checks are not a universal second-order guarantee at arbitrary discontinuities.

## 8. Bugs discovered and fixed

- Merely reducing midpoint substeps produced nonmonotonic narrow-boundary impulse errors; added finite chord cuts at crossed edge planes and retained conservative slab bounds.
- Generic equality assumed objects and threw on region arrays; added recursive array handling and cross-runtime identity/toleranced science checks (last-bit speed/energy differences are expected).
- Optional regional patch serialization emitted unset null fields, breaking strict lesson reconstruction; omit them explicitly, retain rejection of supplied null patches.
- Snapshot-only immutable backend metadata did not alone constrain regional schema-version Literal coercion; added strict integer validators for new region/action versions.
- Browser drag test initially read camera scale before RAF updated the DOM; wait for scale change. Native height resize needed its handle scrolled into view. Added keyboard height control as well.
- Original shared parameter draft could lose a keyboard minus sign; use controlled decimal text draft, finite/range validation and separate validated sliders.
- Metrics initially subscribed only to clock buckets and could miss a parameter edit at t=0 or final pause; include revision/status in the throttled subscription key.
- A manual live diagnostic initially omitted backend environment loading and stopped before any network request; corrected to use the same fixed backend environment loader. No key was changed or printed.

- Final review caught electric 2× playback being capped after speed multiplication on slow frames; consume at most two bounded legacy ticks and verify 0.05 wall seconds yields 0.1 simulation seconds. Spatial frame-budget exhaustion now publishes its valid partial state before pausing instead of discarding accumulated integration work.

## 9. Real Gemini and measured browser verification

Two actual Google Gemini `gemini-3.5-flash-lite` requests through the running FastAPI HTTP server and existing provider adapter: region-aware Chinese explain **200**, regional plan-action **200**. Context at t=2.5 s is inside zone-b, local E=0, Bz=20 T; explanation correctly describes perpendicular magnetic force and no magnetic work in that region. Plan returns update_field_region on zone-b, Bz −20 T, leaves the other region unchanged and requires_confirmation=true. After preview physics is reset t=0 (outside all regions), correctly distinct from submitted before readings. No automatic retries, model changes, billing or project changes. No real lesson generation requested this milestone; regional lessons are validated with mocks/E2E. Final extra displacement/energy summary fields were checked offline, not an additional paid request.

Real browser inspected both responsive panel modes and a 3 s two-region simulation, with visible E acceleration then B curvature. Short performance scene: 12 regions, 120 RAF samples, local macOS 26.5.1 arm64, bundled Chromium 156 (Playwright Desktop Chrome's Windows UA), 1280×720/DPR1. One full-suite sample: elapsed 1991.6 ms, mean 16.5967 ms, P95 16.7 ms, maximum 16.8 ms. Zero AI requests, trace ≤2000. This is a short local sample, not a cross-device FPS or memory-soak guarantee. Screenshot is delivered separately from source.

## 10. Limitations and next priorities

Prescribed piecewise-uniform, nonrelativistic single-particle model, no Maxwell solver/fringe/induced fields/collisions/radiation. Ballistic crossing cuts approximate curved boundaries; grazing/corner timing errors remain and arbitrary discontinuities can have first-order/nonmonotonic refinement. Very small distinct edge gaps or stiff/high-speed scenes can be rejected by explicit 100000-step or per-frame budgets. Camera scaling/DPR cap and history/render density are bounded. Local progress is advisory and local-only; public multi-user learning needs authentication, server-owned progress and global quota. Request bodies remain ≤64 KiB, including saved lesson evaluation payloads. AI prose still needs review, even with authoritative physics tables/equations. Next: event-refined curved crossing solver with independent convergence envelopes, then a wave/nonparticle presentation to exercise the editor binding without rectangular regions.

## 11. Commit record

Verified base merge: `9360626634f04b4ca85fd1588f1df4b59a0b79dd`. This log is updated before the feature commit. Exact feature SHA/push/new PR/remote CI are reported only after GitHub confirms them; no future commit hashes or test results are fabricated here.
