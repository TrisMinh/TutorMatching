"""Probe cache/broker least privilege without printing credentials or touching application keys."""
import json,subprocess,uuid
from pathlib import Path
root=Path(__file__).resolve().parents[1]
credentials=json.loads((root/'.security/secrets.json').read_text())
compose=['docker','compose','-f','compose.yaml','-f','compose.ha.yaml','-f','compose.security.yaml']
def redis(user,*arguments):
    result=subprocess.run(compose+['exec','-T','-e','REDISCLI_AUTH='+credentials[user],'redis','redis-cli','--tls','--cacert','/run/trust/ca.crt','-p','6380','--user',user,*arguments],capture_output=True,text=True)
    if result.returncode: raise SystemExit('Redis permission probe could not connect; credentials omitted.')
    return result.stdout.strip()
key='security:revoked:user:'+str(uuid.uuid4())
try:
    for user in ['gateway','scheduling','student','notification','tutor']:
        assert 'NOPERM' in redis(user,'SET',key,'0','EX','60'), 'Unexpected cache write privilege'
    assert redis('identity','SET',key,'1','EX','60')=='OK'
    assert redis('gateway','GET',key)=='1'
    assert 'NOPERM' in redis('student','GET','booking:hold:'+uuid.uuid4().hex)
    dryrun=redis('operator','ACL','DRYRUN','gateway','FLUSHDB')
    assert 'no permissions' in dryrun.lower() or 'NOPERM' in dryrun
    print('PASS: Identity-only revocation writes; readers cannot modify it; Student cannot read booking holds; ACL DRYRUN denies destructive cache commands without executing them.')
finally:
    redis('operator','DEL',key)
result=subprocess.run(compose+['exec','-T','rabbitmq','rabbitmqctl','list_permissions','-p','/','--quiet'],capture_output=True,text=True)
assert result.returncode==0,'Broker permission listing failed'
rows=[line.split('\t') for line in result.stdout.splitlines()]
notification=next(row for row in rows if row[0]=='notification')
scheduling=next(row for row in rows if row[0]=='scheduling')
assert notification[1:]==['^$',r'^tutormatching[.](retry|dlx)$',r'^notification[.]booking-events[.]v1$']
assert scheduling[1:]==[r'^tutormatching[.]events$',r'^tutormatching[.]events$','^$']
print('PASS: broker roles are scoped; Notification cannot configure topology or publish booking events; Scheduling cannot consume queues.')
for name in ['identity','tutor','student','scheduling','notification']:
    assert credentials['db-'+name]!=name+'_dev'
assert len({credentials['db-'+n] for n in ['identity','tutor','student','scheduling','notification']})==5
result=subprocess.run(['docker','run','--rm','--network','tutormatching_data','-e','PGPASSWORD='+credentials['db-student'],'postgres:17-alpine','psql','-h','identity-db','-U','identity_app','-d','identity_db','-c','SELECT 1'],capture_output=True,text=True)
assert result.returncode!=0 and 'password authentication failed' in result.stderr.lower(),'Student credential must not authenticate to Identity database'
print('PASS: five distinct non-demo DB credentials; Student credential cannot authenticate to Identity database.')
