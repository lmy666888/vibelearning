"""The only permitted network-completion dispatch path, shared by v1/v2 and every experiment."""
import asyncio,hashlib,json,secrets,time
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Literal
from pydantic import model_validator
from app.schemas.ai import StrictModel,ShortText
from app.governance.quota import Limits,GovernanceError,store_for,specs_for
from app.governance.policy import SCOPE_POLICY,localized,preflight
@dataclass
class Identity:
    session:str;network:str;language:str='en';operation:str='explain';api_version:int=1;remaining_minute:int|None=None;remaining_daily:int|None=None
identity:ContextVar[Identity|None]=ContextVar('ai_identity',default=None)
dispatch_authorized:ContextVar[bool]=ContextVar('ai_admitted',default=False)
class ScopeEnvelope(StrictModel):
    scope:Literal['in_scope','out_of_scope','needs_clarification']
    result:dict|None=None
    message:ShortText|None=None
    @model_validator(mode='after')
    def shape(self):
        if self.scope=='in_scope':
            if not isinstance(self.result,dict) or self.message is not None:raise ValueError('Invalid scope result')
        elif self.result is not None or not self.message:raise ValueError('Invalid scope route')
        return self

def input_check(messages,limits):
    if len(messages)>limits.max_messages or any(set(m)!={'role','content'} or m['role'] not in {'system','user','assistant'} or not isinstance(m['content'],str) for m in messages):raise GovernanceError('invalid_request',422,0)
    size=len(json.dumps(messages,ensure_ascii=False).encode())
    if size>limits.input_tokens:raise GovernanceError('invalid_request',422,0)
    return size # Conservative UTF-8 byte upper bound, not a claimed tokenizer measurement.

def task_schema(operation,v2):
    if operation=='explain':
        from app.schemas.ai import Explanation
        return Explanation.model_json_schema()
    if operation=='evaluate-observation':
        from app.schemas.learning import ObservationFeedback
        return ObservationFeedback.model_json_schema()
    if v2:
        from app.experiments.ai import Decision,LessonDecision
        return (LessonDecision if operation=='generate-lesson' else Decision).json_schema()
    from app.schemas.actions import decision_adapter
    from app.schemas.learning import lesson_decision_adapter
    return (lesson_decision_adapter if operation=='generate-lesson' else decision_adapter).json_schema()

async def completion(provider,messages,requested,send,operation=None):
    from app.services.ai.provider import ProviderError
    who=identity.get() or Identity('server-internal','server-internal')
    try:limits=Limits.load()
    except (GovernanceError,ValueError):raise ProviderError(503,'quota_unavailable',localized('quota_unavailable',who.language)) from None
    output=min(requested,limits.lesson_output if requested>1500 else limits.ordinary_output)
    policy=SCOPE_POLICY+'\nFor in_scope, result MUST satisfy this exact task JSON Schema. Do not substitute an explanation-only object or prose: '+json.dumps(task_schema(operation or who.operation,who.api_version==2),ensure_ascii=False)
    trusted=[*(m for m in messages if m['role']=='system'),{'role':'system','content':policy},*(m for m in messages if m['role']!='system')]
    try:tokens=input_check(trusted,limits)
    except GovernanceError as e:raise ProviderError(e.status,e.code,localized(e.code,who.language)) from None
    digest=hashlib.sha256(json.dumps(messages,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    store=store_for(limits)
    for attempt in range(limits.retries+1):
        specs,cost=specs_for(limits,who.session,who.network,digest,tokens,output);r=None;success=False;actual=None
        try:
            r=await store.reserve(specs,secrets.token_hex(16),time.time()+min(limits.timeout,provider.settings.timeout)+10,limits.concurrency,cost,specs[-1][0]);who.remaining_minute=r.remaining_minute;who.remaining_daily=r.remaining_daily
            authorization=dispatch_authorized.set(True)
            try:raw,usage=await asyncio.wait_for(send(trusted,output),min(limits.timeout,provider.settings.timeout))
            finally:dispatch_authorized.reset(authorization)
            if usage and all(type(usage.get(k)) is int and usage[k]>=0 for k in ['prompt_tokens','completion_tokens']):actual=min(cost,limits.cost(usage['prompt_tokens'],usage['completion_tokens']))
            if len(raw.encode())>24000 or SCOPE_POLICY in raw:raise ValueError('Unsafe or oversized scope result')
            result=ScopeEnvelope.model_validate_json(raw);success=True
            if result.scope!='in_scope':
                code='out_of_scope' if result.scope=='out_of_scope' else 'clarification_required'
                raise ProviderError(422 if code=='out_of_scope' else 409,code,localized(code,who.language))
            return json.dumps(result.result,ensure_ascii=False,allow_nan=False)
        except GovernanceError as e:
            error=ProviderError(e.status,e.code,localized(e.code,who.language));error.retry_after=e.retry;raise error from None
        except TimeoutError:raise ProviderError(504,'provider_timeout','The AI provider timed out. Retry explicitly.') from None
        except ValueError:raise ProviderError(502,'invalid_provider_response','The provider returned invalid governed output.') from None
        except ProviderError as e:
            # Only explicit upstream 5xx/network unavailability retries; every attempt reserves anew.
            if attempt<limits.retries and e.code in {'provider_unavailable','provider_error'}:await asyncio.sleep(.1*(attempt+1));continue
            raise
        finally:
            if r:await asyncio.shield(store.finish(r,actual_cost=actual,failed=not success))
