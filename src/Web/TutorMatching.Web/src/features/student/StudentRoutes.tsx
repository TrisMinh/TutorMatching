import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { gatewayClient, type Booking, type NotificationItem, type StudentProfile, type Subject, type TutorProfile } from '../../api';
import { useGatewayResource } from '../../api/useGatewayResource';
import { Button } from '../../design-system/Button';
import { TextField } from '../../design-system/TextField';
import { AppShell } from '../../shared/AppShell';
import { MotionLink as Link, useMotionNavigate } from '../../shared/MotionLink';
import { studentBookings, studentNotifications, studentTutors } from '../../shared/fixtures';
import './student.css';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const educationLabels = ['Primary', 'Grade 6–9', 'Grade 10', 'University', 'Adult'];
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
  const loadBookings = useCallback(() => gatewayClient.listBookings(), []);
  const { data: remoteBookings } = useGatewayResource<Booking[] | null>(loadBookings, null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [courseFilter, setCourseFilter] = useState('All Course');
  const [selectedDay, setSelectedDay] = useState(23);
  const weekLabel = weekOffset === 0 ? '02 – 08 March' : weekOffset < 0 ? '24 February – 01 March' : '09 – 15 March';
  const upcomingCount = remoteBookings?.filter((booking) => booking.status !== 'Cancelled').length ?? 3;
  const courseTabs = ['All Course', 'One by One', 'Webinar', 'Personal Coaching', 'Workshop'];
  const miniCalendarDays = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 1, 2, 3, 4, 5];

  return (
    <AppShell active="dashboard" contentClassName="student-dashboard" title="Good morning, Minh">
      <section className="dashboard-compact">
        <div className="dashboard-stats">
          {[['Upcoming', String(upcomingCount)], ['Hours learned', '24'], ['Tutors', '5']].map(([label, value]) => (
            <article key={label}><span>{label}</span><strong>{value}</strong></article>
          ))}
        </div>
        <div className="dashboard-week">
          <div className="dashboard-week__header"><h2>This week</h2><Link to="/student/bookings" viewTransition>View bookings</Link></div>
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

      <section className="dashboard-template" aria-label="My schedule">
        <div className="dashboard-legacy">
          <div className="legacy-schedule-head"><h2>My Schedule</h2><span>(GMT +06:00) Public Time⌄</span></div>
          <div className="legacy-date">
            <span>{weekLabel}</span>
            <button aria-label="Previous week" onClick={() => setWeekOffset((value) => value - 1)} type="button">‹</button>
            <button aria-label="Next week" onClick={() => setWeekOffset((value) => value + 1)} type="button">›</button>
          </div>
          <div className="legacy-calendar">
            <div className="legacy-calendar__days">{[['Mon','02'],['Tues','03'],['Wed','04'],['Thu','05'],['Fri','06'],['Sat','07']].map(([day,date])=><span key={day}><strong>{day}</strong><small>{date}</small></span>)}</div>
            <div className="legacy-calendar__times">{['09:00','10:00','11:00','12:00','13:00','14:00','15:00'].map(time=><span key={time}>{time}</span>)}</div>
            <Link className="legacy-event legacy-event--research" to="/student/bookings" viewTransition><span className="legacy-event__thumb"><img alt="" src="/assets/figma/dashboard-research.png"/></span><span className="legacy-event__copy"><strong>UX Research Class</strong><small>Mon – Thu</small></span><span className="legacy-event__people"><span className="legacy-avatars"><img alt="" src="/assets/figma/dashboard-avatar-1.png"/><img alt="" src="/assets/figma/dashboard-avatar-2.png"/><img alt="" src="/assets/figma/dashboard-avatar-3.png"/></span><small>10:44 am</small></span></Link>
            <Link className="legacy-event legacy-event--app" to="/student/bookings" viewTransition><span className="legacy-event__thumb"><img alt="" src="/assets/figma/dashboard-app.png"/></span><span className="legacy-event__copy"><strong>App Development Course</strong><small>Mon – Thu</small></span><span className="legacy-event__people"><span className="legacy-avatars"><img alt="" src="/assets/figma/dashboard-avatar-2.png"/><img alt="" src="/assets/figma/dashboard-avatar-3.png"/></span><small>10:44 am</small></span></Link>
            <Link className="legacy-event legacy-event--figma" to="/student/bookings" viewTransition><span className="legacy-event__thumb"><img alt="" src="/assets/figma/dashboard-figma.png"/></span><span className="legacy-event__copy"><strong>Figma UI/UX Workshop</strong><small>Mon – Thu</small></span><span className="legacy-event__people"><span className="legacy-avatars"><img alt="" src="/assets/figma/dashboard-avatar-2.png"/><img alt="" src="/assets/figma/dashboard-avatar-3.png"/></span><small>10:44 am</small></span></Link>
            <Link className="legacy-event legacy-event--webinar" to="/student/bookings" viewTransition><strong>Webinar</strong><span className="legacy-zoom"><img alt="" src="/assets/figma/dashboard-zoom.svg"/> Zoom</span><small>Mon – Thu<br/>10:44 am</small></Link>
          </div>
          <div className="legacy-tabs" role="tablist" aria-label="Course type">{courseTabs.map(tab=><button aria-selected={courseFilter===tab} className={courseFilter===tab?'is-active':''} key={tab} onClick={()=>setCourseFilter(tab)} role="tab" type="button">{tab}</button>)}</div>
          <div className="legacy-courses">
            <Link to="/student/find-tutors" viewTransition><img src="/assets/figma/dashboard-course-camera.png" alt=""/><strong>Portrait Photography Masterclass</strong><span>Jane Copper</span></Link>
            <Link to="/student/find-tutors" viewTransition><img src="/assets/figma/dashboard-course-ui.png" alt=""/><strong>User Interface Design Masterclass</strong><span>Jane Copper</span></Link>
          </div>
        </div>

        <aside className="dashboard-rail" aria-label="Calendar and events">
          <section className="dashboard-mini-calendar">
            <div><h2>February 2021</h2><span aria-hidden="true">‹　›</span></div>
            <div className="dashboard-mini-calendar__weekdays">{['Mo','Tu','We','Th','Fr','Sa','Su'].map(day=><strong key={day}>{day}</strong>)}</div>
            <div className="dashboard-mini-calendar__days">{miniCalendarDays.map((day,index)=><button aria-pressed={selectedDay===day && index<29} className={`${index>28?'is-muted ':''}${selectedDay===day&&index<29?'is-selected':''}`} key={`${day}-${index}`} onClick={()=>setSelectedDay(day)} type="button">{day}</button>)}</div>
          </section>
          <section className="dashboard-rail-section"><h2>Upcoming Events</h2><Link to="/student/bookings" viewTransition><span className="dashboard-event-icon is-yellow">✎</span><span><strong>Typography in UX/UI</strong><small>• Design　• 10:00 am</small></span><b>••</b></Link><Link to="/student/bookings" viewTransition><span className="dashboard-event-icon is-rainbow">F</span><span><strong>Figma UI UX Design</strong><small>• Design　• 10:00 am</small></span><b>••</b></Link></section>
          <section className="dashboard-rail-section dashboard-top-courses"><h2>Top Performing Courses</h2>{['CSS for Designers','3D Design Foundations','Design Composition','Color Psychology'].map((course,index)=><Link key={course} to="/student/find-tutors" viewTransition><span className={`dashboard-course-icon course-${index+1}`}>◆</span><span><strong>{course}</strong><small>◉ uxcel</small></span><i aria-hidden="true">⌁</i></Link>)}</section>
        </aside>
      </section>
    </AppShell>
  );
}

