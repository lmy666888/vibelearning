import json,math,struct
from typing import Literal, Annotated
from pydantic import Field, JsonValue, field_validator
from app.schemas.ai import StrictModel
from app.experiments.registry import experiment

def fingerprint(value):
    def normalize(v):
        if type(v) in (int,float):
            if not math.isfinite(v):raise ValueError('Nonfinite snapshot')
            if v==0:return '0'
            return struct.pack('>d',float(v)).hex()
        if isinstance(v,dict):return {k:normalize(v[k]) for k in sorted(v)}
        if isinstance(v,list):return [normalize(x) for x in v]
        return v
    data=json.dumps(normalize(value),ensure_ascii=False,separators=(',',':')).encode();h=2166136261
    for b in data:h=((h^b)*16777619)&0xffffffff
    return f'fnv1a-{h:08x}'

class ExperimentContext(StrictModel):
    schema_version: Literal[2]
    experiment_id: Annotated[str,Field(min_length=1,max_length=80)]
    experiment_version: Annotated[int,Field(ge=1,le=100)]
    parameters: dict[str,JsonValue]
    query: dict[str,JsonValue]
    simulation_state: dict[str,JsonValue]
    observables: dict[str,JsonValue]
    revision: Annotated[int,Field(ge=0,le=9007199254740991)]
    snapshot_id: str
    @field_validator('schema_version',mode='before')
    @classmethod
    def version(cls,v):
        if type(v) is not int or v!=2:raise ValueError('Expected context version 2')
        return v

def context(experiment_id,parameters,query,revision=0,version=None):
    plugin=experiment(experiment_id,version);p=plugin.validate_parameters(parameters);r=plugin.evaluate_query(p,query)
    data=dict(schema_version=2,experiment_id=experiment_id,experiment_version=plugin.version,parameters=p,query=query,simulation_state=r['state'],observables=r['observables'],revision=revision)
    return ExperimentContext(**data,snapshot_id=fingerprint({k:data[k] for k in ['schema_version','experiment_id','experiment_version','parameters','query','revision']}))

def verify(supplied:ExperimentContext):
    expected=context(supplied.experiment_id,supplied.parameters,supplied.query,supplied.revision,supplied.experiment_version)
    def equal(a,b):
        if type(a) in (int,float):return type(b) in (int,float) and math.isfinite(b) and math.isclose(a,b,rel_tol=1e-8,abs_tol=1e-15)
        if isinstance(a,dict):return isinstance(b,dict) and set(a)==set(b) and all(equal(a[k],b[k]) for k in a)
        return a==b
    if not equal(expected.simulation_state,supplied.simulation_state) or not equal(expected.observables,supplied.observables) or expected.snapshot_id!=supplied.snapshot_id:
        raise ValueError('Context identity or derived science failed independent verification')
    return expected
