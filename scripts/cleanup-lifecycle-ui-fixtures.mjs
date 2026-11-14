import {execFileSync} from 'node:child_process';
// Reserved fixture identity only; never delete user/demo courses or accounts.
execFileSync('docker',['compose','exec','-T','tutor-db','psql','-v','ON_ERROR_STOP=1','-U','tutor_app','-d','tutor_db','-c',`BEGIN;
DELETE FROM courses WHERE "Id" ~ '^lifecycle-ui-[0-9]+$' AND "Title"='Lifecycle UI course' AND "Description"='Isolated lifecycle UI fixture';
UPDATE tutor_profiles SET status='Suspended' WHERE display_name='Lifecycle UI tutor' AND bio='Isolated lifecycle UI fixture';
COMMIT;`],{stdio:'pipe'});
console.log('Reserved lifecycle UI fixtures cleaned; demo courses preserved.');
