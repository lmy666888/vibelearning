# Unified workspace audit and ordered implementation plan — 2026-10-15

PR #4 checked OPEN/main, CLEAN/MERGEABLE, both exact-head CI jobs successful, no review or issue comments. Scanned remote tracked head for configured key and credential signatures before authorized normal merge 9360626634f04b4ca85fd1588f1df4b59a0b79dd. Prior branch preserved; new branch feat/unified-experiment-workspace.

## Findings before implementation
- Platform.tsx has separate ElectricPresentation/LorentzPresentation, duplicated preset/control/playback placement and inconsistent comparison/lesson presentation. AI orchestration is already shared and should remain so.
- Electric retains a long stacked Day 1–5 page, Lorentz embeds an entire parameter sidebar. Generic buttons inherit old global styles; spacing/headings/panel hierarchy and language are inconsistent. Side panels consume the canvas rather than collapse/resize.
- Separate Canvas implementations own fixed world mappings. DPR handling exists but there is no shared camera, fit, zoom, pan, focus, region hit testing or undo transaction.
- Runtime electric adapter depends on the historical store; Lorentz already uses fixed ticks. Both scientific plugins assume a uniform field. Context v2/independent recomputation, revision guards and explicit confirmation are reusable.
- Shared manifest is canonical for capabilities, but has no region schema, spatial presets or standardized bilingual educational metadata. Generic action union handles only numeric fields/presets/reset.
- Storage is memory-only. Persistence must validate parameters/version/size, restore paused and discard incompatible lesson/proposal identity.
- Existing independent uniform science tests and legacy UI/API paths must remain. CI mocks external generation and has frontend/type/build/Chromium and backend jobs.

## Implementation order and decisions
1. Verify baseline; introduce scoped Tailwind-compatible workspace tokens and one reusable header/toolbar/sidebar/metrics/education structure for both current plugins.
2. Implement bounded camera transforms and responsive shared particle Canvas, with independent CSS/device/world coordinates; resizable panels/focus/mobile tabs.
3. Add a third explicit multi-zone plugin. Canonical versioned rectangular-region schema, lower-inclusive/upper-exclusive boundaries, zero outside, sum enabled overlaps. Existing uniform engines unchanged.
4. Implement bounded event-aware substeps using conservative distance/acceleration envelopes, edge bracketing and deterministic finite budget. Validate thin-region traversal and independent reference convergence before editor integration.
5. Add atomic region editor transactions, preview drags, exact SI inspector, snapping/alignment and bounded undo/redo without traces. Reuse action/lesson validators with discriminated region operations.
6. Versioned bounded local restore, paused state, safe compatible lesson progress; unknown versions rejected/migrated explicitly.
7. Scientific/API/UI/E2E regressions, measured browser scene (no invented FPS), limited real Gemini checks, docs/date log, secret scan, normal commit/push/new unmerged PR and exact-head CI.
