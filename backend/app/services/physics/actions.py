"""Pure action validation and analytical preview; never writes application state."""
import json
import math
from pathlib import Path
from app.schemas.ai import Parameters, SimulationContext
from app.schemas.actions import Action, PhysicsPreview
from app.services.physics.context_validator import canonical_state

CONTROLS = json.loads((Path(__file__).resolve().parents[4] / 'shared/simulation-controls.json').read_text())
LIMITS = {item['target']: (item['min'] * item['scale'], item['max'] * item['scale']) for item in CONTROLS}

class InvalidAction(ValueError):
    pass

def check_parameters(parameters: Parameters) -> None:
    data = parameters.model_dump()
    for target, (low, high) in LIMITS.items():
        parts = target.split('.')
        value = data[parts[0]] if len(parts) == 1 else data[parts[0]][parts[1]]
        if not low <= value <= high:
            raise InvalidAction(f'{target} must be between {low:g} and {high:g} SI units; no clamping is applied.')

def apply_action(parameters: Parameters, action: Action) -> Parameters:
    data = parameters.model_dump()
    if action.action == 'select_preset':
        data = dict(charge=-2e-9 if action.preset_id == 'negative-charge' else 2e-9,
                    mass=1e-6, field=dict(x=0, y=0 if action.preset_id == 'no-field' else 200 if action.preset_id == 'stronger-field' else 100),
                    initialPosition=dict(x=0, y=0), initialVelocity=dict(x=5, y=0))
    elif action.action in {'set_parameter', 'scale_parameter'}:
        parts = action.target.split('.')
        parent = data if len(parts) == 1 else data[parts[0]]
        key = parts[-1]
        parent[key] = action.value if action.action == 'set_parameter' else parent[key] * action.factor
    result = Parameters.model_validate(data)
    check_parameters(result)
    return result

def preview(context: SimulationContext, parameters: Parameters) -> PhysicsPreview:
    state = canonical_state(context.model_copy(update={'parameters': parameters, 'time': 0.0}))
    return PhysicsPreview(force=state.force, acceleration=state.acceleration,
                          acceleration_magnitude=math.hypot(state.acceleration.x, state.acceleration.y))
