import {create} from 'zustand';
import {useLanguageStore} from '../stores/languageStore';
export const useAIUsage=create<{remaining:number|null;minute:number|null;retry:number|null;code:string|null}>(()=>({remaining:null,minute:null,retry:null,code:null}));
const guidance:Record<string,[string,string]>={
 out_of_scope:['Ask a question about science, mathematics or the active experiment.','请提出与科学、数学或当前实验相关的问题。'],
 clarification_required:['Clarify the scientific question or the intended experiment change.','请说明科学问题或预期的实验修改。'],
 rate_limit_exceeded:['AI requests are too frequent. Wait before retrying; simulation remains available.','AI 请求过于频繁，请稍后重试；仿真仍可使用。'],
 daily_quota_exceeded:['The application daily AI allowance is exhausted. Retry after reset.','应用每日 AI 额度已用完，请在重置后重试。'],
 global_budget_exhausted:['The application AI budget is exhausted. Local experiments still work.','应用 AI 预算已用完，本地实验仍可使用。'],
 quota_unavailable:['AI usage service is unavailable. New model calls are paused.','AI 用量服务不可用，新的模型调用已暂停。'],
 invalid_session:['AI session expired or is invalid. Reload and retry.','AI 会话已过期或无效，请刷新后重试。'],
 repeated_request:['An identical request was just submitted. Wait before retrying.','相同请求刚刚提交，请稍后重试。'],
 invalid_request:['AI input exceeds supported message or size limits.','AI 输入超出支持的消息或大小限制。'],
};
function count(value:string|null){if(value===null)return null;const n=Number(value);return Number.isInteger(n)&&n>=0&&n<=1000000?n:null;}
export async function aiFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 const response=await fetch(input,{...init,credentials:'include'});let code:string|null=null;
 if(!response.ok){const body=await response.clone().json().catch(()=>null);code=body?.detail?.code??null;}
 useAIUsage.setState({remaining:count(response.headers.get('X-AI-Remaining-Daily')),minute:count(response.headers.get('X-AI-Remaining-Minute')),retry:count(response.headers.get('Retry-After')),code});
 if(code&&guidance[code])throw new Error(guidance[code][useLanguageStore.getState().language==='zh-CN'?1:0]);
 return response;
}
