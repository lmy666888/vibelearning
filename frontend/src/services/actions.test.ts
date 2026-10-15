import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { useSimulationStore as store, defaults } from '../stores/simulationStore';
import { applyAction, capturePlanRequest, validateAction, validateProposal, planIsCurrent, planAction } from './actions';
import { proposalFor, doubleField } from '../test/actionFixture';
beforeEach(() => store.getState().updateParameters(defaults));
afterEach(() => vi.unstubAllGlobals());
function request() { return capturePlanRequest('Double Ey.', store.getState()); }
it('captures an immutable identified snapshot and verifies negative-charge preview', () => {
  store.getState().updateParameters({ ...defaults, charge: -2e-9, field: { x: 0, y: 200 } });
  const r=request(), p=proposalFor(r);
  expect(Object.isFrozen(r.simulation_context.parameters.field)).toBe(true);
  expect(p.after_physics.acceleration.y).toBeCloseTo(-.8);
  expect(p.before_physics.force.y).toBeCloseTo(-4e-7, 12);
  expect(validateProposal(p,r).after.field.y).toBe(400);
});
it.each([
  { ...doubleField, action: 'execute' }, { ...doubleField, target: '__proto__' },
  { ...doubleField, schema_version: true }, { ...doubleField, schema_version: 2 },
  { ...doubleField, factor: NaN }, { ...doubleField, factor: Infinity },
  { ...doubleField, factor: 11 }, { ...doubleField, factor: 0 }, { ...doubleField, factor: -2 },
  { ...doubleField, requires_confirmation: false }, { ...doubleField, factor: '2' },
  { schema_version:1, action:'select_preset', preset_id:'unknown' },
])('rejects malformed or unsupported model actions %j', action => { expect(() => validateAction(action)).toThrow(); });
it.each([['mass',0],['mass',-1],['charge',11e-9],['field.x',501],['initialVelocity.y',11]] as const)('rejects out-of-range %s', (target,value) => {
  expect(() => applyAction(defaults,{ schema_version:1,action:'set_parameter',target,value })).toThrow();
});
it('handles presets, reset and zero baselines without ratios', () => {
  const zero=applyAction(defaults,{schema_version:1,action:'select_preset',preset_id:'no-field'});
  expect(zero.field.y).toBe(0);
  expect(applyAction(zero,doubleField).field.y).toBe(0);
  expect(applyAction(defaults,{schema_version:1,action:'reset_simulation'})).toEqual(defaults);
});
it('requires matching snapshot, confirmation and independently verified physics', () => {
  const r=request(), p=proposalFor(r);
  for (const modified of [{...p,requires_confirmation:false},{...p,snapshot_id:'other'},{...p,parameter_revision:99},{...p,execute:true},{...p,after:{...p.after,mass:0}},{...p,after_physics:{...p.after_physics,acceleration_magnitude:999}}]) {
    expect(() => validateProposal(modified,r)).toThrow();
  }
});
it('planning never mutates; confirmation emits one atomic paused/reset update and keeps baseline', () => {
  const r=request(), p=proposalFor(r); store.getState().saveBaseline(); const baseline=store.getState().baseline;
  store.getState().play();store.getState().advance(.03);
  expect(store.getState().parameters.field.y).toBe(100);
  expect(planIsCurrent(r,store.getState())).toBe(true);
  const listener=vi.fn(); const unsubscribe=store.subscribe(listener);
  store.getState().confirmProposal(p,r);unsubscribe();
  expect(listener).toHaveBeenCalledTimes(1);
  expect(store.getState()).toMatchObject({time:0,status:'paused',parameterRevision:r.parameter_revision+1});
  expect(store.getState().parameters.field.y).toBe(200);expect(store.getState().baseline).toBe(baseline);
  expect(() => store.getState().confirmProposal(p,r)).toThrow(/Stale/);
});
it('rejects stale edits, edit-then-revert and reset without any mutation', () => {
  for (const mutate of [() => store.getState().updateParameters({...defaults,charge:-2e-9}), () => {store.getState().updateParameters({...defaults,charge:-2e-9});store.getState().updateParameters(defaults);}, () => store.getState().reset()]) {
    store.getState().updateParameters(defaults);const r=request(),p=proposalFor(r);mutate();const state=store.getState();
    expect(() => store.getState().confirmProposal(p,r)).toThrow(/Stale/);expect(store.getState()).toBe(state);
  }
});
it('rejects a modified proposal atomically with no update', () => {
  const r=request(),p=structuredClone(proposalFor(r));p.after.mass=0; const state=store.getState();
  expect(() => store.getState().confirmProposal(p,r)).toThrow();expect(store.getState()).toBe(state);
});
it('validates API proposals, clarifications and safe failures', async () => {
  const r=request();
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(proposalFor(r))))
    .mockResolvedValueOnce(new Response(JSON.stringify({status:'clarification_needed',explanation:'Which component?'})))
    .mockResolvedValueOnce(new Response(JSON.stringify({detail:{code:'provider_timeout',message:'private-debug'}}),{status:504}))
    .mockResolvedValueOnce(new Response(JSON.stringify({...proposalFor(r),requires_confirmation:false}))));
  expect((await planAction(r)).status).toBe('proposal');expect((await planAction(r)).status).toBe('clarification_needed');
  await expect(planAction(r)).rejects.toThrow('timed out');await expect(planAction(r)).rejects.toThrow('invalid action response');
});
