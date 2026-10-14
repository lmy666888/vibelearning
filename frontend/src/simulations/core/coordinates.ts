import type { Vector2 } from './types';
export const WORLD={xmin:-10,xmax:50,ymin:-15,ymax:25};
export function createViewport(width:number,height:number) { const scale=Math.min(width/60,height/40); return {scale, left:(width-60*scale)/2,top:(height-40*scale)/2}; }
export function physicalToScreen(p:Vector2,width:number,height:number):Vector2 { const v=createViewport(width,height);return {x:v.left+(p.x-WORLD.xmin)*v.scale,y:v.top+(WORLD.ymax-p.y)*v.scale}; }
export function inViewport(p:Vector2) { return p.x>=WORLD.xmin&&p.x<=WORLD.xmax&&p.y>=WORLD.ymin&&p.y<=WORLD.ymax; }