export function CompleteProfileScreen() {
  const navigate = useMotionNavigate();
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
        educationLevel: 2,
        learningGoal: learningGoal.trim(),
        timezone: 'Asia/Ho_Chi_Minh',
      });
      const subjects = await gatewayClient.listSubjects();
      if (subjects.length) {
        await gatewayClient.saveStudentInterests(subjects.slice(0, 2).map((subject, index) => ({ subjectId: subject.id, priority: index + 1 })));
      }
      navigate('/student/find-tutors', { viewTransition: true });
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
  const [availableToday, setAvailableToday] = useState(false);
  const [savedTutors, setSavedTutors] = useState<string[]>([]);
  const loadSubjects = useCallback(() => gatewayClient.listSubjects(), []);
  const { data: subjects } = useGatewayResource(loadSubjects, null);
  const mathematics = subjects?.find((subject) => subject.name === 'Mathematics');
  const loadTutors = useCallback(async () => {
    if (!availableToday || !mathematics) return gatewayClient.searchTutors(mathematics?.id, 1, 100);
    const date = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Ho_Chi_Minh',
    }).format(new Date());
    const result = await gatewayClient.searchAvailableTutors({
      subjectId: mathematics.id,
      date,
      timezone: 'Asia/Ho_Chi_Minh',
      pageSize: 100,
    });
    return {
      ...result,
      items: result.items.map((tutor) => ({
        ...tutor,
        availability: tutor.availableSlots,
      })),
    };
  }, [availableToday, mathematics]);
  const { data: remoteTutors, loading } = useGatewayResource(loadTutors, null);
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
      <div className="tutor-filters">{['Mathematics', 'Grade 10', 'Online', 'Under 200k', 'Available today'].map((filter, index) => <button aria-pressed={index === 0 || (filter === 'Available today' && availableToday)} className={index === 0 || (filter === 'Available today' && availableToday) ? 'is-active' : ''} key={filter} onClick={() => { if (filter === 'Available today') setAvailableToday((value) => !value); }} type="button">{filter}</button>)}</div>
      <div className="tutor-results-title"><h2>Tutors matching your search</h2><span>Sort by relevance</span></div>
      <span aria-live="polite" className="sr-only">{loading ? 'Loading tutors' : `${tutors.length} tutors found`}</span>
      <div className="tutor-grid">
        {tutors.map((tutor) => (
          <article className="tutor-card" key={tutor.id}>
            <button aria-label={`${savedTutors.includes(tutor.id) ? 'Remove' : 'Save'} ${tutor.shortName}`} aria-pressed={savedTutors.includes(tutor.id)} className={`tutor-card__favorite ${savedTutors.includes(tutor.id) ? 'is-saved' : ''}`} onClick={() => setSavedTutors((current) => current.includes(tutor.id) ? current.filter((id) => id !== tutor.id) : [...current, tutor.id])} type="button">{savedTutors.includes(tutor.id) ? '♥' : '♡'}</button>
            <div className="tutor-card__avatar"><img alt={tutor.name} src={tutor.image}/><span /></div>
            <h3 className="desktop-name">{tutor.name}</h3><h3 className="mobile-name">{tutor.shortName}</h3>
            <p className="tutor-card__subjects desktop-name">{tutor.subjects}</p><p className="tutor-card__subjects mobile-name">{tutor.mobileSubjects}</p>
            <p className="tutor-card__rating">★ {tutor.rating} <span>•</span> <span className="desktop-name">{tutor.reviews}</span><span className="mobile-name">{tutor.mobilePrice} / hour</span></p>
            <p className="tutor-card__price">{tutor.price} <span>/ hour</span></p>
            <p className="tutor-card__bio">{tutor.bio || 'Patient, structured lessons tailored to each student.'}</p>
            <Link className="student-primary-link" to={`/student/tutors/${tutor.id}`} viewTransition>View profile</Link>
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
  const [selectedAvailability, setSelectedAvailability] = useState('Today • 18:00');
  return (
    <AppShell active="find" contentClassName="tutor-profile" title="Tutor profile">
      <section className="student-card tutor-profile__hero">
        <div className="profile-avatar"><img alt={displayName} src={avatar}/><span /></div>
        <div><h2>{displayName}</h2><p>Mathematics • Physics • Grade 8–12</p><p className="profile-rating">★ 4.9　•　126 reviews　•　482 lessons</p><strong>150,000₫ <span>/ hour</span></strong></div>
        <Link className="student-primary-link" to={bookingTarget} viewTransition>Book a lesson</Link>
      </section>
      <div className="tutor-profile__details">
        <section className="student-card tutor-about"><h2>About Minh Anh</h2><p>{tutor?.bio || 'I help students build strong foundations and confidence through clear, practical explanations.'}</p><h3>Experience</h3><p>{tutor ? `${tutor.experienceYears}+ years tutoring` : '5+ years tutoring • Hanoi National University of Education'}</p><h3>Teaching style</h3><div className="tag-row"><span>Patient</span><span>Structured</span><span>Exam focused</span></div></section>
        <section className="student-card tutor-availability"><h2>Next availability</h2>{['Today • 18:00','Tue • 09:00','Tue • 15:30','Wed • 19:00'].map((time)=><button aria-pressed={selectedAvailability===time} className={selectedAvailability===time?'is-active':''} key={time} onClick={()=>setSelectedAvailability(time)} type="button">{time}</button>)}</section>
      </div>
      <Link className="student-primary-link tutor-profile__mobile-book" to={bookingTarget} viewTransition>Book a lesson</Link>
    </AppShell>
  );
}

export function SelectScheduleScreen() {
  const [selectedTime, setSelectedTime] = useState('10:30');
  const [selectedDay, setSelectedDay] = useState(18);
  const [bookingError, setBookingError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useMotionNavigate();
  const days = Array.from({ length: 30 }, (_, index) => index + 1);

  async function continueBooking() {
    const tutorId = searchParams.get('tutorId');
    const subjectId = searchParams.get('subjectId');
    const startAtUtc = searchParams.get('startAtUtc');
    if (!tutorId || !subjectId || !startAtUtc) {
      navigate('/student/book/review', { viewTransition: true });
      return;
    }
    setSubmitting(true);
    setBookingError('');
    try {
      const hold = await gatewayClient.createBookingHold({ tutorId, subjectId, startAtUtc });
      window.sessionStorage.setItem('tutormatching.booking.hold', JSON.stringify(hold));
      navigate('/student/book/review', { viewTransition: true });
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
        <section className="student-card month-card"><div className="month-card__header"><h2>November 2026</h2><span>‹　›</span></div><div className="month-weekdays">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=><span key={day}>{day}</span>)}</div><div className="month-grid">{days.map(day=><button aria-pressed={selectedDay===day} className={`${day>=14&&day<=22?'is-available ':''}${day===selectedDay?'is-selected':''}`} disabled={day<14||day>22} key={day} onClick={()=>setSelectedDay(day)} type="button"><strong>{day}</strong>{day===selectedDay?<small>Selected</small>:day>=14&&day<=22?<small>2 slots</small>:null}</button>)}</div></section>
        <section className="student-card time-card"><h2>{selectedDay === 18 ? 'Wednesday' : 'Selected day'}, {selectedDay} Nov</h2><div>{['09:00','10:30','14:00','15:30','19:00'].map(time=><button aria-pressed={selectedTime===time} className={selectedTime===time?'is-active':''} key={time} onClick={()=>setSelectedTime(time)} type="button">{time}</button>)}</div>{bookingError ? <p className="tm-field__message tm-field__message--error" role="alert">{bookingError}</p> : null}<Button disabled={submitting} fullWidth onClick={continueBooking} size="large">{submitting ? 'Holding slot…' : 'Continue'}</Button></section>
      </div>
    </AppShell>
  );
}

function DetailRows({ rows }: { rows: Array<[string, string]> }) {
  return <div className="detail-rows">{rows.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>;
}

export function ReviewBookingScreen() {
  const navigate = useMotionNavigate();
  const [confirming, setConfirming] = useState(false);
  const [bookingError, setBookingError] = useState('');

  async function confirm() {
    const rawHold = window.sessionStorage.getItem('tutormatching.booking.hold');
    if (!rawHold) {
      navigate('/student/book/confirmed', { viewTransition: true });
      return;
    }
    setConfirming(true);
    setBookingError('');
    try {
      const hold = JSON.parse(rawHold) as { holdId: string; holdToken: string };
      const booking = await gatewayClient.confirmBooking(hold);
      window.sessionStorage.removeItem('tutormatching.booking.hold');
      window.sessionStorage.setItem('tutormatching.booking.confirmed', JSON.stringify(booking));
      navigate('/student/book/confirmed', { viewTransition: true });
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
      <section className="student-card confirmation-card"><div className="confirmation-avatar"><img alt="Minh Anh" src="/assets/figma/student-tutor-1.jpg"/><span>✓</span></div><h2>Your lesson is booked!</h2><p>We’ve notified Minh Anh and added the lesson to your schedule.</p><div className="confirmation-summary"><strong>Mathematics • Wednesday, 18 Nov • 10:30–11:30</strong><span>Online • Nguyen Minh Anh • 150,000₫</span></div><div className="confirmation-actions"><Link className="student-primary-link" to="/student/bookings/TM-20261118-1042" viewTransition>View booking</Link><Link className="student-secondary-link" to="/student/dashboard" viewTransition>Back to dashboard</Link></div></section>
    </AppShell>
  );
}

export function BookingsScreen() {
  const loadBookings = useCallback(() => gatewayClient.listBookings(), []);
  const { data: remoteBookings } = useGatewayResource<Booking[] | null>(loadBookings, null);
  const bookings: BookingCard[] = remoteBookings ? remoteBookings.map(formatBooking) : studentBookings;
  const [activeTab, setActiveTab] = useState('Upcoming');
  const visibleBookings = bookings.filter((booking) => activeTab === 'Upcoming' ? !['Completed','Cancelled'].includes(booking.status) : booking.status === activeTab);
  return (
    <AppShell active="bookings" contentClassName="bookings" title="My bookings">
      <div className="booking-tabs" role="tablist">{['Upcoming','Completed','Cancelled'].map(tab=><button aria-selected={activeTab===tab} className={activeTab===tab?'is-active':''} key={tab} onClick={()=>setActiveTab(tab)} role="tab" type="button">{tab}</button>)}</div>
      <div className="booking-list">{visibleBookings.length ? visibleBookings.map((booking)=><article className="student-card booking-item" key={booking.id ?? `${booking.day}-${booking.title}`}><div className="booking-date"><strong>{booking.day}</strong><span>{booking.month}</span></div><div className="booking-item__content"><h2>{booking.title}</h2><p>{booking.time} • {booking.format}</p></div><span className="booking-status">{booking.status}</span><Link className="student-primary-link" to={booking.id ? `/student/bookings/${booking.id}` : '/student/bookings/TM-20261118-1042'} viewTransition>{booking.action}</Link></article>) : <p className="booking-empty">No {activeTab.toLowerCase()} bookings.</p>}</div>
    </AppShell>
  );
}

export function BookingDetailsScreen() {
  const navigate = useMotionNavigate();
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
  const [actionMessage, setActionMessage] = useState('');
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
      <div className="booking-detail-layout"><section className="student-card booking-detail-card"><h2>{title}</h2><span className="booking-status">{booking?.status ?? 'Confirmed'}</span><DetailRows rows={rows}/></section><aside><Button fullWidth onClick={()=>setActionMessage('The meeting room opens 10 minutes before the lesson.')} size="large">Join lesson</Button><Button fullWidth onClick={()=>navigate('/student/book/select-schedule',{viewTransition:true})} size="large" variant="secondary">Reschedule</Button>{actionMessage?<p className="booking-action-message" aria-live="polite">{actionMessage}</p>:null}{error ? <p className="tm-field__message tm-field__message--error" role="alert">{error}</p> : null}<Button disabled={cancelling || booking?.status === 'Cancelled'} fullWidth onClick={cancelBooking} size="large" variant="danger">{cancelling ? 'Cancelling…' : booking?.status === 'Cancelled' ? 'Booking cancelled' : 'Cancel booking'}</Button></aside></div>
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
  const loadProfile = useCallback(() => gatewayClient.getStudentProfile(), []);
  const { data: profile } = useGatewayResource<StudentProfile | null>(loadProfile, null);
  const [displayName, setDisplayName] = useState('Nguyen Van Minh');
  const [schoolLevel, setSchoolLevel] = useState('Grade 10');
  const [learningGoal, setLearningGoal] = useState('Improve exam results');
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [avatar, setAvatar] = useState('/assets/figma/student-tutor-3.jpg');
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName);
    const educationLevel = typeof profile.educationLevel === 'number'
      ? profile.educationLevel
      : Number.parseInt(String(profile.educationLevel), 10);
    setSchoolLevel(educationLabels[educationLevel] ?? 'Grade 10');
    setLearningGoal(profile.learningGoal);
    setTimezone(profile.timezone);
  }, [profile]);

  async function save() {
    setSaving(true); setMessage('');
    try {
      const normalizedLevel = schoolLevel.toLowerCase();
      const grade = Number.parseInt(normalizedLevel.replace(/\D/g, ''), 10);
      const educationLevel = normalizedLevel.includes('university') ? 3
        : normalizedLevel.includes('adult') ? 4
          : Number.isFinite(grade) && grade <= 5 ? 0
            : Number.isFinite(grade) && grade <= 9 ? 1 : 2;
      await gatewayClient.saveStudentProfile({ displayName, educationLevel, learningGoal, timezone });
      setMessage('Profile saved');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to save your profile.');
    } finally { setSaving(false); }
  }

  function changePhoto(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => { if (typeof reader.result === 'string') setAvatar(reader.result); });
    reader.readAsDataURL(file);
  }

  return (
    <AppShell active="profile" contentClassName="student-profile" title="My profile">
      <section className="student-card student-profile__card"><div className="student-profile__photo"><div className="profile-avatar"><img alt={displayName} src={avatar}/><span /></div><input accept="image/*" className="student-photo-input" onChange={(event)=>changePhoto(event.target.files?.[0])} ref={photoInput} type="file"/><Button onClick={()=>photoInput.current?.click()}>Change photo</Button></div><div className="student-profile__fields"><TextField label="Full name" onChange={(event) => setDisplayName(event.target.value)} value={displayName}/><TextField defaultValue="minh@example.com" disabled label="Email"/><TextField defaultValue="+84 912 345 678" label="Phone"/><TextField label="School level" onChange={(event) => setSchoolLevel(event.target.value)} value={schoolLevel}/><TextField label="Learning goal" onChange={(event) => setLearningGoal(event.target.value)} value={learningGoal}/><TextField label="Timezone" onChange={(event) => setTimezone(event.target.value)} value={timezone}/></div>{message ? <p aria-live="polite" className={message === 'Profile saved' ? 'tutor-added' : 'tm-field__message tm-field__message--error'}>{message}</p> : null}<Button className="student-profile__save" disabled={saving} onClick={save} size="large">{saving ? 'Saving…' : 'Save changes'}</Button></section>
    </AppShell>
  );
}

