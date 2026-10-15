import asyncio
import copy
import json
import httpx
import pytest
from pydantic import ValidationError
from app.main import app
from app.api.routes.ai import get_tutor_service
from app.schemas.ai import SimulationContext
from app.schemas.actions import PlanRequest, action_adapter, decision_adapter
from app.services.ai.tutor_service import TutorService
from app.services.ai.provider import OpenAICompatibleProvider, ProviderError
from app.services.physics.actions import apply_action, InvalidAction
from test_ai import context, SETTINGS, run, envelope

SCALE = {'schema_version': 1, 'action': 'scale_parameter', 'target': 'field.y', 'factor': 2}
def body():
    return dict(instruction='Double the vertical electric field.', simulation_context=context(), snapshot_id='test-snapshot', parameter_revision=4)
def decision(action=SCALE):
    return decision_adapter.validate_python(dict(status='proposal', action=action, explanation='Review before confirming.'))
class Provider:
    def __init__(self, result=None, error=None): self.result=result or decision(); self.error=error; self.calls=0
    async def plan_action(self, messages):
        self.calls+=1
        assert json.loads(messages[1]['content'])['verified_simulation_context']['acceleration']['y'] == pytest.approx(-.4)
        if self.error: raise self.error
        return self.result
class Service(TutorService):
    def __init__(self, provider): super().__init__(); self.provider=provider
    async def plan_action(self, request): return await super().plan_action(request, self.provider, SETTINGS)
@pytest.fixture(autouse=True)
def isolated(monkeypatch):
    app.dependency_overrides.clear()
    monkeypatch.delenv('LLM_API_KEY',raising=False); monkeypatch.delenv('LLM_MODEL',raising=False)
    yield
    app.dependency_overrides.clear()
def post(data=None, host='127.0.0.1', headers=None, content=None):
    async def send():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app,client=(host,123)),base_url='http://test') as client:
            return await client.post('/api/ai/plan-action',json=data if content is None else None,content=content,headers=headers)
    return run(send())
@pytest.mark.parametrize('action,expected', [
    ({'schema_version':1,'action':'set_parameter','target':'charge','value':2e-9}, .4),
    (SCALE,-.8),
    ({'schema_version':1,'action':'select_preset','preset_id':'negative-charge'},-.2),
    ({'schema_version':1,'action':'reset_simulation'},-.4),
    ({'schema_version':1,'action':'set_parameter','target':'field.y','value':0},0),
])
def test_operations_preview_and_no_mutation(action,expected):
    data=body(); original=copy.deepcopy(data); provider=Provider(decision(action))
    app.dependency_overrides[get_tutor_service]=lambda:Service(provider)
    result=post(data)
    assert result.status_code==200
    result=result.json()
    assert result['after_physics']['acceleration']['y']==pytest.approx(expected)
    assert result['after_physics']['acceleration_magnitude']==pytest.approx(abs(expected))
    assert result['before_physics']['force']['y']==pytest.approx(-4e-7)
    assert result['snapshot_id']=='test-snapshot' and result['parameter_revision']==4
    assert result['requires_confirmation'] is True
    assert data==original and provider.calls==1
@pytest.mark.parametrize('action', [
    {'schema_version':1,'action':'execute','code':'alert(1)'},
    {**SCALE,'target':'initialPosition.x'}, {**SCALE,'target':'__proto__'},
    {**SCALE,'factor':0}, {**SCALE,'factor':-1}, {**SCALE,'factor':11},
    {**SCALE,'factor':float('nan')}, {**SCALE,'factor':float('inf')},
    {**SCALE,'factor':True}, {**SCALE,'factor':'2'},
    {**SCALE,'schema_version':2}, {**SCALE,'schema_version':True},
    {**SCALE,'requires_confirmation':False},
    {'schema_version':1,'action':'select_preset','preset_id':'other'},
])
def test_strict_action_rejection(action):
    with pytest.raises(ValidationError): action_adapter.validate_python(action)
@pytest.mark.parametrize('target,value',[('mass',0),('mass',-1),('mass',1e-9),('mass',11e-6),('charge',11e-9),('field.x',501),('initialVelocity.y',11)])
def test_range_rejection(target,value):
    action=dict(schema_version=1,action='set_parameter',target=target,value=value)
    app.dependency_overrides[get_tutor_service]=lambda:Service(Provider(decision(action)))
    result=post(body())
    assert result.status_code==502 and result.json()['detail']['code']=='invalid_action'
def test_scale_result_cannot_exceed_bounds():
    with pytest.raises(InvalidAction): apply_action(SimulationContext.model_validate(context()).parameters,action_adapter.validate_python({**SCALE,'factor':3}))
