import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../app/App';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('authentication routes from Figma', () => {
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
});
