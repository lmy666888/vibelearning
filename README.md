# VibeLearning AI

An interactive STEM learning platform with analytical electric-field simulation, controlled experiments, immutable baseline comparison, authored guided learning, and a context-aware AI Tutor. Day 3 preserves the Day 1/2 simulation and introduces a validated backend provider path.

The simulator uses deterministic analytical equations. AI explanations use a server-verified immutable simulation snapshot and require backend provider configuration. Without credentials, the API returns a clear configuration error and simulation remains available. No authentication, database or Docker is included.

## Requirements and stack

- macOS, Node.js 24 LTS, npm, uv, Python 3.13 (uv can install it).
- React 19.3, TypeScript 7, Vite 8, Tailwind CSS 4, Zustand 5, Vitest 5.
- Playwright Test 1.64 with its bundled Chromium.
- FastAPI, Uvicorn, Pydantic, Pytest, HTTPX.

`frontend/package-lock.json` and `backend/uv.lock` are the version authorities. Existing runtime dependency versions were retained. HTTPX is now a backend runtime dependency; frontend component testing adds Testing Library and jsdom as development-only dependencies.

## Install and run

Backend terminal:

```sh
cd /Users/mingyi/Projects/vibelearning-ai/backend
uv sync --python 3.13 --locked
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend terminal:

```sh
cd /Users/mingyi/Projects/vibelearning-ai/frontend
npm ci
npm run dev
```

Open http://127.0.0.1:5173 . Health endpoint: http://127.0.0.1:8000/api/health ; API docs: http://127.0.0.1:8000/docs .

The development server proxies `/api` to port 8000. To use a separate API, copy `.env.example` to `frontend/.env.local` and set `VITE_API_BASE_URL` without a trailing slash. Production static hosting needs an API reverse proxy or a build-time base URL.

If a restricted environment cannot write default caches, prefix npm commands with `NPM_CONFIG_CACHE=/tmp/vibelearning-npm-cache`. For uv, use `UV_CACHE_DIR=/tmp/vibelearning-uv-cache UV_PYTHON_INSTALL_DIR=/tmp/vibelearning-python`. The existing backend environment also supports `.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`.

## Tests and build

```sh
cd /Users/mingyi/Projects/vibelearning-ai/frontend
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
# Optional interactive runner:
npm run test:e2e:ui

