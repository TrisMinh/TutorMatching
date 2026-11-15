// Hide only synthetic test identities. Keep user/demo accounts and course history intact.
import {execFileSync} from 'node:child_process';
const sql=`INSERT INTO account_settings ("UserId","EmailReminders","InAppNotifications","EnrollmentAlerts","ProfileVisible","CancellationNoticeHours","Version")
SELECT id,false,true,true,false,12,1 FROM user_accounts WHERE role='Tutor' AND (
 email ~ '^audit[.][0-9]+[.](teacher|stranger)@demo[.]tutormatching[.]test$'
 OR email ~ '^registration[.]ui[.][0-9]+[.]tutor@example[.]com$'
 OR email ~ '^(lifecycle[.]fixture|account[.]fixture|prefs[.]ui)[.][0-9]+[.][a-z-]+@example[.]com$')
ON CONFLICT("UserId") DO UPDATE SET "ProfileVisible"=false,"EmailReminders"=false,"Version"=account_settings."Version"+1;`;
const result=execFileSync('docker',['compose','exec','-T','identity-db','psql','-v','ON_ERROR_STOP=1','-U','identity_app','-d','identity_db'],{input:sql,encoding:'utf8'});
console.log('Synthetic test tutor visibility updated: '+result.trim());
