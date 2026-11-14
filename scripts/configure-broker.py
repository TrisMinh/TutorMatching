"""Provision narrowly scoped broker accounts; no credentials in stdout or error messages."""
import json
import subprocess
import urllib.request
import urllib.parse
import base64
from pathlib import Path
root=Path(__file__).resolve().parents[1]
secrets=json.loads((root/'.security/secrets.json').read_text())
compose=['docker','compose','-f','compose.yaml','-f','compose.ha.yaml','-f','compose.security.yaml','exec','-T','rabbitmq']
def run(*args):
    result=subprocess.run(compose+list(args),capture_output=True,text=True)
    if result.returncode: raise SystemExit('Broker provisioning failed; inspect local broker status without printing credentials.')
    return result.stdout
users=run('rabbitmqctl','list_users','--quiet')
for name in ['scheduling','notification']:
    password=secrets['rabbit-'+name]
    existing=any(line.split()[0]==name for line in users.splitlines() if line.strip())
    run('rabbitmqctl','change_password' if existing else 'add_user',name,password)
    if name=='scheduling': configure=write=r'^tutormatching[.]events$';read=r'^$'
    else:
        configure=r'^$';read=r'^notification[.]booking-events[.]v1$'
        write=r'^tutormatching[.](retry|dlx)$'
    run('rabbitmqctl','set_permissions','-p','/',name,configure,write,read)
run('sh','-c','rabbitmqctl change_password "$RABBITMQ_DEFAULT_USER" "$(cat /run/broker/operator.pass)"')
operator=run('sh','-c','printf "%s" "$RABBITMQ_DEFAULT_USER"').strip()
auth=base64.b64encode((operator+':'+secrets['rabbit-operator']).encode()).decode()
def management(path,body,method='PUT'):
    req=urllib.request.Request('http://127.0.0.1:15672/api/'+path,data=json.dumps(body).encode(),method=method,headers={'Authorization':'Basic '+auth,'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=10) as response: response.read()
    except Exception: raise SystemExit('Broker topology provisioning failed; credentials were not printed.') from None
for exchange in ['tutormatching.events','tutormatching.retry','tutormatching.dlx']:
    management('exchanges/%2F/'+exchange,{'type':'topic','durable':True,'auto_delete':False,'internal':False,'arguments':{}})
for queue,args in [('notification.booking-events.v1',{}),('notification.booking-events.retry',{'x-message-ttl':30000,'x-dead-letter-exchange':'tutormatching.events'}),('notification.booking-events.dlq',{})]:
    management('queues/%2F/'+queue,{'durable':True,'auto_delete':False,'arguments':args})
for exchange,queue,keys in [('tutormatching.events','notification.booking-events.v1',['booking.confirmed.v1','booking.cancelled.v1']),('tutormatching.retry','notification.booking-events.retry',['booking.*.v1']),('tutormatching.dlx','notification.booking-events.dlq',['booking.*.v1'])]:
    for routing in keys: management('bindings/%2F/e/'+exchange+'/q/'+queue,{'routing_key':routing,'arguments':{}},'POST')
print('RabbitMQ per-service accounts/permissions configured; default operator password rotated to ignored local material.')
