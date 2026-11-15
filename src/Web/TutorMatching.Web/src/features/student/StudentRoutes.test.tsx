import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { gatewayClient } from '../../api';
import { App } from '../../app/App';


const subject = {id:'11111111-1111-4111-8111-111111111111',code:'MATH',name:'Mathematics'};
const tutor = {id:'22222222-2222-4222-8222-222222222222',displayName:'Nguyen Minh Anh',bio:'Persisted tutor bio',experienceYears:5,subjects:[{subjectId:subject.id,proficiencyLevel:2}],availability:[]};
beforeEach(()=>{
 vi.spyOn(gatewayClient,'getStudentProfile').mockResolvedValue({id:'student',userId:'user',displayName:'Test Student',educationLevel:2,learningGoal:'Practice',timezone:'Asia/Ho_Chi_Minh',status:'Active',version:1,interests:[]});
 vi.spyOn(gatewayClient,'listSubjects').mockResolvedValue([subject,{id:'english',code:'ENGLISH',name:'English'}]);
 vi.spyOn(gatewayClient,'listBookings').mockResolvedValue([]);
 vi.spyOn(gatewayClient,'listCourses').mockResolvedValue([]);
 vi.spyOn(gatewayClient,'listMyCourses').mockResolvedValue([]);
 vi.spyOn(gatewayClient,'getTutor').mockResolvedValue(tutor);
 vi.spyOn(gatewayClient,'searchTutors').mockResolvedValue({items:[tutor,{...tutor,id:'33333333-3333-4333-8333-333333333333',displayName:'Tran Thu Ha',subjects:[{subjectId:'english',proficiencyLevel:2}]}],page:1,pageSize:100,total:2});
});
afterEach(()=>vi.restoreAllMocks());

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
    ['/student/dashboard', 'Welcome, Test Student'],
    ['/student/complete-profile', 'Your learning profile'],
    ['/student/find-tutors', 'Find the right tutor'],
    ['/student/tutors/22222222-2222-4222-8222-222222222222', 'Tutor profile'],
    ['/student/book/select-schedule', 'Book a lesson'],
    ['/student/book/review', 'Review your booking'],
    ['/student/book/confirmed', 'Booking confirmed'],
    ['/student/bookings', 'My bookings'],
    ['/student/bookings/44444444-4444-4444-8444-444444444444', 'Booking details'],
    ['/student/notifications', 'Notifications'],
    ['/student/profile', 'My profile'],
    ['/student/settings', 'Settings'],
  ])('renders %s with heading %s', async (path, heading) => {
    renderAt(path);
    expect(await screen.findByRole('heading', { name: heading }, {timeout: 3500})).toBeInTheDocument();
  });

  it('filters tutors from the Figma search field', async () => {
    const user = userEvent.setup();
    renderAt('/student/find-tutors');

    await screen.findByPlaceholderText('Search by subject, tutor name, or keyword');
    await user.type(screen.getByPlaceholderText('Search by subject, tutor name, or keyword'), 'English');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getAllByText('Tran Thu Ha').length).toBeGreaterThan(0);
    expect(screen.queryByText('Nguyen Minh Anh')).not.toBeInTheDocument();
  });

  it('uses composed availability when the approved today filter is selected', async () => {
    const user = userEvent.setup();
    const subject = { id: '11111111-1111-1111-1111-111111111111', code: 'MATH', name: 'Mathematics' };
    vi.spyOn(gatewayClient, 'listSubjects').mockResolvedValue([subject]);
    vi.spyOn(gatewayClient, 'searchTutors').mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0 });
    const available = vi.spyOn(gatewayClient, 'searchAvailableTutors').mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0, generatedAtUtc: '2026-11-14T00:00:00Z', partial: false });
    renderAt('/student/find-tutors');

    await user.click(await screen.findByRole('combobox', {name:'Subject'}));
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

  it('does not offer fake time slots when no tutor has been selected', async () => {
    renderAt('/student/book/select-schedule');
    expect(await screen.findByText('Select a tutor before booking a lesson.')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: '15:30'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Continue'})).not.toBeInTheDocument();
  });

  it('toggles an account preference accessibly', async () => {
    const user = userEvent.setup();
    vi.spyOn(gatewayClient,'getSettings').mockResolvedValue({emailReminders:true,inAppNotifications:true,enrollmentAlerts:true,profileVisible:true,cancellationNoticeHours:12,version:0});
    renderAt('/student/settings');
    const marketing = await screen.findByRole('switch', { name: 'Email reminders' });

    await waitFor(()=>expect(marketing).toBeEnabled());
    expect(marketing).toHaveAttribute('aria-checked', 'true');
    await user.click(marketing);
    expect(marketing).toHaveAttribute('aria-checked', 'false');
    vi.restoreAllMocks();
  });
  it('loads an existing learning profile without replacing saved fields or subjects', async () => {
    vi.spyOn(gatewayClient,'getStudentProfile').mockResolvedValue({id:'student',userId:'user',displayName:'Existing learner',educationLevel:'University',learningGoal:'Keep this learning goal',timezone:'Europe/London',status:'Active',version:3,interests:[{subjectId:subject.id,priority:1}]});
    renderAt('/student/complete-profile');
    await waitFor(()=>expect(screen.getByLabelText('Display name')).toHaveValue('Existing learner'));
    expect(screen.getByLabelText('Learning goal')).toHaveValue('Keep this learning goal');
    expect(screen.getByRole('combobox',{name:'School level'})).toHaveTextContent('University');
    expect(screen.getByRole('checkbox',{name:'Mathematics'})).toBeChecked();
  });

  it('saves the registration name without requiring a level, goal or subjects', async () => {
    const user=userEvent.setup();
    vi.spyOn(gatewayClient,'getStudentProfile').mockResolvedValue({id:'student',userId:'user',displayName:'Registered learner',educationLevel:'Unspecified',learningGoal:'',timezone:'Asia/Ho_Chi_Minh',status:'Active',version:1,interests:[]});
    vi.spyOn(gatewayClient,'listSubjects').mockRejectedValue(new Error('Temporarily unavailable'));
    const save=vi.spyOn(gatewayClient,'saveStudentProfile').mockResolvedValue({id:'student',userId:'user',displayName:'Registered learner',version:2});
    const interests=vi.spyOn(gatewayClient,'saveStudentInterests');
    renderAt('/student/complete-profile');
    await waitFor(()=>expect(screen.getByLabelText('Display name')).toHaveValue('Registered learner'));
    await user.click(screen.getByRole('button',{name:'Save changes'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith({displayName:'Registered learner',educationLevel:-1,learningGoal:'',timezone:'Asia/Ho_Chi_Minh'}));
    expect(interests).not.toHaveBeenCalled();
  });

  it('prevents saving when an existing profile could not be loaded', async () => {
    vi.spyOn(gatewayClient,'getStudentProfile').mockRejectedValue({status:503});
    const save=vi.spyOn(gatewayClient,'saveStudentProfile');
    renderAt('/student/complete-profile');
    expect(await screen.findByRole('button',{name:'Retry loading profile'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Save changes'})).toBeDisabled();
    expect(save).not.toHaveBeenCalled();
  });

});
