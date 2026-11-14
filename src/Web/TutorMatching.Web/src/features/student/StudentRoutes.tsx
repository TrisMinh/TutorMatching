import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { gatewayClient, type Booking, type NotificationItem, type Subject, type TutorProfile } from '../../api';
import { useGatewayResource } from '../../api/useGatewayResource';
import { Button } from '../../design-system/Button';
import { TextField } from '../../design-system/TextField';
import { AppShell } from '../../shared/AppShell';
import { studentBookings, studentNotifications, studentTutors } from '../../shared/fixtures';
import './student.css';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type TutorCard = (typeof studentTutors)[number] & { bio?: string; source?: TutorProfile };
type BookingCard = (typeof studentBookings)[number] & { id?: string };

function mapTutor(profile: TutorProfile, index: number, subjects: Subject[]): TutorCard {
  const presentation = studentTutors[index % studentTutors.length];
  const subjectNames = profile.subjects
    .map((item) => subjects.find((subject) => subject.id === item.subjectId)?.name)
    .filter(Boolean)
    .join(' • ');
  return {
    ...presentation,
    id: profile.id,
    name: profile.displayName,
    shortName: profile.displayName.split(' ').slice(-2).join(' '),
    subjects: subjectNames || presentation.subjects,
    mobileSubjects: subjectNames || presentation.mobileSubjects,
    image: profile.avatarUrl || presentation.image,
    bio: profile.bio,
    source: profile,
  };
}

