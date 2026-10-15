import definitions from '../../../shared/experiments.json' with {type:'json'};
import type {Manifest,RegisteredEngine} from './contract';
import {spatialPlugin} from './spatial';
import {lorentzPlugin} from './lorentz';
import {electricPlugin} from './electric';
const manifests=definitions as Manifest[];
if(new Set(manifests.map(m=>m.id)).size!==manifests.length)throw new Error('Duplicate experiment identity.');
const manifest=(id:string)=>{const m=manifests.find(m=>m.id===id);if(!m)throw new Error('Missing registered manifest.');return m;};
const registered:RegisteredEngine[]=[electricPlugin(manifest('uniform-electric-field')),lorentzPlugin(manifest('lorentz-force-2d')),spatialPlugin(manifest('multi-zone-em'))];
if(registered.length!==manifests.length)throw new Error('Manifest has no registered engine.');
export const experiments:readonly RegisteredEngine[]=Object.freeze(registered);
export function experiment(id:string,version?:number):RegisteredEngine{const plugin=experiments.find(p=>p.id===id&&(version===undefined||p.version===version));if(!plugin)throw new Error('Unknown experiment or version.');return plugin;}
