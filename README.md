# VibeLearning AI

An interactive STEM learning platform. Day 2 extends the working Day 1 uniform-electric-field simulator with controlled experiments, immutable baseline comparison, authored guided learning, and Chromium end-to-end tests.

The simulator uses deterministic analytical equations. AI Tutor remains explicitly marked **Coming Soon**; no LLM provider, authentication, database, or Docker is included.

## Requirements and stack

- macOS, Node.js 24 LTS, npm, uv, Python 3.13 (uv can install it).
- React 19.3, TypeScript 7, Vite 8, Tailwind CSS 4, Zustand 5, Vitest 5.
- Playwright Test 1.64 with its bundled Chromium.
- FastAPI, Uvicorn, Pydantic, Pytest, HTTPX.

`frontend/package-lock.json` and `backend/uv.lock` are the version authorities. Existing runtime dependencies were retained; Day 2 adds only Playwright Test and its transitive dependencies.

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

Day 2 final validation: **64 Vitest tests**, **3 Pytest tests**, and **14 Chromium E2E tests** passed. All original 31 frontend tests and 3 backend tests remain unchanged and pass. Strict TypeScript checks include E2E and configuration files; production build passes.

Playwright always starts an isolated Vite server on **5174** and stops it afterward. Keep that port free; the regular app on 5173 is unaffected. Health responses are intercepted in E2E so the learning tests do not require a backend; a dedicated test aborts health requests to verify offline simulation. Actual backend behavior is tested by Pytest and a separate live HTTP/browser smoke check. Tests use accessible roles, labels and stable reading IDs, bounded polling, zero retries, and no arbitrary sleeps. Failure screenshots/traces go to ignored `frontend/test-results/`.

## Features and workflow

1. Adjust charge, mass, field components, and initial velocity. Play/Pause controls elapsed simulation time; Reset pauses, clears the trajectory, and preserves parameters.
2. Apply one of four presets: Positive Charge, Negative Charge, Stronger Electric Field, or No Electric Field. Selection validates parameters and atomically pauses and resets time. Manual edits clear preset identity.
3. Save a baseline, then adjust controls or choose a preset. Comparison shows charge, mass, field, initial velocity, force, acceleration components, and acceleration magnitude. Replace/Clear baseline are explicit actions. The snapshot does not change during animation.
4. Follow **Understanding Electric Force**. Previous/Next changes only the lesson step; **Apply suggested preset** explicitly changes the experiment. Explanations are authored lesson data, not generated AI text.
5. The versioned, SI-only `buildSimulationContext()` contract is available for future integration but is not transmitted anywhere.

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
    learning/lessons/uniformElectricField.ts
    simulations/
      core/{types,coordinates,simulationContext}.ts
      physics/uniform-electric-field/{types,physics,presets,comparison}.ts
    stores/simulationStore.ts
    services/api.ts
    # Colocated *.test.ts files cover physics, store, lessons and contracts.
  e2e/learning.spec.ts
  playwright.config.ts
  vitest.config.ts
  vite.config.ts
backend/
  app/main.py
  app/api/routes/health.py
  tests/test_health.py
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
- Context is a typed frontend contract, not yet a server-validated request schema or an AI endpoint. No data is sent to a provider.
- The supplied source directory has no Git repository. No commit was created.

Day 3 can add a matching backend validation schema and an explicit, server-side tutor API after defining provider configuration, privacy, timeout, rate-limit and grounding behavior. Keep analytical physics authoritative. See `docs/roadmap.md`.
