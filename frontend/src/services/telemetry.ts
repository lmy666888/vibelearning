/** No error messages, prompts, stack traces, URLs or identifiers are transmitted. */
import {platformStore} from '../experiments/runtime';
const sent=new Map<string,number>();
export function reportClientError(kind:'runtime'|'scientific'){
 const experiment_id=platformStore.getState().runtime.engine.id,key=kind+':'+experiment_id,now=Date.now();
 if(now-(sent.get(key)??0)<60000)return;sent.set(key,now);
 void fetch('/api/telemetry/client-error',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,experiment_id}),credentials:'omit',keepalive:true}).catch(()=>{});
}
export function installErrorReporting(){const report=()=>reportClientError('runtime');window.addEventListener('error',report);window.addEventListener('unhandledrejection',report);return()=>{window.removeEventListener('error',report);window.removeEventListener('unhandledrejection',report);};}
