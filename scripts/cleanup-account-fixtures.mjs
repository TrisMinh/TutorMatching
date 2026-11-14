// Removes only fixtures reserved by verify-account-features.mjs. Never demo/user data.
import {execFileSync} from 'node:child_process';
function sql(service,user,db,query){return execFileSync('docker',['compose','exec','-T',service,'psql','-v','ON_ERROR_STOP=1','-U',user,'-d',db,'-At','-c',query],{encoding:'utf8'}).trim();}
const ids=sql('identity-db','identity_app','identity_db',"SELECT id FROM user_accounts WHERE email ~ '^account[.]fixture[.][0-9]+[.](teacher|learner|course-teacher|course-learner|muted-learner)@example[.]com$'").split(/\s+/).filter(Boolean);
if(ids.length){
 if(ids.some(id=>! /^[0-9a-f-]{36}$/i.test(id)))throw Error('Invalid fixture identifier');
 const list=ids.map(id=>`'${id}'::uuid`).join(',');
 sql('notification-db','notification_app','notification_db',`BEGIN; DELETE FROM delivery_attempts WHERE reminder_id IN(SELECT id FROM reminder_schedules WHERE recipient_user_id IN(${list})) OR notification_id IN(SELECT id FROM notifications WHERE recipient_user_id IN(${list})); DELETE FROM reminder_schedules WHERE recipient_user_id IN(${list}); DELETE FROM notifications WHERE recipient_user_id IN(${list}); COMMIT;`);
 sql('scheduling-db','scheduling_app','scheduling_db',`BEGIN; DELETE FROM outbox_messages WHERE aggregate_id IN(SELECT id FROM bookings WHERE student_user_id IN(${list}) AND tutor_user_id IN(${list})); DELETE FROM bookings WHERE student_user_id IN(${list}) AND tutor_user_id IN(${list}); COMMIT;`);
 sql('identity-db','identity_app','identity_db',`INSERT INTO account_settings ("UserId","EmailReminders","InAppNotifications","EnrollmentAlerts","ProfileVisible","CancellationNoticeHours","Version") SELECT id,false,true,true,false,12,1 FROM user_accounts WHERE id IN(${list}) AND role='Tutor' ON CONFLICT("UserId") DO UPDATE SET "ProfileVisible"=false,"EmailReminders"=false,"Version"=account_settings."Version"+1;`);
}
sql('tutor-db','tutor_app','tutor_db',`BEGIN; DELETE FROM courses WHERE "Id" LIKE 'account-fixture-%' AND "Title"='Account reminder fixture' AND "Description"='Disposable mail verification course'; COMMIT;`);
console.log('Cleaned reserved account fixture schedules/courses and hid fixture tutors; demo data preserved.');
