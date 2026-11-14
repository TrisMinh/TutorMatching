import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../design-system/Button';
import { TextField } from '../../design-system/TextField';
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

function RoleSwitch() {
  const [role, setRole] = useState<'student' | 'tutor'>('student');

  return (
    <div className="auth-role-switch" aria-label="Continue as" role="group">
      <button
        aria-pressed={role === 'student'}
        className={role === 'student' ? 'is-active' : ''}
        onClick={() => setRole('student')}
        type="button"
      >
        I’m a student
      </button>
      <button
        aria-pressed={role === 'tutor'}
        className={role === 'tutor' ? 'is-active' : ''}
        onClick={() => setRole('tutor')}
        type="button"
      >
        I’m a tutor
      </button>
    </div>
  );
}

export function SignInScreen({ error = false }: { error?: boolean }) {
  return (
    <AuthLayout
      screen={error ? 'sign-in-error' : 'sign-in'}
      slideNumber={error ? 9 : 1}
      slideTitle={error ? 'Try again — your learning space is waiting.' : 'Learn better, together.'}
    >
      <AuthHeader
        description="Sign in to continue to your TutorMatching account."
        title="Welcome back!"
      />
      <div className="auth-role-block">
        <p>Continue as</p>
        <RoleSwitch />
      </div>
      <form className="auth-form" onSubmit={(event) => event.preventDefault()}>
        <TextField
          autoComplete="email"
          defaultValue={error ? 'minh@example.com' : undefined}
          label="Email address"
          placeholder="you@example.com"
          type="email"
        />
        <TextField
          autoComplete="current-password"
          error={error ? 'Email or password is incorrect.' : undefined}
          label="Password"
          placeholder="Enter password"
          type="password"
        />
        <div className="auth-form__options">
          <label className="auth-checkbox">
            <input type="checkbox" />
            <span>Remember me</span>
          </label>
          <Link to="/auth/forgot-password">Forgot password?</Link>
        </div>
        <Button fullWidth size="large" type="submit">
          Sign in
        </Button>
      </form>
      <p className="auth-switch-link">
        New here? <Link to="/auth/sign-up">Create account</Link>
      </p>
    </AuthLayout>
  );
}

export function SignUpScreen() {
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
      <form className="auth-form" onSubmit={(event) => event.preventDefault()}>
        <TextField autoComplete="name" label="Full name" placeholder="Enter your full name" />
        <TextField autoComplete="email" label="Email address" placeholder="you@example.com" type="email" />
        <TextField autoComplete="new-password" label="Password" placeholder="Create a password" type="password" />
        <TextField autoComplete="new-password" label="Confirm password" placeholder="Repeat your password" type="password" />
        <Button fullWidth size="large" type="submit">Create account</Button>
      </form>
      <p className="auth-legal-copy">
        By continuing, you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
      </p>
      <p className="auth-switch-link">Already have an account? <Link to="/auth/sign-in">Sign in</Link></p>
    </AuthLayout>
  );
}

export function ForgotPasswordScreen() {
  return (
    <AuthLayout screen="forgot-password" slideNumber={3} slideTitle="We’ll help you get back on track.">
      <AuthHeader
        description="Enter your email and we’ll send a secure reset link."
        title="Forgot password?"
      />
      <form className="auth-form" onSubmit={(event) => event.preventDefault()}>
        <TextField autoComplete="email" label="Email address" placeholder="you@example.com" type="email" />
        <Button fullWidth size="large" type="submit">Send reset link</Button>
      </form>
      <p className="auth-switch-link">Remembered it? <Link to="/auth/sign-in">Back to sign in</Link></p>
      <Link className="auth-back-link" to="/auth/sign-in">← <span>Back to sign in</span></Link>
    </AuthLayout>
  );
}

export function CheckEmailScreen() {
  return (
    <AuthLayout screen="check-email" slideNumber={4} slideTitle="Secure recovery, without the stress.">
      <AuthHeader
        description="A password reset link has been sent to minh@example.com."
        title="Check your email"
      />
      <div className="auth-form auth-form--actions">
        <Button fullWidth size="large">Open email app</Button>
        <p>Didn’t receive it? <button type="button">Resend in 00:48</button></p>
        <Link className="auth-secondary-action" to="/auth/forgot-password">Use another email</Link>
      </div>
    </AuthLayout>
  );
}

export function ResetPasswordScreen() {
  return (
    <AuthLayout screen="reset-password" slideNumber={5} slideTitle="A fresh password keeps your learning safe.">
      <AuthHeader
        description="Use a strong password you have not used before."
        title="Create a new password"
      />
      <form className="auth-form" onSubmit={(event) => event.preventDefault()}>
        <TextField autoComplete="new-password" label="New password" placeholder="Create a new password" type="password" />
        <TextField autoComplete="new-password" label="Confirm password" placeholder="Repeat your new password" type="password" />
        <Button fullWidth size="large" type="submit">Reset password</Button>
        <p className="auth-hint">Password must include a number and uppercase letter.</p>
      </form>
    </AuthLayout>
  );
}

export function VerifyEmailScreen() {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  function updateDigit(index: number, event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value.replace(/\D/g, '').slice(-1);
    setDigits((current) => current.map((digit, position) => (position === index ? value : digit)));
    if (value && index < inputs.current.length - 1) inputs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
  }

  return (
    <AuthLayout screen="verify-email" slideNumber={6} slideTitle="One quick step to protect your account.">
      <AuthHeader
        description="Enter the 6-digit code sent to minh@example.com."
        title="Verify your email"
      />
      <form className="auth-form" onSubmit={(event) => event.preventDefault()}>
        <div className="auth-otp">
          {digits.map((digit, index) => (
            <input
              aria-label={`Verification digit ${index + 1}`}
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              inputMode="numeric"
              key={index}
              maxLength={1}
              onChange={(event) => updateDigit(index, event)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              ref={(node) => { inputs.current[index] = node; }}
              value={digit}
            />
          ))}
        </div>
        <Button fullWidth size="large" type="submit">Verify email</Button>
        <p className="auth-hint auth-hint--center">Resend code in 00:48</p>
        <Link className="auth-secondary-action" to="/auth/forgot-password">Change email</Link>
      </form>
    </AuthLayout>
  );
}

type AccountRole = 'Student' | 'Tutor';

export function ChooseRoleScreen() {
  const [role, setRole] = useState<AccountRole>('Student');

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
        <Button fullWidth size="large">Continue as {role}</Button>
        <Button fullWidth size="large" variant="secondary">Continue as {role === 'Student' ? 'Tutor' : 'Student'}</Button>
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
