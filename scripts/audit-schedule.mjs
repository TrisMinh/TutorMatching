import {execFileSync} from 'node:child_process';
function query(service,user,database,sql){const raw=execFileSync('docker',['compose','exec','-T',service,'psql','-U',user,'-d',database,'-At','-c',sql],{encoding:'utf8'}).trim();return JSON.parse(raw||'[]');}
const sessions=query('tutor-db','tutor_app','tutor_db',`SELECT coalesce(json_agg(x),'[]') FROM (SELECT s."CourseId" course,s."StartAtUtc" start,s."EndAtUtc" finish,t.user_id teacher,e."StudentUserId" student FROM course_sessions s JOIN courses c ON c."Id"=s."CourseId" JOIN tutor_profiles t ON t.id=c."TutorId" LEFT JOIN course_enrollments e ON e."CourseId"=c."Id" AND e."WithdrawnAtUtc" IS NULL WHERE c."Status"<>'Cancelled') x`);
const bookings=query('scheduling-db','scheduling_app','scheduling_db',`SELECT coalesce(json_agg(x),'[]') FROM (SELECT id,start_at_utc start,end_at_utc finish,student_user_id student,tutor_user_id teacher FROM bookings WHERE status='Confirmed') x`);
const conflicts=[];
for(const session of sessions)for(const booking of bookings)if((session.student===booking.student||session.teacher===booking.teacher)&&new Date(session.start)<new Date(booking.finish)&&new Date(booking.start)<new Date(session.finish))conflicts.push({course:session.course,booking:booking.id});
console.log(JSON.stringify({confirmedBookings:bookings.length,courseBookingConflicts:conflicts.length,conflicts},null,2));
