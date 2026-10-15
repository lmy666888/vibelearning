from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

Number = Annotated[float, Field(allow_inf_nan=False)]
Question = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
PresetId = Literal["positive-charge", "negative-charge", "stronger-field", "no-field"]
LessonStepId = Literal["observe-positive", "reverse-charge", "increase-field", "explain-acceleration"]

class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False, frozen=True)

class Vector2(StrictModel):
    x: Number
    y: Number

class Parameters(StrictModel):
    charge: Number
    mass: Annotated[float, Field(gt=0, allow_inf_nan=False)]
    field: Vector2
    initialPosition: Vector2
    initialVelocity: Vector2

class ParticleState(StrictModel):
    time: Annotated[float, Field(ge=0, allow_inf_nan=False)]
    position: Vector2
    velocity: Vector2
    force: Vector2
    acceleration: Vector2

class SimulationContext(StrictModel):
    schemaVersion: Literal[1]
    simulationId: Literal["uniform-electric-field-2d"]
    unitSystem: Literal["SI"]
    parameters: Parameters
    time: Annotated[float, Field(ge=0, allow_inf_nan=False)]
    particleState: ParticleState
    force: Vector2
    acceleration: Vector2
    activePresetId: PresetId | None
    currentLessonStepId: LessonStepId | None

    @field_validator("schemaVersion", mode="before")
    @classmethod
    def supported_version(cls, value):
        if type(value) is not int or value != 1:
            raise ValueError("Unsupported context schema version; expected integer 1")
        return value

class ExplainRequest(StrictModel):
    preferred_language: Literal["zh-CN", "en"] | None = None
    question: Question
    simulation_context: SimulationContext

ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
class Explanation(StrictModel):
    answer: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=8000)]
    key_concepts: Annotated[list[ShortText], Field(max_length=8)]
    related_equations: Annotated[list[ShortText], Field(max_length=8)]
