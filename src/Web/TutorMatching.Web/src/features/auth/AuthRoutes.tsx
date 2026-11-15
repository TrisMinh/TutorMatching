import {notifyAction} from '../../shared/notificationEvents';
import {TOAST_DURATION_MS} from '../../shared/Toast';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import { GatewayError, gatewayClient, browserSession } from '../../api';
import { Button } from '../../design-system/Button';
import { TextField } from '../../design-system/TextField';
import { MotionLink as Link, useMotionNavigate } from '../../shared/MotionLink';
import { AuthLayout } from './AuthLayout';
import './auth.css';

type AuthHeaderProps = {
  title: string;
  description: string;
};

function AuthHeader({ title, description }: AuthHeaderProps) {
  return (
    <div className="auth-copy">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

function RoleSwitch({ onChange, value }: { onChange?: (role: 'student' | 'tutor') => void; value?: 'student' | 'tutor' }) {
  const [internalRole, setInternalRole] = useState<'student' | 'tutor'>('student');
  const role = value ?? internalRole;

  function selectRole(nextRole: 'student' | 'tutor') {
    setInternalRole(nextRole);
    onChange?.(nextRole);
  }

  return (
    <div className="auth-role-switch" aria-label="Register as" role="group">
      <button
        aria-pressed={role === 'student'}
        className={role === 'student' ? 'is-active' : ''}
        onClick={() => selectRole('student')}
        type="button"
      >
        I’m a student
      </button>
      <button
        aria-pressed={role === 'tutor'}
        className={role === 'tutor' ? 'is-active' : ''}
        onClick={() => selectRole('tutor')}
        type="button"
      >
        I’m a tutor
      </button>
    </div>
  );
}

export function SignInScreen({ error = false }: { error?: boolean }) {
  const navigate = useMotionNavigate();
  const [email, setEmail] = useState(error ? 'minh@example.com' : '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [submitError, setSubmitError] = useState(error ? 'Email or password is incorrect.' : '');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      const { user } = await gatewayClient.login({ email, password }, remember);
      sessionStorage.removeItem('tutormatching.registration.verified');
      notifyAction('Signed in successfully.');
      const destination = user.role === 'Tutor' ? '/tutor/dashboard' : '/student/dashboard';
      navigate(destination, { replace: true, viewTransition: true });
    } catch (reason) {
      if (reason instanceof GatewayError && reason.code === 'email_verification_required') {
        sessionStorage.setItem('tutormatching.registration.email', email.trim());
        navigate('/auth/verify-email', {replace: true});
        return;
      }
      const message = reason instanceof GatewayError ? reason.message : 'Unable to reach TutorMatching. Try again.';
      setSubmitError(message); notifyAction(message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      screen={error ? 'sign-in-error' : 'sign-in'}
      slideNumber={error ? 9 : 1}
      slideTitle={error ? 'Try again — your learning space is waiting.' : 'Learn better, together.'}
    >
      <AuthHeader
        description="Log in to find your tutor or connect with students."
        title="Welcome back!"
      />
      <form className="auth-form" onSubmit={submit}>
        <TextField
          autoComplete="email"
          label="Email address"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email address"
          type="email"
          value={email}
        />
        <TextField
          autoComplete="current-password"
          error={submitError || undefined}
          label="Password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
          type="password"
          value={password}
        />
        <div className="auth-form__options">
          <label className="auth-checkbox">
            <input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" />
            <span>Remember me</span>
          </label>
          <Link to="/auth/forgot-password" viewTransition>Forgot password?</Link>
        </div>
        <Button disabled={submitting} fullWidth size="large" type="submit">
          {submitting ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
      <p className="auth-switch-link">
        Don’t have an account? <Link to="/auth/sign-up" viewTransition>Sign up</Link>
      </p>
    </AuthLayout>
  );
}

export function SignUpScreen() {
  const navigate = useMotionNavigate();
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'student' | 'tutor'>(() => sessionStorage.getItem('tutormatching.registration.role') === 'Tutor' ? 'tutor' : 'student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setSubmitError('Passwords do not match.');
      notifyAction('Passwords do not match.', 'error');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    const role = selectedRole === 'tutor' ? 'Tutor' : 'Student';
    try {
      await gatewayClient.register({ email, password, role, fullName: fullName.trim() });
      notifyAction('Account created. Check your email for the verification code.');
      window.sessionStorage.setItem('tutormatching.registration.name', fullName);
      sessionStorage.setItem('tutormatching.registration.email', email.trim());
      sessionStorage.setItem('tutormatching.registration.resendAt', String(Date.now() + 60000));
      sessionStorage.removeItem('tutormatching.registration.verified');
      navigate('/auth/verify-email', { replace: true, viewTransition: true });
    } catch (reason) {
      if (reason instanceof GatewayError && reason.code === 'email_verification_required') {
        sessionStorage.setItem('tutormatching.registration.email', email.trim());
        navigate('/auth/verify-email', {replace: true});
        return;
      }
      const message = reason instanceof GatewayError ? reason.message : 'The request could not finish. Check your connection. If a verification email arrived, continue verification below.';
      setSubmitError(message); notifyAction(message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      screen="sign-up"
      slideNumber={2}
      slideTitle="Your next learning milestone starts here."
    >
      <AuthHeader
        description="Join as a student or tutor and start learning."
        title="Create your account"
      />
      <form className="auth-form" onSubmit={submit}>
        <div className="auth-role-block">
          <p>Register as</p>
          <RoleSwitch onChange={setSelectedRole} value={selectedRole} />
        </div>
        <TextField autoComplete="name" label="Full name" onChange={(event) => setFullName(event.target.value)} placeholder="Enter your full name" required value={fullName} />
        <TextField autoComplete="email" label="Email address" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} />
        <TextField autoComplete="new-password" hint="Use at least 12 characters." label="Password" minLength={12} onChange={(event) => setPassword(event.target.value)} placeholder="Create a password" required type="password" value={password} />
        <TextField autoComplete="new-password" error={submitError || undefined} label="Confirm password" onChange={(event) => setConfirmation(event.target.value)} placeholder="Repeat your password" required type="password" value={confirmation} />
        <Button disabled={submitting} fullWidth size="large" type="submit">{submitting ? 'Creating account…' : 'Create account'}</Button>
        {submitError && email.trim() ? <Link className="auth-secondary-action" to="/auth/verify-email" onClick={() => sessionStorage.setItem('tutormatching.registration.email', email.trim())}>Continue email verification</Link> : null}
      </form>
      <p className="auth-legal-copy">
        By continuing, you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
      </p>
      <p className="auth-switch-link">Already have an account? <Link to="/auth/sign-in" viewTransition>Sign in</Link></p>
    </AuthLayout>
  );
}

export function ForgotPasswordScreen() {
 const navigate=useMotionNavigate();
 const [email,setEmail]=useState(()=>browserSession.load()?.email??sessionStorage.getItem('tutormatching.recoveryEmail')??'');
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{await gatewayClient.forgotPassword(email.trim());notifyAction('If the account exists, a password reset email has been sent.');sessionStorage.setItem('tutormatching.recoveryEmail',email.trim());navigate('/auth/check-email');}catch(e){const message=e instanceof Error?e.message:'Unable to send email.';setError(message);notifyAction(message,'error');}finally{setBusy(false);}}
 return <AuthLayout screen="forgot-password" slideNumber={3} slideTitle="We’ll help you get back on track."><AuthHeader description="Enter your email to request a one-time password reset link." title="Forgot password?"/><form className="auth-form" onSubmit={event=>void submit(event)}><TextField autoComplete="email" label="Email address" placeholder="you@example.com" type="email" required maxLength={320} value={email} onChange={e=>setEmail(e.target.value)}/>{error?<p role="alert" className="tm-field__message tm-field__message--error">{error}</p>:null}<Button fullWidth size="large" type="submit" disabled={busy}>{busy?'Sending…':'Send reset link'}</Button></form><Link className="auth-back-link" to="/auth/sign-in">← Back to sign in</Link></AuthLayout>;
}

export function CheckEmailScreen() {
 const [cooldown,setCooldown]=useState(60);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const email=sessionStorage.getItem('tutormatching.recoveryEmail')??'';
 useEffect(()=>{if(cooldown<=0)return;const timer=setTimeout(()=>setCooldown(value=>value-1),1000);return()=>clearTimeout(timer);},[cooldown]);
 async function resend(){if(!email||busy||cooldown>0)return;setBusy(true);setError('');try{await gatewayClient.forgotPassword(email);setCooldown(60);notifyAction('If the account exists, a new reset email has been sent.');}catch(e){const message=e instanceof Error?e.message:'Unable to resend email.';setError(message);notifyAction(message,'error');}finally{setBusy(false);}}
 return <AuthLayout screen="check-email" slideNumber={4} slideTitle="Secure recovery, without the stress."><AuthHeader description={`If an active account exists for ${email||'that address'}, a reset link will arrive shortly. The link expires in 30 minutes.`} title="Check your email"/><div className="auth-form auth-form--actions"><p>Check your inbox and spam folder. For the local demo, open Mailpit at localhost:8025.</p>{error?<p role="alert" className="tm-field__message tm-field__message--error">{error}</p>:null}<Button fullWidth disabled={!email||cooldown>0||busy} onClick={()=>void resend()} size="large">{busy?'Sending…':cooldown>0?`Resend in ${cooldown}s`:'Resend email'}</Button><Link className="auth-secondary-action" to="/auth/forgot-password">Use another email</Link><Link className="auth-secondary-action" to="/auth/sign-in">Back to sign in</Link></div></AuthLayout>;
}

export function ResetPasswordScreen() {
 const [token]=useState(()=>new URLSearchParams(window.location.search).get('token')??'');
 const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [busy,setBusy]=useState(false);const [done,setDone]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{if(token)window.history.replaceState(window.history.state,'',window.location.pathname);},[token]);
 async function submit(event:FormEvent){event.preventDefault();if(password!==confirm){setError('Passwords do not match.');return;}setBusy(true);setError('');try{await gatewayClient.resetPassword(token,password);notifyAction('Password updated successfully. You can now sign in.');browserSession.clear();sessionStorage.removeItem('tutormatching.recoveryEmail');setDone(true);}catch(e){const message=e instanceof Error?e.message:'Unable to reset password.';setError(message);notifyAction(message,'error');}finally{setBusy(false);}}
 return <AuthLayout screen="reset-password" slideNumber={5} slideTitle="A fresh password keeps your learning safe."><AuthHeader description={done?'Your password has been updated. Sign in with your new password.':'Choose a password with 12–128 characters.'} title={done?'Password updated':'Create a new password'}/>{done?<Link className="auth-secondary-action" to="/auth/sign-in">Back to sign in →</Link>:!token?<div className="auth-form"><p role="alert">Open the reset link from your email. This page needs a valid link.</p><Link to="/auth/forgot-password">Request a new reset link</Link></div>:<form className="auth-form" onSubmit={event=>void submit(event)}><TextField autoComplete="new-password" label="New password" type="password" required minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/><TextField autoComplete="new-password" label="Confirm password" type="password" required minLength={12} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)}/>{error?<p role="alert" className="tm-field__message tm-field__message--error">{error}</p>:null}<Button fullWidth size="large" type="submit" disabled={busy}>{busy?'Updating…':'Reset password'}</Button><Link to="/auth/forgot-password">Request a new reset link</Link></form>}</AuthLayout>;
}

export function VerifyEmailScreen() {
  const navigate = useMotionNavigate();
  const [email] = useState(() => sessionStorage.getItem('tutormatching.registration.email') ?? '');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(() => Math.max(0, Math.ceil((Number(sessionStorage.getItem('tutormatching.registration.resendAt') ?? 0) - Date.now()) / 1000)));
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!verified) return;
    const timer = window.setTimeout(() => navigate('/auth/sign-in', {replace: true}), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [verified, navigate]);

  function updateDigit(index: number, event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value.replace(/\D/g, '').slice(-1);
    setDigits(current => current.map((digit, position) => position === index ? value : digit));
    if (value && index < 5) inputs.current[index + 1]?.focus();
  }
  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await gatewayClient.verifyEmail(email.trim(), digits.join(''));
      sessionStorage.removeItem('tutormatching.registration.email');
      sessionStorage.removeItem('tutormatching.registration.resendAt');
      setVerified(true);
      notifyAction('Email verified successfully. Redirecting to sign in in 3 seconds.');
    } catch (reason) { const message = reason instanceof Error ? reason.message : 'Unable to verify email.'; setError(message); notifyAction(message, 'error'); }
    finally { setBusy(false); }
  }
  async function resend() {
    if (verified || cooldown > 0 || !email.trim()) return;
    setResending(true); setError('');
    try {
      await gatewayClient.resendVerification(email.trim());
      sessionStorage.setItem('tutormatching.registration.email', email.trim());
      sessionStorage.setItem('tutormatching.registration.resendAt', String(Date.now() + 60000));
      setCooldown(60); setDigits(['', '', '', '', '', '']);
      notifyAction('If your account needs verification, a new code has been sent.');
    } catch (reason) { const message = reason instanceof Error ? reason.message : 'Unable to resend code.'; setError(message); notifyAction(message, 'error'); }
    finally { setResending(false); }
  }
  return (
    <AuthLayout screen="verify-email" slideNumber={6} slideTitle="One quick step to protect your account.">
      <AuthHeader description={verified ? "Email verified successfully. You will be redirected to sign in in 3 seconds." : "Enter the 6-digit code sent to your email. It expires in 10 minutes."} title="Verify your email" />
      <form className="auth-form" onSubmit={event => void submit(event)}>
        <TextField label="Email address" type="email" autoComplete="email" readOnly value={email} hint={email ? undefined : "Return to registration or sign in to continue email verification."} />
        <div className="auth-otp" role="group" aria-label="Six-digit verification code" onPaste={event => {
          const code = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
          if (!code) return;
          event.preventDefault(); setDigits(Array.from({length: 6}, (_, index) => code[index] ?? ''));
          inputs.current[Math.min(code.length, 5)]?.focus();
        }}>
          {digits.map((digit, index) => <input
            aria-label={`Verification digit ${index + 1}`} autoComplete={index === 0 ? 'one-time-code' : 'off'}
            inputMode="numeric" key={index} maxLength={1} disabled={busy || verified} required pattern="[0-9]" value={digit}
            onChange={event => updateDigit(index, event)} onKeyDown={event => handleKeyDown(index, event)}
            ref={node => { inputs.current[index] = node; }}
          />)}
        </div>
        {error ? <p role="alert" className="tm-field__message tm-field__message--error">{error}</p> : null}
        <Button fullWidth size="large" type="submit" disabled={busy || resending || verified || !email || digits.some(digit => !digit)}>{verified ? 'Email verified' : busy ? 'Verifying…' : 'Verify email'}</Button>
        <Button fullWidth variant="secondary" type="button" disabled={busy || resending || verified || cooldown > 0 || !email} onClick={() => void resend()}>{resending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</Button>
        <Link className="auth-secondary-action" to="/auth/sign-up">Back to registration to change email</Link>
        <Link className="auth-secondary-action" to="/auth/sign-in">Back to sign in</Link>
      </form>
    </AuthLayout>
  );
}