cd /Users/mingyi/Projects/vibelearning-ai/backend
uv run --locked pytest
```

Day 3 validation: **76 Vitest tests**, **79 Pytest tests**, and **19 Chromium E2E tests** passed. The original physics/store/backend tests remain unchanged and pass. The E2E assertion for the retired Coming Soon heading now checks the implemented AI Tutor panel; all other existing regression scenarios remain. Strict TypeScript checks include E2E and configuration files; production build passes.

Playwright always starts an isolated Vite server on **5174** and stops it afterward. Keep that port free; the regular app on 5173 is unaffected. Health responses are intercepted in E2E so the learning tests do not require a backend; a dedicated test aborts health requests to verify offline simulation. Actual backend behavior is tested by Pytest and a separate live HTTP/browser smoke check. Tests use accessible roles, labels and stable reading IDs, bounded polling, zero retries, and no arbitrary sleeps. Failure screenshots/traces go to ignored `frontend/test-results/`.

## Features and workflow

1. Adjust charge, mass, field components, and initial velocity. Play/Pause controls elapsed simulation time; Reset pauses, clears the trajectory, and preserves parameters.
2. Apply one of four presets: Positive Charge, Negative Charge, Stronger Electric Field, or No Electric Field. Selection validates parameters and atomically pauses and resets time. Manual edits clear preset identity.
3. Save a baseline, then adjust controls or choose a preset. Comparison shows charge, mass, field, initial velocity, force, acceleration components, and acceleration magnitude. Replace/Clear baseline are explicit actions. The snapshot does not change during animation.
4. Follow **Understanding Electric Force**. Previous/Next changes only the lesson step; **Apply suggested preset** explicitly changes the experiment. Explanations are authored lesson data, not generated AI text.
5. Ask AI Tutor explicitly to submit a question and a frozen context snapshot to the backend and configured provider. Suggested questions only populate the form. Responses remain associated with the submitted snapshot; changes to parameters, time, preset or lesson trigger an earlier-state notice. Retry captures the current snapshot again.

### Comparison conventions

Signed change `Δ = current − baseline`; absolute difference `|Δ|` is displayed separately. Percent change is `100 × Δ / |baseline|`. A negative baseline therefore preserves the direction of signed component change. Example: ay from −0.2 to +0.2 m/s² is +200% component change, while acceleration magnitude changes by 0%. Zero baselines, including 0 → 0, show **N/A — zero baseline**. Unrepresentable differences/percentages show a numeric range explanation instead of NaN/Infinity. Small and large values use scientific notation.

### Physics and units

All engine/context values use SI. Controls and comparison display nC (`×10⁻⁹ C`) and mg (`×10⁻⁶ kg`). `F=qE`, `a=F/m`, `r=r₀+v₀t+½at²`, `v=v₀+at`; no Euler integration. Positive physical y points upward; Canvas y points downward. The fixed world viewport is x ∈ [−10,50] m, y ∈ [−15,25] m with equal scale on both axes. Particles continue calculating outside the viewport, with a visible notice.

Defaults: q=+2 nC, m=1 mg, Ex=0, Ey=100 N/C, v₀=(5,0) m/s, r₀=(0,0) m. Controls bound charge to ±10 nC, mass to 0.1–10 mg, field to ±500 N/C, and velocity to ±10 m/s. Invalid numeric drafts do not enter physical state. Blue/red/gray particles indicate positive/negative/zero charge; purple shows trajectory, mint shows velocity direction.

## Structure

```text
frontend/
  src/
    app/App.tsx
    components/
      layout/Header.tsx
      simulation/
        SimulationCanvas.tsx
        ControlPanel.tsx
        SimulationInfo.tsx
        ExperimentPresets.tsx
        ExperimentComparison.tsx
      learning/GuidedLesson.tsx
      ai/AITutorPanel.tsx
    learning/lessons/uniformElectricField.ts
    simulations/
      core/{types,coordinates,simulationContext}.ts
      physics/uniform-electric-field/{types,physics,presets,comparison}.ts
    stores/simulationStore.ts
    services/{api,tutor}.ts
    # Colocated *.test.ts files cover physics, store, lessons and contracts.
  e2e/{learning,tutor}.spec.ts
  playwright.config.ts
  vitest.config.ts
  vite.config.ts
backend/
  app/main.py
  app/api/routes/{health,ai}.py
  app/schemas/ai.py
  app/services/ai/{config,provider,prompt_builder,tutor_service}.py
  app/services/physics/context_validator.py
  app/request_limits.py
  tests/{test_health,test_ai}.py
  pyproject.toml
  uv.lock
docs/
  architecture.md
  development-log.md
  roadmap.md
