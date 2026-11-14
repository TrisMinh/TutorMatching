import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../app/App';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('shared states from Figma', () => {
  it.each([
    ['/states/loading', 'Loading your content'],
    ['/states/empty-bookings', 'No bookings yet'],
    ['/states/no-results', 'No tutors found'],
    ['/states/offline', 'You’re offline'],
    ['/states/403', 'Access denied'],
    ['/states/404', 'Page not found'],
    ['/states/500', 'Something went wrong'],
    ['/states/booking-conflict', 'Time slot unavailable'],
    ['/states/booking-success', 'Booking confirmed'],
    ['/states/session-expired', 'Session expired'],
    ['/states/rate-limited', 'Too many attempts'],
    ['/states/maintenance', 'Scheduled maintenance'],
    ['/states/cancel-confirmation', 'Cancel this booking?'],
    ['/states/validation', 'Form validation'],
    ['/states/toasts', 'Changes saved'],
    ['/states/booking-hold', 'Your slot is on hold'],
  ])('renders %s with the exact Figma content', (path, heading) => {
    renderAt(path);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('keeps the offline recovery action accessible', () => {
    renderAt('/states/offline');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('renders both cancel-confirmation actions', () => {
    renderAt('/states/cancel-confirmation');
    expect(screen.getByRole('button', { name: 'Keep booking' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeInTheDocument();
  });

  it('exposes the validation states to assistive technology', () => {
    renderAt('/states/validation');
    expect(screen.getByRole('textbox', { name: 'Email address' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText('Full name')).toHaveAttribute('aria-invalid', 'false');
  });

  it('announces the toast stack and booking countdown', () => {
    renderAt('/states/toasts');
    expect(screen.getByRole('status', { name: 'Changes saved' })).toBeInTheDocument();
    expect(screen.getByRole('alert', { name: 'Could not save changes' })).toBeInTheDocument();

    renderAt('/states/booking-hold');
    expect(screen.getByRole('timer')).toHaveTextContent('09:42');
  });
});
