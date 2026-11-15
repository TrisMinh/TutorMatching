import './tutor-profile.css';
import {FriendlyIllustration,FriendlyEmptyState} from '../../shared/FriendlyEmptyState';
import {BookingCelebration} from '../../shared/BookingCelebration';
import {useCallback, useEffect, useState} from 'react';
import {useParams, useSearchParams} from 'react-router-dom';
import {gatewayClient, type Booking, type BookingHold} from '../../api';
import {useGatewayResource} from '../../api/useGatewayResource';
import {AppShell} from '../../shared/AppShell';
import {MotionLink as Link, useMotionNavigate} from '../../shared/MotionLink';
import {Button} from '../../design-system/Button';
import {Select} from '../../design-system/Select';
import {notifyAction} from '../../shared/notificationEvents';

const zone = 'Asia/Ho_Chi_Minh';
const dateKey = (value: string | Date) => new Intl.DateTimeFormat('en-CA', {timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(value));
const timeLabel = (value: string) => new Date(value).toLocaleTimeString('en-GB', {timeZone: zone, hour: '2-digit', minute: '2-digit'});
const dateLabel = (value: string) => new Date(value).toLocaleDateString('en-GB', {timeZone: zone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'});
const message = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete this operation.';
type HeldLesson = BookingHold & {tutorId: string; tutorName: string; subjectId: string; subjectName: string; startAtUtc: string; endAtUtc: string};
function readHold(): HeldLesson | null {try {return JSON.parse(sessionStorage.getItem('tutormatching.booking.hold') ?? 'null');} catch {return null;}}
function Failure({error, retry}: {error: unknown; retry: () => void}) {return <section className="student-card" role="alert"><p>{message(error)}</p><Button onClick={retry}>Try again</Button><Link to="/student/find-tutors">Find a tutor</Link></section>;}

export function TutorProfileScreen() {
  const {tutorId = ''} = useParams();
  const load = useCallback(async () => ({tutor: await gatewayClient.getTutor(tutorId), subjects: await gatewayClient.listSubjects(), courses: await gatewayClient.listCourses()}), [tutorId]);
  const {data, loading, error, reload} = useGatewayResource(load, null);
  const tutor = data?.tutor;
  const [expanded,setExpanded]=useState(false);
  useEffect(()=>setExpanded(false),[tutorId]);
  const windows=(tutor?.availability??[]).filter(window=>Date.parse(window.endAtUtc)>Date.now()).sort((a,b)=>Date.parse(a.startAtUtc)-Date.parse(b.startAtUtc));
  const courses=(data?.courses??[]).filter(course=>course.tutorId===tutorId);
  return <AppShell active="find" contentClassName="tutor-profile tutor-profile-live" title="Tutor profile">
    {loading ? <p role="status">Loading tutor profile…</p> : error ? <Failure error={error} retry={() => void reload()} /> : tutor && <>
      <section className="student-card tutor-profile__hero"><div className="profile-avatar"><img alt="" src={tutor.avatarUrl || '/assets/figma/default-avatar.svg'} /></div><div><h2>{tutor.displayName}</h2><p>{tutor.subjects.map(s => data.subjects.find(subject => subject.id === s.subjectId)?.name).filter(Boolean).join(' • ') || 'No teaching subjects yet'}</p><p>{tutor.experienceYears} years of teaching experience</p></div><div className="tutor-contact-actions">{tutor.subjects.length ? <Link className="student-primary-link" to={'/student/book/select-schedule?tutorId=' + tutor.id + '&subjectId=' + tutor.subjects[0].subjectId}>Book a lesson</Link> : <p>Booking is unavailable until this tutor adds a subject.</p>}<Link className="message-tutor-link" to={'/student/messages?tutor='+tutor.id}>Message tutor</Link></div></section>
      <div className="public-tutor-layout"><div className="public-tutor-main"><section className="student-card public-tutor-about"><span className="public-tutor-eyebrow">Meet your tutor</span><h2>About {tutor.displayName}</h2><p>{tutor.bio || 'This tutor has not added a biography.'}</p><div className="public-tutor-subjects" aria-label="Teaching subjects">{tutor.subjects.map(subject=><span key={subject.subjectId}>{data.subjects.find(item=>item.id===subject.subjectId)?.name??'Subject'}</span>)}</div></section><section className="student-card public-tutor-courses"><header><div><span className="public-tutor-eyebrow">Keep learning</span><h2>Courses by {tutor.displayName}</h2></div><span className="public-tutor-course-count">{courses.length} course{courses.length===1?'':'s'}</span></header>{courses.length?<div className="public-tutor-course-grid">{courses.map(course=><Link className="public-tutor-course" key={course.id} to={'/student/courses/'+course.id}><img src={course.image} alt=""/><div><span>{course.category}</span><h3>{course.title}</h3><p>{course.sessions.length} sessions · {Math.max(0,course.capacity-course.enrolled)} places left</p></div><span className="public-tutor-course-arrow" aria-hidden="true">↗</span></Link>)}</div>:<FriendlyEmptyState compact kind="book" title="No published courses yet." description="You can still message this tutor about one-to-one lessons."/>}</section></div><section className="student-card public-tutor-availability"><header><span className="booking-detail-icon booking-detail-icon--date"><ConfirmationIcon kind="date"/></span><div><h2>Published availability</h2><p>Vietnam time · GMT+07</p></div></header>
          <p className="public-tutor-availability-hint">Choose a lesson time to check which slots are still available.</p>
          {windows.length?<><div className="public-tutor-windows" role="region" aria-label="Published time blocks" tabIndex={expanded?0:undefined}>{(expanded?windows:windows.slice(0,4)).map(window=><div className="public-tutor-window" key={window.startAtUtc+window.endAtUtc} data-start={window.startAtUtc}><span className="public-tutor-day-icon" aria-hidden="true">{new Date(window.startAtUtc).toLocaleDateString('en-GB',{timeZone:zone,day:'2-digit'})}<small>{new Date(window.startAtUtc).toLocaleDateString('en-GB',{timeZone:zone,month:'short'})}</small></span><div><strong>{new Date(window.startAtUtc).toLocaleDateString('en-GB',{timeZone:zone,weekday:'long',day:'numeric',month:'short'})}</strong><span>{timeLabel(window.startAtUtc)} – {timeLabel(window.endAtUtc)}</span></div></div>)}</div>{windows.length>4?<button type="button" className="public-tutor-more" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?'Show fewer dates':`Show all ${windows.length} time blocks`}<span aria-hidden="true">{expanded?'↑':'↓'}</span></button>:null}</>:<FriendlyEmptyState compact kind="calendar" title="No future availability published." description="Message this tutor to ask about a suitable lesson time."/>}
        </section></div>
    </>}
  </AppShell>;
}

export function SelectScheduleScreen() {
  const [params] = useSearchParams();
  const tutorId = params.get('tutorId') ?? '';
  const [subjectId, setSubjectId] = useState(params.get('subjectId') ?? '');
  const initialDate = params.get('startAtUtc') ?? new Date().toISOString();
  const [day, setDay] = useState(dateKey(initialDate));
  const [month, setMonth] = useState(dateKey(initialDate).slice(0, 7));
  const [start, setStart] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const navigate = useMotionNavigate();
  const load = useCallback(async () => ({tutor: await gatewayClient.getTutor(tutorId), subjects: await gatewayClient.listSubjects()}), [tutorId]);
  const {data, loading, error, reload} = useGatewayResource(load, null);
  useEffect(() => {if (!subjectId && data?.tutor.subjects[0]) setSubjectId(data.tutor.subjects[0].subjectId);}, [data, subjectId]);
  const loadSlots = useCallback(async () => {
    if (!tutorId || !subjectId) return [];
    const result = await gatewayClient.searchAvailableTutors({subjectId, date: day, timezone: zone, pageSize: 100});
    if (result.partial) throw new Error('Availability could not be fully checked. Try again before booking.');
    return result.items.find(tutor => tutor.id === tutorId)?.availableSlots ?? [];
  }, [tutorId, subjectId, day]);
  const {data: slots, loading: slotsLoading, error: slotsError, reload: reloadSlots} = useGatewayResource(loadSlots, []);
  const selectedStart = slots.some(slot => slot.startAtUtc === start) ? start : '';
  const first = new Date(month + '-01T00:00:00+07:00');
  const numberOfDays = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const offset = (new Date(month + '-01T12:00:00Z').getUTCDay() + 6) % 7;
  function moveMonth(delta: number) {const next = new Date(month + '-01T12:00:00Z'); next.setUTCMonth(next.getUTCMonth() + delta); setMonth(next.toISOString().slice(0, 7));}
  async function hold() {
    if (!data || !selectedStart) return;
    setBusy(true); setFailure('');
    try {
      const hold = await gatewayClient.createBookingHold({tutorId, subjectId, startAtUtc: selectedStart});
      const details: HeldLesson = {...hold, tutorId, tutorName: data.tutor.displayName, subjectId, subjectName: data.subjects.find(s => s.id === subjectId)?.name ?? 'Tutoring', startAtUtc: selectedStart, endAtUtc: new Date(Date.parse(selectedStart) + 3600000).toISOString()};
      sessionStorage.setItem('tutormatching.booking.hold', JSON.stringify(details));
      notifyAction('Time slot held. Review your lesson before confirming.');
      navigate('/student/book/review');
    } catch (reason) {setFailure(message(reason)); notifyAction(message(reason), 'error'); void reloadSlots();}
    finally {setBusy(false);}
  }
  return <AppShell active="find" contentClassName="book-schedule" title="Book a lesson">
    <p className="booking-steps"><strong>1 Select time</strong><span>2 Review</span><span>3 Confirmed</span></p>
    {!tutorId ? <FriendlyEmptyState kind="search" title="Select a tutor before booking a lesson." description="Find someone who fits your goals, then choose a time to learn together." action={{label:'Find a tutor',to:'/student/find-tutors'}}/> : loading ? <p role="status">Loading tutor…</p> : error ? <Failure error={error} retry={() => void reload()} /> : data && <>
      <section className="student-card"><h2>{data.tutor.displayName}</h2><label>Subject <Select aria-label="Lesson subject" value={subjectId} onChange={event => {setSubjectId(event.target.value); setStart('');}}>{data.tutor.subjects.map(s => <option key={s.subjectId} value={s.subjectId}>{data.subjects.find(subject => subject.id === s.subjectId)?.name ?? 'Subject'}</option>)}</Select></label><p>Times are shown in Vietnam time (GMT+07). Each lesson lasts 60 minutes.</p></section>
      <div className="booking-layout"><section className="student-card month-card"><div className="month-card__header"><h2>{first.toLocaleDateString('en-GB', {timeZone: zone, month: 'long', year: 'numeric'})}</h2><div><Button variant="secondary" aria-label="Previous month" onClick={() => moveMonth(-1)}>‹</Button><Button variant="secondary" aria-label="Next month" onClick={() => moveMonth(1)}>›</Button></div></div><div className="month-weekdays">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(label => <span key={label}>{label}</span>)}</div><div className="month-grid">{Array.from({length: offset}, (_, i) => <span key={'blank-' + i} />)}{Array.from({length: numberOfDays}, (_, i) => {
        const key = month + '-' + String(i + 1).padStart(2, '0');
        const begin = Date.parse(key + 'T00:00:00+07:00');
        const possible = data.tutor.availability.some(w => Date.parse(w.startAtUtc) < begin + 86400000 && Math.min(Date.parse(w.endAtUtc), begin + 86400000) - Math.max(Date.parse(w.startAtUtc), begin, Date.now()) >= 3600000);
        return <button key={key} aria-label={key} aria-pressed={day === key} disabled={!possible || begin > Date.now() + 90 * 86400000} className={(day === key ? 'is-selected' : possible ? 'is-available' : '')} onClick={() => {setDay(key); setStart(''); setFailure('');}}><strong>{i + 1}</strong>{day === key ? <small>Selected</small> : possible ? <small>View slots</small> : null}</button>;
      })}</div></section><section className="student-card time-card"><h2>{dateLabel(day + 'T12:00:00+07:00')}</h2>{slotsLoading ? <p role="status">Checking available slots…</p> : slotsError ? <><p role="alert">{message(slotsError)}</p><Button onClick={() => void reloadSlots()}>Reload slots</Button></> : <div>{slots.map(slot => <button key={slot.startAtUtc} aria-pressed={selectedStart === slot.startAtUtc} className={selectedStart === slot.startAtUtc ? 'is-active' : ''} onClick={() => setStart(slot.startAtUtc)}>{timeLabel(slot.startAtUtc)} – {timeLabel(slot.endAtUtc)}</button>)}{!slots.length && <p>No available slots on this day. Choose another day.</p>}</div>}{failure && <p role="alert">{failure}</p>}<Button disabled={busy || slotsLoading || !!slotsError || !selectedStart} fullWidth onClick={() => void hold()}>{busy ? 'Holding slot…' : 'Continue'}</Button></section></div>
    </>}
  </AppShell>;
}

function Summary({details}: {details: {tutorName: string; subjectName: string; startAtUtc: string; endAtUtc: string}}) {
  return <div className="detail-rows">{[['Tutor', details.tutorName], ['Subject', details.subjectName], ['Date', dateLabel(details.startAtUtc)], ['Time (GMT+07)', timeLabel(details.startAtUtc) + ' – ' + timeLabel(details.endAtUtc)]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>;
}
export function ReviewBookingScreen() {
  const [hold] = useState(readHold);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useMotionNavigate();
  useEffect(() => {const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer);}, []);
  const valid = hold && !!hold.tutorId && !!hold.startAtUtc && Date.parse(hold.expiresAtUtc) > now;
  async function confirm() {
    if (!valid) return;
    setBusy(true); setError('');
    try {
      const booking = await gatewayClient.confirmBooking({holdId: hold.holdId, holdToken: hold.holdToken});
      sessionStorage.removeItem('tutormatching.booking.hold');
      sessionStorage.setItem('tutormatching.booking.confirmed', JSON.stringify(booking));
      notifyAction('Your lesson is confirmed and saved to your schedule.');
      navigate('/student/book/confirmed?bookingId=' + booking.id, {replace: true});
    } catch (reason) {setError(message(reason)); notifyAction(message(reason), 'error');} finally {setBusy(false);}
  }
  return <AppShell active="bookings" contentClassName="review-booking" title="Review your booking">{valid ? <div className="review-layout"><section className="student-card lesson-summary"><h2>Lesson summary</h2><Summary details={hold} /></section><aside><section className="booking-policy"><h2>Booking policy</h2><p>Cancel at least {hold.cancellationNoticeHours ?? 12} hours before the lesson.</p><p>Hold expires in {Math.max(0, Math.ceil((Date.parse(hold.expiresAtUtc) - now) / 1000))} seconds.</p></section>{error && <p role="alert">{error}</p>}<Button disabled={busy} fullWidth onClick={() => void confirm()}>{busy ? 'Confirming…' : 'Confirm booking'}</Button></aside></div> : <FriendlyEmptyState kind="calendar" title="No active reservation" description="Your hold is missing or has expired. Choose a tutor and select a new time slot when you’re ready." action={{label:'Find a tutor',to:'/student/find-tutors'}}/>}</AppShell>;
}
function useBooking(id: string) {
  const load = useCallback(async () => {
    const detail = await gatewayClient.getBookingDetails(id);
    const [tutor, subjects] = await Promise.all([gatewayClient.getTutor(detail.booking.tutorId), gatewayClient.listSubjects()]);
    return {...detail, tutorName: tutor.displayName, subjectName: subjects.find(subject => subject.id === detail.booking.subjectId)?.name ?? 'Tutoring', startAtUtc: detail.booking.startAtUtc, endAtUtc: detail.booking.endAtUtc};
  }, [id]);
  return useGatewayResource(load, null);
}
function ConfirmationIcon({kind}:{kind:'tutor'|'subject'|'date'|'time'}) {
 return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='tutor'?<><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></>:kind==='subject'?<><path d="M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15"/></>:kind==='date'?<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m4 4h2m4 0h2"/></>:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}</svg>;
}
export function BookingConfirmedScreen() {
  const [params] = useSearchParams();
  const id = params.get('bookingId') ?? '';
  const {data, loading, error, reload} = useBooking(id);
  const confirmed=data?.booking.status==='Confirmed';
  return <AppShell active="bookings" contentClassName="booking-confirmed" title="Booking confirmed">{loading ? <p role="status">Loading confirmation…</p> : error ? <Failure error={error} retry={() => void reload()} /> : data && <section className="student-card booking-success-card" aria-labelledby="booking-success-title">
    <header className="booking-success-header">
      {confirmed?<BookingCelebration/>:null}
      <span className="booking-success-status" data-status={data.booking.status}>{confirmed?<svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6"/><path d="m6 10 3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>:null}{data.booking.status}</span>
      <h2 id="booking-success-title">{confirmed?'Your lesson is booked!':'Your booking status'}</h2>
      <p>{confirmed?'A little time set aside for something great. Your lesson is saved to My bookings.':'You can find the latest details and status in My bookings.'}</p>
    </header>
    <dl className="booking-success-details">{([
      ['tutor','Your tutor',data.tutorName],['subject','Subject',data.subjectName],['date','Lesson date',dateLabel(data.startAtUtc)],['time','Time (GMT+07)',timeLabel(data.startAtUtc)+' – '+timeLabel(data.endAtUtc)],
    ] as const).map(([kind,label,value])=><div className="booking-success-detail" key={kind}><span className={'booking-detail-icon booking-detail-icon--'+kind}><ConfirmationIcon kind={kind}/></span><div><dt>{label}</dt><dd>{value}</dd></div></div>)}</dl>
    <div className="booking-success-actions"><Link className="booking-success-primary" to={'/student/bookings/' + data.booking.id}>View booking details <span aria-hidden="true">→</span></Link><Link className="booking-success-secondary" to="/student/dashboard">Back to dashboard</Link></div>
    <p className="booking-success-reference">Booking reference <span>{data.booking.id}</span></p>
  </section>}</AppShell>;
}
export function BookingDetailsScreen() {
  const {bookingId = ''} = useParams();
  const {data, loading, error, reload} = useBooking(bookingId);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  async function cancel() {setBusy(true);setFailure('');try {await gatewayClient.cancelBooking(bookingId, 'StudentRequested'); notifyAction('Booking cancelled. Your schedule has been updated.'); await reload();} catch (reason) {setFailure(message(reason)); notifyAction(message(reason), 'error');} finally {setBusy(false);}}
  const booking: Booking | undefined = data?.booking;
  const late = !!booking?.cancellationDeadlineUtc && Date.now() > Date.parse(booking.cancellationDeadlineUtc);
  return <AppShell active="bookings" contentClassName="booking-details" title="Booking details">{loading ? <p role="status">Loading booking…</p> : error ? <Failure error={error} retry={() => void reload()} /> : data && <section className="student-card lesson-detail-card" aria-labelledby="lesson-detail-title">
    <header className="lesson-detail-header"><div><Link className="lesson-detail-back" to="/student/bookings">← My bookings</Link><span className="lesson-detail-eyebrow">Your private lesson</span><h2 id="lesson-detail-title">{data.subjectName} with {data.tutorName}</h2><span className="booking-status" data-status={data.booking.status}>{data.booking.status}</span></div><FriendlyIllustration kind="calendar"/></header>
    <dl className="lesson-detail-facts">{([
      ['tutor','Your tutor',data.tutorName],['subject','Subject',data.subjectName],['date','Lesson date',dateLabel(data.startAtUtc)],['time','Time (GMT+07)',timeLabel(data.startAtUtc)+' – '+timeLabel(data.endAtUtc)],
    ] as const).map(([kind,label,value])=><div className="lesson-detail-fact" key={kind}><span className={'booking-detail-icon booking-detail-icon--'+kind}><ConfirmationIcon kind={kind}/></span><div><dt>{label}</dt><dd>{value}</dd></div></div>)}</dl>
    <section className="lesson-detail-policy" aria-label="Cancellation policy"><span className="lesson-detail-policy-icon"><ConfirmationIcon kind="time"/></span><div><h3>{booking?.status==='Cancelled'?'This booking has been cancelled':late?'The cancellation window has closed':'Need to change your plans?'}</h3><p>{booking?.status==='Cancelled'?'This lesson remains in your booking history. You can find another tutor or choose a new time.':booking?.cancellationDeadlineUtc?<>You can cancel before <strong>{dateLabel(booking.cancellationDeadlineUtc)} · {timeLabel(booking.cancellationDeadlineUtc)} (GMT+07)</strong>.</>:'Check your booking status before making changes.'}</p></div></section>
    {failure && <p className="lesson-detail-error" role="alert">{failure}</p>}
    <footer className="lesson-detail-footer"><div className="lesson-detail-reference"><span>Booking reference</span><code>{data.booking.id}</code></div><div className="lesson-detail-actions"><Link to={'/student/messages?tutor='+data.booking.tutorId}>Message tutor</Link><Link to="/student/bookings">My bookings</Link><Button variant="danger" disabled={busy || booking?.status !== 'Confirmed' || late} onClick={() => void cancel()}>{busy ? 'Cancelling…' : booking?.status === 'Cancelled' ? 'Booking cancelled' : late ? 'Cancellation window closed' : 'Cancel booking'}</Button></div></footer>
  </section>}</AppShell>;

}