```

## Architecture

Pure physics functions are independent of React and Canvas. Zustand is the sole source of current experiment/lesson state, with frozen parameter snapshots and atomic preset actions. Canvas directly reads the store inside its existing RAF loop. Other panels subscribe only to the fields they need; physical readings refresh at 10 Hz. Comparison derives solely from baseline/current parameters, not elapsed time. FastAPI is independent of local simulation availability. See `docs/architecture.md` for the context contract and rendering lifecycle.

## Known limitations and next steps

- Classical, non-relativistic uniform electric field only; no magnetic fields or collisions.
- Fixed viewport/initial position in the UI, 1× time, and 240-point analytical trajectory sampling. Background tabs stop advancing; individual frame increments are capped at 50 ms, so low frame rates can slow simulation time.
- Baseline and learning progress are in memory; reload clears them. Lessons have no answer grading or generated explanations.
- UI retains Day 1 Chinese labels while new learning panels use English. A full localization pass is deferred.
- Chromium automation covers 1280/1024/390 CSS-pixel widths, DPR 2, and dynamic DPR 2 → 1.5 → 1. Physical multi-monitor switching, real browser zoom UI, Safari/Firefox, mobile hardware and production deployment remain unverified.
- AI uses one OpenAI-compatible JSON-mode Chat Completions provider; support for `response_format` and `max_completion_tokens` is required. Structured validation does not guarantee educational correctness. Gemini 3.5 Flash-Lite real generation and three physics scenarios passed; this small sample does not guarantee all generated explanations are correct. Exact remaining project quota was not accessible.
- Git is initialized with a stable Day 1/2 baseline and a dedicated Day 3 feature branch. See daily logs for actual commits and remote/authentication status.

Day 4 should add stronger authentication/rate limiting before any public deployment, provider-specific live quality checks, and expanded accessibility/browser coverage. Keep analytical physics authoritative. See `docs/roadmap.md`.

## Day 3 AI Tutor configuration

The application automatically loads the fixed `backend/.env` path at startup, independently of the working directory. Explicit process environment values take precedence; interpolation of other environment secrets is disabled. Create `backend/.env` from the root `.env.example` and configure `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_TIMEOUT_SECONDS`. Choose an existing provider/model that supports JSON-mode Chat Completions; no model is silently selected. Never put provider variables in `VITE_*` values or frontend code. `.env` and `.env.*` overrides are ignored, while `.env.example` and both dependency lockfiles are tracked.

```sh
cd /Users/mingyi/Projects/vibelearning-ai
cp .env.example backend/.env
# Edit backend/.env locally; do not commit or paste credentials.
cd backend
uv sync --python 3.13 --locked
uv run --env-file .env uvicorn app.main:app --host 127.0.0.1 --port 8000
```

`LLM_BASE_URL` defaults to `https://api.openai.com/v1`; key/model must be set. HTTPS is required except for loopback development providers. URL credentials, query strings and fragments are rejected. Timeout must be finite and between 1 and 120 seconds (default 20). `FRONTEND_ORIGINS` is a comma-separated explicit list, defaulting to localhost/127.0.0.1 port 5173. Wildcard CORS is rejected.

### API contract

`POST /api/ai/explain` receives `{question, simulation_context}`. The context uses the exact existing frontend v1 camelCase fields: schemaVersion, simulationId, unitSystem, parameters, time, particleState, force, acceleration, activePresetId and currentLessonStepId. The outer request uses `simulation_context`. Question length is 1–2000 characters after trimming; the raw request body is limited to 64 KiB. Extra fields, non-finite values, numeric strings, boolean physical values, non-positive mass, negative time, unsupported versions/IDs and invalid enum metadata are rejected.

The server independently recomputes force, acceleration, position and velocity using analytical SI equations, compares every supplied derived component and state time (`rel_tol=1e-8`, `abs_tol=1e-15`), rejects mismatches, and sends recalculated values to the provider even when differences are within tolerance.

Successful responses contain exactly `answer`, `key_concepts`, and `related_equations`. Answer length is at most 8000 characters; each list contains at most 8 strings of at most 160 characters. The provider envelope is limited to 32 KiB and 1500 completion tokens are requested. Responses with unsupported/truncated finish reasons, malformed JSON, invalid schema, credentials or a full internal-prompt echo are rejected. The UI renders escaped plain text, not provider HTML.

Errors are safe and typed: 422 validation/physics mismatch, 413 oversized request, 403 non-local/disallowed origin, 429 concurrency full, 503 missing configuration/connection failure, 504 timeout, 502 provider/response failure, or a sanitized 500 fallback. No user questions, keys, raw provider bodies or internal prompts are logged or returned in errors. Two provider requests per process are admitted; excess calls fail immediately, with no automatic paid retries. Total service deadline and network timeout both apply. Client abort/unmount cancels the frontend request; provider work is bounded by the server deadline even if a disconnected client does not cancel server execution.

### Local-only security boundary