def test_clarification_has_no_action_or_preview():
    result=decision_adapter.validate_python(dict(status='clarification_needed',explanation='Which field component and value?'))
    app.dependency_overrides[get_tutor_service]=lambda:Service(Provider(result))
    data=body();data['instruction']='Increase the field.'
    response=post(data)
    assert response.status_code==200 and response.json()==result.model_dump()
def test_inconsistent_physics_is_rejected_before_provider():
    provider=Provider();app.dependency_overrides[get_tutor_service]=lambda:Service(provider)
    data=body(); data['simulation_context']['force']['y']=4
    assert post(data).status_code==422 and provider.calls==0
@pytest.mark.parametrize('field,value',[('requires_confirmation',False),('execute',True),('parameter_revision',True),('snapshot_id',''),('instruction','')])
def test_request_no_bypass_and_strict_snapshot(field,value):
    data=body(); data[field]=value
    assert post(data).status_code==422
@pytest.mark.parametrize('payload',[{}, {'status':'proposal','action':SCALE,'explanation':'x','execute':True}])
def test_invalid_model_json(payload):
    adapter=OpenAICompatibleProvider(SETTINGS,httpx.MockTransport(lambda _:httpx.Response(200,json=envelope(payload))))
    with pytest.raises(ProviderError) as error:run(adapter.plan_action([]))
    assert error.value.code=='invalid_provider_response'
@pytest.mark.parametrize('status,code',[(401,'provider_authentication_error'),(403,'provider_authentication_error'),(404,'provider_model_unavailable'),(429,'provider_rate_limited'),(500,'provider_error')])
def test_planner_http_errors(status,code):
    adapter=OpenAICompatibleProvider(SETTINGS,httpx.MockTransport(lambda _:httpx.Response(status,json={'error':'private-debug'})))
    with pytest.raises(ProviderError) as error:run(adapter.plan_action([]))
    assert error.value.code==code and 'private-debug' not in str(error.value)
def test_adapter_valid_planning_and_invalid_raw_json():
    for content, valid in [(json.dumps(decision().model_dump()),True),('{bad',False)]:
        payload={'choices':[{'finish_reason':'stop','message':{'content':content}}]}
        adapter=OpenAICompatibleProvider(SETTINGS,httpx.MockTransport(lambda _:httpx.Response(200,json=payload)))
        if valid: assert run(adapter.plan_action([]))==decision()
        else:
            with pytest.raises(ProviderError):run(adapter.plan_action([]))
def test_timeout_and_shared_admission_control():
    async def scenario():
        class Slow:
            async def plan_action(self,messages): await asyncio.Event().wait()
        service=TutorService(1); request=PlanRequest.model_validate(body())
        from dataclasses import replace
        with pytest.raises(ProviderError) as error:await service.plan_action(request,Slow(),replace(SETTINGS,timeout=.01))
        assert error.value.code=='provider_timeout'
        await service._slots.acquire()
        with pytest.raises(ProviderError) as error:await service.plan_action(request,Provider(),SETTINGS)
        assert error.value.code=='tutor_busy'
        service._slots.release()
        assert (await service.plan_action(request,Provider(),SETTINGS)).requires_confirmation
    run(scenario())
def test_body_and_origin_limits_and_configuration():
    assert post(content='x'*65537).status_code==413
    assert post(body(),host='203.0.113.1').status_code==403
    assert post(body(),headers={'Origin':'https://evil.example'}).status_code==403
    assert post(body()).status_code==503

@pytest.mark.parametrize('x,y',[(100,200),(0,0)])
def test_ambiguous_field_axis_requires_clarification_without_model_call(x,y):
    from app.services.physics.context_validator import canonical_state
    data=body(); data['instruction']='将电场加倍'; c=data['simulation_context'];c['parameters']['field']={'x':x,'y':y}
    state=canonical_state(SimulationContext.model_validate(c))
    c.update(particleState=state.model_dump(),force=state.force.model_dump(),acceleration=state.acceleration.model_dump())
    provider=Provider();app.dependency_overrides[get_tutor_service]=lambda:Service(provider)
    response=post(data)
    assert response.status_code==200 and response.json()['status']=='clarification_needed'
    assert provider.calls==0

def test_planner_rejects_credential_and_system_prompt_echo():
    from app.services.ai.action_planner import PLANNER_PROMPT
    for text in [SETTINGS.api_key,PLANNER_PROMPT]:
        result=decision_adapter.validate_python(dict(status='clarification_needed',explanation=text))
        app.dependency_overrides[get_tutor_service]=lambda:Service(Provider(result))
        response=post(body())
        assert response.status_code==502 and SETTINGS.api_key not in response.text
