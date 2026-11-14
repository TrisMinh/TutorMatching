import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { gatewayClient } from '../../api';
import { App } from '../../app/App';

function renderAt(path: string) {
  window.sessionStorage.setItem('tutormatching.auth.session', JSON.stringify({ accessToken: 'test', refreshToken: 'test', role: 'Student' }));
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

  it('uses composed availability when the approved today filter is selected', async () => {
    const user = userEvent.setup();
    const subject = { id: '11111111-1111-1111-1111-111111111111', code: 'MATH', name: 'Mathematics' };
    vi.spyOn(gatewayClient, 'listSubjects').mockResolvedValue([subject]);
    vi.spyOn(gatewayClient, 'searchTutors').mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0 });
    const available = vi.spyOn(gatewayClient, 'searchAvailableTutors').mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0, generatedAtUtc: '2026-11-14T00:00:00Z', partial: false });
    renderAt('/student/find-tutors');

    await user.click(screen.getByRole('combobox', {name:'Subject'}));
    await user.click(await screen.findByRole('option', {name:'Mathematics'}));
    await user.click(screen.getByRole('combobox', {name:'Availability'}));
    await user.click(screen.getByRole('option', {name:'Available today'}));

    await waitFor(() => expect(available).toHaveBeenCalledWith(expect.objectContaining({
      subjectId: subject.id,
      timezone: 'Asia/Ho_Chi_Minh',
    })));
    expect(screen.getByRole('combobox', { name: 'Availability' })).toHaveTextContent('Available today');
    vi.restoreAllMocks();
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
