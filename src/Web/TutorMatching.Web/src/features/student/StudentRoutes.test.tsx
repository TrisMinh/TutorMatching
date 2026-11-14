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

describe('student routes from Figma', () => {
  it.each([
    ['/student/dashboard', 'Good morning, Minh'],
    ['/student/complete-profile', 'Complete your student profile'],
    ['/student/find-tutors', 'Find the right tutor'],
    ['/student/tutors/minh-anh', 'Tutor profile'],
    ['/student/book/select-schedule', 'Book a lesson'],
    ['/student/book/review', 'Review your booking'],
    ['/student/book/confirmed', 'Booking confirmed'],
    ['/student/bookings', 'My bookings'],
    ['/student/bookings/TM-20261118-1042', 'Booking details'],
    ['/student/notifications', 'Notifications'],
    ['/student/profile', 'My profile'],
    ['/student/settings', 'Settings'],
  ])('renders %s with heading %s', (path, heading) => {
    renderAt(path);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('filters tutors from the Figma search field', async () => {
    const user = userEvent.setup();
    renderAt('/student/find-tutors');

    await user.type(screen.getByPlaceholderText('Search by subject, tutor name, or keyword'), 'English');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByText('Tran Thu Ha')).toBeInTheDocument();
    expect(screen.queryByText('Nguyen Minh Anh')).not.toBeInTheDocument();
  });

  it('changes the selected lesson time', async () => {
    const user = userEvent.setup();
    renderAt('/student/book/select-schedule');
    const time = screen.getByRole('button', { name: '15:30' });

    await user.click(time);
    expect(time).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles an account preference accessibly', async () => {
    const user = userEvent.setup();
    renderAt('/student/settings');
    const marketing = screen.getByRole('switch', { name: 'Marketing updates' });

    expect(marketing).toHaveAttribute('aria-checked', 'false');
    await user.click(marketing);
    expect(marketing).toHaveAttribute('aria-checked', 'true');
  });
});
