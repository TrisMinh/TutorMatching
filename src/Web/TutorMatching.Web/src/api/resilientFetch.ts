type RetryOptions={repeatable:boolean;maxAttempts?:number;attemptTimeoutMs?:number;budgetMs?:number;baseDelayMs?:number};
function pause(ms:number,signal?:AbortSignal|null){return new Promise<void>((resolve,reject)=>{
 if(signal?.aborted){reject(signal.reason);return;}
 const abort=()=>{clearTimeout(timer);reject(signal?.reason);};
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);signal?.addEventListener('abort',abort,{once:true});
});}
export async function resilientFetch(fetcher:typeof fetch,url:string,init:RequestInit,{repeatable,maxAttempts=3,attemptTimeoutMs=5000,budgetMs=12000,baseDelayMs=150}:RetryOptions):Promise<Response>{
 const deadline=Date.now()+budgetMs;
 for(let attempt=0;;attempt++){
  const controller=new AbortController();const parent=init.signal;const abort=()=>controller.abort(parent?.reason);
  if(parent?.aborted)throw parent.reason;
  parent?.addEventListener('abort',abort,{once:true});const timer=setTimeout(()=>controller.abort(new DOMException('Request timed out.','TimeoutError')),Math.max(1,Math.min(attemptTimeoutMs,deadline-Date.now())));
  let result:Response|undefined;let failure:unknown;
  try{
   const response=await fetcher(url,{...init,signal:controller.signal});
   // Read the body inside the timeout/retry boundary, including a dropped response after commit.
   const bytes=await response.arrayBuffer();result=new Response([204,205,304].includes(response.status)||init.method==='HEAD'?null:bytes,{status:response.status,statusText:response.statusText,headers:response.headers});
  }catch(error){if(parent?.aborted)throw parent.reason;failure=error;}
  finally{clearTimeout(timer);parent?.removeEventListener('abort',abort);}
  const transient=!result||[408,429,502,503,504].includes(result.status);
  if(!repeatable||!transient||attempt+1>=maxAttempts){if(result)return result;throw failure;}
  let delay=baseDelayMs*2**attempt+Math.random()*baseDelayMs;
  const retryAfter=result?.headers.get('Retry-After');
  if(retryAfter){const seconds=Number(retryAfter);delay=Math.max(delay,Number.isFinite(seconds)?seconds*1000:Math.max(0,Date.parse(retryAfter)-Date.now()));}
  if(!Number.isFinite(delay)||Date.now()+delay>=deadline){if(result)return result;throw failure;}
  await pause(delay,parent);
 }
}
