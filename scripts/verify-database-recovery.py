"""Run real PostgreSQL recovery tests using temporary loopback proxies and current secrets."""
import json,os,subprocess,uuid
from pathlib import Path
root=Path(__file__).resolve().parents[1]
env_file=root/'.env'
settings={line.split('=',1)[0]:line.split('=',1)[1] for line in env_file.read_text().splitlines() if '=' in line and not line.startswith('#')} if env_file.exists() else {}
credentials={'db-'+name:settings.get('LOCAL_ADMIN_PASSWORD','change-me-local-password') for name in ['scheduling','notification']}
proxies=[]
def docker(*args):
    result=subprocess.run(['docker',*args],capture_output=True,text=True,cwd=root)
    if result.returncode: raise SystemExit('Temporary database-test proxy failed; credentials omitted.')
    return result.stdout.strip()
try:
    for service,project,filter_name in [('scheduling','Scheduling','OutboxRecoveryTests'),('notification','Notification','MultiInstanceRecoveryTests')]:
        name='tm-db-recovery-'+uuid.uuid4().hex[:12]
        docker('run','--rm','-d','--name',name,'--network','tutormatching_data','-p','127.0.0.1::5432','alpine/socat','TCP-LISTEN:5432,fork,reuseaddr',f'TCP:{service}-db:5432');proxies.append(name)
        port=json.loads(docker('inspect',name))[0]['NetworkSettings']['Ports']['5432/tcp'][0]['HostPort']
        env=os.environ.copy();env.pop('TEST_REDIS_CONNECTION',None)
        env['TEST_'+service.upper()+'_DB']=f'Host=localhost;Port={port};Database={service}_db;Username={service}_app;Password={credentials["db-"+service]}'
        result=subprocess.run(['dotnet','test',f'tests/{project}/TutorMatching.{project}.Tests','--filter','FullyQualifiedName~'+filter_name,'--verbosity','minimal'],cwd=root,env=env,capture_output=True,text=True)
        output=result.stdout+result.stderr
        for secret in credentials.values(): output=output.replace(secret,'[redacted]')
        print(output,end='')
        if result.returncode: raise SystemExit('Database recovery test failed.')
finally:
    for name in proxies: subprocess.run(['docker','stop',name],capture_output=True,cwd=root)
