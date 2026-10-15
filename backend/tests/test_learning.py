import copy
import json
import asyncio
import httpx
import pytest
from pydantic import ValidationError
from app.main import app
from app.api.routes.ai import get_tutor_service
from app.schemas.learning import LessonDraft, GenerateLessonRequest, ObservationRequest, ObservationFeedback
from app.schemas.ai import SimulationContext
from app.services.ai.tutor_service import TutorService
from app.services.ai.provider import OpenAICompatibleProvider, ProviderError
from app.services.physics.context_validator import canonical_state
from test_ai import context, SETTINGS, run, envelope

CAPABILITIES={'simulation_id':'uniform-electric-field-2d','operations':['set_parameter','scale_parameter','select_preset','reset_simulation'],'parameter_targets':['charge','mass','field.x','field.y','initialVelocity.x','initialVelocity.y']}
def action(target,value):return {'schema_version':1,'action':'set_parameter','target':target,'value':value}
def draft():
    steps=[]
    for i,actions in enumerate([[action('charge',2e-9),action('field.y',200)],[action('charge',-2e-9)],[{'schema_version':1,'action':'scale_parameter','target':'field.y','factor':2}]]):
        steps.append(dict(step_id=f'step-{i+1}',title=f'Experiment {i+1}',objective='Observe acceleration direction.',experiment_actions=actions,expected_behavior='Compare the signed acceleration.',observation_question='Which direction does the particle accelerate?',expected_concepts=['Electric force'],explanation='Use F = qE and a = F/m.',completion_criteria='submit_observation'))
    return dict(status='lesson',schema_version=1,language='en',title='Electric force',learning_objectives=['Compare charge polarity'],steps=steps)
def body():return dict(learning_goal='Teach me charge polarity.',preferred_language='en',simulation_context=context(),capabilities=copy.deepcopy(CAPABILITIES))
FEEDBACK=dict(assessment='correct',feedback='Your direction is correct.',explanation='Positive charge accelerates along the field.',hint=None,next_action='continue')
class Provider:
    def __init__(self,result=None,error=None):self.result=result;self.error=error;self.calls=0
    async def generate_lesson(self,messages):
        self.calls+=1
        if self.error:raise self.error
        return LessonDraft.model_validate(self.result or draft())
    async def evaluate_observation(self,messages):
        self.calls+=1
        if self.error:raise self.error
        return ObservationFeedback.model_validate(self.result or FEEDBACK)
class Service(TutorService):
    def __init__(self,provider):super().__init__();self.provider=provider
    async def generate_lesson(self,request):return await super().generate_lesson(request,self.provider,SETTINGS)
    async def evaluate_observation(self,request):return await super().evaluate_observation(request,self.provider,SETTINGS)
@pytest.fixture(autouse=True)
def isolate(monkeypatch):
    app.dependency_overrides.clear();monkeypatch.delenv('LLM_API_KEY',raising=False);monkeypatch.delenv('LLM_MODEL',raising=False)
    yield
    app.dependency_overrides.clear()
def post(path,data=None,content=None,host='127.0.0.1',headers=None):
    async def perform():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app,client=(host,123)),base_url='http://test') as client:
            return await client.post('/api/ai/'+path,json=data if content is None else None,content=content,headers=headers)
    return run(perform())
def generate():
    app.dependency_overrides[get_tutor_service]=lambda:Service(Provider())
    response=post('generate-lesson',body());assert response.status_code==200
    return response.json()
def observation(plan=None):
    plan=plan or generate();c=context();c['parameters']=plan['steps'][0]['after'];s=canonical_state(SimulationContext.model_validate(c));c.update(particleState=s.model_dump(),force=s.force.model_dump(),acceleration=s.acceleration.model_dump())
    return dict(lesson=plan,step_id='step-1',student_answer='It accelerates upward along the field.',simulation_context=c,preferred_language='en')
def test_sequential_predictions_and_no_mutation():
    original=body();saved=copy.deepcopy(original);p=Provider();app.dependency_overrides[get_tutor_service]=lambda:Service(p)
    response=post('generate-lesson',original);assert response.status_code==200
    plan=response.json();assert original==saved and p.calls==1
    assert [s['predicted_physics']['acceleration']['y'] for s in plan['steps']]==pytest.approx([.4,-.4,-.8])
    assert all(s['requires_confirmation'] is True for s in plan['steps'])
    assert plan['steps'][2]['before']==plan['steps'][1]['after']
    assert plan['initial_parameters']==context()['parameters']
