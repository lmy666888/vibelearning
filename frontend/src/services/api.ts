export interface HealthResponse {status:'ok';service:'vibelearning-api'}
export async function getHealth(signal?:AbortSignal):Promise<HealthResponse> {
 const response=await fetch(`${import.meta.env.VITE_API_BASE_URL??''}/api/health`,{signal});
 if(!response.ok)throw new Error(`HTTP ${response.status}`);const data:unknown=await response.json();
 if(typeof data!=='object'||data===null||!('status' in data)||!('service' in data)||data.status!=='ok'||data.service!=='vibelearning-api')throw new Error('健康检查响应无效');return data as HealthResponse;
}
