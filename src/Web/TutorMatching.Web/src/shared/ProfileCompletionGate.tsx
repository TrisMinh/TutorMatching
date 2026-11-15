import {useEffect, useState, type ReactNode} from 'react';
import {Link, Navigate, useLocation} from 'react-router-dom';
import {browserSession, gatewayClient, GatewayError, type AccountRole} from '../api';
import {Button} from '../design-system/Button';

export function ProfileCompletionGate({role, children}: {role: AccountRole; children: ReactNode}) {
  const {pathname} = useLocation();
  const [state, setState] = useState<'checking' | 'ready' | 'missing' | 'error'>('checking');
  const [attempt, setAttempt] = useState(0);
  const setup = role === 'Tutor' ? '/tutor/onboarding' : '/student/complete-profile';
  useEffect(() => {
    if (role === 'Student') return;
    let active = true;
    const load = gatewayClient.getMyTutorProfile();
    load.then(() => {if (active) setState('ready');}).catch(reason => {if (active) setState(reason instanceof GatewayError && reason.status === 404 ? 'missing' : 'error');});
    const updated = () => setState('ready');
    window.addEventListener('tutormatching:profile-updated', updated);
    return () => {active = false; window.removeEventListener('tutormatching:profile-updated', updated);};
  }, [role, attempt]);
  if (role === 'Student') return children;
  if (pathname === setup || pathname.endsWith('/profile') || pathname.endsWith('/settings')) return children;
  if (state === 'missing') return <Navigate replace to={setup} />;
  if (state === 'error') return <main className="account-readiness"><section className="student-card" role="alert"><h1>Your profile could not be loaded</h1><p>Unable to check your profile. Try again before continuing.</p><div><Button onClick={() => {setState('checking');setAttempt(value => value + 1);}}>Try again</Button><Link to="/auth/sign-in" onClick={()=>browserSession.clear()}>Back to sign in</Link></div></section></main>;
  if (state === 'checking') return <main className="account-readiness"><p role="status">Loading your account profile…</p></main>;
  return children;
}