type AccountRole = 'Student' | 'Tutor';

export function ChooseRoleScreen() {
  const [role, setRole] = useState<AccountRole>('Student');
  const navigate = useMotionNavigate();

  function continueWith(selectedRole: AccountRole) {
    window.sessionStorage.setItem('tutormatching.registration.role', selectedRole);
    navigate('/auth/sign-up', { viewTransition: true });
  }

  return (
    <AuthLayout screen="choose-role" slideNumber={7} slideTitle="One platform, two paths to progress.">
      <AuthHeader
        description="Choose a role now. You can complete your profile next."
        title="How will you use Teach.?"
      />
      <div className="auth-role-cards">
        <button aria-pressed={role === 'Student'} className={role === 'Student' ? 'is-active' : ''} onClick={() => setRole('Student')} type="button">
          <span className="auth-role-cards__icon" aria-hidden="true">◎</span>
          <span><strong>Student</strong><small>Find tutors, book lessons, track progress</small></span>
          <span className="auth-role-cards__radio" aria-hidden="true" />
        </button>
        <button aria-pressed={role === 'Tutor'} className={role === 'Tutor' ? 'is-active' : ''} onClick={() => setRole('Tutor')} type="button">
          <span className="auth-role-cards__icon" aria-hidden="true">◇</span>
          <span><strong>Tutor</strong><small>Teach, manage availability, grow</small></span>
          <span className="auth-role-cards__radio" aria-hidden="true" />
        </button>
      </div>
      <div className="auth-role-actions">
        <Button fullWidth onClick={() => continueWith(role)} size="large">Continue as {role}</Button>
        <Button fullWidth onClick={() => continueWith(role === 'Student' ? 'Tutor' : 'Student')} size="large" variant="secondary">Continue as {role === 'Student' ? 'Tutor' : 'Student'}</Button>
      </div>
    </AuthLayout>
  );
}

