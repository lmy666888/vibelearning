import type {ContextV2} from './context';
import type {Language} from '../stores/languageStore';
export async function requestAI(operation:string,context:ContextV2,prompt:string,preferred_language:Language,signal:AbortSignal,extra:Record<string,unknown>={}):Promise<unknown>{
 if(!prompt.trim()||prompt.length>2000)throw new Error('Enter 1–2000 characters.');
 const response=await fetch(`${import.meta.env.VITE_API_BASE_URL??''}/api/v2/ai/${operation}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({context,prompt,preferred_language,...extra}),signal:AbortSignal.any([signal,AbortSignal.timeout(130000)])});
 if(!response.ok){const d=await response.json().catch(()=>null);const messages:Record<string,string>={language_mismatch:'Provider language did not match your preference. Please retry.',provider_rate_limited:'Provider quota or rate limit reached. Retry later.',provider_timeout:'The provider timed out. Please retry.',invalid_experiment_context:'Experiment snapshot or lesson is invalid. Preview and retry.',invalid_action:'The proposed action is outside supported experiment limits.',tutor_not_configured:'AI provider is not configured on the backend.'};throw new Error(messages[d?.detail?.code]??'AI provider unavailable or invalid response. Retry later.');}
 return response.json();
}
