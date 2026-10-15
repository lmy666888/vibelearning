import { PhysicsPreviewTable } from './PhysicsPreviewTable';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSimulationStore } from '../../stores/simulationStore';
import { capturePlanRequest, planAction, planIsCurrent, type PlanRequest, type PlanResult } from '../../services/actions';
import { TutorRequestError } from '../../services/tutor';
export function ExperimentActionForm() {
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const captured = useRef<PlanRequest | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    const unsubscribe = useSimulationStore.subscribe(state => {
      if (captured.current) setStale(!planIsCurrent(captured.current, state));
    });
    return () => { unsubscribe(); pending.current?.abort(); pending.current = null; };
  }, []);
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (pending.current) return;
    let request: PlanRequest;
    try { request = capturePlanRequest(instruction, useSimulationStore.getState()); }
    catch { setError('Enter an instruction between 1 and 2000 characters.'); return; }
    const controller = new AbortController(); pending.current = controller; captured.current = request;
    setLoading(true); setError(null); setResult(null); setFeedback(null); setStale(false);
    try {
      const response = await planAction(request, controller.signal);
      if (pending.current !== controller || controller.signal.aborted) return;
      setResult(response); setStale(!planIsCurrent(request, useSimulationStore.getState()));
    } catch (failure) {
      if (pending.current !== controller || controller.signal.aborted) return;
      setError(failure instanceof TutorRequestError ? failure.message : 'Action planning is unreachable or timed out. Check the backend and retry.');
    } finally {
      if (pending.current === controller) { pending.current = null; setLoading(false); }
    }
  }
  function confirm() {
    if (result?.status !== 'proposal' || !captured.current) return;
    try {
      useSimulationStore.getState().confirmProposal(result, captured.current);
      captured.current = null; setResult(null); setStale(false);
      setFeedback('Experiment updated. Simulation paused and reset to t = 0.');
    } catch { setStale(true); setError('Proposal could not be applied. Regenerate with the current experiment.'); }
  }
  function cancel() { captured.current = null; setResult(null); setStale(false); setFeedback('Proposal cancelled. Experiment unchanged.'); }
  return <div>
    <p>Describe one experiment change. Review the verified preview and confirm before anything changes. Values are shown in SI units.</p>
    <form onSubmit={submit} aria-busy={loading}>
      <label htmlFor="experiment-instruction">Experiment change instruction</label>
      <textarea id="experiment-instruction" rows={3} maxLength={2000} value={instruction} disabled={loading}
        onChange={event => setInstruction(event.target.value)} placeholder="Double the vertical electric field." />
      <div className="tutor-actions"><small>{instruction.length}/2000 · One proposal per request.</small>
        <button type="submit" className="primary" disabled={loading || !instruction.trim()}>{loading ? 'Planning…' : 'Preview experiment change'}</button></div>
    </form>
    {loading && <p role="status">Planning from a captured snapshot… Playback remains available.</p>}
    {error && <p role="alert">{error}</p>}
    {result?.status === 'clarification_needed' && <p role="status">Clarification needed: {result.explanation}</p>}
    {result?.status === 'proposal' && <article className="tutor-result" aria-label="AI action proposal">
      <h3>Proposed experiment change</h3><p>{result.explanation}</p>
      <p><strong>Confirmation required.</strong> Preview calculated with F = qE and a = F/m. Confirmation pauses playback and resets time and trajectory to t = 0.</p>
      <PhysicsPreviewTable before={result.before} after={result.after} />
      {stale && <p role="status" className="stale-notice">Stale proposal: experiment parameters or reset state changed. Regenerate the proposal.</p>}
      <div className="buttons"><button className="primary" disabled={stale} onClick={confirm}>Confirm experiment change</button><button onClick={cancel}>Cancel proposal</button></div>
    </article>}
    {feedback && <p role="status">{feedback}</p>}
  </div>;
}
