"""Offline preflight metrics + adversarial action validation. Optional tightly capped live ASGI evaluation."""
import argparse,json,sys,asyncio,uuid,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'backend'))
from app.governance.policy import preflight
from app.experiments.registry import experiment
from app.experiments.ai import apply,action_adapter

def offline():
    rows=json.loads((ROOT/'shared/security/release-evaluation.json').read_text())['cases'];confusion={};tp=fp=fn=tn=0;unsafe=attempts=0;abstain=0
    for row in rows:
        route=preflight(row['prompt']);pred=route;actual=row['scope_label'];confusion[actual+' -> '+pred]=confusion.get(actual+' -> '+pred,0)+1
        if route=='needs_semantic_classification':abstain+=1
        if actual!='needs_clarification':
            positive=actual=='in_scope';accepted=route=='needs_semantic_classification'
            tp+=int(positive and accepted);fp+=int(not positive and accepted);fn+=int(positive and not accepted);tn+=int(not positive and not accepted)
        if row['category'] in {'invalid_action','cross_experiment','injection'}:
            e=experiment(row['experiment_id']);p=e.manifest['presets'][0]['parameters']
            for action in row['adversarial_actions']:
                attempts+=1
                try:apply(e,p,[action_adapter.validate_python(action)]);unsafe+=1
                except ValueError:pass
    return dict(cases=len(rows),method='deterministic preflight candidate routing, NOT Gemini end-to-end accuracy; deferred requests require semantic classification',confusion=confusion,semantic_required=abstain,in_scope_precision=tp/(tp+fp) if tp+fp else None,in_scope_recall=tp/(tp+fn) if tp+fn else None,false_rejection_rate=fn/(tp+fn) if tp+fn else None,false_acceptance_candidate_rate=fp/(fp+tn) if fp+tn else None,unauthorized_action_attempts=attempts,unauthorized_action_execution=unsafe,structured_output_validity='tested separately with adversarial mock ASGI responses, not inferred from routing',language_consistency='tested separately with bilingual mock schemas; real-model rate not measured')

async def live(args):
    # Hard caps cannot be raised through flags. Larger evaluations require a separately reviewed approval/change.
    from app.environment import load_backend_environment
    load_backend_environment(Path(args.env_file))
    from app.main import app
    from app.experiments.context import context
    from app.governance.quota import Limits
    import httpx
    limits=Limits.load();rows=json.loads((ROOT/'shared/security/release-evaluation.json').read_text())['cases'];selected=[r for r in rows if r['category']=='science'][:args.requests]
    estimate=args.requests*limits.cost(limits.input_tokens,limits.ordinary_output)/1e6
    if estimate>args.estimated_usd_cap:raise SystemExit('Worst-case configured accounting estimate exceeds evaluation cap; no calls sent.')
    # Reserve before dispatch; failures stay charged against this local evaluation cap.
    import fcntl,time
    ledger=ROOT/'backend/.evaluation-budget.json';ledger.parent.mkdir(exist_ok=True)
    with ledger.open('a+') as f:
        fcntl.flock(f,fcntl.LOCK_EX);f.seek(0)
        try:state=json.load(f)
        except json.JSONDecodeError:state={}
        day=int(time.time())//86400
        if state.get('utc_day')!=day:state={'utc_day':day,'requests':0,'estimated_usd':0.}
        if state['requests']+args.requests>3 or state['estimated_usd']+estimate>.1:raise SystemExit('Daily evaluation budget exhausted; explicit approval and reviewed cap change required.')
        state['requests']+=args.requests;state['estimated_usd']+=estimate;f.seek(0);f.truncate();json.dump(state,f);f.flush();os.fsync(f.fileno())
    result=[]
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://127.0.0.1') as client:
        for row in selected:
            e=experiment(row['experiment_id']);body=dict(prompt=row['prompt'],preferred_language=row['language'],context=context(e.id,e.manifest['presets'][0]['parameters'],e.manifest['initial_query']).model_dump())
            response=await client.post('/api/v2/ai/explain',json=body);result.append(dict(id=row['id'],http_status=response.status_code,structured_answer=response.status_code==200))
    return dict(mode='real Gemini; request cap per invocation, operator must track cumulative run budget',requests=args.requests,estimated_max_usd=estimate,results=result)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--live',action='store_true');p.add_argument('--requests',type=int,default=1);p.add_argument('--estimated-usd-cap',type=float,default=.1);p.add_argument('--env-file',default=str(ROOT/'backend/.env'));p.add_argument('--output');p.add_argument('--junit')
    args=p.parse_args()
    if not 1<=args.requests<=3 or not 0<args.estimated_usd_cap<=.1:p.error('Hard safety cap: 1–3 requests and <=0.10 estimated USD. Request explicit approval before any larger evaluation; unsupported here.')
    result=asyncio.run(live(args)) if args.live else offline()
    if args.junit:
        import xml.etree.ElementTree as ET
        cases=[c for c in ET.parse(args.junit).iter('testcase') if 'bilingual_mock_output_contract' in c.attrib.get('name','')]
        groups={}
        for kind in ['valid','malformed','wrong_language','secret_echo']:
            matching=[c for c in cases if '['+kind+'-' in c.attrib['name']];passed=sum(c.find('failure') is None and c.find('error') is None and c.find('skipped') is None for c in matching)
            groups[kind]={'passed_contract_assertions':passed,'total':len(matching)}
        result['mock_contract_metrics']={'groups':groups,'provenance':'actual ASGI + mocked upstream, not real Gemini accuracy'}
    text=json.dumps(result,ensure_ascii=False,indent=2)
    if args.output:Path(args.output).write_text(text+'\n')
    else:print(text)
