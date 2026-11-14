"""Rotate existing per-context DB role passwords without deleting volumes or printing secrets."""
import json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
credentials=json.loads((root/'.security/secrets.json').read_text())
compose=['docker','compose','-f','compose.yaml','-f','compose.ha.yaml','-f','compose.security.yaml']
for name in ['identity','tutor','student','scheduling','notification']:
    password=credentials['db-'+name]
    if len(password)!=48 or any(c not in '0123456789abcdef' for c in password): raise SystemExit('Invalid generated database credential format.')
    result=subprocess.run(compose+['exec','-T',name+'-db','psql','-v','ON_ERROR_STOP=1','-U',name+'_app','-d',name+'_db'],input=f"ALTER ROLE {name}_app WITH PASSWORD '{password}';\n",text=True,capture_output=True)
    if result.returncode: raise SystemExit('Database credential provisioning failed; SQL and secrets were not printed.')
print('Five existing database roles rotated to distinct generated credentials; application data and volumes preserved.')
