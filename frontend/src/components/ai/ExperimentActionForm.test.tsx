// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AITutorPanel } from './AITutorPanel';
import { useSimulationStore as store, defaults } from '../../stores/simulationStore';
import { proposalFor } from '../../test/actionFixture';
import type { PlanRequest } from '../../services/actions';
beforeEach(() => store.getState().updateParameters(defaults));
afterEach(() => {cleanup();vi.unstubAllGlobals();});
function setup(response?: (r:PlanRequest)=>unknown) {
  vi.stubGlobal('fetch',vi.fn(async (_url,init) => new Response(JSON.stringify(response ? response(JSON.parse(init.body)) : proposalFor(JSON.parse(init.body))))));
  render(<AITutorPanel />);fireEvent.click(screen.getByRole('button',{name:'Request an experiment change'}));
  fireEvent.change(screen.getByLabelText('Experiment change instruction'),{target:{value:'Double Ey.'}});
  fireEvent.click(screen.getByRole('button',{name:'Preview experiment change'}));
}
it('renders before/after physics without mutation and explicitly confirms', async () => {
  setup();const article=await screen.findByRole('article',{name:'AI action proposal'});
  expect(article.textContent).toContain('Charge q (C)');expect(article.textContent).toContain('Electric force F (N)');
  expect(article.textContent).toContain('+0.2000');expect(article.textContent).toContain('+0.4000');
  expect(store.getState().parameters.field.y).toBe(100);
  fireEvent.click(screen.getByRole('button',{name:'Confirm experiment change'}));
  expect(store.getState().parameters.field.y).toBe(200);
  expect(screen.getByText(/Experiment updated/)).toBeTruthy();expect(screen.queryByRole('article')).toBeNull();
});
it('cancellation discards the proposal without mutation', async () => {
  setup();await screen.findByRole('article');const state=store.getState();
  fireEvent.click(screen.getByRole('button',{name:'Cancel proposal'}));
  expect(store.getState()).toBe(state);expect(screen.getByText(/Proposal cancelled/)).toBeTruthy();
});
it('marks parameter changes stale and disables confirmation, including edit then revert', async () => {
  setup();await screen.findByRole('article');
  act(() => {store.getState().updateParameters({...defaults,charge:-2e-9});store.getState().updateParameters(defaults);});
  expect(screen.getByText(/Stale proposal:/)).toBeTruthy();
  expect(screen.getByRole('button',{name:'Confirm experiment change'}).hasAttribute('disabled')).toBe(true);
});
it('shows clarification and never offers confirmation', async () => {
  setup(() => ({status:'clarification_needed',explanation:'Which component?'}));
  expect(await screen.findByText(/Clarification needed: Which component/)).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Confirm experiment change'})).toBeNull();
});
it('rejects invalid response with a safe error', async () => {
  setup(r => ({...proposalFor(r),requires_confirmation:false}));
  expect((await screen.findByRole('alert')).textContent).toContain('invalid action response');
  expect(store.getState().parameters).toEqual(defaults);
});
it('keeps playback responsive during loading, prevents duplicates and aborts on unmount', async () => {
  let signal:AbortSignal|undefined;
  const fetch=vi.fn((_url,init)=>{signal=init.signal;return new Promise(()=>{});});vi.stubGlobal('fetch',fetch);
  const {unmount}=render(<AITutorPanel />);fireEvent.click(screen.getByRole('button',{name:'Request an experiment change'}));
  fireEvent.change(screen.getByLabelText('Experiment change instruction'),{target:{value:'Double Ey.'}});
  fireEvent.click(screen.getByRole('button',{name:'Preview experiment change'}));
  fireEvent.submit(screen.getByLabelText('Experiment change instruction').closest('form')!);
  expect(fetch).toHaveBeenCalledTimes(1);expect(screen.getByRole('button',{name:'Planning…'}).hasAttribute('disabled')).toBe(true);
  act(()=>{store.getState().play();store.getState().advance(.03);});expect(store.getState().time).toBeCloseTo(.03);
  unmount();expect(signal?.aborted).toBe(true);
});
