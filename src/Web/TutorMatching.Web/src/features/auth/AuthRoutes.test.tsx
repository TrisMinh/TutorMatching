import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../app/App';
import { GatewayError, gatewayClient } from '../../api';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('authentication routes from Figma', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['/auth/sign-in', 'Welcome back!'],
    ['/auth/sign-up', 'Create your account'],
    ['/auth/forgot-password', 'Forgot password?'],
    ['/auth/check-email', 'Check your email'],
    ['/auth/reset-password', 'Create a new password'],
    ['/auth/verify-email', 'Verify your email'],
    ['/auth/choose-role', 'How will you use Teach.?'],
    ['/auth/session-expired', 'Session expired'],
  ])('renders %s with heading %s', (path, heading) => {
    renderAt(path);

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByText('Find the right tutor.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next slide' })).toBeInTheDocument();
  });

  it('changes the selected role and continue action together', async () => {
    const user = userEvent.setup();
    renderAt('/auth/choose-role');

    const tutor = screen.getByRole('button', { name: /Tutor Teach, manage availability, grow/i });
    await user.click(tutor);

    expect(tutor).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Continue as Tutor' })).toBeInTheDocument();
  });

  it('keeps the sign-in error attached to the password field', () => {
    renderAt('/auth/sign-in-error');

    expect(screen.getByRole('heading', { name: 'Welcome back!' })).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      'Email or password is incorrect.',
    );
  });

  it('moves focus through six verification digits', async () => {
    const user = userEvent.setup();
    renderAt('/auth/verify-email');

    const firstDigit = screen.getByLabelText('Verification digit 1');
    const secondDigit = screen.getByLabelText('Verification digit 2');
    await user.type(firstDigit, '4');

    expect(firstDigit).toHaveValue('4');
    expect(secondDigit).toHaveFocus();
  });

  it('signs in through the Gateway and routes by the account role', async () => {
    const user = userEvent.setup();
    vi.spyOn(gatewayClient, 'login').mockImplementation(async () => {
      window.sessionStorage.setItem('tutormatching.auth.session', JSON.stringify({ accessToken: 'access', refreshToken: 'refresh', role: 'Student', email: 'minh@example.com' }));
      return {
      tokens: { accessToken: 'access', refreshToken: 'refresh', role: 'Student', email: 'minh@example.com' },
      user: {
        userId: '11111111-1111-1111-1111-111111111111',
        email: 'minh@example.com',
        role: 'Student',
      }};
    });
    renderAt('/auth/sign-in');

    await user.type(screen.getByLabelText('Email address'), 'minh@example.com');
    await user.type(screen.getByLabelText('Password'), 'TutorMatching!123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(gatewayClient.login).toHaveBeenCalledWith(
      { email: 'minh@example.com', password: 'TutorMatching!123' },
      false,
    );
    expect(await screen.findByRole('heading', { name: 'Good morning, Minh' })).toBeInTheDocument();
  });

  it('shows the Gateway authentication failure on the password field', async () => {
    const user = userEvent.setup();
    vi.spyOn(gatewayClient, 'login').mockRejectedValue(
      new GatewayError(401, { detail: 'Invalid credentials or session.' }),
    );
    renderAt('/auth/sign-in');

    await user.type(screen.getByLabelText('Email address'), 'minh@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByLabelText('Password')).toHaveAccessibleDescription(
      'Invalid credentials or session.',
    );
  });
});