@pytest.mark.parametrize('change',[
    lambda p:p.update(schema_version=True),lambda p:p.update(schema_version=2),lambda p:p.update(steps=[]),
    lambda p:p.update(steps=p['steps']*2),lambda p:p['steps'][1].update(step_id='step-1'),
    lambda p:p['steps'][0].update(experiment_actions=[action('charge',1e-9)]*4),
    lambda p:p['steps'][0].update(requires_confirmation=False),
    lambda p:p['steps'][0].update(experiment_actions=[action('gravity',1)]),
])
def test_invalid_lesson_schemas(change):
    data=draft();change(data)
    with pytest.raises(ValidationError):LessonDraft.model_validate(data)
@pytest.mark.parametrize('actions',[
    [action('mass',0)],[action('field.y',501)],[action('charge',1e-9),action('charge',-1e-9)],
    [action('charge',1e-9),{'schema_version':1,'action':'select_preset','preset_id':'no-field'}],
    [action('charge',1e-9),{'schema_version':1,'action':'reset_simulation'}],
])
def test_invalid_atomic_transitions(actions):
    data=draft();data['steps'][0]['experiment_actions']=actions
    app.dependency_overrides[get_tutor_service]=lambda:Service(Provider(data))
    response=post('generate-lesson',body());assert response.status_code==502 and response.json()['detail']['code']=='invalid_action'
def test_capability_subset_is_enforced():
    data=body();data['capabilities']['operations']=['select_preset']
    app.dependency_overrides[get_tutor_service]=lambda:Service(Provider())
    assert post('generate-lesson',data).status_code==502

def test_unsupported_goal_clear_response():
    from app.schemas.learning import UnsupportedLesson
    class Unsupported(Provider):
        async def generate_lesson(self,messages):return UnsupportedLesson(status='unsupported_capability',language='en',reason='Magnetic fields are not supported.')
    app.dependency_overrides[get_tutor_service]=lambda:Service(Unsupported())
    response=post('generate-lesson',body());assert response.status_code==200 and response.json()['status']=='unsupported_capability'
@pytest.mark.parametrize('field,value',[('preferred_language','fr'),('learning_goal',''),('execute',True)])
def test_invalid_requests(field,value):
    data=body();data[field]=value;assert post('generate-lesson',data).status_code==422

def test_physics_verification_precedes_provider():
    p=Provider();app.dependency_overrides[get_tutor_service]=lambda:Service(p)
    data=body();data['simulation_context']['force']['y']=10
    assert post('generate-lesson',data).status_code==422 and p.calls==0

def test_observation_feedback_and_current_experiment_validation():
    data=observation();p=Provider();app.dependency_overrides[get_tutor_service]=lambda:Service(p)
    response=post('evaluate-observation',data);assert response.status_code==200
    assert response.json()['assessment']=='correct' and response.json()['authoritative_physics']['acceleration']['y']==pytest.approx(.4)
    data['simulation_context']=context()
    assert post('evaluate-observation',data).status_code==422 and p.calls==1

def test_tampered_plan_predictions_rejected_before_feedback():
    data=observation();data['lesson']['steps'][2]['predicted_physics']['acceleration']['y']=1
    p=Provider();app.dependency_overrides[get_tutor_service]=lambda:Service(p)
    assert post('evaluate-observation',data).status_code==422 and p.calls==0
@pytest.mark.parametrize('assessment',['partially_correct','incorrect','needs_clarification'])
def test_conservative_feedback_requires_retry(assessment):
    with pytest.raises(ValidationError):ObservationFeedback.model_validate({**FEEDBACK,'assessment':assessment})
    data=observation();p=Provider({**FEEDBACK,'assessment':assessment,'next_action':'retry','hint':'Compare force with field.'})
    app.dependency_overrides[get_tutor_service]=lambda:Service(p)
    assert post('evaluate-observation',data).json()['next_action']=='retry'
@pytest.mark.parametrize('method',['generate_lesson','evaluate_observation'])
@pytest.mark.parametrize('status,code',[(429,'provider_rate_limited'),(500,'provider_error'),(403,'provider_authentication_error')])
def test_provider_http_errors(method,status,code):
    provider=OpenAICompatibleProvider(SETTINGS,httpx.MockTransport(lambda _:httpx.Response(status,json={'error':'private-debug'})))
    with pytest.raises(ProviderError) as e:run(getattr(provider,method)([]))
    assert e.value.code==code and 'private-debug' not in str(e.value)
@pytest.mark.parametrize('method',['generate_lesson','evaluate_observation'])
def test_invalid_provider_json(method):
    p=OpenAICompatibleProvider(SETTINGS,httpx.MockTransport(lambda _:httpx.Response(200,json=envelope({'unexpected':'value'}))))
    with pytest.raises(ProviderError) as e:run(getattr(p,method)([]))
    assert e.value.code=='invalid_provider_response'
