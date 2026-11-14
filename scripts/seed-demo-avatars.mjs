// Fill missing photos only on explicitly named demo accounts, preserving user-selected avatars.
import {execFileSync} from 'node:child_process';
function sql(service,user,db,query){return execFileSync('docker',['compose','exec','-T',service,'psql','-v','ON_ERROR_STOP=1','-U',user,'-d',db,'-At','-F','|','-c',query],{encoding:'utf8'}).trim();}
const rows=sql('identity-db','identity_app','identity_db',"SELECT id,email FROM user_accounts WHERE email ~ '^student[0-9]{2}@demo[.]tutormatching[.]test$'").split('\n').filter(Boolean);
for(const row of rows){
 const [id,email]=row.trim().split('|');if(!/^[0-9a-f-]{36}$/.test(id))throw new Error('Unexpected demo account ID');
 const number=Number(email.match(/^student([0-9]+)/)[1]);const avatar=`/assets/figma/dashboard-avatar-${1+(number-1)%3}.png`;
 sql('student-db','student_app','student_db',`UPDATE student_profiles SET avatar_url='${avatar}' WHERE user_id='${id}'::uuid AND (avatar_url IS NULL OR avatar_url='')`);
 const saved=sql('student-db','student_app','student_db',`SELECT avatar_url FROM student_profiles WHERE user_id='${id}'::uuid`);
 // The retained notice uses the same saved profile image; never replace an existing snapshot.
 if(saved===avatar)sql('tutor-db','tutor_app','tutor_db',`UPDATE enrollment_notices SET "AvatarUrl"='${avatar}' WHERE "StudentUserId"='${id}'::uuid AND ("AvatarUrl" IS NULL OR "AvatarUrl"='')`);
}
console.log(`Filled missing demo avatars for ${rows.length} demo account candidates; existing avatars preserved.`);