export function SessionExpiredScreen() {
  return (
    <AuthLayout screen="session-expired" slideNumber={8} slideTitle="Your account stays protected at every step.">
      <AuthHeader
        description="For your security, please sign in again to continue."
        title="Session expired"
      />
      <form className="auth-form" onSubmit={(event) => event.preventDefault()}>
        <TextField defaultValue="minh@example.com" label="Email address" type="email" />
        <TextField label="Password" placeholder="Enter password" type="password" />
        <Button fullWidth size="large" type="submit">Sign in again</Button>
        <p className="auth-safe-note"><span aria-hidden="true">✓</span>Your unsaved changes are safely preserved.</p>
      </form>
    </AuthLayout>
  );
}

export const authRoutes = [
  { path: '/auth/sign-in', element: <SignInScreen /> },
  { path: '/auth/sign-up', element: <SignUpScreen /> },
  { path: '/auth/forgot-password', element: <ForgotPasswordScreen /> },
  { path: '/auth/check-email', element: <CheckEmailScreen /> },
  { path: '/auth/reset-password', element: <ResetPasswordScreen /> },
  { path: '/auth/verify-email', element: <VerifyEmailScreen /> },
  { path: '/auth/choose-role', element: <ChooseRoleScreen /> },
  { path: '/auth/session-expired', element: <SessionExpiredScreen /> },
  { path: '/auth/sign-in-error', element: <SignInScreen error /> },
];