Keep Uvicorn bound to loopback. AI requests additionally require a loopback client and an allowed Origin when supplied. **CORS and loopback checks are not authentication. Do not expose this unauthenticated paid endpoint through a public reverse proxy, tunnel, or unrestricted network bind.** Before deployment, add authentication, per-user rate/budget limits, abuse controls, trusted-proxy configuration and process-wide/distributed limits. Only the question and required context are transmitted after explicit submission. Baselines, UI state and credentials are not included.

### Testing and live status

Pytest exercises the real HTTP adapter through HTTPX MockTransport and the route through ASGITransport, including Chinese/English question preservation, analytical verification, concurrency, cancellation, malformed/oversized output and safe errors. Frontend form tests use jsdom; E2E intercepts `/api/ai/explain` and never makes paid calls. Mock responses are test fixtures, not a fake runtime tutor. Initial setup had no credentials; the legacy gemini-2.5-flash-lite later returned 404 for new-user access. The user subsequently authorized gemini-3.5-flash-lite. A real bounded adapter request, three real physics scenarios through FastAPI, and a real Chinese React submission now pass. See the dated live-validation report for the scope and quota limitations.

Provider request format follows the [official Chat Completions reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create). JSON mode still requires application-level schema validation, which this adapter performs.

## GitHub daily workflow

Repository: https://github.com/lmy666888/vibelearning . Stable branch: `main`; Day 3 branch: `feat/day3-ai-tutor`. See `docs/development/workflow.md` and daily logs under `docs/development/`. Never force push, automatically merge, delete remote branches, or commit secrets. Historical Day 1/2 logs were reconstructed from existing reports; no original historical commits are invented.

## Google Gemini configuration and live verification

The selected model is `gemini-3.5-flash-lite`, using the existing OpenAI-compatible HTTP adapter. Use the following non-secret configuration; fill the key only in ignored `backend/.env`:

```dotenv
LLM_API_KEY=
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
LLM_MODEL=gemini-3.5-flash-lite
LLM_TIMEOUT_SECONDS=30
```

The existing key is never overwritten automatically or sent to the frontend. The API and SI physics contracts are unchanged. Trailing slashes are normalized. Ordinary Uvicorn startup loads the local backend file; restart after editing it. Explicit process variables still take precedence.

On 2026-10-14 the real models endpoint returned 200 and listed the selected model. A minimal 512-token-limit request through the production adapter returned 200, the exact requested model identifier and a valid structured explanation. The default application output limit remains 1500 tokens; the adapter accepts a smaller internal limit in [64,1500] for bounded manual checks.

Three actual `/api/ai/explain` requests returned 200: positive charge with Ey=200 N/C produced +0.4 m/s², negative charge produced −0.4 m/s² with a Chinese explanation, and doubling Ey from 100 to 200 N/C correctly doubled acceleration magnitude from 0.2 to 0.4 m/s². Real React submission rendered an explanation, concepts and equations while animation continued, and displayed the earlier-snapshot notice. See `docs/development/gemini-live-validation-2026-10-14.md`.

