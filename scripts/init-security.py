"""Idempotent local security material. Never prints secrets; never installs host trust."""
from pathlib import Path
import datetime as dt
import ipaddress
import secrets
import json
import hashlib
import base64
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID, ExtendedKeyUsageOID

root = Path(__file__).resolve().parents[1] / '.security'
root.mkdir(exist_ok=True)
now = dt.datetime.now(dt.timezone.utc)

def write_key(path, key):
    path.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    path.chmod(0o600)

ca_dir = root / 'ca'
ca_dir.mkdir(exist_ok=True)
if not (ca_dir / 'ca.key').exists():
    key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'TutorMatching Local Workload CA')])
    ca = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(x509.random_serial_number())
          .not_valid_before(now-dt.timedelta(minutes=5)).not_valid_after(now+dt.timedelta(days=365))
          .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
          .add_extension(x509.KeyUsage(False,False,False,False,False,True,True,False,False),critical=True)
          .sign(key, hashes.SHA256()))
    write_key(ca_dir / 'ca.key', key)
    (ca_dir / 'ca.crt').write_bytes(ca.public_bytes(serialization.Encoding.PEM))
ca_key = serialization.load_pem_private_key((ca_dir / 'ca.key').read_bytes(), password=None)
ca = x509.load_pem_x509_certificate((ca_dir / 'ca.crt').read_bytes())
for name in ['identity','tutor','student','scheduling','notification','gateway','service-lb','web','redis','rabbitmq']:
    folder = root / name
    folder.mkdir(exist_ok=True)
    if not (folder / 'tls.key').exists():
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        cert = (x509.CertificateBuilder().subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,name)]))
                .issuer_name(ca.subject).public_key(key.public_key()).serial_number(x509.random_serial_number())
                .not_valid_before(now-dt.timedelta(minutes=5)).not_valid_after(now+dt.timedelta(days=90))
                .add_extension(x509.BasicConstraints(ca=False,path_length=None),critical=True)
                .add_extension(x509.SubjectAlternativeName([x509.DNSName(name),x509.DNSName(name+'-service'),x509.DNSName('service-lb'),x509.DNSName('localhost'),x509.IPAddress(ipaddress.ip_address('127.0.0.1'))]),critical=False)
                .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH,ExtendedKeyUsageOID.CLIENT_AUTH]),critical=False)
                .add_extension(x509.KeyUsage(True,False,True,False,False,False,False,False,False),critical=True)
                .sign(ca_key,hashes.SHA256()))
        write_key(folder / 'tls.key',key)
        (folder / 'tls.crt').write_bytes(cert.public_bytes(serialization.Encoding.PEM))
        (folder / 'tls.pem').write_bytes((folder / 'tls.crt').read_bytes()+(folder / 'tls.key').read_bytes())
        (folder / 'tls.pem').chmod(0o600)
    if not (folder / 'audit.key').exists():
        (folder / 'audit.key').write_text(secrets.token_hex(32),encoding='ascii')
        (folder / 'audit.key').chmod(0o600)
public = root / 'public'
public.mkdir(exist_ok=True)
(public / 'ca.crt').write_bytes((ca_dir / 'ca.crt').read_bytes())
if not (root / 'identity' / 'jwt-private.pem').exists():
    key = rsa.generate_private_key(public_exponent=65537,key_size=3072)
    write_key(root / 'identity' / 'jwt-private.pem',key)
    (public / 'jwt-public.pem').write_bytes(key.public_key().public_bytes(serialization.Encoding.PEM,serialization.PublicFormat.SubjectPublicKeyInfo))
secret_path = root / 'secrets.json'
credentials = json.loads(secret_path.read_text()) if secret_path.exists() else {}
for name in ['identity','tutor','student','scheduling','notification','gateway','health','operator','rabbit-scheduling','rabbit-notification','rabbit-operator','db-identity','db-tutor','db-student','db-scheduling','db-notification']:
    credentials.setdefault(name, secrets.token_hex(24))