function formatBooking(booking: Booking, index: number): BookingCard {
  const start = new Date(booking.startAtUtc);
  const end = new Date(booking.endAtUtc);
  const presentation = studentBookings[index % studentBookings.length];
  return {
    ...presentation,
    id: booking.id,
    day: new Intl.DateTimeFormat('en', { day: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(start),
    month: new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(start).toUpperCase(),
    time: `${start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })} – ${end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}`,
    status: booking.status,
  };
}

export function StudentDashboard() {
  return (
    <AppShell active="dashboard" contentClassName="student-dashboard" title="Good morning, Minh">
      <section className="dashboard-compact">
        <div className="dashboard-stats">
          {[['Upcoming', '3'], ['Hours learned', '24'], ['Tutors', '5']].map(([label, value]) => (
            <article key={label}><span>{label}</span><strong>{value}</strong></article>
          ))}
        </div>
        <div className="dashboard-week">
          <div className="dashboard-week__header"><h2>This week</h2><Link to="/student/bookings">View bookings</Link></div>
          <div className="dashboard-week__days">
            {weekdays.map((day, dayIndex) => (
              <div className="dashboard-week__day" key={day}>
                <span>{day}</span>
                <div className={dayIndex === 1 ? 'has-lesson' : ''}>{dayIndex === 1 ? <><strong>Math</strong><small>10:30</small></> : null}</div>
                <div />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard-legacy" aria-label="My schedule">
        <div className="legacy-schedule-head"><h2>My Schedule</h2><span>(GMT +06:00) Public Time⌄</span></div>
        <p className="legacy-date">02 – 08 March　‹　›</p>
        <div className="legacy-calendar">
          <div className="legacy-calendar__days">{['Mon 02','Tues 03','Wed 04','Thu 05','Fri 06','Sat 07'].map(day=><span key={day}>{day}</span>)}</div>
          <div className="legacy-event legacy-event--research"><strong>UX Research Class</strong><span>Mon – Thu　　　　　　　　　10:44 am</span></div>
          <div className="legacy-event legacy-event--app"><strong>App Development Course</strong><span>Mon – Thu　　　　　　　　10:44 am</span></div>
          <div className="legacy-event legacy-event--figma"><strong>Figma UI/UX Workshop</strong><span>Mon – Thu　　　　　　　　10:44 am</span></div>
          <div className="legacy-event legacy-event--webinar"><strong>Webinar</strong><span>Mon – Thu<br/>10:44 am</span></div>
        </div>
        <div className="legacy-tabs"><strong>All Course</strong><span>One by One</span><span>Webinar</span><span>Personal Coaching</span><span>Workshop</span></div>
        <div className="legacy-courses">
          <article><img src="/assets/figma/student-tutor-1.jpg" alt=""/><strong>Portrait Photography Masterclass</strong><span>Jane Copper</span></article>
          <article><img src="/assets/figma/student-tutor-2.jpg" alt=""/><strong>User Interface Design Masterclass</strong><span>Jane Copper</span></article>
        </div>
      </section>
    </AppShell>
  );
}

export function CompleteProfileScreen() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(() => window.sessionStorage.getItem('tutormatching.registration.name') || 'Minh Nguyen');
  const [learningGoal, setLearningGoal] = useState('Improve exam results');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function saveProfile() {
    setSaving(true);
    setError('');
    try {
      await gatewayClient.saveStudentProfile({
        displayName: displayName.trim(),
        educationLevel: 'UpperSecondary',
        learningGoal: learningGoal.trim(),
        timezone: 'Asia/Ho_Chi_Minh',
      });
      const subjects = await gatewayClient.listSubjects();
      if (subjects.length) {
        await gatewayClient.saveStudentInterests(subjects.slice(0, 2).map((subject, index) => ({ subjectId: subject.id, priority: index + 1 })));
      }
      navigate('/student/find-tutors');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save your learning profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell active="profile" contentClassName="profile-onboarding" title="Complete your student profile">
      <p className="student-step">Step 1 of 3</p>
      <h2>Tell us how you learn</h2>
      <p className="student-subtitle">This helps us recommend tutors who match your goals.</p>
      <section className="student-card learning-profile">
        <h3>Learning profile</h3>
        <TextField label="Display name" onChange={(event) => setDisplayName(event.target.value)} value={displayName} />
        <TextField defaultValue="Grade 10" label="School level" />
        <TextField defaultValue="Mathematics, Physics" label="Subjects" />
        <TextField label="Learning goal" onChange={(event) => setLearningGoal(event.target.value)} value={learningGoal} />
        <TextField defaultValue="Vietnamese" label="Preferred language" />
        <TextField defaultValue="Evenings and weekends" label="Weekly availability" />
      </section>
      {error ? <p className="tm-field__message tm-field__message--error" role="alert">{error}</p> : null}
      <Button className="profile-onboarding__save" disabled={saving} onClick={saveProfile} size="large">{saving ? 'Saving…' : 'Save & continue'}</Button>
    </AppShell>
  );
}

export function FindTutorsScreen() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const loadTutors = useCallback(() => gatewayClient.searchTutors(undefined, 1, 100), []);
  const loadSubjects = useCallback(() => gatewayClient.listSubjects(), []);
  const { data: remoteTutors, loading } = useGatewayResource(loadTutors, null);
  const { data: subjects } = useGatewayResource(loadSubjects, null);
  const availableTutors = useMemo<TutorCard[]>(
    () => remoteTutors ? remoteTutors.items.map((tutor, index) => mapTutor(tutor, index, subjects ?? [])) : studentTutors,
    [remoteTutors, subjects],
  );
  const tutors = useMemo(() => {
    const normalized = submittedQuery.trim().toLowerCase();
    if (!normalized) return availableTutors;
    return availableTutors.filter((tutor) => `${tutor.name} ${tutor.subjects}`.toLowerCase().includes(normalized));
  }, [availableTutors, submittedQuery]);

  return (
    <AppShell active="find" contentClassName="find-tutors" mobileTitle="Find tutors" title="Find the right tutor">
      <form className="tutor-search" onSubmit={(event) => { event.preventDefault(); setSubmittedQuery(query); }}>
        <input onChange={(event) => setQuery(event.target.value)} placeholder="Search by subject, tutor name, or keyword" value={query} />
        <Button size="large" type="submit">Search</Button>
      </form>
      <div className="tutor-filters">{['Mathematics', 'Grade 10', 'Online', 'Under 200k', 'Available today'].map((filter, index) => <button className={index === 0 ? 'is-active' : ''} key={filter} type="button">{filter}</button>)}</div>
      <div className="tutor-results-title"><h2>Tutors matching your search</h2><span>Sort by relevance</span></div>
      <span aria-live="polite" className="sr-only">{loading ? 'Loading tutors' : `${tutors.length} tutors found`}</span>
      <div className="tutor-grid">
        {tutors.map((tutor) => (
          <article className="tutor-card" key={tutor.id}>
            <button className="tutor-card__favorite" aria-label={`Save ${tutor.shortName}`} type="button">♡</button>
            <div className="tutor-card__avatar"><img alt={tutor.name} src={tutor.image}/><span /></div>
            <h3 className="desktop-name">{tutor.name}</h3><h3 className="mobile-name">{tutor.shortName}</h3>
            <p className="tutor-card__subjects desktop-name">{tutor.subjects}</p><p className="tutor-card__subjects mobile-name">{tutor.mobileSubjects}</p>
            <p className="tutor-card__rating">★ {tutor.rating} <span>•</span> <span className="desktop-name">{tutor.reviews}</span><span className="mobile-name">{tutor.mobilePrice} / hour</span></p>
            <p className="tutor-card__price">{tutor.price} <span>/ hour</span></p>
            <p className="tutor-card__bio">{tutor.bio || 'Patient, structured lessons tailored to each student.'}</p>
            <Link className="student-primary-link" to={`/student/tutors/${tutor.id}`}>View profile</Link>
          </article>
        ))}
      </div>
    </AppShell>
  );
}

export function TutorProfileScreen() {
  const { tutorId = 'minh-anh' } = useParams();
  const loadTutor = useCallback(
    () => uuidPattern.test(tutorId) ? gatewayClient.getTutor(tutorId) : Promise.reject(new Error('Figma fixture tutor')),
    [tutorId],
  );
  const { data: remoteTutor } = useGatewayResource<TutorProfile | null>(loadTutor, null);
  const tutor = remoteTutor;
  const firstSubjectId = tutor?.subjects[0]?.subjectId;
  const firstStartAtUtc = tutor?.availability[0]?.startAtUtc;
  const bookingQuery = new URLSearchParams();
  if (tutor) bookingQuery.set('tutorId', tutor.id);
  if (firstSubjectId) bookingQuery.set('subjectId', firstSubjectId);
  if (firstStartAtUtc) bookingQuery.set('startAtUtc', firstStartAtUtc);
  const bookingTarget = `/student/book/select-schedule${bookingQuery.size ? `?${bookingQuery}` : ''}`;
  const displayName = tutor?.displayName ?? 'Nguyen Minh Anh';
  const avatar = tutor?.avatarUrl ?? '/assets/figma/student-tutor-1.jpg';
  return (
    <AppShell active="find" contentClassName="tutor-profile" title="Tutor profile">
      <section className="student-card tutor-profile__hero">
        <div className="profile-avatar"><img alt={displayName} src={avatar}/><span /></div>
        <div><h2>{displayName}</h2><p>Mathematics • Physics • Grade 8–12</p><p className="profile-rating">★ 4.9　•　126 reviews　•　482 lessons</p><strong>150,000₫ <span>/ hour</span></strong></div>
        <Link className="student-primary-link" to={bookingTarget}>Book a lesson</Link>
      </section>
      <div className="tutor-profile__details">
        <section className="student-card tutor-about"><h2>About Minh Anh</h2><p>{tutor?.bio || 'I help students build strong foundations and confidence through clear, practical explanations.'}</p><h3>Experience</h3><p>{tutor ? `${tutor.experienceYears}+ years tutoring` : '5+ years tutoring • Hanoi National University of Education'}</p><h3>Teaching style</h3><div className="tag-row"><span>Patient</span><span>Structured</span><span>Exam focused</span></div></section>
        <section className="student-card tutor-availability"><h2>Next availability</h2>{['Today • 18:00','Tue • 09:00','Tue • 15:30','Wed • 19:00'].map((time,index)=><button aria-pressed={index===0} className={index===0?'is-active':''} key={time} type="button">{time}</button>)}</section>
      </div>
      <Link className="student-primary-link tutor-profile__mobile-book" to={bookingTarget}>Book a lesson</Link>
    </AppShell>
  );
}

export function SelectScheduleScreen() {
  const [selectedTime, setSelectedTime] = useState('10:30');
  const [bookingError, setBookingError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const days = Array.from({ length: 30 }, (_, index) => index + 1);

  async function continueBooking() {
    const tutorId = searchParams.get('tutorId');
    const subjectId = searchParams.get('subjectId');
    const startAtUtc = searchParams.get('startAtUtc');
    if (!tutorId || !subjectId || !startAtUtc) {
      navigate('/student/book/review');
      return;
    }
    setSubmitting(true);
    setBookingError('');
    try {
      const hold = await gatewayClient.createBookingHold({ tutorId, subjectId, startAtUtc });
      window.sessionStorage.setItem('tutormatching.booking.hold', JSON.stringify(hold));
      navigate('/student/book/review');
    } catch (reason) {
      setBookingError(reason instanceof Error ? reason.message : 'Unable to hold this time slot.');
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <AppShell active="find" contentClassName="book-schedule" title="Book a lesson">
      <p className="booking-steps"><strong>1&nbsp; Select time</strong><span>2&nbsp; Review</span><span>3&nbsp; Confirmed</span></p>
      <div className="booking-layout">
        <section className="student-card month-card"><div className="month-card__header"><h2>November 2026</h2><span>‹　›</span></div><div className="month-weekdays">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=><span key={day}>{day}</span>)}</div><div className="month-grid">{days.map(day=><button className={`${day>=14&&day<=22?'is-available ':''}${day===18?'is-selected':''}`} key={day} type="button"><strong>{day}</strong>{day===18?<small>Selected</small>:day>=14&&day<=22?<small>2 slots</small>:null}</button>)}</div></section>
        <section className="student-card time-card"><h2>Wednesday, 18 Nov</h2><div>{['09:00','10:30','14:00','15:30','19:00'].map(time=><button aria-pressed={selectedTime===time} className={selectedTime===time?'is-active':''} key={time} onClick={()=>setSelectedTime(time)} type="button">{time}</button>)}</div>{bookingError ? <p className="tm-field__message tm-field__message--error" role="alert">{bookingError}</p> : null}<Button disabled={submitting} fullWidth onClick={continueBooking} size="large">{submitting ? 'Holding slot…' : 'Continue'}</Button></section>
      </div>
    </AppShell>
  );
}

function DetailRows({ rows }: { rows: Array<[string, string]> }) {
  return <div className="detail-rows">{rows.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>;
}

export function ReviewBookingScreen() {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [bookingError, setBookingError] = useState('');

  async function confirm() {
    const rawHold = window.sessionStorage.getItem('tutormatching.booking.hold');
    if (!rawHold) {
      navigate('/student/book/confirmed');
      return;
    }
    setConfirming(true);
    setBookingError('');
    try {
      const hold = JSON.parse(rawHold) as { holdId: string; holdToken: string };
      const booking = await gatewayClient.confirmBooking(hold);
      window.sessionStorage.removeItem('tutormatching.booking.hold');
      window.sessionStorage.setItem('tutormatching.booking.confirmed', JSON.stringify(booking));
      navigate('/student/book/confirmed');
    } catch (reason) {
      setBookingError(reason instanceof Error ? reason.message : 'Unable to confirm this booking.');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <AppShell active="bookings" contentClassName="review-booking" title="Review your booking">
      <div className="review-layout"><section className="student-card lesson-summary"><h2>Lesson summary</h2><p>Review the details before confirming your lesson.</p><p className="summary-tutor"><span>Tutor</span>Nguyen Minh Anh</p><DetailRows rows={[["Subject","Mathematics • Grade 10"],["Date","Wednesday, 18 November 2026"],["Time","10:30 – 11:30"],["Format","Online lesson"],["Price","150,000₫"]]}/></section><aside><section className="booking-policy"><h2>Booking policy</h2><p>Free cancellation up to 12 hours before the lesson. Your slot is held for 09:42.</p></section>{bookingError ? <p className="tm-field__message tm-field__message--error" role="alert">{bookingError}</p> : null}<Button disabled={confirming} fullWidth onClick={confirm} size="large">{confirming ? 'Confirming…' : 'Confirm booking'}</Button></aside></div>
    </AppShell>
  );
}

export function BookingConfirmedScreen() {
  return (
    <AppShell active="bookings" contentClassName="booking-confirmed" title="Booking confirmed">
      <section className="student-card confirmation-card"><div className="confirmation-avatar"><img alt="Minh Anh" src="/assets/figma/student-tutor-1.jpg"/><span>✓</span></div><h2>Your lesson is booked!</h2><p>We’ve notified Minh Anh and added the lesson to your schedule.</p><div className="confirmation-summary"><strong>Mathematics • Wednesday, 18 Nov • 10:30–11:30</strong><span>Online • Nguyen Minh Anh • 150,000₫</span></div><div className="confirmation-actions"><Link className="student-primary-link" to="/student/bookings/TM-20261118-1042">View booking</Link><Link className="student-secondary-link" to="/student/dashboard">Back to dashboard</Link></div></section>
    </AppShell>
  );
}

export function BookingsScreen() {
  const loadBookings = useCallback(() => gatewayClient.listBookings(), []);
  const { data: remoteBookings } = useGatewayResource<Booking[] | null>(loadBookings, null);
  const bookings: BookingCard[] = remoteBookings ? remoteBookings.map(formatBooking) : studentBookings;
  return (
    <AppShell active="bookings" contentClassName="bookings" title="My bookings">
      <div className="booking-tabs"><button className="is-active">Upcoming</button><button>Completed</button><button>Cancelled</button></div>
      <div className="booking-list">{bookings.map((booking,index)=><article className="student-card booking-item" key={booking.id ?? `${booking.day}-${booking.title}`}><div className="booking-date"><strong>{booking.day}</strong><span>{booking.month}</span></div><div className="booking-item__content"><h2>{booking.title}</h2><p>{booking.time} • {booking.format}</p></div><span className="booking-status">{booking.status}</span><Link className="student-primary-link" to={booking.id ? `/student/bookings/${booking.id}` : index===0?'#':'/student/bookings/TM-20261118-1042'}>{booking.action}</Link></article>)}</div>
    </AppShell>
  );
}

export function BookingDetailsScreen() {
  const { bookingId = '' } = useParams();
  const loadBooking = useCallback(async () => {
    if (!uuidPattern.test(bookingId)) throw new Error('Figma fixture booking');
    const bookings = await gatewayClient.listBookings();
    const booking = bookings.find((candidate) => candidate.id === bookingId);
    if (!booking) throw new Error('Booking not found');
    return booking;
  }, [bookingId]);
  const { data: booking, setData } = useGatewayResource<Booking | null>(loadBooking, null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const start = booking ? new Date(booking.startAtUtc) : null;
  const end = booking ? new Date(booking.endAtUtc) : null;
  const title = booking ? `Lesson • ${booking.subjectId.slice(0, 8)}` : 'Mathematics with Minh Anh';
  const rows: Array<[string, string]> = booking && start && end ? [
    ['Booking ID', `#${booking.id}`],
    ['Date', start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })],
    ['Time', `${start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })} – ${end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}`],
    ['Format', 'Online • Google Meet'],
    ['Subject ID', booking.subjectId],
    ['Cancellation', booking.cancelledAtUtc ? 'This booking has been cancelled' : 'Free until 12 hours before the lesson'],
  ] : [['Booking ID','#TM-20261118-1042'],['Date','Wednesday, 18 November 2026'],['Time','10:30 – 11:30'],['Format','Online • Google Meet'],['Notes','Review quadratic equations and practice exam questions.'],['Cancellation','Free until 17 Nov, 22:30']];

  async function cancelBooking() {
    if (!booking) return;
    setCancelling(true); setError('');
    try {
      await gatewayClient.cancelBooking(booking.id, 'StudentRequested');
      setData({ ...booking, status: 'Cancelled', cancelledAtUtc: new Date().toISOString() });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to cancel this booking.');
    } finally { setCancelling(false); }
  }
  return (
    <AppShell active="bookings" contentClassName="booking-details" title="Booking details">
      <div className="booking-detail-layout"><section className="student-card booking-detail-card"><h2>{title}</h2><span className="booking-status">{booking?.status ?? 'Confirmed'}</span><DetailRows rows={rows}/></section><aside><Button fullWidth size="large">Join lesson</Button><Button fullWidth size="large" variant="secondary">Reschedule</Button>{error ? <p className="tm-field__message tm-field__message--error" role="alert">{error}</p> : null}<Button disabled={cancelling || booking?.status === 'Cancelled'} fullWidth onClick={cancelBooking} size="large" variant="danger">{cancelling ? 'Cancelling…' : booking?.status === 'Cancelled' ? 'Booking cancelled' : 'Cancel booking'}</Button></aside></div>
    </AppShell>
  );
}

export function NotificationsScreen() {
  const loadNotifications = useCallback(() => gatewayClient.listNotifications(), []);
  const { data: remoteNotifications, setData } = useGatewayResource(loadNotifications, null);
  const notifications = remoteNotifications?.items;

  async function markRead(notification: NotificationItem) {
    if (notification.status === 'Read') return;
    await gatewayClient.markNotificationRead(notification.id);
    setData((current) => current ? {
      ...current,
      items: current.items.map((item) => item.id === notification.id ? { ...item, status: 'Read' } : item),
    } : current);
  }

  return (
    <AppShell active="notifications" contentClassName="notifications" title="Notifications">
      <div className="notification-list">{notifications ? notifications.map((notification,index)=><article className={`student-card notification-item ${notification.status==='Unread'?'is-unread':''}`} key={notification.id} onClick={() => void markRead(notification)}><div className="notification-avatar"><img alt="" src={`/assets/figma/student-tutor-${(index % 3) + 1}.jpg`}/><span /></div><div><h2>{notification.title}</h2><p>{notification.body}</p></div><time>{new Date(notification.createdAtUtc).toLocaleDateString()}</time></article>) : studentNotifications.map(([title,body,time,image],index)=><article className={`student-card notification-item ${index<2?'is-unread':''}`} key={title}><div className="notification-avatar"><img alt="" src={`/assets/figma/student-tutor-${image}.jpg`}/><span /></div><div><h2>{title}</h2><p>{body}</p></div><time>{time}</time></article>)}</div>
    </AppShell>
  );
}

export function StudentProfileScreen() {
  return (
    <AppShell active="profile" contentClassName="student-profile" title="My profile">
      <section className="student-card student-profile__card"><div className="student-profile__photo"><div className="profile-avatar"><img alt="Minh" src="/assets/figma/student-tutor-3.jpg"/><span /></div><Button>Change photo</Button></div><div className="student-profile__fields"><TextField defaultValue="Nguyen Van Minh" label="Full name"/><TextField defaultValue="minh@example.com" label="Email"/><TextField defaultValue="+84 912 345 678" label="Phone"/><TextField defaultValue="Grade 10" label="School level"/><TextField defaultValue="Mathematics, Physics" label="Subjects"/><TextField defaultValue="Asia/Ho_Chi_Minh" label="Timezone"/></div><Button className="student-profile__save" size="large">Save changes</Button></section>
    </AppShell>
  );
}

function SettingToggle({ defaultOn = false, description, label }: { defaultOn?: boolean; description: string; label: string }) {
  const [enabled,setEnabled]=useState(defaultOn);
  return <div className="setting-row"><div><strong>{label}</strong><span>{description}</span></div><button aria-checked={enabled} aria-label={label} className={enabled?'is-on':''} onClick={()=>setEnabled(value=>!value)} role="switch" type="button"><span /></button></div>;
}

export function StudentSettingsScreen() {
  return (
    <AppShell active="settings" contentClassName="student-settings" title="Settings">
      <section><h2>Account &amp; preferences</h2><SettingToggle defaultOn label="Email notifications" description="Booking updates, reminders, and account activity"/><SettingToggle defaultOn label="Push notifications" description="Real-time lesson and message alerts"/><SettingToggle label="Marketing updates" description="Product tips and learning offers"/><SettingToggle label="Two-factor authentication" description="Add an extra layer of account security"/><div className="setting-password"><div><strong>Password</strong><span>Last changed 3 months ago</span></div><Button variant="secondary">Change password</Button></div><Button className="delete-account" variant="danger">Delete account</Button></section>
    </AppShell>
  );
}

export const studentRoutes = [
  { path: '/student/dashboard', element: <StudentDashboard /> },
  { path: '/student/complete-profile', element: <CompleteProfileScreen /> },
  { path: '/student/find-tutors', element: <FindTutorsScreen /> },
  { path: '/student/tutors/minh-anh', element: <TutorProfileScreen /> },
  { path: '/student/tutors/:tutorId', element: <TutorProfileScreen /> },
  { path: '/student/book/select-schedule', element: <SelectScheduleScreen /> },
  { path: '/student/book/review', element: <ReviewBookingScreen /> },
  { path: '/student/book/confirmed', element: <BookingConfirmedScreen /> },
  { path: '/student/bookings', element: <BookingsScreen /> },
  { path: '/student/bookings/TM-20261118-1042', element: <BookingDetailsScreen /> },
  { path: '/student/bookings/:bookingId', element: <BookingDetailsScreen /> },
  { path: '/student/notifications', element: <NotificationsScreen /> },
  { path: '/student/profile', element: <StudentProfileScreen /> },
  { path: '/student/settings', element: <StudentSettingsScreen /> },
];
