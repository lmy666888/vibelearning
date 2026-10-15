# How to Build a Spatially Varying Field Experiment

Implemented 2026-10-15. The new `multi-zone-em` v1 plugin is separate from uniform electric/Lorentz v1 plugins. Rectangular regions are a domain-specific parameter schema, not a requirement of ExperimentPlugin. Reuse the generic context/action/lesson APIs; a future wave or chemistry editor should register its own scientific schema and explicit presentation binding.

## Scientific domain and schema

All quantities use SI. Particle parameters: charge, mass, initialPosition, initialVelocity, timeStep and duration. The shared manifest defines units/bounds/presets. `regions` contains at most 12 entries:

```json
{"schema_version":1,"id":"zone-a","name":"Electric region","geometry":{"type":"rectangle","x":-5,"y":-5,"width":5,"height":10},"electric_field":{"x":0,"y":100},"magnetic_field":{"z":0},"enabled":true,"color":"cyan"}
```

IDs match `[a-z][a-z0-9-]{0,31}`, are unique and stable under rename/move/resize. Names 1–48 characters; colors cyan/violet/amber/green. Finite rectangular geometry remains within [-100,100] m, dimensions [.1,200] m; each field component in [-500,500] SI. No automatic clamping of invalid physical parameters. Empty region lists and disabled regions are valid.

A rectangle includes its lower x/y edges and excludes upper edges. Outside enabled rectangles E=B=0. Sample in sorted ID order for deterministic sums. Enabled overlaps add Ex/Ey/Bz, never trajectory vectors; adjacent shared boundaries have one owner. Opposite overlapping fields cancel. The Canvas uses translucent boundaries/colors, local field arrows and ⊙(+B out)/⊗(−B in). Visual-only metadata cannot affect the force.

## Numerical method and bounds

Retain the synchronized centered Boris/Cayley uniform-field step with symmetric E kicks and trapezoidal position. Multi-zone sampling uses the midpoint ballistic position, then applies this local prescribed field. To resolve narrow slabs, collect distinct enabled x/y edge planes, compute minimum positive separation d, and bound speed by

`v_bound = |v0| + |q/m| × (sum enabled |Ei|) × duration`.

Magnetic rotations preserve norm; symmetric E impulses justify this conservative speed envelope. Choose

`h = min(requested_dt, d/(8 v_bound), .02/(|q/m| sum |Bi|))`

with zero-denominator terms omitted. This limits path length per outer step to d/8 and bounds gyro-angle even with overlapping fields. Reject configurations requiring >100000 outer steps rather than silently undersampling. At each outer step, split the ballistic chord at every enabled edge plane; at most 48 cuts / 49 local pieces (12 rectangles). A final fractional step is deterministic. There is no recursive search or unconstrained loop. Per RAF call ≤1000 outer steps; if catch-up exceeds that budget the runtime pauses with an explicit error. Trace holds ≤2000 points; global field glyphs ≤48 and per-region glyph sites ≤36; grids ≤150 lines per axis, with viewport culling of regions.

The edge-plane chord is a crossing-time approximation, not an exact curved-orbit event solver. The conservative slab cap prevents jumping across an entire narrow axial slab, but cannot promise exact timing for grazing curved corner crossings. Discontinuous-field errors may converge non-monotonically for arbitrary placements. General boundary error is finite and can be first order; selected analytic straight-crossing and circular cases converge more strongly. Unsupported tiny edge gaps explicitly fail budget validation. Use timestep refinement and independent references for new presets, especially near corners. No physical claim about fringe/induced fields is made.

Position/velocity updates never jump or reset on crossings; only local acceleration may jump. Inputs/outputs are finite and bounded; magnetic-only speed drift above max(1e−11, |v0|×5e−10) fails. Viewport/camera does not enter scientific inputs, query or snapshot identity.

## Add a new spatial experiment

1. Add canonical manifest metadata, parameter definitions, scientific limits, actions, five educational presets and bilingual education data.
2. Implement a strict scientific parameter schema in both runtimes. Declare edge ownership, outside-field and overlap semantics explicitly.
3. Implement independent TS/Python sampling and deterministic integration using a bounded resolution policy. Reuse uniform physics only where valid.
4. Register explicit engines; add cross-runtime input/context fixtures and exact input identity checks, toleranced derived values.
5. Register a runtime factory and a separate presentation in `workspace/presentations.tsx`. The current three particle renderers share WorkspaceCanvas; other domains can use different Canvas/Inspector components.
6. For domain edits, extend the strict discriminated action union with a data-only handler. Check capability, identity, IDs and all scientific bounds after each action. Never execute model-provided code/paths.
7. Reuse shared tutor, confirmation, sequential lesson, observation and stale-revision machinery; no domain-specific AI page.
8. Add independent analytical or convergent reference tests, boundary corner/thin-region tests, invalid limits, both-language API mocks, restore validation and browser editor journeys.

## Editing, camera and storage

One scoped workspace uses reusable header/selector, playback, parameter/preset cards, Canvas, inspector, metrics, education and AI panel. Sidebars resize with pointer or arrow keys; narrow screens use parameters/canvas/AI tabs. Focus mode hides sidebars. Canvas can be resized natively or through a keyboard-operable height slider. World↔CSS-screen transforms use one isotropic px/m scale, with independent DPR backing dimensions (DPR capped at 4). Cursor-anchored wheel/trackpad zoom bounds [.5,1000] px/m; pan center ±10000 m; reset/fit-all/fit-selected do not mutate simulation state.

Drag preview stays local to the renderer; pointer-up validates and commits once. Escape/cancel discards it; stale revision rejects it. Empty-space/Shift dragging pans, region bodies move, four corner handles resize. Exact inspector values, snapping and adjacent alignment use meters. Every physical edit pauses/resets and increments revision; undo/redo stores at most 40 validated parameter states, without traces, and is cleared across external AI/manual revisions.

Browser key `vibelearning.workspace`, schema_version 1, ≤100000 characters. Persist only whitelisted experiment/version, validated parameters/regions, camera/height/visibility, language, validated lesson/index/bounded advisory progress/answer. Optional viewport_height defaults to 560 for earlier v1 saves. No older workspace format existed; unknown versions fail safely, never guessed/misinterpreted. Invalid geometry, unknown versions, oversized/malformed JSON or blocked storage are handled clearly. Restore is paused at t=0 with no trace, baseline, outstanding proposal or confirmation authority. Restored lesson requires fresh preview/confirmation; manual geometry changes invalidate pending action/observation revisions. Local progress is advisory, not server-authenticated mastery. No credentials/system prompts are persisted. Reset saved workspace clears stored state and returns paused defaults.

## Verification and limits

See physics-verification.md and the actual-date development log for tolerances, real Gemini statuses and measured browser performance. Sessions are local-only, not cross-device/authenticated. Prescribed uniform tiles are not a Maxwell solver: no fringe field continuity, collisions, radiation, relativity, space charge or induced fields. Large stiffness, tiny unrelated edge gaps and high simulation speed can hit explicit budgets; lower duration/speed or widen geometry. Do not deploy publicly without separate authentication, quota and server-owned learning authority.
