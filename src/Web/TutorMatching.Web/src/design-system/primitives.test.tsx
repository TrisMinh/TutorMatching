import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';
import { StatusBadge } from './StatusBadge';
import { Surface } from './Surface';
import { TextField } from './TextField';

describe('Figma design-system primitives', () => {
  it('prevents a disabled primary action from firing', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Continue
      </Button>,
    );

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('reveals and hides a password without replacing the labelled input', async () => {
    const user = userEvent.setup();
    render(<TextField label="Password" name="password" type="password" />);

    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('describes an error with text instead of color alone', () => {
    render(<TextField error="Enter a valid email address." label="Email address" name="email" />);

    const input = screen.getByLabelText('Email address');
    expect(input).toHaveAccessibleDescription('Enter a valid email address.');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
  });

  it('renders status text and a semantic surface region', () => {
    render(
      <Surface aria-label="Booking summary">
        <StatusBadge status="confirmed" />
      </Surface>,
    );

    expect(screen.getByRole('region', { name: 'Booking summary' })).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });
});