def test_lesson_deadline():
    class Slow(Provider):
        async def generate_lesson(self,messages):await asyncio.Event().wait()
    from dataclasses import replace
    with pytest.raises(ProviderError) as e:run(TutorService().generate_lesson(GenerateLessonRequest.model_validate(body()),Slow(),replace(SETTINGS,timeout=.01)))
    assert e.value.code=='provider_timeout'

def test_language_mismatch_rejected_without_retry():
    data=body();data['preferred_language']='zh-CN';p=Provider();app.dependency_overrides[get_tutor_service]=lambda:Service(p)
    response=post('generate-lesson',data);assert response.status_code==502 and response.json()['detail']['code']=='language_mismatch' and p.calls==1

def test_chinese_fields_are_checked_individually():
    data=draft();data['language']='zh-CN';data['title']='电场课程';data['learning_objectives']=['理解电场力']
    request=body();request['preferred_language']='zh-CN';app.dependency_overrides[get_tutor_service]=lambda:Service(Provider(data))
    assert post('generate-lesson',request).json()['detail']['code']=='language_mismatch'

@pytest.mark.parametrize('path',['generate-lesson','evaluate-observation'])
def test_learning_route_guards(path):
    data=body() if path=='generate-lesson' else observation()
    assert post(path,data,host='203.0.113.1').status_code==403
    assert post(path,data,headers={'Origin':'https://evil.example'}).status_code==403
    assert post(path,content='x'*65537).status_code==413

def test_sequential_prediction_uses_existing_mass_instead_of_hardcoded_outcomes():
    data=body();data['simulation_context']['parameters']['mass']=2e-6
    c=SimulationContext.model_validate(data['simulation_context']);s=canonical_state(c)
    data['simulation_context'].update(particleState=s.model_dump(),force=s.force.model_dump(),acceleration=s.acceleration.model_dump())
    app.dependency_overrides[get_tutor_service]=lambda:Service(Provider())
    response=post('generate-lesson',data);assert response.status_code==200
    assert [s['predicted_physics']['acceleration']['y'] for s in response.json()['steps']]==pytest.approx([.2,-.2,-.4])

def test_valid_chinese_lesson():
    data=draft();data.update(language='zh-CN',title='理解电场力',learning_objectives=['比较电荷正负'])
    for s in data['steps']:
        for field in ['title','objective','expected_behavior','observation_question','explanation']:s[field]='观察电荷的加速度方向。'
        s['expected_concepts']=['电场力']
    request=body();request['preferred_language']='zh-CN';app.dependency_overrides[get_tutor_service]=lambda:Service(Provider(data))
    response=post('generate-lesson',request);assert response.status_code==200 and response.json()['language']=='zh-CN'

def test_shared_language_policy_applies_to_existing_explanation_and_action_routes():
    from app.schemas.ai import Explanation,ExplainRequest
    from app.schemas.actions import PlanRequest,decision_adapter
    from test_actions import body as action_body
    from test_ai import body as explain_body
    class WrongLanguage:
        async def explain(self,messages):
            assert 'exclusively in English' in messages[0]['content']
            return Explanation(answer='中文解释。',key_concepts=['电场力'],related_equations=['F=qE'])
        async def plan_action(self,messages):
            assert 'exclusively in English' in messages[0]['content']
            return decision_adapter.validate_python(dict(status='clarification_needed',explanation='中文问题。'))
    for method,model,data in [('explain',ExplainRequest,explain_body()),('plan_action',PlanRequest,action_body())]:
        data['preferred_language']='en'
        with pytest.raises(ProviderError) as e:run(getattr(TutorService(),method)(model.model_validate(data),WrongLanguage(),SETTINGS))
        assert e.value.code=='language_mismatch'

def test_chinese_policy_rejects_mixed_english_prose_but_preserves_units_and_parameter_paths():
    from app.services.ai.language import ensure_language
    with pytest.raises(ProviderError):ensure_language(['The force is upward. 电场力。'],'zh-CN')
    ensure_language(['电荷 charge 为 2 nC，质量 mass 为 1 mg，field.y=200 N/C，ay=0.4 m/s²，F=qE。'],'zh-CN')

def test_feedback_prompt_echo_is_rejected_without_revealing_it():
    class Echo(Provider):
        async def evaluate_observation(self,messages):return ObservationFeedback(**{**FEEDBACK,'feedback':messages[0]['content']})
    request=ObservationRequest.model_validate(observation())
    with pytest.raises(ProviderError) as e:run(TutorService().evaluate_observation(request,Echo(),SETTINGS))
    assert e.value.code=='invalid_provider_response'
