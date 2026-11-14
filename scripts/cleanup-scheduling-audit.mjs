// Remove only disposable scheduling-audit fixtures created by this verification suite.
import {execFileSync} from 'node:child_process';
function sql(service,user,db,query){return execFileSync('docker',['compose','exec','-T',service,'psql','-U',user,'-d',db,'-At','-c',query],{encoding:'utf8'}).trim();}
const ids=sql('identity-db','identity_app','identity_db',"SELECT id FROM user_accounts WHERE email ~ '^course[.]e2e[.][0-9]+@example[.]com$'").split(/\s+/).filter(id=>/^[0-9a-f-]{36}$/.test(id));
if(ids.length){
 sql('identity-db','identity_app','identity_db',`UPDATE refresh_sessions SET revoked_at_utc=now() WHERE user_id IN (${ids.map(id=>`'${id}'`).join(',')}) AND revoked_at_utc IS NULL`);
 sql('tutor-db','tutor_app','tutor_db',`DELETE FROM enrollment_notices WHERE "StudentUserId" IN (${ids.map(id=>`'${id}'`).join(',')}); DELETE FROM course_enrollments WHERE "StudentUserId" IN (${ids.map(id=>`'${id}'`).join(',')})`);
}
sql('tutor-db','tutor_app','tutor_db',`DELETE FROM courses WHERE "Id" LIKE 'audit-course-%' AND "Title" = 'Scheduling audit course'; UPDATE tutor_profiles SET status='Suspended' WHERE display_name IN ('Scheduling audit tutor','UI audit teacher')`);
console.log('Revoked disposable browser-fixture sessions, cleaned audit courses/enrollments and hid audit-only tutors; demo accounts/courses preserved.');
