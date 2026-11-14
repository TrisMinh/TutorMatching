import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const base='http://localhost:8080/api/v1';const password='TutorDemo!2026';const stamp=Date.now();
async function withCrashedOwner(response,action){
 const owner=response.headers.get('X-Service-Instance');assert.ok(owner,'HA instance diagnostics required');
 const replicas=execFileSync('docker',['compose','-f','compose.yaml','-f','compose.ha.yaml','ps','-q','scheduling-service'],{encoding:'utf8'}).trim().split(/\s+/);
 const victim=replicas.find(id=>execFileSync('docker',['inspect','--format','{{.Config.Hostname}}',id],{encoding:'utf8'}).trim()===owner);assert.ok(victim);
 execFileSync('docker',['update','--restart=no',victim]);
 try{execFileSync('docker',['kill','--signal=KILL',victim]);await new Promise(resolve=>setTimeout(resolve,4000));return await action(owner);}
 finally{execFileSync('docker',['start',victim]);execFileSync('docker',['update','--restart=unless-stopped',victim]);}
}
async function call(path,method='GET',body,token){return fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});}
async function account(role,suffix){const email=`audit.${stamp}.${suffix}@demo.tutormatching.test`;const registered=await call('/auth/register','POST',{email,password,role});assert.equal(registered.status,201,await registered.text());const login=await call('/auth/login','POST',{email,password});assert.equal(login.status,200);return (await login.json()).accessToken;}
const tutor=await account('Tutor','teacher');const student=await account('Student','learner');const stranger=await account('Tutor','stranger');
const subjects=await (await call('/subjects')).json();const subjectId=subjects[0].id;
assert.equal((await call('/tutors/me','GET',undefined,student)).status,403);
assert.equal((await call('/tutors/me','GET',undefined,stranger)).status,404);
const profile=await call('/tutors/me','PUT',{displayName:'Scheduling audit tutor',bio:'Isolated scheduling verification',experienceYears:3,avatarUrl:'/assets/figma/student-tutor-1.jpg'},tutor);assert.equal(profile.status,200);const tutorId=(await profile.json()).id;
assert.equal((await call('/tutors/me/subjects','PUT',[{subjectId,proficiencyLevel:1}],tutor)).status,204);
assert.equal((await call('/students/me','PUT',{displayName:'Scheduling audit learner',educationLevel:2,learningGoal:'Verify scheduling',timezone:'Asia/Ho_Chi_Minh',avatarUrl:'/assets/figma/student-tutor-2.jpg'},student)).status,200);
const anchor=new Date();anchor.setUTCDate(anchor.getUTCDate()+10);anchor.setUTCHours(3,0,0,0);
const start=anchor.toISOString();const end=new Date(+anchor+10800000).toISOString();const windows=[{startAtUtc:start,endAtUtc:end}];
assert.equal((await call('/tutors/me/availability','PUT',windows,tutor)).status,204);
const persisted=await (await call('/tutors/me','GET',undefined,tutor)).json();assert.equal(persisted.id,tutorId);assert.equal(+new Date(persisted.availability[0].startAtUtc),+anchor);
assert.equal((await call('/tutors/me/availability','PUT',[...windows,...windows],tutor)).status,400);
assert.equal((await call('/tutors/me/availability','PUT',[{startAtUtc:end,endAtUtc:start}],tutor)).status,400);
assert.equal((await call('/tutors/me/availability','PUT',[{startAtUtc:new Date(+anchor+60000).toISOString(),endAtUtc:end}],tutor)).status,400);
// Replacing an existing tracked collection must persist without EF concurrency errors.
assert.equal((await call('/tutors/me/availability','PUT',windows,tutor)).status,204);
const courseId=`audit-course-${stamp}`;
const courseStart=new Date(+anchor+7200000).toISOString();
assert.equal((await call('/courses/'+courseId,'PUT',{title:'Scheduling audit course',image:'/assets/figma/student-tutor-1.jpg',category:'Workshop',description:'Overlap probe',capacity:5,sessions:[{startAtUtc:courseStart,endAtUtc:end}]},tutor)).status,200);
const blocked=await call('/bookings/holds','POST',{tutorId,subjectId,startAtUtc:courseStart},student);assert.ok([409,422].includes(blocked.status),await blocked.text());
const hold=await call('/bookings/holds','POST',{tutorId,subjectId,startAtUtc:start},student);assert.equal(hold.status,201,await hold.clone().text());const h=await hold.json();
const confirm=()=>call('/bookings','POST',{holdId:h.holdId,holdToken:h.holdToken},student);
const confirmed=process.env.HA_CHAOS==='1'?await withCrashedOwner(hold,async owner=>{const result=await confirm();assert.notEqual(result.headers.get('X-Service-Instance'),owner);console.log('PASS: another instance confirmed the shared Redis hold after its creator crashed.');return result;}):await confirm();
assert.equal(confirmed.status,201,await confirmed.clone().text());const booking=await confirmed.json();
if(process.env.HA_CHAOS==='1'){
 await withCrashedOwner(confirmed,async owner=>{
  const recovered=await call('/bookings','POST',{holdId:h.holdId,holdToken:h.holdToken},student);assert.equal(recovered.status,200,await recovered.clone().text());assert.equal((await recovered.json()).id,booking.id);assert.notEqual(recovered.headers.get('X-Service-Instance'),owner);
  console.log('PASS: killed original confirmation instance; another instance recovered the same committed booking using hold proof.');
 });
}
const replay=await call('/bookings','POST',{holdId:h.holdId,holdToken:h.holdToken},student);assert.equal(replay.status,200,await replay.clone().text());assert.equal((await replay.json()).id,booking.id);
assert.equal((await call('/bookings','POST',{holdId:h.holdId,holdToken:'invalid-proof'},student)).status,409);
const otherStudent=await account('Student','other-learner');assert.equal((await call('/bookings','POST',{holdId:h.holdId,holdToken:h.holdToken},otherStudent)).status,404);
const mine=await (await call('/bookings','GET',undefined,tutor)).json();assert.ok(mine.some(b=>b.id===booking.id));
const others=await (await call('/bookings','GET',undefined,stranger)).json();assert.ok(!others.some(b=>b.id===booking.id));
assert.equal((await call('/bookings/'+booking.id,'GET',undefined,stranger)).status,404);
const detail=await (await call('/bookings/'+booking.id,'GET',undefined,tutor)).json();assert.equal(detail.studentName,'Scheduling audit learner');assert.equal(detail.studentAvatarUrl,'/assets/figma/student-tutor-2.jpg');assert.equal(detail.booking.id,booking.id);
assert.equal((await call(`/bookings/${booking.id}?reasonCode=audit`,'DELETE',undefined,stranger)).status,403);
const duplicate=await call('/bookings/holds','POST',{tutorId,subjectId,startAtUtc:start},student);assert.equal(duplicate.status,409);
assert.equal((await call(`/bookings/${booking.id}?reasonCode=audit`,'DELETE',undefined,tutor)).status,204);
const after=await (await call('/bookings','GET',undefined,student)).json();assert.equal(after.find(b=>b.id===booking.id).status,'Cancelled');
assert.equal((await call(`/bookings/${booking.id}?reasonCode=audit`,'DELETE',undefined,tutor)).status,204);
const noticeDeadline=Date.now()+20000;let delivered=false;
while(Date.now()<noticeDeadline){
 const response=await call('/notifications?page=1&pageSize=100','GET',undefined,student);assert.equal(response.status,200);
 const items=(await response.json()).items.filter(n=>n.bookingId===booking.id);
 if(items.some(n=>n.type==='BookingConfirmed')&&items.some(n=>n.type==='BookingCancelled')){delivered=true;break;}
 await new Promise(resolve=>setTimeout(resolve,500));
}
assert.ok(delivered,'Both signed booking events must be delivered to the participant through RabbitMQ');
console.log('PASS: confirmed/cancelled events traversed broker and reached the authenticated participant notification list.');
console.log('PASS: tutor isolation, availability validation, schedule conflicts, confirmed booking replay after hold release, wrong token/owner rejection, duplicate prevention and idempotent cancellation.');
