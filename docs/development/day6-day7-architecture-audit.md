# Architecture audit before the second experiment — 2026-10-15

Verified Day 5 PR #3/main CI, clean mergeability, no review blockers and remote tracked secret scan. Authorized normal merge: d5acaa48e2edb2e0b01da3b094160d47a4e78354; prior feature branch retained.

Coupling found: frontend simulationStore, core/SimulationContext, actions/learning clients and previews import the electric parameter/state types directly. ControlPanel hardcodes six IDs. SimulationCanvas combines analytical evaluation, a fixed viewport, trajectory calculation, drawing and RAF timing. Presets/comparison/authored lessons are electric-specific. Backend Context v1, action Target/Preset enums and lesson schemas embed electric IDs; canonical_state and AI prompts assume qE. CI correctly uses mocks and locked dependencies.

Decision: preserve these tested implementations as an explicit Context v1 compatibility surface and electric presentation/runtime adapters. Add a parameter/state/observable-generic plugin contract, explicit registry and canonical shared manifest; React rendering stays outside scientific plugins. Context v2 identifies experiment/version and deterministically fingerprints validated state. New shared AI/action/learning orchestration dispatches only through registered capabilities and deterministic models, never experiment-name conditionals. Both plugins use this workflow; no Lorentz-only chatbot or action protocol.

Sequence: implement registry/contract and electric adapter first, run old regression suites, then implement/test Lorentz physics and renderer, shared selector/workflow, new integration tests, live verification and delivery. Session recovery remains explicitly deferred to prioritize model correctness and safe transitions.

Electric-only registry/adapters were introduced before Lorentz implementation. All existing 128 Vitest, 169 Pytest and 26 Chromium tests passed, with typecheck/build passing. Work crossed local midnight; implementation/completion reporting uses 2026-10-15.
