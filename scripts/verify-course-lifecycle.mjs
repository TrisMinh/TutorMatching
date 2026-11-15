import {requireMailpitForDemo, verifyDemoEmail} from './verify-demo-email.mjs';
requireMailpitForDemo();
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const base='http://localhost:8080/api/v1',stamp=Date.now(),password='CourseLifecycle!2026';
async function api(path,method='GET',body,token,status=200){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});assert.equal(r.status,status,`${method} ${path}: ${r.status} ${await r.clone().text()}`);const text=await r.text();return text?JSON.parse(text):null;}
async function account(role,suffix){const email=`lifecycle.fixture.${stamp}.${suffix}@example.com`;await api('/auth/register','POST',{email,password,role},undefined,201);await verifyDemoEmail(email);return (await api('/auth/login','POST',{email,password})).accessToken;}
function sql(service,user,db,query){return execFileSync('docker',['compose','exec','-T',service,'psql','-v','ON_ERROR_STOP=1','-U',user,'-d',db,'-At','-c',query],{encoding:'utf8'}).trim();}
const ids=[];
try{
 const tutor=await account('Tutor','teacher'),stranger=await account('Tutor','stranger'),student=await account('Student','learner'),other=await account('Student','other');
 const tutorId=(await api('/tutors/me','PUT',{displayName:'Lifecycle fixture tutor',bio:'Lifecycle integration fixture',experienceYears:3},tutor)).id;
 await api('/tutors/me','PUT',{displayName:'Lifecycle fixture stranger',bio:'Lifecycle isolation fixture',experienceYears:3},stranger);
 for(const [token,name] of [[student,'Lifecycle student'],[other,'Lifecycle other']])await api('/students/me','PUT',{displayName:name,educationLevel:2,learningGoal:'Verify lifecycle',timezone:'Asia/Ho_Chi_Minh'},token);
 const subjectId=(await api('/subjects'))[0].id;
 await api('/tutors/me/subjects','PUT',[{subjectId,proficiencyLevel:1}],tutor,204);
 const start=new Date();start.setUTCDate(start.getUTCDate()+12);start.setUTCHours(6,0,0,0);
 const end=new Date(+start+3600000);
 await api('/tutors/me/availability','PUT',[{startAtUtc:start.toISOString(),endAtUtc:end.toISOString()}],tutor,204);
 const id=`lifecycle-fixture-${stamp}`;ids.push(id);
 await api('/courses/'+id,'PUT',{title:'Lifecycle fixture course',image:'/assets/figma/dashboard-research.png',category:'Workshop',description:'Reserved lifecycle fixture',capacity:1,sessions:[{startAtUtc:start.toISOString(),endAtUtc:end.toISOString()}]},tutor);
 const course=()=>api('/courses/'+id);
 const status=async(state,expected=200,reason='Schedule changed',version)=>{const c=await course();return api('/courses/'+id+'/status','PUT',{status:state,version:version??c.version,reason},tutor,expected);};
 const initial=await course();assert.equal(initial.status,'Open');assert.ok(initial.version>0);
 await api('/courses/'+id+'/status','PUT',{status:'Closed',version:initial.version},stranger,403);
 await api('/courses/'+id+'/status','PUT',{status:'Closed',version:initial.version},student,403);
 await status('Closed');await api('/courses/'+id+'/enrollments','POST',{},student,409);
 await status('Open',409,'',initial.version);await status('Open');
 await api('/courses/'+id+'/enrollments','POST',{},student);
 await api('/courses/'+id+'/enrollments','POST',{},student); // retry must not double-count
 assert.equal((await course()).enrolled,1);
 await api('/courses/'+id+'/enrollments','POST',{},other,409);
 await status('Closed');assert.equal((await api('/courses/mine','GET',undefined,student)).find(c=>c.id===id).status,'Closed');
 await api('/bookings/holds','POST',{tutorId,subjectId,startAtUtc:start.toISOString()},student,422);
 await api('/courses/'+id+'/enrollments/me','DELETE',undefined,student,204);
 await api('/courses/'+id+'/enrollments/me','DELETE',undefined,student,204);
 assert.equal((await course()).enrolled,0);assert.ok(!(await api('/courses/mine','GET',undefined,student)).some(c=>c.id===id));
 const withdrawn=await api('/courses/lifecycle-notifications','GET',undefined,tutor);assert.equal(withdrawn.filter(n=>n.courseId===id&&n.type==='CourseWithdrawn').length,1);
 const otherCourse=`lifecycle-fixture-${stamp}-overlap`;ids.push(otherCourse);
 await api('/courses/'+otherCourse,'PUT',{title:'Lifecycle overlap fixture',image:'/assets/figma/dashboard-research.png',category:'Workshop',description:'Reserved lifecycle fixture',capacity:2,sessions:[{startAtUtc:start.toISOString(),endAtUtc:end.toISOString()}]},stranger);
 await api('/courses/'+otherCourse+'/enrollments','POST',{},student);
 await api('/courses/'+otherCourse+'/enrollments/me','DELETE',undefined,student,204);
 await api('/courses/'+id+'/enrollments','POST',{},student,409);await status('Open');
 await api('/courses/'+id+'/enrollments','POST',{},student);assert.equal((await course()).enrolled,1);
 assert.equal((await api('/courses/enrollment-notifications','GET',undefined,tutor)).filter(n=>n.courseId===id).length,1);
 await status('Cancelled',400,'');await status('Cancelled',200,'Tutor unavailable');await status('Cancelled');
 assert.equal((await course()).status,'Cancelled');assert.equal((await course()).cancellationReason,'Tutor unavailable');
 await status('Open',409);await api('/courses/'+id+'/enrollments','POST',{},other,409);
 assert.ok(!(await api('/courses')).some(c=>c.id===id));
 assert.equal((await api('/courses/mine','GET',undefined,student)).find(c=>c.id===id).status,'Cancelled');
 const notices=await api('/courses/lifecycle-notifications','GET',undefined,student);const cancelled=notices.filter(n=>n.courseId===id&&n.type==='CourseCancelled');assert.equal(cancelled.length,1);
 const noticeId=cancelled[0].id.slice('course-lifecycle:'.length);
 await api('/courses/lifecycle-notifications/'+noticeId+'/read','PUT',undefined,other,404);
 await api('/courses/lifecycle-notifications/'+noticeId+'/read','PUT',undefined,student,204);
 assert.equal((await api('/courses/lifecycle-notifications','GET',undefined,student)).find(n=>n.id===cancelled[0].id).status,'Read');
 const h=await api('/bookings/holds','POST',{tutorId,subjectId,startAtUtc:start.toISOString()},student,201);
 await api(`/bookings/holds/${h.holdId}?holdToken=${encodeURIComponent(h.holdToken)}`,'DELETE',undefined,student,204);
 console.log('PASS: owner/role, stale version, close/reopen, capacity, withdrawal/re-enrollment, idempotent notices, cancellation history and release of scheduling conflicts.');
 // Only this isolated fixture is moved into past to prove time guards; no demo date changes.
 const past=`lifecycle-fixture-${stamp}-past`;ids.push(past);
 await api('/courses/'+past,'PUT',{title:'Lifecycle time fixture',image:'/assets/figma/dashboard-research.png',category:'Workshop',description:'Reserved lifecycle fixture',capacity:2,sessions:[{startAtUtc:new Date(+start+7200000).toISOString(),endAtUtc:new Date(+end+7200000).toISOString()}]},tutor);
 await api('/courses/'+past+'/enrollments','POST',{},student);
 sql('tutor-db','tutor_app','tutor_db',`UPDATE course_sessions SET "StartAtUtc"=now()-interval '10 minutes',"EndAtUtc"=now()+interval '50 minutes' WHERE "CourseId"='${past}'`);
 await api('/courses/'+past+'/enrollments/me','DELETE',undefined,student,409);
 await api('/courses/'+past+'/enrollments','POST',{},other,409);
 const p=await api('/courses/'+past);await api('/courses/'+past+'/status','PUT',{status:'Closed',version:p.version},tutor,409);
 sql('tutor-db','tutor_app','tutor_db',`UPDATE course_sessions SET "StartAtUtc"=now()-interval '2 hours',"EndAtUtc"=now()-interval '1 hour' WHERE "CourseId"='${past}'`);
 await api('/courses/'+past+'/status','PUT',{status:'Cancelled',version:p.version,reason:'too late'},tutor,409);
 console.log('PASS: started course rejects new enrollment/withdrawal and completed course rejects cancellation.');
}finally{
 if(ids.length)sql('tutor-db','tutor_app','tutor_db',`DELETE FROM courses WHERE "Id" IN (${ids.map(id=>`'${id}'`).join(',')}) AND "Description"='Reserved lifecycle fixture'`);
 sql('tutor-db','tutor_app','tutor_db',"UPDATE tutor_profiles SET status='Suspended' WHERE display_name IN ('Lifecycle fixture tutor','Lifecycle fixture stranger') AND bio IN ('Lifecycle integration fixture','Lifecycle isolation fixture')");
}

