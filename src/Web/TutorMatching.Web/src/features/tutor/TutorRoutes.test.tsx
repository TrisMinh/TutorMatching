import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../app/App';
import { gatewayClient } from '../../api';

beforeEach(()=>{
 vi.spyOn(gatewayClient,'getMyTutorProfile').mockResolvedValue({id:'teacher',displayName:'Minh Anh',bio:'Teacher bio',experienceYears:5,subjects:[],availability:[]});
 vi.spyOn(gatewayClient,'listMyCourses').mockResolvedValue([]);
 vi.spyOn(gatewayClient,'listBookings').mockResolvedValue([]);
 vi.spyOn(gatewayClient,'listSubjects').mockResolvedValue([]);
});
afterEach(()=>vi.restoreAllMocks());

function renderAt(path: string) {
  window.sessionStorage.setItem('tutormatching.auth.session', JSON.stringify({ accessToken: 'test', refreshToken: 'test', role: 'Tutor' }));
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

describe('tutor routes from Figma', () => {
  it('keeps the calendar on Dashboard without a duplicate Schedule menu item',async()=>{
    renderAt('/tutor/dashboard');
    expect(screen.queryByRole('link',{name:'Schedule'})).not.toBeInTheDocument();
    expect(await screen.findByRole('link',{name:'Dashboard'})).toHaveAttribute('href','/tutor/dashboard');
  });
  it.each([
    ['/tutor/dashboard', 'Good morning, Minh Anh'],
    ['/tutor/onboarding', 'Set up your tutor profile'],
    ['/tutor/subjects-pricing', 'Teaching subjects'],
    ['/tutor/availability', 'Availability'],
    ['/tutor/requests', 'My bookings'],
    ['/tutor/schedule', 'Good morning, Minh Anh'],
    ['/tutor/lessons/18-nov-math', 'Lesson details'],
    ['/tutor/public-profile', 'Public profile preview'],
    ['/tutor/notifications', 'Notifications'],
    ['/tutor/settings', 'Settings'],
  ])('renders %s with heading %s', async (path, heading) => {
    renderAt(path);
    expect(await screen.findByRole('heading', { name: heading }, {timeout:3500})).toBeInTheDocument();
    expect(screen.getByText('Tutor mode')).toBeInTheDocument();
  });

  it('shows persisted booking states without fake approval actions', async () => {
    renderAt('/tutor/requests');
    expect(await screen.findByText('No upcoming bookings.')).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Accept'})).not.toBeInTheDocument();
  });

  it('requires saving an added future availability block', async () => {
    const user = userEvent.setup();
    renderAt('/tutor/availability');
    await screen.findByRole('heading',{name:'Saved availability'});
    await user.clear(screen.getByLabelText('Date',{exact:true}));
    await user.type(screen.getByLabelText('Date',{exact:true}),'2099-01-01');
    await user.click(screen.getByRole('button', { name: 'Add time block' }));
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Save availability'})).toBeEnabled();
  });

  it('toggles a tutor preference', async () => {
    const user = userEvent.setup();
    vi.spyOn(gatewayClient,'getSettings').mockResolvedValue({emailReminders:true,inAppNotifications:true,enrollmentAlerts:true,profileVisible:true,cancellationNoticeHours:12,version:0});
    renderAt('/tutor/settings');
    const toggle = await screen.findByRole('switch', { name: 'Email reminders' });
    await waitFor(()=>expect(toggle).toBeEnabled());
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });
});
