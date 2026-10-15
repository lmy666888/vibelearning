/** Presentation bindings are explicit and separate from scientific plugins.
 * Future wave/quantum editors register their own Canvas/Inspector here.
 */
import type {ComponentType} from 'react';
import type {Runtime} from '../experiments/runtime';
import type {Editor} from './editor';
import {WorkspaceCanvas} from './WorkspaceCanvas';
import {KeplerCanvas,KeplerInspector} from './KeplerCanvas';
import {OpticsCanvas} from './OpticsCanvas';
import {RegionEditor} from './RegionEditor';
export interface WorkspacePresentation {Canvas:ComponentType<{runtime:Runtime;editor:Editor}>;Inspector?:ComponentType<{runtime:Runtime;editor:Editor}>}
const bindings:Record<string,WorkspacePresentation>={
 'kepler-canvas':{Canvas:KeplerCanvas,Inspector:KeplerInspector},
 'optics-canvas':{Canvas:OpticsCanvas},
 'electric-canvas':{Canvas:WorkspaceCanvas},
 'lorentz-canvas':{Canvas:WorkspaceCanvas},
 'spatial-canvas':{Canvas:WorkspaceCanvas,Inspector:RegionEditor},
};
export function workspacePresentation(renderer:string){const binding=bindings[renderer];if(!binding)throw new Error('Unregistered workspace presentation.');return binding;}
