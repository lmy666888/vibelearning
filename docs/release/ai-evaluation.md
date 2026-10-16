# Offline evaluation and real-model boundary

`shared/security/release-evaluation.json` has336 labeled cases:6experiments×8categories×7templates. Categories: science, prerequisites, ambiguity, unrelated topics, injection, invalid actions, cross-experiment manipulation and resource excess. English/Chinese labels are explicit. This is a synthetic template corpus, not336independent real students or an unseen benchmark. Experiment prefixes intentionally exercise wrapped user text. Scope labels separate content relevance from action authorization; invalid numeric actions remain physics-relevant but must reject independently. Shell execution and excessive resource/budget bypass are labeled out-of-scope. Dataset generator is deterministic and labels/actions are reviewable.

Reproduce from root:

```sh
backend/.venv/bin/pytest backend/tests/test_release_hardening.py --junitxml=release-tests.xml
backend/.venv/bin/python scripts/evaluate_ai.py --junit release-tests.xml --output ai-report.json
```

The report measures **deterministic preflight candidate routing**, NOT full semantic/Gemini accuracy. Actual matrix:162in-scope candidates deferred,18/42ambiguous directly clarified and24deferred;6/132out-of-scope directly denied,126deferred.312/336require semantic classification. Treating defer as a candidate positive yields precision56.25%,recall100%,false-rejection0%,false-acceptance-candidate95.45%. The latter is **not final answer acceptance**; it makes explicit that the narrow prefilter cannot replace a semantic classifier. No scope precision/recall for real Gemini was established by this offline run. Do not market these values as model accuracy or prompt-injection immunity.

252explicit adversarial structured-action attempts (out-of-domain targets/presets, invalid parameter values, arbitrary-code and quota-toggle requests) execute0authorized transitions.61hardening tests include48actual ASGI/provider-adapter cases: valid schema+language12/12accepted; malformed12/12rejected; wrong-language12/12rejected; configured-key echo12/12rejected. These are **mock contract conformance**, not claims that Gemini emits valid language/schema100%of the time. Machine reports derive mock counts from JUnit rather than invented totals. Existing stale/confirmation/isolation tests remain independent of scope.

Optional real evaluation is opt-in only:

```sh
backend/.venv/bin/python scripts/evaluate_ai.py --live --requests 1 --env-file /absolute/path/to/backend/.env --output live-evaluation.json
```

Only an operator with an approved existing project/key should invoke it after confirming model/project permissions and budget. No new project/billing setup occurs. No raw prompts, generated text or keys are printed in results. The CLI refuses >3requests or >$0.10configured accounting estimate; conservative worst-case token accounting may admit only1request under current prices. A file-locked ignored daily ledger reserves cumulative calls/cost before dispatch, including failures. Changing/removing the ledger is not a permission bypass for a larger evaluation: obtain explicit human approval and a reviewed cap change. This is local operator safety on top of the server's shared quota, not a trustworthy multi-host ledger. CI never uses --live.

Milestone5 ran **zero new real Gemini requests**. Prior Milestone1 small selected live results do not establish release accuracy for336cases or all6domains. A small approved live multilingual/scope/action smoke and subsequent independently reviewed evaluation remain beta conditions.
