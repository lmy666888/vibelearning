import { useSimulationStore } from '../../stores/simulationStore';
import { uniformElectricFieldLesson } from '../../learning/lessons/uniformElectricField';
import { getPreset } from '../../simulations/physics/uniform-electric-field/presets';

export function GuidedLesson() {
  const stepId = useSimulationStore(state => state.currentLessonStepId);
  const navigate = useSimulationStore(state => state.navigateLesson);
  const applyPreset = useSimulationStore(state => state.applyPreset);
  const lesson = uniformElectricFieldLesson;
  const index = lesson.steps.findIndex(step => step.id === stepId);
  const step = lesson.steps[index];
  const preset = getPreset(step.suggestedPresetId);
  return <section className="panel learning-panel" aria-labelledby="lesson-heading">
    <span className="eyebrow">GUIDED LEARNING · AUTHORED LESSON</span>
    <h2 id="lesson-heading">{lesson.title}</h2>
    <p><b>Learning objective:</b> {lesson.learningObjective}</p>
    <div className="lesson-step" aria-live="polite" aria-atomic="true">
      <span className="tag">Step {index + 1} of {lesson.steps.length}</span><h3>{step.title}</h3>
      <p>{step.explanation}</p><p className="concept-question"><b>Think about it:</b> {step.question}</p>
    </div>
    <button className="apply-preset" onClick={() => applyPreset(step.suggestedPresetId)}>Apply suggested preset: {preset.title}</button>
    <p className="control-note">Navigating steps does not change your experiment. Apply a preset explicitly when ready.</p>
    <div className="buttons lesson-navigation"><button onClick={() => navigate(-1)} disabled={index === 0}>Previous step</button>
      <button onClick={() => navigate(1)} disabled={index === lesson.steps.length - 1}>Next step</button></div>
  </section>;
}
