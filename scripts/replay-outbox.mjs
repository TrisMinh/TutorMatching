// Explicit operator replay of one exhausted, unpublished event. Never creates another event ID.
import {execFileSync} from 'node:child_process';
const id=process.argv[2]?.toLowerCase();
if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id??''))throw new Error('Usage: node scripts/replay-outbox.mjs <event-uuid>');
const sql=`UPDATE outbox_messages SET attempt_count=0,next_attempt_at_utc=now(),locked_until_utc=NULL,last_error=NULL WHERE id='${id}'::uuid AND published_at_utc IS NULL AND attempt_count>=8 RETURNING id;`;
const result=execFileSync('docker',['compose','exec','-T','scheduling-db','psql','-v','ON_ERROR_STOP=1','-U','scheduling_app','-d','scheduling_db','-At','-c',sql],{encoding:'utf8'});
console.log(result.includes(id)?`Queued existing event ${id} for replay.`:'No exhausted unpublished event matched; nothing changed.');