function SettingToggle({ defaultOn = false, description, label }: { defaultOn?: boolean; description: string; label: string }) {
  const [enabled,setEnabled]=useState(defaultOn);
  return <div className="setting-row"><div><strong>{label}</strong><span>{description}</span></div><button aria-checked={enabled} aria-label={label} className={enabled?'is-on':''} onClick={()=>setEnabled(value=>!value)} role="switch" type="button"><span /></button></div>;
}

export function StudentSettingsScreen() {
  const navigate = useMotionNavigate();
  const [message,setMessage]=useState('');
  return (
    <AppShell active="settings" contentClassName="student-settings" title="Settings">
      <section><h2>Account &amp; preferences</h2><SettingToggle defaultOn label="Email notifications" description="Booking updates, reminders, and account activity"/><SettingToggle defaultOn label="Push notifications" description="Real-time lesson and message alerts"/><SettingToggle label="Marketing updates" description="Product tips and learning offers"/><SettingToggle label="Two-factor authentication" description="Add an extra layer of account security"/><div className="setting-password"><div><strong>Password</strong><span>Last changed 3 months ago</span></div><Button onClick={()=>navigate('/auth/forgot-password',{viewTransition:true})} variant="secondary">Change password</Button></div>{message?<p className="settings-action-message" aria-live="polite">{message}</p>:null}<Button className="delete-account" onClick={()=>setMessage('Account deletion requires email confirmation. We have not deleted any data.')} variant="danger">Delete account</Button></section>
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
