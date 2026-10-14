# Architecture

## Extension of Day 1

Day 2 preserves the original React/Vite/Tailwind/Zustand application and FastAPI health API. No runtime dependency was replaced. The analytical equations, fixed world coordinates, SI convention and existing physics tests remain intact.

`App` composes the simulation/control workspace, a preset/lesson learning row, live readings, a comparison table, and the original educational/AI-placeholder panels. New panels extend the existing dark theme and responsive breakpoints.

## Physics and projections

`physics.ts` owns force, acceleration, analytical particle state, trajectory sampling and vector magnitude. Validation rejects non-finite inputs, non-positive mass, negative time and overflowing results. `coordinates.ts` maps physical y-up to Canvas y-down using one scale factor. Components never recalculate force or acceleration.

## State and preset transitions

`presets.ts` defines `ExperimentPreset` (ID, title, description, learning objective, expected behavior and SI parameters). Four immutable presets represent charge sign, doubled field, and no field. Nested vector snapshots are cloned and frozen.

Zustand owns parameters, status, elapsed time, error, activePresetId, baseline, and currentLessonStepId. `applyPreset` validates and commits parameters, identity, paused status, time zero and cleared error in one `set` notification. Trajectories are analytical projections of time, so zero time clears the path without maintaining a second trajectory state. Manual edits validate, reset/pause, and clear preset identity; reset retains current identity and parameters. Baseline and lesson navigation do not change physical time or playback.

Control inputs keep only a transient text draft to support empty/negative keyboard entry. Invalid drafts display accessible errors and leave committed physical parameters unchanged. A preset or committed parameter change synchronizes drafts and clears stale validation messages. Drafts are never used by physics.

## Comparison

The baseline is a detached, deeply frozen parameter snapshot. Save replaces it explicitly; Clear removes it. `comparison.ts` derives all physical values through the engine at t=0 because force and acceleration are constant in this model. Display-unit conversions live with the pure comparison model.

Each row includes ID, label, units, scalar/component/magnitude classification, before/current values, signed delta, percentage and an explicit undefined reason. Absolute difference is the magnitude of delta. Percent is `100 * (current - baseline) / abs(baseline)`, not division by a signed baseline. Zero baselines, including zero-to-zero, have no defined relative percentage. Arithmetic overflow is represented by null, never displayed as NaN/Infinity. A ratio fallback permits a finite percentage when raw subtraction overflows; finite deltas are used directly to retain precision for nearby large values.

`ExperimentComparison` subscribes to parameter/baseline references and memoizes rows. Time ticks do not cause rerenders or alter the comparison. Presentation formats scalar differences; no physics formulas are embedded in React.

## Authored guided learning

`learning/lessons/uniformElectricField.ts` contains `GuidedLesson` and `LessonStep` data with stable IDs, objectives, explanations, conceptual questions and suggested preset IDs. The pure navigation helper clamps at the first/last step. Store navigation changes only currentLessonStepId; applying a suggestion explicitly calls the shared preset action. The lesson component has no effect that overwrites parameters on navigation.

The schema separates educational content from UI so future validated/generated content could use the same renderer. Day 2 content is authored, with no fake chat or provider integration.

## Simulation Context v1

`buildSimulationContext(input)` is pure and accepts parameters, time, optional active preset ID and optional current lesson step ID explicitly. It returns:

```ts
{
  schemaVersion: 1,
  simulationId: 'uniform-electric-field-2d',
  unitSystem: 'SI',
  parameters,
  time,
  particleState,
  force,
  acceleration,
  activePresetId: null | PresetId,
  currentLessonStepId: null | LessonStepId
}
```

The builder explicitly picks physical numeric fields and clones nested vectors, preventing accidental propagation of extra runtime properties. Derived values are calculated from one analytical state, validated for finiteness and detached from inputs. Optional IDs serialize as explicit null. Force/acceleration are repeated at top level as requested transport fields and agree with particleState when built; consumers should treat the transport snapshot as read-only.

The object includes no controls, layout, baseline, secrets or personal details. Stable simulation/step IDs let a future tutor ground explanations in the same experiment. Version and SI markers allow the backend to reject incompatible contracts. Day 3 must introduce runtime server validation and a privacy-reviewed submission path; this builder alone neither makes network requests nor grants permission to send data.

## Canvas lifecycle and DPR

The existing single RAF loop renders analytical state and directly advances the store without subscribing the whole React tree. Physical information polls at 100 ms. Visibility changes clear the last frame timestamp; hidden tabs do not advance. Delta is capped at 50 ms. Reset/parameter/preset changes all set t=0.

ResizeObserver and window resize synchronize CSS dimensions with DPR-scaled bitmap dimensions. A resolution media query is re-armed after every DPR change. Because Chromium's emulated DPR changes did not reliably emit resolution events during testing, RAF also compares the current DPR with the last rendered ratio; it rebuilds the bitmap only when the ratio differs. That check requires no layout read on ordinary frames. Cleanup cancels RAF, disconnects the observer, and removes visibility, resolution and resize listeners, including under StrictMode setup/cleanup.

## API and testing boundaries

FastAPI uses an organized API router, Pydantic health schema and local CORS. Its existing three tests use HTTPX ASGITransport. API health failure cannot block client-side simulations.

Vitest includes only `src/**/*.test.ts`; Playwright uses `e2e/` to avoid cross-running test frameworks. Playwright starts its own Vite server on 5174 with no server reuse. Learning tests intercept health and separately cover failure. Tests use semantic roles and bounded assertions, no arbitrary sleeps, with zero retries. Retina/DPR emulation checks bitmap dimensions; real multi-monitor and browser zoom behavior still need hardware validation.
