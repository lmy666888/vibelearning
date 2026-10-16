# How to add a new experiment

1. Add a unique ID/version, title, subject, description, limits, units, writable/read-only parameter paths, operations, observables, initial query, equations, renderer ID, capabilities and limitations to `shared/experiments.json`. Add meaningful presets (name, description, objective, expected behavior, validated parameters). Do not copy charge/mass fields for a model that does not use them.
2. Define strict frontend/backend parameter and query schemas. Reject extra fields, nonfinite/range violations and invalid coupled configurations. Use the manifest for shared bounds and action paths. Bump versions for incompatible changes; unknown versions must reject rather than migrate implicitly.
3. Implement the scientific engine using `ExperimentPlugin<P,S,O,Q>` / the backend Protocol. Separate state from observables; the query may be a time, static input or another model coordinate. Provide a deterministic initial state and bounded evaluation. Document error budgets and workload limits for numerical solvers.
4. Register both implementations explicitly in `frontend/src/experiments/registry.ts` and `backend/app/experiments/registry.py`. No user-supplied import paths or code are permitted.
5. Supply a runtime/presentation binding appropriate for the model. The existing current-particle adapters are clock-based; a static experiment can expose a static query/control view without adopting particle equations. Keep scientific code independent of React. Register the renderer/presentation ID in `components/Platform.tsx` and runtime factory in `runtime.ts`; unknown IDs must not choose an arbitrary renderer.
6. Renderer responsibilities include coordinates, DPI, resizing, accessible labels, RAF cleanup and domain-specific visualization. Do not make it authoritative for physical calculations. Control definitions and preset metadata should come from the manifest. Use readonly parameter descriptors for coordinates not exposed to AI mutation.
7. Reuse `makeContext`, `applyActions`, proposal/lesson validation and the shared AI component/client. The backend `experiments/ai.py` must not need an experiment-name branch. Explain, action planning, lessons and feedback receive the manifest plus recomputed observables. Only declare operations that the plugin can validate; canonical equations should be math-only and ≤160 characters (up to eight).
8. Add independent scientific correctness tests (closed-form solution, conservation law or independently implemented reference), explicit tolerances, invalid-input/coupled-limit tests and convergence for numerical models. Do not validate a solver only against itself.
9. Extend `shared/fixtures/experiment-contexts.json` and both runtime compatibility tests. Compare canonical presets against legacy definitions when adapting an existing model. Check deterministic snapshot normalization in Python and TypeScript.
10. Add mocked AI tests for explanation, action bounds, confirmation bypass, wrong experiment/version, sequential lessons, observations, language/error handling and no mutations during planning. Include a selection/switch-away-back E2E journey, rendering/controls, preview/confirm, one lesson step and isolation. CI must not call paid/external models.
11. Update API/model/limitation documentation and the actual-date development log; inspect diff/secrets, run locked tests/typecheck/build, push a feature branch and verify real CI. Keep PRs unmerged unless explicitly authorized.

## Minimal nonparticle/static scaffold

This example is intentionally small and is not an automatically loaded plugin:

```ts
const staticModel: ExperimentPlugin<
  { slope: number }, { result: number }, { output: number }, { input: number }
> = {
  id: 'linear-response', version: 1,
  validateParameters(value) {
    const p = value as { slope: number };
    if (!Number.isFinite(p.slope)) throw new Error('Invalid slope');
    return p;
  },
  createInitialState: () => ({ result: 0 }),
  evaluate: (p, q) => ({
    state: { result: p.slope * q.input },
    observables: { output: p.slope * q.input },
  }),
};
```

Production registration should add strict exact-field/range validation, units and query validation. At the shared JSON boundary, wrap scalar/array values in named object fields. The backend tests register an isolated static model with query `{input:3}` and parameter `{slope:2}` to exercise context/action dispatch without position, velocity, force or time. Such a model needs its own static presentation/runtime binding, but no new AI workflow.

## Recovery and deployment boundary

No session persistence is enabled in this milestone. A future recovery feature must version the experiment/lesson/session, independently revalidate all stored data, normalize pending/running status to paused and require confirmation before restoring current state. Never store keys or prompts. FNV snapshot IDs are deterministic correlation identifiers, not signatures. Public deployment needs authentication, server-owned session identities and global quota controls.

## Shared workspace presentation extension

The uniform electric and Lorentz plugins use the same camera-aware particle presentation. The third `multi-zone-em` v1 plugin adds a rectangular-region Inspector through `workspace/presentations.tsx`. This is an explicit presentation binding, separate from scientific registry/lifecycle/AI. Future non-electromagnetic models should bind their own renderer/editor rather than introduce regions into the generic contract. Camera controls and storage must be validated for that domain; do not assume every future query has time or particle coordinates. Follow [How to Build a Spatially Varying Field Experiment](spatial-field-experiment-guide.md) for the implemented spatial case and bounded numerical strategy.

Optics demonstrates a nonparticle model: register its own parameter schema/evaluate query, a bounded event-count clock and a ScientificCanvas view binding. It does not use rectangular field regions. Keep display apparatus geometry distinct from physical model geometry; obtain plotted data from the scientific engine. Follow physics-double-slit.md for units/limits/independent test references.

Kepler demonstrates an independent analytical SI model with a period-scaled runtime and AU camera presentation. Domain display units never enter scientific snapshot coordinates. Expose solver residuals/invariants, use independent mathematical reference cases, and document the chosen reference frame. Shared AI remains capability-driven.

Collision reference: register `momentum-collisions`/`collisions-canvas` independently. Scientific runtime config uses time,1second/second and parameter horizon, with explicit replay reset. Bound event state replaces trajectories. Add strict nested numeric controls and coupled1D/overlap validation; arbitrary action targets remain manifest-whitelisted. New plugins automatically enter shared all-domain4-operation AI governance tests. Always test an independent oracle (COM restitution, known contact normal) and cross-runtime snapshots, not only production self-consistency.
