import { useSimulationStore } from '../../stores/simulationStore';
import { experimentPresets, getPreset } from '../../simulations/physics/uniform-electric-field/presets';

export function ExperimentPresets() {
  const activeId = useSimulationStore(state => state.activePresetId);
  const applyPreset = useSimulationStore(state => state.applyPreset);
  const selected = activeId ? getPreset(activeId) : null;
  return <section className="panel learning-panel" aria-labelledby="presets-heading">
    <span className="eyebrow">EXPLORE THE VARIABLES</span>
    <h2 id="presets-heading">Experiment Presets</h2>
    <p>Start with a controlled experiment, then change one variable.</p>
    <div className="preset-grid">
      {experimentPresets.map(preset => <button key={preset.id} className="preset-card"
        aria-pressed={activeId === preset.id} onClick={() => applyPreset(preset.id)}>
        <strong>{preset.title}</strong><span>{preset.description}</span>
      </button>)}
    </div>
    <div className="experiment-description" aria-live="polite">
      {selected ? <><h3>{selected.title}</h3><p>{selected.description}</p>
        <p><b>Objective:</b> {selected.learningObjective}</p><p><b>Expected behavior:</b> {selected.expectedBehavior}</p></>
        : <p>Custom experiment. Select a preset to see its objective and expected behavior.</p>}
    </div>
  </section>;
}
