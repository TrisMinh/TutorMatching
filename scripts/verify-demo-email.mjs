import {execFileSync} from 'node:child_process';

export function requireMailpitForDemo() {
  const provider = execFileSync('docker', ['compose', '-f', 'compose.yaml', '-f', 'compose.ha.yaml', 'exec', '-T', 'identity-service', 'printenv', 'Email__Provider'], {encoding: 'utf8'}).trim().toLowerCase();
  if (provider !== 'mailpit') throw new Error('Demo accounts require Identity to use Mailpit. Run seed-data.cmd to temporarily select Mailpit and restore your email configuration afterwards.');
}

export async function verifyDemoEmail(email, apiBase = 'http://localhost:8080/api/v1') {
  const mailpit = process.env.MAILPIT_URL ?? 'http://localhost:8025';
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await fetch(mailpit + '/api/v1/search?query=' + encodeURIComponent('to:' + email), {signal: AbortSignal.timeout(5000)});
    if (!search.ok) throw new Error('Unable to read Mailpit demo inbox.');
    for (const summary of (await search.json()).messages ?? []) {
      if (summary.Subject !== 'Verify your TutorMatching email') continue;
      const detail = await (await fetch(mailpit + '/api/v1/message/' + summary.ID)).json();
      const code = detail.Text?.match(/verification code is: (\d{6})/)?.[1];
      if (!code) continue;
      const verified = await fetch(apiBase + '/auth/verify-email', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email, code})});
      if (verified.ok) return;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('No usable verification email found in Mailpit for demo account.');
}
