"""Explicit engine registry, separate from presentation and AI orchestration."""
import json
from pathlib import Path
from typing import Protocol, Any
from types import SimpleNamespace
from app.schemas.ai import Parameters
from app.services.physics.context_validator import canonical_state
MANIFESTS=json.loads((Path(__file__).resolve().parents[3]/'shared/experiments.json').read_text())

class ExperimentPlugin(Protocol):
    id: str
    version: int
    manifest: dict
    def validate_parameters(self, data: Any) -> dict: ...
    def create_initial_state(self, parameters: dict) -> dict: ...
    def evaluate_query(self, parameters: dict, query: Any) -> dict: ...

def value(p,path):
    for part in path.split('.'):p=p[part]
    return p

def bounds(p,manifest):
    import math
    for c in manifest['parameters']:
        v=value(p,c['target'])
        if type(v) not in (int,float) or not math.isfinite(v) or not c['min']*c['scale']-math.ulp(1.)*abs(c['min']*c['scale']) <= v <= c['max']*c['scale']+math.ulp(1.)*abs(c['max']*c['scale']):
            raise ValueError('Parameter outside supported SI bounds')

def time_query(query):
    if not isinstance(query,dict) or set(query)!={'time'}:raise ValueError('Invalid time query')
    return query['time']

class ElectricPlugin:
    def __init__(self,manifest):self.manifest=manifest;self.id=manifest['id'];self.version=manifest['version']
    def validate_parameters(self,data):
        p=Parameters.model_validate(data);bounds(p.model_dump(),self.manifest);return p.model_dump()
    def create_initial_state(self,parameters):return self.evaluate_query(parameters,self.manifest['initial_query'])['state']
    def evaluate_query(self,parameters,query):return self.evaluate(parameters,time_query(query))
    def evaluate(self,parameters,time):
        import math
        if type(time) not in (int,float) or not math.isfinite(time) or not 0<=time<=self.manifest['evolution']['max_duration']:raise ValueError('Unsupported duration')
        p=Parameters.model_validate(self.validate_parameters(parameters))
        state=canonical_state(SimpleNamespace(parameters=p,time=time))
        return dict(state=state.model_dump(),observables=dict(force=state.force.model_dump(),acceleration=state.acceleration.model_dump(),acceleration_magnitude=math.hypot(state.acceleration.x,state.acceleration.y),speed=math.hypot(state.velocity.x,state.velocity.y)))

if len({m['id'] for m in MANIFESTS})!=len(MANIFESTS):raise ValueError('Duplicate experiment identity')
def manifest(experiment_id):
    return next(m for m in MANIFESTS if m['id']==experiment_id)
REGISTRY={'uniform-electric-field':ElectricPlugin(manifest('uniform-electric-field'))}
def experiment(experiment_id,version=None):
    plugin=REGISTRY.get(experiment_id)
    if plugin is None or (version is not None and (type(version) is not int or plugin.version!=version)):raise ValueError('Unknown experiment or version')
    return plugin
# Explicit registration only; user data never controls imports.
from app.experiments.lorentz import LorentzPlugin
REGISTRY['lorentz-force-2d']=LorentzPlugin(manifest('lorentz-force-2d'))
from app.experiments.spatial import SpatialPlugin
REGISTRY['multi-zone-em']=SpatialPlugin(manifest('multi-zone-em'))
from app.experiments.optics import OpticalPlugin
REGISTRY['double-slit-interference']=OpticalPlugin(manifest('double-slit-interference'))
if len(REGISTRY)!=len(MANIFESTS):raise ValueError('Manifest has no registered engine')
