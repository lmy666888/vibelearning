from typing import Annotated, Literal
from pydantic import Field, StringConstraints, TypeAdapter, field_validator
from app.schemas.ai import StrictModel, Number, Question, Parameters, Vector2, PresetId, SimulationContext

Target = Literal['charge', 'mass', 'field.x', 'field.y', 'initialVelocity.x', 'initialVelocity.y']
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]

class VersionedAction(StrictModel):
    schema_version: Literal[1]

    @field_validator('schema_version', mode='before')
    @classmethod
    def version(cls, value):
        if type(value) is not int or value != 1:
            raise ValueError('Expected action schema version 1')
        return value

class SetParameter(VersionedAction):
    action: Literal['set_parameter']
    target: Target
    value: Number

class ScaleParameter(VersionedAction):
    action: Literal['scale_parameter']
    target: Target
    factor: Annotated[float, Field(gt=0, le=10, allow_inf_nan=False)]

class SelectPreset(VersionedAction):
    action: Literal['select_preset']
    preset_id: PresetId

class ResetSimulation(VersionedAction):
    action: Literal['reset_simulation']

Action = Annotated[SetParameter | ScaleParameter | SelectPreset | ResetSimulation, Field(discriminator='action')]
action_adapter = TypeAdapter(Action)

class ModelProposal(StrictModel):
    status: Literal['proposal']
    action: Action
    explanation: Text

class Clarification(StrictModel):
    status: Literal['clarification_needed']
    explanation: Text

Decision = Annotated[ModelProposal | Clarification, Field(discriminator='status')]
decision_adapter = TypeAdapter(Decision)

class PlanRequest(StrictModel):
    instruction: Question
    simulation_context: SimulationContext
    snapshot_id: Annotated[str, StringConstraints(pattern=r'^[a-zA-Z0-9-]{1,80}$')]
    parameter_revision: Annotated[int, Field(ge=0, le=9007199254740991)]

class PhysicsPreview(StrictModel):
    force: Vector2
    acceleration: Vector2
    acceleration_magnitude: Annotated[float, Field(ge=0, allow_inf_nan=False)]

class Proposal(ModelProposal):
    before: Parameters
    after: Parameters
    before_physics: PhysicsPreview
    after_physics: PhysicsPreview
    snapshot_id: str
    parameter_revision: int
    requires_confirmation: Literal[True]

PlanResult = Annotated[Proposal | Clarification, Field(discriminator='status')]