[Google's pricing page](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite) lists free standard input/output for this model. The user identified the existing project as Free tier. No billing, project or account configuration was changed. The account-specific AI Studio quota dashboard required an unavailable authenticated session, so exact RPM/TPM/RPD values, remaining quota and billing status were not independently inspected. Successful generation proves current generation access, not unlimited free usage. No alternative or paid model was called.

Upstream errors are classified without returning raw diagnostics: 401/403 → safe credential/permission error (local 502), 404 → model/endpoint unavailable (local 502), 429 → provider rate/quota error (local 429), and other upstream failures → safe provider error (local 502). Existing timeout/transport handling remains. Automated tests and CI only use mocks; live manual checks are separate and do not run automatically.

## Continuous integration

`.github/workflows/ci.yml` runs on PRs targeting main and pushes to main. On Ubuntu 24.04 it uses Node.js 24, Python 3.13 and uv 0.12.7. Frontend checks install with npm ci, run Vitest, strict TypeScript and production build, install Chromium/system dependencies, and run mocked Playwright tests. The backend installs from uv.lock and runs mocked Pytest tests. No Gemini credentials are configured or required. Third-party setup actions are pinned to verified commit SHAs; the workflow has read-only contents permission. Actual CI outcomes are recorded in the dated development log.

### Day 4: review and confirm experiment changes

In **AI Tutor**, choose **Request an experiment change**, enter one change (for example, “Double the vertical electric field”), and select **Preview experiment change**. Review the signed SI before/after table, then explicitly confirm or cancel. Planning never changes the experiment. Confirmation pauses playback and resets time/trajectory to zero; normal playback can continue while a request is pending. Parameter edits, preset selections and resets invalidate old proposals, even after an edit is reverted. Regenerate stale proposals.

`POST /api/ai/plan-action` reuses the configured Gemini OpenAI-compatible adapter. It accepts an instruction, Context v1, opaque snapshot ID and parameter revision; it returns either clarification or one strictly validated, confirmation-required proposal. Supported operations are `set_parameter`, `scale_parameter`, `select_preset`, and `reset_simulation`. Physics comes from deterministic equations on both sides. The original `/api/ai/explain` API is unchanged.

The allowlisted targets use existing parameter paths: `charge`, `mass`, `field.x`, `field.y`, `initialVelocity.x`, `initialVelocity.y`. Ranges and display conversions are shared in `shared/simulation-controls.json`. Do not remove that directory when running the backend separately. See [the action contract and security boundaries](docs/architecture.md#day-4-action-planning) and [the actual Day 4 results](docs/development/2026-10-14-day4.md#authorized-day-4-implementation).

### Day 5: AI-guided learning

Choose **Guided Learning**, select **AI response language** (`zh-CN` or `en`), enter a learning goal, and generate a lesson. The default is three steps, with hard limits of five steps and three existing Day 4 actions per step. Review objectives, preview/confirm each setup, use the existing Play/Pause controls, finish observing, and submit an answer. Structured feedback offers retry or progression; it does not certify mastery.

Earlier steps and restart also require a new preview/confirmation before restoring the validated experiment. Cancelling or exiting never changes parameters. Manual edits invalidate pending previews/observations; re-preview explicitly. **Free Experiment** and **AI Tutor** remain available, including the original authored lesson and Day 4 proposals. The language selector applies to new AI explanations, proposals and lessons; existing lessons retain their original language. Inconsistent provider language produces a clear error, without automatic retries or numerical translation.

There is one in-memory learning session per browser app instance. Mode switches retain its plan/progress; refreshing closes it. Browser storage persistence is deliberately deferred until full versioned restore/staleness rules are designed. No database, credential storage or dependency was added. See [API contracts](docs/api.md), [architecture](docs/architecture.md#day-5-guided-learning), [ADR](docs/decisions/0001-deterministic-human-confirmed-learning.md), and [Day 5 verification](docs/development/2026-10-14-day5.md).

### Day 6–7: registered multi-experiment platform

The default workbench now has a shared **Experiment** selector for **Uniform Electric Field** and **Lorentz Force**. Both use the same context-v2 AI Tutor, action preview/confirmation and guided lessons. The electric presentation adapts the original Canvas, controls, presets, authored lesson and comparison. The new Lorentz renderer shows equal-scale trajectories, E/B direction (⊙ out, ⊗ in), velocity and electric/magnetic/total force vectors, with five presets, speed, fixed timestep, bounded duration and trajectory clearing.

Switching pauses/discards the previous experiment, its baseline, proposals and active lesson, then loads defaults. It never carries one experiment's proposals into another. Parameter updates still require review and explicit confirmation. Shared scientific metadata, controls, supported actions, presets and equations live in `shared/experiments.json`; scientific models and React renderers are separate. The v2 equations shown beside AI answers come from the registry rather than generated math.

The existing Day 1–5 UI/API remain available at `/?context=v1` and `/api/ai/...`. The default UI uses `/api/v2/ai/...` and an explicitly versioned experiment envelope; no Lorentz payload is interpreted as an electric context. Legacy E2E journeys now use the explicit v1 URL; new E2E journeys test both experiments in the default workbench.

See [plugin guide](docs/experiment-plugin-guide.md), [numerical physics and tolerances](docs/physics-verification.md), [v2 API](docs/api.md#experiment-context-v2), and [actual-date Day 6–7 log](docs/development/2026-10-15-day6-day7.md). Session recovery remains deferred; all running states are memory-only and reset on refresh. No database or new dependency is required.

### Unified workspace and multi-zone fields

Default workbench now shares playback, camera/Canvas, resizable side panels, focus/mobile tabs, metrics, bilingual learning material and reviewed AI workflows across Uniform Electric Field, Lorentz Force and the new **Multi-Zone Electromagnetic Lab**. Build, drag, resize, align and edit up to 12 SI rectangular field regions. Enabled overlaps superpose, outside fields are zero, and actual deterministic dynamics use bounded boundary-aware integration. Region changes pause/reset; AI edits require confirmation and stale proposals fail. Browser-local schema-v1 recovery restores validated setup/lesson progress paused, without trajectory or credentials. The classic electric-field page remains available at `/?context=v1`.

See [spatial experiment guide](docs/spatial-field-experiment-guide.md), [scientific verification](docs/physics-verification.md) and [actual-date workspace report](docs/development/2026-10-15-unified-workspace.md). This is a prescribed-field educational model, not a Maxwell solver.

### AI guardrails and usage governance

All Gemini-backed v1/v2 workflows share signed server-issued anonymous sessions, educational scope routing, strict output contracts and atomic pre-dispatch usage reservations. Defaults: 5 requests/minute and 30/day per session, 1200 ordinary output tokens. Production requires shared Redis, stable signing secret and explicit estimated token prices; quota outage pauses new model calls while local experiments remain usable. See [AI policy and deployment limits](docs/ai/guardrails.md). Application allowance is distinct from Google project quota. CI uses mocked models and a real isolated Redis service.

### Double-slit interference

The fourth registered experiment uses independent coherent scalar Fraunhofer optics with finite-width envelope, exact screen-angle geometry and bounded reproducible detection sampling. Specialized optical Canvas, six presets and bilingual learning reuse the same reviewed AI/governance/session workspace. [Scientific model and limitations](docs/physics-double-slit.md).

### Kepler's laws and orbital mechanics

The fifth plugin solves bounded Newtonian elliptical two-body relative motion analytically via safeguarded Kepler root finding. Focus geometry, equal-time sectors, T²/a³ graph, astronomical units and six presets reuse shared governed AI/lessons/confirmation and paused recovery. [Scientific contract](docs/physics-kepler.md).

### Momentum & Collisions

Six experiments now share one workspace. `momentum-collisions` adds exact1D and continuous-time2D frictionless pair impacts, restitution, laboratory/COM frames,7presets and before/after momentum-energy charts. All use the same governed AI/confirmed actions/lessons and paused recovery. No general rigid-body or permanent2D sticking claim; see [collision physics](docs/physics-collisions.md) and [M4 log](docs/development/2026-10-15-m4-collisions.md). Stacked merge order: AI governance → double slit → Kepler → collisions; new PRs remain unmerged.

### Milestone5 — release integration and hardening

PR6–9 are integrated by normal merge commits; main baseline ee31ae64c6cb5aeae10dda2f068ccfff69b6d49a. Hardening adds per-experiment machine-readable scientific validation,336labeled offline AI cases, privacy-safe aggregate metrics, liveness/readiness, a server AI kill switch, production configuration and cross-browser/state-isolation QA. No public deployment/billing/model evaluation is implied. See [deployment and rollback](docs/release/deployment.md), [AI evaluation limits](docs/release/ai-evaluation.md), [UX audit](docs/release/ux-audit.md), [science report](docs/release/scientific-validation.json) and [daily log](docs/development/2026-10-16-m5-release-hardening.md). Production defaults AI off; real provider and deployment image checks remain operator gates.
