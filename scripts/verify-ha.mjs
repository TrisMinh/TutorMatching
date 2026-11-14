import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const compose=['compose','-f','compose.yaml','-f','compose.ha.yaml','-f','compose.security.yaml'];
const base='http://localhost:8080';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8'}).trim();
const ids=service=>docker(...compose,'ps','-q',service).split(/\s+/).filter(Boolean);
async function login(){const response=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'student01@demo.tutormatching.test',password:'TutorDemo!2026'}),signal:AbortSignal.timeout(8000)});assert.equal(response.status,200);return response.json();}
const session=await login();const authorization=`Bearer ${session.accessToken}`;
const paths={gateway:'/health/ready','identity-service':'/api/v1/users/me','tutor-service':'/api/v1/subjects','student-service':'/api/v1/students/me','scheduling-service':'/api/v1/bookings','notification-service':'/api/v1/notifications?page=1&pageSize=10'};
async function sample(service,count=30){
 const responses=[];
 for(let batch=0;batch<count;batch+=6){responses.push(...await Promise.all(Array.from({length:Math.min(6,count-batch)},async()=>{
  const response=await fetch(base+paths[service],{headers:{Authorization:authorization},signal:AbortSignal.timeout(8000)});
  assert.equal(response.status,200,`${service}: ${response.status}`);await response.arrayBuffer();
  const instance=response.headers.get(service==='gateway'?'X-Gateway-Instance':'X-Service-Instance');assert.ok(instance,`${service} missing instance diagnostics`);return instance;
 })));}
 return new Set(responses);
}
async function waitForPool(service,count,excluded){
 const until=Date.now()+25000;
 while(Date.now()<until){try{const seen=await sample(service,18);if(seen.size===count&&(!excluded||!seen.has(excluded)))return seen;}catch{}await pause(500);}
 throw new Error(`${service}: pool did not converge to ${count} healthy replicas`);
}
for(const service of Object.keys(paths)){
 const expected=service==='scheduling-service'?3:1;
 const replicas=ids(service);assert.equal(replicas.length,expected,`${service} should run ${expected} replicas`);
 const all=await waitForPool(service,expected);console.log(`${service}: ${expected} distinct responding instance(s)`);
 // Single-instance services are checked for health, not deliberately taken offline.
 if(expected===1)continue;
 const victim=replicas[0];const hostname=docker('inspect','--format','{{.Config.Hostname}}',victim);assert.ok(all.has(hostname));
 // Disable automatic restart only during this controlled hard-crash test.
 docker('update','--restart=no',victim);
 try{
  docker('kill','--signal=KILL',victim);
  const survivors=await waitForPool(service,2,hostname);assert.equal(survivors.size,2);
  await sample(service,36);console.log(`${service}: hard crash excluded, 36 requests served by survivors`);
 }finally{
  docker('start',victim);docker('update','--restart=unless-stopped',victim);
 }
 await waitForPool(service,3);console.log(`${service}: recovered instance rejoined`);
}
// Stateful refresh rotation is shared, with row locking across identity replicas.
const concurrent=await login();
const refreshes=await Promise.all([0,1].map(()=>fetch(base+'/api/v1/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken:concurrent.refreshToken}),signal:AbortSignal.timeout(8000)})));
assert.deepEqual(refreshes.map(r=>r.status).sort(),[200,401]);
const rotated=await refreshes.find(r=>r.status===200).json();
const reuse=await fetch(base+'/api/v1/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken:rotated.refreshToken}),signal:AbortSignal.timeout(8000)});assert.equal(reuse.status,401,'Replay revokes the whole token family');
const concurrentLogins=await Promise.all([login(),login()]);assert.ok(concurrentLogins.every(s=>s.accessToken));
const email=`course.e2e.${Date.now()}@example.com`;
const registrations=await Promise.all([0,1].map(()=>fetch(base+'/api/v1/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'TutorDemo!2026',role:'Student'}),signal:AbortSignal.timeout(8000)})));
assert.deepEqual(registrations.map(r=>r.status).sort(),[201,409]);
console.log('Concurrent refresh rotation: one success, one replay rejection; no duplicate active replacements.');
console.log('Concurrent login succeeds; duplicate registration returns 201/409 without server errors.');
console.log('PASS: Scheduling has 3 replicas with failover/rejoin; Gateway and the other APIs each have 1 healthy instance.');
