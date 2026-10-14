import {beforeEach,it,expect} from 'vitest';
import {useSimulationStore as store,defaults} from './simulationStore';
beforeEach(()=>store.getState().updateParameters(defaults));
it('play advances, pause stops and resume continues',()=>{store.getState().play();store.getState().advance(0.02);store.getState().pause();store.getState().advance(0.02);expect(store.getState().time).toBeCloseTo(0.02);store.getState().play();store.getState().advance(0.02);expect(store.getState().time).toBeCloseTo(0.04);});
it('reset clears time and pauses',()=>{store.getState().play();store.getState().advance(0.03);store.getState().reset();expect(store.getState().time).toBe(0);expect(store.getState().status).toBe('paused');});
it('parameter edits restart and pause',()=>{store.getState().play();store.getState().advance(0.03);store.getState().updateParameters({...defaults,charge:-2e-9});expect(store.getState().time).toBe(0);expect(store.getState().status).toBe('paused');});
it('caps suspended frame delta',()=>{store.getState().play();store.getState().advance(300);expect(store.getState().time).toBeCloseTo(0.05);});
it('rejects invalid parameters without corrupting state',()=>{expect(()=>store.getState().updateParameters({...defaults,mass:0})).toThrow();expect(store.getState().parameters.mass).toBe(1e-6);});
