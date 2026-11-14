import {resilientFetch} from './resilientFetch';
const options={repeatable:true,baseDelayMs:1,attemptTimeoutMs:100,budgetMs:1000};
it('replays identical payload after commit succeeded but response was lost',async()=>{
 const operations=new Set<string>();let committed=0;
 const fetcher=vi.fn<typeof fetch>(async(_url,init)=>{const key=String(init?.body);if(!operations.has(key)){operations.add(key);committed++;throw new TypeError('Response lost after commit');}return new Response(JSON.stringify({id:'same-booking'}));});
 const response=await resilientFetch(fetcher,'/bookings',{method:'POST',body:'{"holdId":"same","holdToken":"same-token"}'},options);
 expect(await response.json()).toEqual({id:'same-booking'});expect(committed).toBe(1);expect(fetcher).toHaveBeenCalledTimes(2);
});
it('does not retry domain conflict or nonrepeatable writes',async()=>{
 const conflict=vi.fn<typeof fetch>().mockResolvedValue(new Response('{"error":"Slot occupied"}',{status:409}));expect((await resilientFetch(conflict,'/bookings',{},options)).status).toBe(409);expect(conflict).toHaveBeenCalledTimes(1);
 const unsafe=vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Network failed'));await expect(resilientFetch(unsafe,'/holds',{method:'POST'},{...options,repeatable:false})).rejects.toThrow();expect(unsafe).toHaveBeenCalledTimes(1);
});
it('bounds retries, respects long Retry-After, and stops on caller cancellation',async()=>{
 const failing=vi.fn<typeof fetch>().mockImplementation(async()=>new Response('unavailable',{status:503}));expect((await resilientFetch(failing,'/read',{},options)).status).toBe(503);expect(failing).toHaveBeenCalledTimes(3);
 const delayed=vi.fn<typeof fetch>().mockResolvedValue(new Response('',{status:503,headers:{'Retry-After':'120'}}));await resilientFetch(delayed,'/read',{},options);expect(delayed).toHaveBeenCalledTimes(1);
 const abort=new AbortController();abort.abort();const cancelled=vi.fn<typeof fetch>();await expect(resilientFetch(cancelled,'/read',{signal:abort.signal},options)).rejects.toBeDefined();expect(cancelled).not.toHaveBeenCalled();
});
it('retries lost response bodies inside the timeout boundary',async()=>{
 const broken=new ReadableStream({start(c){c.error(new TypeError('Connection closed during body'));}});
 const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(broken)).mockResolvedValueOnce(new Response('{"ok":true}'));
 expect(await (await resilientFetch(fetcher,'/read',{},options)).json()).toEqual({ok:true});expect(fetcher).toHaveBeenCalledTimes(2);
});
