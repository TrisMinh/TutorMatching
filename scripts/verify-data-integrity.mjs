import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
const compose=['compose','-f','compose.yaml','-f','compose.ha.yaml'];
function rows(name,sql){return JSON.parse(execFileSync('docker',[...compose,'exec','-T',name+'-db','psql','-v','ON_ERROR_STOP=1','-U',name+'_app','-d',name+'_db','-Atc',`SELECT COALESCE(json_agg(t),'[]'::json) FROM (${sql}) t`],{encoding:'utf8'}));}
const users=rows('identity','SELECT id,role,status FROM user_accounts');
const tutors=rows('tutor','SELECT id,user_id FROM tutor_profiles');
const students=rows('student','SELECT id,user_id FROM student_profiles');
const subjects=rows('tutor','SELECT id FROM subjects');
const courses=rows('tutor','SELECT "Id" as id,"TutorId" as tutor_id,"Capacity" as capacity,"Status" as status FROM courses');
const sessions=rows('tutor','SELECT "Id" as id,"CourseId" as course_id,"StartAtUtc" as start_at_utc,"EndAtUtc" as end_at_utc FROM course_sessions');
const enrollments=rows('tutor','SELECT "CourseId" as course_id,"StudentUserId" as student_user_id,"WithdrawnAtUtc" as withdrawn_at_utc FROM course_enrollments');
const bookings=rows('scheduling','SELECT id,student_id,student_user_id,tutor_id,tutor_user_id,subject_id,start_at_utc,end_at_utc,status FROM bookings');
const favorites=rows('student','SELECT "StudentId" as student_id,"TutorId" as tutor_id FROM saved_tutors');
const notifications=rows('notification','SELECT id,recipient_user_id FROM notifications');
const issues=[],map=values=>new Map(values.map(v=>[v.id,v]));
const identity=map(users),tutorMap=map(tutors),studentMap=map(students),courseMap=map(courses),subjectIds=new Set(subjects.map(s=>s.id));
const check=(valid,reason)=>{if(!valid)issues.push(reason);};
for(const t of tutors)check(identity.get(t.user_id)?.role==='Tutor','Tutor Identity link missing: '+t.id);
for(const s of students)check(identity.get(s.user_id)?.role==='Student','Student Identity link missing: '+s.id);
for(const c of courses){check(tutorMap.has(c.tutor_id),'Course owner missing: '+c.id);check(c.capacity>0,'Invalid capacity: '+c.id);check(enrollments.filter(e=>e.course_id===c.id&&!e.withdrawn_at_utc).length<=c.capacity,'Course over capacity: '+c.id);}
for(const s of sessions){check(courseMap.has(s.course_id),'Session course missing: '+s.id);check(Date.parse(s.end_at_utc)>Date.parse(s.start_at_utc),'Invalid session interval: '+s.id);}
for(const e of enrollments){check(courseMap.has(e.course_id),'Enrollment course missing: '+e.course_id);check(identity.get(e.student_user_id)?.role==='Student','Enrollment Identity missing: '+e.course_id);check(students.some(s=>s.user_id===e.student_user_id),'Enrollment profile missing: '+e.course_id);}
for(const b of bookings){check(studentMap.get(b.student_id)?.user_id===b.student_user_id,'Booking student link invalid: '+b.id);check(tutorMap.get(b.tutor_id)?.user_id===b.tutor_user_id,'Booking tutor link invalid: '+b.id);check(subjectIds.has(b.subject_id),'Booking subject missing: '+b.id);check(Date.parse(b.end_at_utc)>Date.parse(b.start_at_utc),'Invalid booking interval: '+b.id);}
for(const favorite of favorites){check(studentMap.has(favorite.student_id),'Saved tutor student missing');check(tutorMap.has(favorite.tutor_id),'Saved tutor target missing');}
for(const n of notifications)check(identity.has(n.recipient_user_id),'Notification recipient missing: '+n.id);
const schedules=new Map();
function add(user,id,start,end){const list=schedules.get(user)??[];list.push({id,start:Date.parse(start),end:Date.parse(end)});schedules.set(user,list);}
for(const b of bookings.filter(b=>b.status==='Confirmed')){add(b.student_user_id,'booking:'+b.id,b.start_at_utc,b.end_at_utc);add(b.tutor_user_id,'booking:'+b.id,b.start_at_utc,b.end_at_utc);}
for(const s of sessions){const c=courseMap.get(s.course_id);if(!c||c.status==='Cancelled')continue;const t=tutorMap.get(c.tutor_id);if(t)add(t.user_id,'course:'+s.id,s.start_at_utc,s.end_at_utc);for(const e of enrollments.filter(e=>e.course_id===c.id&&!e.withdrawn_at_utc))add(e.student_user_id,'course:'+s.id,s.start_at_utc,s.end_at_utc);}
for(const [user,list] of schedules){list.sort((a,b)=>a.start-b.start);for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length&&list[j].start<list[i].end;j++)if(list[i].id!==list[j].id)issues.push(`Schedule overlap for ${user}: ${list[i].id} / ${list[j].id}`);}
const report={checkedAt:new Date().toISOString(),counts:{accounts:users.length,tutors:tutors.length,students:students.length,subjects:subjects.length,courses:courses.length,sessions:sessions.length,enrollments:enrollments.filter(e=>!e.withdrawn_at_utc).length,bookings:bookings.length,notifications:notifications.length,savedTutors:favorites.length},issues};
mkdirSync('.logs',{recursive:true});writeFileSync('.logs/data-integrity.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(issues.length)process.exitCode=1;
