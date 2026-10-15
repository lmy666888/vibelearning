import type {Data,RegisteredEngine} from './contract';
import {record,exact} from './validation';
import {validateRegion,type Region} from './spatial';
export type RegionAction={schema_version:1}&({action:'add_field_region';region:Region}|{action:'update_field_region';region_id:string;changes:Partial<Pick<Region,'name'|'electric_field'|'magnetic_field'|'color'>>}|{action:'move_field_region';region_id:string;x:number;y:number}|{action:'resize_field_region';region_id:string;width:number;height:number}|{action:'remove_field_region';region_id:string}|{action:'toggle_field_region';region_id:string;enabled:boolean});
export function validateRegionAction(raw:unknown):RegionAction{
 const a=record(raw);if(a.schema_version!==1)throw new Error('Invalid regional action version.');
 if(a.action==='add_field_region'){exact(a,['schema_version','action','region']);validateRegion(a.region);}
 else{if(typeof a.region_id!=='string'||! /^[a-z][a-z0-9-]{0,31}$/.test(a.region_id))throw new Error('Invalid region ID.');
  if(a.action==='update_field_region'){exact(a,['schema_version','action','region_id','changes']);const c=record(a.changes);if(!Object.keys(c).length||Object.keys(c).some(k=>!['name','electric_field','magnetic_field','color'].includes(k)))throw new Error('Invalid regional patch.');}
  else if(a.action==='move_field_region'||a.action==='resize_field_region'){const keys=a.action==='move_field_region'?['x','y']:['width','height'];exact(a,['schema_version','action','region_id',...keys]);if(keys.some(k=>typeof a[k]!=='number'||!Number.isFinite(a[k])))throw new Error('Invalid regional dimensions.');}
  else if(a.action==='toggle_field_region'){exact(a,['schema_version','action','region_id','enabled']);if(typeof a.enabled!=='boolean')throw new Error('Invalid enabled flag.');}
  else if(a.action==='remove_field_region')exact(a,['schema_version','action','region_id']);else throw new Error('Unsupported regional action.');
 }return structuredClone(a) as RegionAction;
}
export function applyRegion(engine:RegisteredEngine,parameters:Data,a:RegionAction):Data{
 const p=structuredClone(parameters),regions=p.regions as Region[];if(!Array.isArray(regions)||!engine.manifest.operations.includes(a.action))throw new Error('This experiment has no regional capability.');
 if(a.action==='add_field_region')regions.push(a.region);else{const r=regions.find(r=>r.id===a.region_id);if(!r)throw new Error('Unknown region ID.');
 if(a.action==='update_field_region')Object.assign(r,a.changes);else if(a.action==='move_field_region')Object.assign(r.geometry,{x:a.x,y:a.y});else if(a.action==='resize_field_region')Object.assign(r.geometry,{width:a.width,height:a.height});else if(a.action==='toggle_field_region')r.enabled=a.enabled;else p.regions=regions.filter(r=>r.id!==a.region_id);}
 return engine.validateParameters(p);
}
