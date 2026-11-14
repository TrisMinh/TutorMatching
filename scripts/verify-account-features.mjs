// Local integration verification. Unique disposable accounts, no demo account password changes.
import assert from 'node:assert/strict';
const base='http://localhost:8080/api/v1';
const stamp=Date.now();const password='AccountFixture!2026';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function api(path,method='GET',body,token,status=200){
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 assert.equal(response.status,status,`${method} ${path}: ${response.status} ${response.status>=400?await response.clone().text():''}`);
 return response.status===204||response.status===202?null:response.json();
}
async function account(role,suffix){
 const email=`account.fixture.${stamp}.${suffix}@example.com`;
 await api('/auth/register','POST',{email,password,role},undefined,201);
 return {email,...await api('/auth/login','POST',{email,password})};
}
try {
const tutor=await account('Tutor','teacher'),student=await account('Student','learner'),courseTutor=await account('Tutor','course-teacher');
const courseStudent=await account('Student','course-learner'),mutedStudent=await account('Student','muted-learner');
const mutedPrefs=await api('/users/me/settings','GET',undefined,mutedStudent.accessToken);
await api('/users/me/settings','PUT',{...mutedPrefs,emailReminders:false},mutedStudent.accessToken);
const settings=await api('/users/me/settings','GET',undefined,tutor.accessToken);
const saved=await api('/users/me/settings','PUT',{...settings,cancellationNoticeHours:12},tutor.accessToken);
await api('/users/me/settings','PUT',settings,tutor.accessToken,409);
await api('/users/me/settings','PUT',{...await api('/users/me/settings','GET',undefined,student.accessToken),cancellationNoticeHours:48},student.accessToken,400);
const subjectId=(await api('/subjects'))[0].id;
async function setupTeacher(a,name){const profile=await api('/tutors/me','PUT',{displayName:name,bio:'Disposable account integration fixture',experienceYears:3},a.accessToken);await api('/tutors/me/subjects','PUT',[{subjectId,proficiencyLevel:1}],a.accessToken,204);return profile.id;}
const tutorId=await setupTeacher(tutor,'Account feature fixture'),courseTutorId=await setupTeacher(courseTutor,'Course reminder fixture');
await api('/students/me','PUT',{displayName:'Account fixture student',educationLevel:2,learningGoal:'Verification',timezone:'Asia/Ho_Chi_Minh'},student.accessToken);
const slot=new Date(Math.ceil((Date.now()+5*60000)/1800000)*1800000);
await api('/tutors/me/availability','PUT',[{startAtUtc:slot.toISOString(),endAtUtc:new Date(+slot+3600000).toISOString()}],tutor.accessToken,204);
const hold=await api('/bookings/holds','POST',{tutorId,subjectId,startAtUtc:slot.toISOString()},student.accessToken,201);
assert.equal(hold.cancellationNoticeHours,12);
const changedBeforeConfirm=await api('/users/me/settings','PUT',{...saved,cancellationNoticeHours:0},tutor.accessToken);
const booking=await api('/bookings','POST',{holdId:hold.holdId,holdToken:hold.holdToken},student.accessToken,201);
assert.equal(booking.cancellationNoticeHours,12);
await api(`/bookings/${booking.id}?reasonCode=StudentRequested`,'DELETE',undefined,student.accessToken,409);
const hidden=await api('/users/me/settings','PUT',{...changedBeforeConfirm,profileVisible:false,cancellationNoticeHours:0},tutor.accessToken);
const search=await api('/tutors?page=1&pageSize=100');assert.ok(!search.items.some(t=>t.id===tutorId));
assert.equal((await api(`/bookings/${booking.id}`,'GET',undefined,student.accessToken)).booking.cancellationNoticeHours,12);
console.log('PASS: settings persist, stale update rejected, student policy rejected, profile hidden from search; existing booking keeps original policy and rejects late student cancellation.');

const courseId=`account-fixture-${stamp}`;const courseStart=new Date(Date.now()+35*60000);
await api('/courses/'+courseId,'PUT',{title:'Account reminder fixture',image:'/assets/figma/dashboard-research.png',category:'Workshop',description:'Disposable mail verification course',capacity:5,sessions:[{startAtUtc:courseStart.toISOString(),endAtUtc:new Date(+courseStart+3600000).toISOString()}]},courseTutor.accessToken);
await api('/courses/'+courseId+'/enrollments','POST',{},courseStudent.accessToken);
await api('/courses/'+courseId+'/enrollments','POST',{},mutedStudent.accessToken);
const alertPrefs=await api('/users/me/settings','GET',undefined,courseTutor.accessToken);
const alertsOff=await api('/users/me/settings','PUT',{...alertPrefs,enrollmentAlerts:false},courseTutor.accessToken);
assert.deepEqual(await api('/courses/enrollment-notifications','GET',undefined,courseTutor.accessToken),[]);
const alertsOn=await api('/users/me/settings','PUT',{...alertsOff,enrollmentAlerts:true},courseTutor.accessToken);
assert.equal((await api('/courses/enrollment-notifications','GET',undefined,courseTutor.accessToken)).length,2);
const mail=async()=>{const res=await fetch('http://localhost:8025/api/v1/messages?limit=200');assert.ok(res.ok);return (await res.json()).messages??[];};
function delivered(rows,email,subject){return rows.some(m=>m.To?.some(to=>to.Address===email)&&m.Subject.includes(subject));}
const until=Date.now()+65000;let rows=[];
while(Date.now()<until){rows=await mail();if(delivered(rows,student.email,'Private tutoring lesson')&&delivered(rows,courseStudent.email,'Account reminder fixture')&&delivered(rows,courseTutor.email,'Account reminder fixture'))break;await pause(1500);}
assert.ok(delivered(rows,student.email,'Private tutoring lesson'),'Booking reminder must reach actual student email');
assert.ok(delivered(rows,courseStudent.email,'Account reminder fixture'),'Course reminder must reach enrolled student');
assert.ok(delivered(rows,courseTutor.email,'Account reminder fixture'),'Course reminder must reach instructor');
assert.ok(!delivered(rows,mutedStudent.email,'Account reminder fixture'),'Opted out student must not receive email');
const notificationPrefs=await api('/users/me/settings','GET',undefined,student.accessToken);
const notificationsOff=await api('/users/me/settings','PUT',{...notificationPrefs,inAppNotifications:false},student.accessToken);
assert.equal((await api('/notifications?page=1&pageSize=20','GET',undefined,student.accessToken)).total,0);
await api('/users/me/settings','PUT',{...notificationsOff,inAppNotifications:true},student.accessToken);
assert.ok((await api('/notifications?page=1&pageSize=20','GET',undefined,student.accessToken)).total>0);
console.log('PASS: email opt-out respected; booking and course reminder workers delivered to actual student and tutor email addresses through SMTP/Mailpit.');
await api(`/bookings/${booking.id}?reasonCode=FixtureCleanup`,'DELETE',undefined,tutor.accessToken,204);
await api(`/bookings/${booking.id}?reasonCode=FixtureCleanup`,'DELETE',undefined,tutor.accessToken,204);
const zeroHold=await api('/bookings/holds','POST',{tutorId,subjectId,startAtUtc:slot.toISOString()},student.accessToken,201);
assert.equal(zeroHold.cancellationNoticeHours,0);
const zeroBooking=await api('/bookings','POST',{holdId:zeroHold.holdId,holdToken:zeroHold.holdToken},student.accessToken,201);
assert.equal((await api(`/bookings/${zeroBooking.id}`,'GET',undefined,student.accessToken)).booking.cancellationNoticeHours,0,'Zero-hour policy must survive database persistence');
await api(`/bookings/${zeroBooking.id}?reasonCode=StudentRequested`,'DELETE',undefined,student.accessToken,204);
console.log('PASS: zero-hour policy persists as zero and allows student cancellation before start.');
await api('/users/me/settings','PUT',{...hidden,profileVisible:false},tutor.accessToken);
const coursePrefs=await api('/users/me/settings','GET',undefined,courseTutor.accessToken);
await api('/users/me/settings','PUT',{...coursePrefs,profileVisible:false,emailReminders:false},courseTutor.accessToken);

// Recover only the disposable student's password. Do not log the reset token.
await api('/auth/forgot-password','POST',{email:student.email},undefined,202);
await api('/auth/forgot-password','POST',{email:student.email},undefined,202);
await api('/auth/forgot-password','POST',{email:`missing.${stamp}@example.com`},undefined,202);
rows=await mail();const resets=rows.filter(m=>m.To?.some(to=>to.Address===student.email)&&m.Subject==='Reset your TutorMatching password');
assert.equal(resets.length,1,'Resend cooldown should suppress duplicate reset email');
const message=await (await fetch(`http://localhost:8025/api/v1/message/${resets[0].ID}`)).json();
const token=new URL((message.Text??'').match(/http:\/\/localhost:3000\/auth\/reset-password\?token=[A-Fa-f0-9]+/)[0]).searchParams.get('token');
await api('/auth/reset-password','POST',{token,password:'short'},undefined,400);
const resetResponses=await Promise.all(Array.from({length:2},()=>fetch(base+'/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password:'NewFixturePassword!2026'})})));
assert.deepEqual(resetResponses.map(r=>r.status).sort(),[204,400]);
await api('/auth/login','POST',{email:student.email,password},undefined,401);
await api('/auth/refresh','POST',{refreshToken:student.refreshToken},undefined,401);
await api('/auth/login','POST',{email:student.email,password:'NewFixturePassword!2026'});
console.log('PASS: actual reset email, resend cooldown, unknown-account response, password validation, concurrent token single-use, old-password rejection and refresh revocation.');


} finally { await import('./cleanup-account-fixtures.mjs'); }