secret_path.write_text(json.dumps(credentials), encoding='utf-8')
secret_path.chmod(0o600)
for name in ['identity','tutor','student','scheduling','notification','gateway']:
    config = {
        'Jwt': {'PublicKeyPath':'/run/trust/jwt-public.pem','PrivateKeyPath':'/run/workload/jwt-private.pem' if name=='identity' else None,'SigningKey':'','RequireAsymmetric':True},
        'Security': {'ServiceName':name,'Transport':{'RequireMtls':True,'CaPath':'/run/trust/ca.crt','CertificatePath':'/run/workload/tls.crt','KeyPath':'/run/workload/tls.key'},'Revocation':{'Enabled':True},'Audit':{'Enabled':True,'KeyPath':'/run/workload/audit.key','Directory':'/var/log/tutormatching'}},
        'ConnectionStrings': {'Redis':f'redis:6380,user={name},password={credentials[name]},ssl=true,sslHost=redis,abortConnect=false,connectTimeout=3000,syncTimeout=3000'},
        'Services': {'Tutor':'https://service-lb:8082','Student':'https://service-lb:8083','Scheduling':'https://service-lb:8084'},
    }
    if name in ['scheduling','notification']:
        config['ConnectionStrings']['RabbitMq']=f'amqps://{name}:{credentials["rabbit-"+name]}@rabbitmq:5671/'
        config['Security']['Messaging']={'RequireSignature':True,'ProducerCertificatePath':'/run/trust/scheduling.crt'}
    if name!='gateway':
        config['ConnectionStrings'][name.capitalize()+'Db']=f'Host={name}-db;Port=5432;Database={name}_db;Username={name}_app;Password={credentials["db-"+name]};Maximum Pool Size=20;Timeout=5;Command Timeout=20'
    if name=='gateway':
        config['ReverseProxy']={'Clusters':{service:{'Destinations':{'primary':{'Address':f'https://service-lb:{port}'}},'HttpRequest':{'Version':'1.1','VersionPolicy':'RequestVersionExact'}} for service,port in [('identity',8081),('tutor',8082),('student',8083),('scheduling',8084),('notification',8085)]}}
    (root / name / 'runtime.json').write_text(json.dumps(config,indent=2),encoding='utf-8')
    (root / name / 'runtime.json').chmod(0o600)
acl = ['user default off +@all ~* &*']
read_commands = '+@connection +ping +echo +info +get +mget +exists +cluster|slots +cluster|nodes +command +config|get +subscribe &__Booksleeve_MasterChanged %R~__Booksleeve_TieBreak'
for name in ['identity','tutor','student','scheduling','notification','gateway','health','operator']:
    digest = hashlib.sha256(credentials[name].encode()).hexdigest()
    if name=='operator': rules='+@all ~* &*'
    elif name=='health': rules='+@connection +ping'
    elif name=='identity': rules=f'{read_commands} +set +setex +psetex %RW~security:revoked:*'
    elif name=='scheduling': rules=f'{read_commands} +set +del +eval +evalsha +script %R~security:revoked:* %RW~booking:* %RW~tutormatching:schedule-write:*'
    elif name=='tutor': rules=f'{read_commands} +set +del +eval +evalsha +script %R~security:revoked:* %RW~tutormatching:schedule-write:*'
    else: rules=f'{read_commands} %R~security:revoked:*'
    acl.append(f'user {name} on #{digest} {rules}')
(root / 'redis' / 'users.acl').write_text('\n'.join(acl)+'\n',encoding='ascii')
(root / 'redis' / 'health.pass').write_text(credentials['health'],encoding='ascii')
(root / 'redis' / 'operator.pass').write_text(credentials['operator'],encoding='ascii')
(root / 'redis' / 'redis.conf').write_text('port 0\ntls-port 6380\ntls-cert-file /run/redis/tls.crt\ntls-key-file /run/redis/tls.key\ntls-ca-cert-file /run/trust/ca.crt\ntls-auth-clients no\naclfile /run/redis/users.acl\nappendonly yes\ndir /data\n',encoding='ascii')
(public / 'scheduling.crt').write_bytes((root / 'scheduling' / 'tls.crt').read_bytes())
web_cert=x509.load_pem_x509_certificate((root/'web/tls.crt').read_bytes())
web_spki=web_cert.public_key().public_bytes(serialization.Encoding.DER,serialization.PublicFormat.SubjectPublicKeyInfo)
(public/'browser-spki.txt').write_text(base64.b64encode(hashlib.sha256(web_spki).digest()).decode(),encoding='ascii')
(root / 'rabbitmq' / 'operator.pass').write_text(credentials['rabbit-operator'],encoding='ascii')
(root / 'rabbitmq' / 'rabbitmq.conf').write_text('listeners.tcp = none\nlisteners.ssl.default = 5671\nssl_options.cacertfile = /run/trust/ca.crt\nssl_options.certfile = /run/broker/tls.crt\nssl_options.keyfile = /run/broker/tls.key\nssl_options.verify = verify_peer\nssl_options.fail_if_no_peer_cert = true\n',encoding='ascii')
print('Local CA, workload certificates, RSA JWT keys and audit keys ready under ignored .security/. Existing keys preserved; host trust unchanged.')
