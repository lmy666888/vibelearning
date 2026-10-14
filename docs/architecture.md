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

The schema separates educational content from UI so future validated/generated content could use the same renderer. Guided lesson content remains authored. Day 3 adds a separate provider-backed tutor without changing those lesson data or navigation semantics.

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

The object includes no controls, layout, baseline, secrets or personal details. Stable simulation/step IDs let a future tutor ground explanations in the same experiment. Version and SI markers allow the backend to reject incompatible contracts. Day 3 introduces matching strict server validation and an explicit submission path. The pure builder itself performs no I/O. Only the tutor submit action sends a detached snapshot.

## Canvas lifecycle and DPR

The existing single RAF loop renders analytical state and directly advances the store without subscribing the whole React tree. Physical information polls at 100 ms. Visibility changes clear the last frame timestamp; hidden tabs do not advance. Delta is capped at 50 ms. Reset/parameter/preset changes all set t=0.

ResizeObserver and window resize synchronize CSS dimensions with DPR-scaled bitmap dimensions. A resolution media query is re-armed after every DPR change. Because Chromium's emulated DPR changes did not reliably emit resolution events during testing, RAF also compares the current DPR with the last rendered ratio; it rebuilds the bitmap only when the ratio differs. That check requires no layout read on ordinary frames. Cleanup cancels RAF, disconnects the observer, and removes visibility, resolution and resize listeners, including under StrictMode setup/cleanup.

## API and testing boundaries

FastAPI uses an organized API router, Pydantic health schema and local CORS. Its existing three tests use HTTPX ASGITransport. API health failure cannot block client-side simulations.

Vitest includes only `src/**/*.test.ts`; Playwright uses `e2e/` to avoid cross-running test frameworks. Playwright starts its own Vite server on 5174 with no server reuse. Learning tests intercept health and separately cover failure. Tests use semantic roles and bounded assertions, no arbitrary sleeps, with zero retries. Retina/DPR emulation checks bitmap dimensions; real multi-monitor and browser zoom behavior still need hardware validation.

## Day 3 backend boundaries

`schemas/ai.py` defines frozen strict models matching Context v1, with forbidden extra fields and finite numeric constraints. `context_validator.py` independently calculates analytical state and verifies all frontend-derived components and duplicated force/acceleration fields. The prompt receives the canonical server result, never an unchecked client-derived value. Relative tolerance is 1e-8 with a 1e-15 absolute floor; values outside finite range are rejected.

`config.py` reads backend-only environment values without exposing key representations. `TutorProvider` is an async protocol; `OpenAICompatibleProvider` is its single production adapter. HTTPX streams and bounds the upstream envelope, does not follow redirects or trust environment proxies, requests JSON output and bounded tokens, and validates the content into `Explanation`. Timeout, transport, upstream and malformed responses become safe domain errors. No raw provider exceptions reach the UI.

`TutorService` owns per-process fail-fast concurrency (two slots) and total deadlines, verifies context before calling the provider, assembles messages through `prompt_builder.py`, and checks output before return. A system message defines physical direction, SI conventions, question-language matching and data/instruction boundaries. The student question and context are serialized as user-role JSON data. No tools or parameter-mutation actions are exposed. Prompt rules reduce injection risk but cannot guarantee language-model behavior; deterministic readings remain authoritative.

`routes/ai.py` handles HTTP mapping and local/origin guards; `request_limits.py` bounds streamed request bytes before JSON parsing. The application sanitizes validation errors to locations/messages/types without echoing input values. Health routing remains independent of provider configuration. CORS permits POST only for configured origins. Uvicorn remains loopback-only; authenticated/budgeted access is required before any public proxy/deployment.

## Day 3 frontend lifecycle

`services/tutor.ts` captures and recursively freezes a context and question, validates structured responses, and maps known backend codes to safe messages. `AITutorPanel` associates every response with its exact request. The single in-flight controller prevents duplicate submissions and aborts on unmount; identity and abort checks prevent late state updates. Retry explicitly captures current state.

A store subscription compares time, physical parameters and educational IDs to the submitted context. A ref records the last stale flag, so ordinary animation frames do not repeatedly set React state. No physics or Canvas execution waits for the network. The UI identifies earlier snapshots and shows submitted time, preset and SI parameters. It renders escaped plain text; no HTML injection or remote links are synthesized.

## Day 3 tests

Testing Library/jsdom tests the form, loading/result/error states, immutable snapshots, stale notices, request deduplication and cleanup. Existing Vitest physics and store tests remain intact. Four additional Chromium cases cover suggestion selection, success, failure/retry and concurrent simulation changes. The obsolete Coming Soon assertion was updated to the implemented panel. Backend tests use mocked HTTP and provider dependencies; no test spends provider credit.

## Gemini environment follow-up

`app/environment.py` loads a fixed absolute backend-local .env path before CORS settings and app construction. It uses python-dotenv without variable interpolation and without overriding explicit process environment. Configuration still flows through the existing four LLM environment variables and ProviderSettings validation. Missing .env remains safe. Gemini uses the existing HTTP adapter and API/physics contracts; upstream 404 has a distinct safe model-unavailable classification. Live model-list success does not imply permission to generate with every listed legacy model.
