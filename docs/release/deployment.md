# Controlled beta deployment runbook

This is a reviewable configuration, not authorization to publish. No infrastructure was provisioned, billing enabled, public hostname bound, or real model evaluation run by Milestone5.

## Build and secrets

Root-context Dockerfiles build frontend with locked npm packages and backend with locked uv dependencies. `deploy/compose.yaml` includes frontend, backend and private Redis7.4.11. Redis version selected against [official security release notes](https://redis.io/docs/latest/operate/oss_and_stack/stack-with-enterprise/release-notes/redisce/redisce-7.4-release-notes/). Node/Python/Nginx base tags are templates: resolve approved patched image digests, scan OS packages and record digests before publishing. Container builds were not run locally when Docker daemon was unavailable; native build/realRedis smoke does not establish container-image security.

Copy `deploy/production.env.example` to untracked `deploy/production.env`. Create untracked, owner-readable `deploy/secrets/` files: llm_key(existing approved API key), session_secret(stable cryptographically random ≥32 chars), metrics_token(random ≥32 chars), redis_url(authenticated URL to redis private network), redis.conf(based on template plus operator-generated requirepass). Do not paste values in logs/issues/commits. Inject secret manager mounts in managed deployments; `_FILE` loader consumes values without printing. `.dockerignore` excludes environment/secrets/dependencies/test outputs from build context. Never rotate session secret casually: it invalidates existing cookies across replicas.

Redis must persist AOF with `appendfsync always` (budget safety over latency), noeviction and an explicit memory bound. Exhaustion/unavailability blocks new AI calls. Restrict ACL/commands to required app operations; quotas use EVAL, GET, INCRBY, EXPIRE, ZADD/ZREM/ZCARD/ZREMRANGEBYSCORE, SET/DEL/EXISTS, PING. Keep Redis unreachable from public networks and deploy transport TLS when crossing trust boundaries. Do not flush production quota databases; doing so resets cost protections. Separate test DB15 and local smoke DB14 from production DB0.

## Startup, HTTPS and proxy trust

`docker compose -f deploy/compose.yaml up --build` is an operator action after prerequisites/approval. Files reference real secrets; placeholders do not qualify as a ready deployment. Entrypoint runs readiness validation before serving: production requires explicit HTTPS frontend origins, metrics secret, and when AI enabled, valid provider config, session secret, conservative prices and reachable shared Redis. `/api/live` is process liveness independent of provider/Redis; `/api/ready` reports safe stable dependency codes with503 when unavailable. Provider readiness validates configuration, not actual model-generation permission/quota.

Only the frontend is bound to loopback8080 by this template. An approved HTTPS ingress/domain/certificate is required for public traffic and Secure cookies. Proxy same-origin `/api` to backend, no cross-site cookie hacks. Nginx removes user forwarding headers; backend uses `--no-proxy-headers`. The app therefore budgets a proxy's network aggregate, deliberately conservative. Do not use `--forwarded-allow-ips='*'`. Before adding trusted forwarding, restrict allowed ingress peers/CIDRs and test spoof rejection; currently direct peer is authoritative. No backend/Redis public ports. The `/api/ops` route is blocked at public frontend; access metrics through private backend network plus bearer token.

CSP blocks external scripts/connections, framing and objects; inline styles support current React Canvas sizing. CORS uses explicit configured HTTPS origins; wildcard is rejected. Access logs are disabled in production entrypoint/proxy to avoid raw paths. Application aggregates never include prompts, session/network identifiers, credentials, stack traces or raw URLs.

## Quotas, kill switch and telemetry

Default5/minute30/day per signed anonymous session plus network/global/concurrency/input/output/timeout/retry limits; configure estimates conservatively. USD values are accounting bounds, not a provider bill or confirmed Free tier quota. `AI_ENABLED=false` rejects new dispatch at the central gateway and before every retry; in-flight calls may complete. Roll out switch to ALL workers/replicas; this environment control is not a distributed real-time toggle. Simulations remain local. Keep AI disabled until a small approved real-provider smoke succeeds.

`GET /api/ops/metrics` requires bearer OPS_METRICS_TOKEN and private routing; counters and cumulative latency buckets are bounded/no user-derived labels. It reports API requests/errors, cancellations, provider attempts/errors, reported input/output token use, reserved/settled estimated microUSD,429rejections, invalid scientific context and client runtime/scientific reports. Snapshots are per-process, reset on restart, and not the quota authority: aggregate them externally and monitor Redis shared counters/global caps. Only metadata available from provider is counted as tokens; no fabricated totals. Client reports are untrusted, globally capped60/min/worker with strict256byte body and registered experiment ID. They never carry raw errors/prompts. Set alerts for sustained readiness503, quota outages, spikes in provider errors and budget utilization; do not scrape the public endpoint.

## Local production-like smoke

Install/run a private Redis test instance bound only to loopback. Without Docker, official source can be compiled into a temporary workspace after checking the [official Redis hashes](https://github.com/redis/redis-hashes); no system installation needed.

From project root:

```sh
backend/.venv/bin/python scripts/validate_science.py --output science-report.json
backend/.venv/bin/python scripts/evaluate_ai.py --output ai-offline-report.json
backend/.venv/bin/python scripts/production_smoke.py --redis-url redis://127.0.0.1:6397/14 --output smoke-report.json
```

Smoke uses production-mode ASGI, real shared Redis, secure cookie/metrics/readiness/kill switch, mocked upstream and zero external provider calls. It does not flushDB or prove real Gemini accuracy. Frontend separately builds production assets; `npm run build` then `npx vite preview --host 127.0.0.1 --port 5180` serves a local static review. Vite preview is not production ingress; use approved reverse proxy for real API interactions.

## Rollback and release gate

Record image digests and main/release SHA. On AI failure first disable AI across workers, preserving local experiments. Roll back to previously approved immutable frontend/backend images with compatible context schemas; never reset Redis budgets to make a rollout pass. Back up AOF and verify restore procedures on isolated data. Session signing secret stays stable across rollback. Browser recovery rejects incompatible schema; request fresh action/lesson confirmation. No database migration is required here.

Before public beta: reviewed hardening PR merged by human; all CI green; real deployment image builds/scans/digest pinning; ingress/TLS/CORS/secret injection; Redis persistence/capacity/ACL/backup; metrics collector/alerts and switch drill; small approved provider generation to confirm model/language/access/quotas. A large Gemini evaluation or >3requests/>$0.10configured accounting estimate is explicitly unsupported by the optional command until separately approved and reviewed. Do not deploy based only on mocked evaluation or native smoke.
