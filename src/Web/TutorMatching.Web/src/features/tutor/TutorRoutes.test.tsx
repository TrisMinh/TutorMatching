import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../app/App';

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

describe('tutor routes from Figma', () => {
  it.each([
    ['/tutor/dashboard', 'Welcome back, Minh Anh'],
    ['/tutor/onboarding', 'Set up your tutor profile'],
    ['/tutor/subjects-pricing', 'Subjects and pricing'],
    ['/tutor/availability', 'Availability'],
    ['/tutor/requests', 'Booking requests'],
    ['/tutor/schedule', 'Schedule'],
    ['/tutor/lessons/18-nov-math', 'Lesson details'],
    ['/tutor/public-profile', 'Public profile preview'],
    ['/tutor/notifications', 'Notifications'],
    ['/tutor/settings', 'Settings'],
  ])('renders %s with heading %s', (path, heading) => {
    renderAt(path);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByText('Tutor mode')).toBeInTheDocument();
  });

  it('moves a booking request to the accepted state', async () => {
    const user = userEvent.setup();
    renderAt('/tutor/requests');
    await user.click(screen.getAllByRole('button', { name: 'Accept' })[0]);
    expect(screen.getByText('Request accepted')).toBeInTheDocument();
  });

  it('adds the configured availability block', async () => {
    const user = userEvent.setup();
    renderAt('/tutor/availability');
    await user.click(screen.getByRole('button', { name: 'Add time block' }));
    expect(screen.getByText('09:00 – 12:00 added')).toBeInTheDocument();
  });

  it('toggles a tutor preference', async () => {
    const user = userEvent.setup();
    renderAt('/tutor/settings');
    const toggle = screen.getByRole('switch', { name: 'Auto-accept repeat students' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});
