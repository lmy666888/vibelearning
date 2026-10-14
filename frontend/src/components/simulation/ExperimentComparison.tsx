import { useMemo } from 'react';
import { useSimulationStore } from '../../stores/simulationStore';
import { compareExperiments } from '../../simulations/physics/uniform-electric-field/comparison';
import { formatNumber } from './SimulationInfo';

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`;
}
export function ExperimentComparison() {
  const parameters = useSimulationStore(state => state.parameters);
  const baseline = useSimulationStore(state => state.baseline);
  const saveBaseline = useSimulationStore(state => state.saveBaseline);
  const clearBaseline = useSimulationStore(state => state.clearBaseline);
  const rows = useMemo(() => baseline ? compareExperiments(baseline, parameters) : [], [baseline, parameters]);
  return <section className="panel comparison-panel" aria-labelledby="comparison-heading">
    <div className="comparison-heading"><div><span className="eyebrow">ANALYZE YOUR EXPERIMENT</span>
      <h2 id="comparison-heading">Experiment Comparison</h2></div>
      <div className="buttons"><button className="primary" onClick={saveBaseline}>{baseline ? 'Replace baseline' : 'Save baseline'}</button>
        <button onClick={clearBaseline} disabled={!baseline}>Clear baseline</button></div></div>
    {baseline ? <><p role="status">Baseline saved. Comparison uses parameters only and stays fixed while time advances.</p>
      <p id="comparison-rule">Signed change Δ = current − baseline; absolute difference = |Δ|. Percent = 100 × Δ / |baseline|. Component percentages describe signed components; magnitude percentages describe size. N/A means a zero baseline or a numeric range limit.</p>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Experiment comparison table"><table aria-describedby="comparison-rule">
        <caption className="sr-only">Baseline and current physical parameters and derived quantities</caption>
        <thead><tr><th scope="col">Quantity (unit)</th><th scope="col">Baseline</th><th scope="col">Current</th><th scope="col">Signed change Δ</th><th scope="col">Absolute difference |Δ|</th><th scope="col">Percent change</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id} data-testid={`comparison-${row.id}`}>
          <th scope="row">{row.label} <small>({row.unit})</small></th>
          <td>{formatNumber(row.baseline)}</td><td>{formatNumber(row.current)}</td>
          <td>{row.delta === null ? 'N/A — numeric range' : signed(row.delta)}</td>
          <td>{row.delta === null ? 'N/A — numeric range' : formatNumber(Math.abs(row.delta))}</td>
          <td>{row.percent === null ? `N/A — ${row.reason === 'zero-baseline' ? 'zero baseline' : 'numeric range'}` : `${signed(row.percent)}%`} <small>({row.kind})</small></td>
        </tr>)}</tbody></table></div></>
      : <p role="status">No baseline saved. Save the current parameters, then modify a control or select another preset.</p>}
  </section>;
}
