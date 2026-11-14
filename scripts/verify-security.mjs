import assert from 'node:assert/strict';
import https from 'node:https';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const compose=['compose','-f','compose.yaml','-f','compose.ha.yaml','-f','compose.security.yaml'];
const ca=fs.readFileSync('.security/public/ca.crt');const base='https://localhost:8443';
function request(path,{method='GET',body,token,port,caller,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const bytes=body===undefined?undefined:Buffer.from(JSON.stringify(body));
  const req=https.request(port?`https://localhost:${port}${path}`:base+path,{method,ca,rejectUnauthorized:true,
   ...(caller?{cert:fs.readFileSync(`.security/${caller}/tls.crt`),key:fs.readFileSync(`.security/${caller}/tls.key`)}:{}),
   headers:{...(bytes?{'Content-Type':'application/json','Content-Length':bytes.length}:{}),...(token?{Authorization:`Bearer ${token}`} :{}),...headers}},res=>{
    const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const text=Buffer.concat(chunks).toString();let json;try{json=JSON.parse(text);}catch{}resolve({status:res.statusCode,json,headers:res.headers});});
   });
  req.setTimeout(10000,()=>req.destroy(new Error('Security probe timeout')));req.on('error',reject);if(bytes)req.write(bytes);req.end();
 });
}
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const proxies=[];const fixtures=[];const sessions=[];const stamp=Date.now();
async function login(email,password){const r=await request('/api/v1/auth/login',{method:'POST',body:{email,password}});assert.equal(r.status,200);return r.json;}
function proxy(container){
 const name=`tm-security-${stamp}-${proxies.length}`;
 docker('run','--rm','-d','--name',name,'--network','tutormatching_backend','-p','127.0.0.1::8443','alpine/socat','TCP-LISTEN:8443,fork,reuseaddr',`TCP:${container}:8443`);proxies.push(name);
 return JSON.parse(docker('inspect',name))[0].NetworkSettings.Ports['8443/tcp'][0].HostPort;
}
async function fixture(suffix){
 const email=`security.e2e.${stamp}.${suffix}@example.com`;const password=crypto.randomBytes(24).toString('base64url');
 const r=await request('/api/v1/auth/register',{method:'POST',body:{email,password,role:'Student'}});assert.equal(r.status,201);assert.match(r.json.id,/^[0-9a-f-]{36}$/);fixtures.push(r.json.id);
 const session=await login(email,password);sessions.push(session);return {email,password,id:r.json.id,session};
}
try{
 assert.equal((await request('/health/ready')).status,200);
 const web=await request('/',{port:3443});assert.equal(web.status,200);assert.ok(web.headers['content-security-policy']?.includes("frame-ancestors 'none'"));
 console.log('PASS: HTTPS ingress verified using the local CA, without disabling TLS validation.');
 const learner=await login('student01@demo.tutormatching.test','TutorDemo!2026');sessions.push(learner);
 const user=await request('/api/v1/users/me',{token:learner.accessToken});assert.equal(user.status,200);
 const [header,payload,signature]=learner.accessToken.split('.');assert.equal(JSON.parse(Buffer.from(header,'base64url')).alg,'RS256');
 const claims=JSON.parse(Buffer.from(payload,'base64url'));const forged=header+'.'+Buffer.from(JSON.stringify({...claims,role:'Admin'})).toString('base64url')+'.'+signature;
 assert.equal((await request('/api/v1/users/me',{token:forged})).status,401);
 assert.equal((await request('/api/v1/tutors/me',{token:learner.accessToken})).status,403);
 assert.equal((await request('/internal/v1/slots/query',{method:'POST',token:learner.accessToken,body:{}})).status,403);
 console.log('PASS: RS256, modified JWT rejection, role authorization and public internal-route blocking.');
 const studentContainer=docker(...compose,'ps','-q','student-service');const studentName=docker('inspect','--format','{{.Name}}',studentContainer).replace(/^\//,'');const studentPort=proxy(studentName);
 const internal=`/internal/v1/students/by-user/${user.json.userId}`;
 await assert.rejects(request(internal,{port:studentPort,token:learner.accessToken}));
 assert.equal((await request(internal,{port:studentPort,caller:'gateway',token:learner.accessToken,headers:{'X-Service-Identity':'scheduling'}})).status,403);
 assert.equal((await request(internal,{port:studentPort,caller:'scheduling'})).status,401);
 assert.equal((await request(internal,{port:studentPort,caller:'scheduling',token:learner.accessToken})).status,200);
 console.log('PASS: missing client certificate rejected, spoofed caller header ineffective, caller certificate AND user JWT required.');
 const scheduling=docker(...compose,'ps','-q','scheduling-service').split(/\s+/);assert.equal(scheduling.length,3);const ports=[];
 for(const id of scheduling){const name=docker('inspect','--format','{{.Name}}',id).replace(/^\//,'');const port=proxy(name);ports.push(port);assert.equal((await request('/api/v1/bookings',{port,caller:'gateway',token:learner.accessToken})).status,200);}
 const revoked=await request('/api/v1/auth/revoke',{method:'POST',body:{refreshToken:learner.refreshToken}});assert.equal(revoked.status,204);
 for(const port of ports)assert.equal((await request('/api/v1/bookings',{port,caller:'gateway',token:learner.accessToken})).status,401);
 assert.equal((await request('/api/v1/auth/refresh',{method:'POST',body:{refreshToken:learner.refreshToken}})).status,401);
 console.log('PASS: logout revokes access immediately on all three Scheduling replicas and blocks refresh.');
 if(process.argv.includes('--cache-failure')){
  const valid=await login('student01@demo.tutormatching.test','TutorDemo!2026');sessions.push(valid);
  const cache=docker(...compose,'ps','-q','redis');
  try{
   docker('stop',cache);
   assert.equal((await request('/api/v1/bookings',{port:ports[0],caller:'gateway',token:valid.accessToken})).status,503);
  }finally{docker('start',cache);}
  const until=Date.now()+30000;let recovered=false;
  while(Date.now()<until){try{if((await request('/api/v1/bookings',{port:ports[0],caller:'gateway',token:valid.accessToken})).status===200){recovered=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
  assert.ok(recovered,'Cache reconnect must recover access validation');
  assert.equal((await request('/api/v1/bookings',{port:ports[0],caller:'gateway',token:learner.accessToken})).status,401);
  console.log('PASS: Redis outage fails closed with 503; reconnect recovers and earlier revocation persists after Redis restart.');
 }
 const owner=await fixture('owner');const second=await login(owner.email,owner.password);sessions.push(second);
 assert.equal((await request('/api/v1/auth/revoke-all',{method:'POST',token:owner.session.accessToken})).status,204);
 assert.equal((await request('/api/v1/users/me',{token:second.accessToken})).status,401);
 const admin=await fixture('admin');
 docker(...compose,'exec','-T','identity-db','psql','-v','ON_ERROR_STOP=1','-U','identity_app','-d','identity_db','-c',`UPDATE user_accounts SET role='Admin' WHERE id='${admin.id}'::uuid`);
 const administrator=await login(admin.email,admin.password);sessions.push(administrator);
 const target=await fixture('disabled');
 assert.equal((await request(`/api/v1/users/${target.id}/disable`,{method:'POST',token:target.session.accessToken})).status,403);
 assert.equal((await request(`/api/v1/users/${target.id}/disable`,{method:'POST',token:administrator.accessToken})).status,204);
 assert.equal((await request('/api/v1/users/me',{token:target.session.accessToken})).status,401);
 assert.equal((await request('/api/v1/auth/login',{method:'POST',body:{email:target.email,password:target.password}})).status,401);
 console.log('PASS: revoke-all invalidates another session; only Admin can disable an account and invalidate its access.');
 // Existing booking ownership remains enforced through the new transport layer.
 const a=await login('student01@demo.tutormatching.test','TutorDemo!2026');const b=await login('student02@demo.tutormatching.test','TutorDemo!2026');sessions.push(a,b);
 const mine=await request('/api/v1/bookings',{token:a.accessToken});assert.equal(mine.status,200);assert.ok(mine.json.length>0);
 assert.equal((await request(`/api/v1/bookings/${mine.json[0].id}`,{token:b.accessToken})).status,404);
 console.log('PASS: changing a booking ID cannot read another student’s booking (BOLA/IDOR).');
 console.log('PASS: security integration probes completed; temporary proxies and fixture accounts will be removed.');
}finally{
 for(const session of sessions){try{await request('/api/v1/auth/revoke',{method:'POST',body:{refreshToken:session.refreshToken}});}catch{}}
 for(const name of proxies){try{docker('stop',name);}catch{}}
 if(fixtures.length)docker(...compose,'exec','-T','identity-db','psql','-v','ON_ERROR_STOP=1','-U','identity_app','-d','identity_db','-c',`DELETE FROM user_accounts WHERE id IN (${fixtures.map(id=>`'${id}'::uuid`).join(',')}) AND email LIKE 'security.e2e.%@example.com'`);
}
