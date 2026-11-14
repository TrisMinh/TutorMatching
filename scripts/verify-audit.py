"""Verify copied audit evidence without printing actor IDs, tokens or log payloads."""
import hashlib,hmac,json,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
folder=Path(sys.argv[1]) if len(sys.argv)>1 else root/'.superpowers/security-evidence/audit'
files=list(folder.glob('*.jsonl'))
if not files: raise SystemExit('No copied audit evidence found.')
count=0
for file in files:
    service=file.name.rsplit('-',1)[0]
    key=bytes.fromhex((root/'.security'/service/'audit.key').read_text().strip())
    previous='0'*64
    for line in file.read_text(encoding='utf-8').splitlines():
        envelope=json.loads(line)
        expected=hmac.new(key,(previous+'\n'+envelope['Payload']).encode(),hashlib.sha256).hexdigest()
        if envelope['Previous']!=previous or not hmac.compare_digest(expected,envelope['Mac']): raise SystemExit('Audit integrity verification failed.')
        payload=json.loads(envelope['Payload'])
        required={'EventId','TimestampUtc','Phase','Service','Instance','ActorId','Role','Caller','Method','Route','Resource','Status','TraceId','SourceHash'}
        if set(payload)!=required: raise SystemExit('Unexpected audit schema or sensitive/unapproved field.')
        previous=envelope['Mac'];count+=1
print(f'PASS: {len(files)} audit streams, {count} entries; HMAC chains and allowlisted metadata verified. No payloads or credentials printed.')
