from typing import Annotated, Literal
from pydantic import Field, StringConstraints, TypeAdapter, model_validator
from app.schemas.ai import StrictModel, Question, Parameters, SimulationContext
from app.schemas.actions import VersionedAction, Action, Target, PhysicsPreview, Text

Language = Literal['zh-CN', 'en']
Operation = Literal['set_parameter', 'scale_parameter', 'select_preset', 'reset_simulation']
Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=240)]
Concepts = Annotated[list[Label], Field(min_length=1, max_length=5)]
class Capabilities(StrictModel):
    simulation_id: Literal['uniform-electric-field-2d']
    operations: Annotated[list[Operation], Field(min_length=1, max_length=4)]
    parameter_targets: Annotated[list[Target], Field(min_length=1, max_length=6)]
    @model_validator(mode='after')
    def unique(self):
        if len(set(self.operations)) != len(self.operations) or len(set(self.parameter_targets)) != len(self.parameter_targets):
            raise ValueError('Capabilities must be unique')
        return self

class GenerateLessonRequest(StrictModel):
    learning_goal: Question
    preferred_language: Language
    simulation_context: SimulationContext
    capabilities: Capabilities

class StepDraft(StrictModel):
    step_id: Annotated[str, StringConstraints(pattern=r'^step-[1-5]$')]
    title: Label
    objective: Label
    experiment_actions: Annotated[list[Action], Field(min_length=1, max_length=3)]
    expected_behavior: Label
    observation_question: Label
    expected_concepts: Concepts
    explanation: Label
    completion_criteria: Literal['submit_observation']

class LessonDraft(VersionedAction):
    status: Literal['lesson']
    title: Label
    language: Language
    learning_objectives: Concepts
    steps: Annotated[list[StepDraft], Field(min_length=1, max_length=5)]
    @model_validator(mode='after')
    def ordered(self):
        if [s.step_id for s in self.steps] != [f'step-{i+1}' for i in range(len(self.steps))]:
            raise ValueError('Step IDs must be unique and ordered from step-1')
        return self

class UnsupportedLesson(StrictModel):
    status: Literal['unsupported_capability']
    language: Language
    reason: Label

LessonDecision = Annotated[LessonDraft | UnsupportedLesson, Field(discriminator='status')]
lesson_decision_adapter = TypeAdapter(LessonDecision)

class LessonStep(StepDraft):
    before: Parameters
    after: Parameters
    predicted_physics: PhysicsPreview
    requires_confirmation: Literal[True]

class GenerationMetadata(StrictModel):
    provider_model: Annotated[str, StringConstraints(min_length=1, max_length=160)]
    generated_at: Annotated[str, StringConstraints(min_length=1, max_length=80)]

class LessonPlan(LessonDraft):
    lesson_id: Annotated[str, StringConstraints(pattern=r'^[a-f0-9-]{36}$')]
    initial_parameters: Parameters
    steps: Annotated[list[LessonStep], Field(min_length=1, max_length=5)]
    metadata: GenerationMetadata

LessonResult = Annotated[LessonPlan | UnsupportedLesson, Field(discriminator='status')]

class ObservationRequest(StrictModel):
    lesson: LessonPlan
    step_id: Annotated[str, StringConstraints(pattern=r'^step-[1-5]$')]
    student_answer: Question
    simulation_context: SimulationContext
    preferred_language: Language

class ObservationFeedback(StrictModel):
    assessment: Literal['correct', 'partially_correct', 'incorrect', 'needs_clarification']
    feedback: Text
    explanation: Text
    hint: Label | None
    next_action: Literal['retry', 'continue']
    @model_validator(mode='after')
    def conservative(self):
        if self.assessment != 'correct' and self.next_action != 'retry':
            raise ValueError('Incomplete or incorrect answers must be offered a retry')
        return self

class ObservationResult(ObservationFeedback):
    lesson_id: str
    step_id: str
    authoritative_physics: PhysicsPreview
