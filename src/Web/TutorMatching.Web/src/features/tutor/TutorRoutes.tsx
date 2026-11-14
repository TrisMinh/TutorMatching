import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { gatewayClient, type Booking, type NotificationItem, type Subject, type TutorProfile } from '../../api';
import { useGatewayResource } from '../../api/useGatewayResource';
import { Button } from '../../design-system/Button';
import { TextField } from '../../design-system/TextField';
import { AppShell } from '../../shared/AppShell';
import { useMotionNavigate } from '../../shared/MotionLink';
import './tutor.css';

const tutorShell = (active: string, title: string, className: string, content: ReactNode, mobileTitle?: string) => (
  <AppShell active={active} contentClassName={`tutor-content ${className}`} mobileTitle={mobileTitle} mode="tutor" title={title}>{content}</AppShell>
);

const tutorProfileKey = 'tutormatching.tutor.profileId';

function apiMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

function formatLesson(booking: Booking) {
  const start = new Date(booking.startAtUtc);
  return {
    time: start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }),
    title: `Lesson • ${booking.subjectId.slice(0, 8)}`,
    note: `${start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Ho_Chi_Minh' })} • ${booking.status}`,
  };
}

export function TutorDashboard() {
  const loadBookings = useCallback(() => gatewayClient.listBookings(), []);
  const { data: remoteBookings } = useGatewayResource<Booking[] | null>(loadBookings, null);
  const fixtureLessons = [['09:00','Mathematics • Lan Anh','Starts in 24 minutes'],['11:00','Physics • Quang Minh','Online lesson'],['15:30','Mathematics • Thu Trang','Online lesson'],['19:00','Exam prep • Gia Huy','Online lesson']];
  const lessons = remoteBookings?.slice(0, 4).map((booking) => Object.values(formatLesson(booking))) ?? fixtureLessons;
  const stats = [['Upcoming lessons',String(remoteBookings?.length ?? 8),'This week'],['Pending requests','3','This week'],['Hours taught','126','This week'],['Profile views','1,284','+18% this month']];
  return tutorShell('dashboard','Welcome back, Minh Anh','tutor-dashboard',<>
    <div className="tutor-stats">{stats.map(([label,value,note])=><article className="student-card" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
    <div className="tutor-dashboard__columns"><section className="student-card tutor-today"><h2>Today’s schedule</h2>{lessons.map(([time,title,note],index)=><article className={index===0?'is-next':''} key={time}><p><strong>{time}</strong>　{title}</p><span>{note}</span></article>)}</section><section className="student-card tutor-request-summary"><h2>Booking requests</h2>{[['Bao • Grade 9','Requested Wed, 18 Nov • 18:00'],['Linh • Grade 12','Requested Thu, 19 Nov • 18:00'],['Huy • Grade 10','Requested Fri, 20 Nov • 18:00']].map(([name,time])=><article key={name}><div><strong>{name}</strong><span>{time}</span></div><Button>Review</Button></article>)}</section></div>
  </>);
}

export function TutorOnboarding() {
  const navigate = useMotionNavigate();
  const [headline, setHeadline] = useState('Math tutor helping students master exams');
  const [bio, setBio] = useState('I help students build strong foundations through clear, practical explanations.');
  const [experienceYears, setExperienceYears] = useState('5');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function saveProfile() {
    setSaving(true);
    setError('');
    try {
      const profile = await gatewayClient.saveTutorProfile({
        displayName: headline.trim() || 'Tutor',
        bio: bio.trim(),
        experienceYears: Math.max(0, Number.parseInt(experienceYears, 10) || 0),
        avatarUrl: '/assets/figma/student-tutor-1.jpg',
      });
      window.sessionStorage.setItem(tutorProfileKey, profile.id);
      navigate('/tutor/subjects-pricing', { viewTransition: true });
    } catch (reason) {
      setError(apiMessage(reason, 'Unable to save your tutor profile.'));
    } finally {
      setSaving(false);
    }
  }

  return tutorShell('profile','Set up your tutor profile','tutor-onboarding',<>
    <p className="tutor-step">Step 1 of 4 • Profile basics</p><section className="student-card tutor-form-card"><h2>Build a profile students can trust</h2><TextField label="Professional headline" onChange={(event) => setHeadline(event.target.value)} value={headline}/><TextField label="Bio" onChange={(event) => setBio(event.target.value)} value={bio}/><TextField defaultValue="Hanoi National University of Education" label="Education"/><TextField label="Years of experience" min="0" onChange={(event) => setExperienceYears(event.target.value)} type="number" value={experienceYears}/><TextField defaultValue="Vietnamese, English" label="Languages"/></section>{error ? <p className="tm-field__message tm-field__message--error" role="alert">{error}</p> : null}<Button className="tutor-form-save" disabled={saving} onClick={saveProfile} size="large">{saving ? 'Saving…' : 'Save & continue'}</Button>
  </>);
}

export function SubjectsPricing() {
  const navigate = useMotionNavigate();
  const loadSubjects = useCallback(() => gatewayClient.listSubjects(), []);
  const { data: apiSubjects } = useGatewayResource<Subject[] | null>(loadSubjects, null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const cards = apiSubjects?.slice(0, 3).map((subject, index) => [subject.name, index === 0 ? 'Grade 8–12' : 'Grade 10–12', `${150 + index * 10},000₫`]) ?? [['Mathematics','Grade 8–12','150,000₫'],['Physics','Grade 10–12','160,000₫'],['Exam preparation','High school','180,000₫']];

  async function saveSubjects() {
    if (!apiSubjects?.length) {
      setError('Subjects are unavailable. Start the API stack and try again.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await gatewayClient.saveTutorSubjects(apiSubjects.slice(0, 3).map((subject, index) => ({ subjectId: subject.id, proficiencyLevel: Math.min(index + 1, 3) })));
      navigate('/tutor/availability', { viewTransition: true });
    } catch (reason) {
      setError(apiMessage(reason, 'Unable to save subjects.'));
    } finally {
      setSaving(false);
    }
  }

  return tutorShell('profile','Subjects and pricing','tutor-subjects',<section className="student-card tutor-subject-card"><h2>What do you teach?</h2><p>Add subjects, levels, and your hourly rate.</p>{cards.map(([subject,level,price])=><article key={subject}><div><strong>{subject}</strong><span>{level}</span></div><p><strong>{price}</strong> / hour</p><Button variant="secondary">Edit</Button></article>)}<Button className="tutor-add-subject" variant="secondary">+ Add subject</Button>{error ? <p className="tm-field__message tm-field__message--error" role="alert">{error}</p> : null}<Button className="tutor-subject-save" disabled={saving} onClick={saveSubjects} size="large">{saving ? 'Saving…' : 'Save changes'}</Button></section>);
}

export function TutorAvailability() {
  const [added,setAdded]=useState(false);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const blocks=[['Mon','18:00 – 21:00'],['Tue','09:00 – 12:00 • 14:00 – 18:00'],['Wed','18:00 – 21:00'],['Thu','18:00 – 21:00'],['Fri','18:00 – 21:00'],['Sat','18:00 – 21:00'],['Sun','Unavailable']];
  async function saveAvailability() {
    setSaving(true); setMessage('');
    try {
      await gatewayClient.saveTutorAvailability([
        { startAtUtc: '2026-11-16T11:00:00Z', endAtUtc: '2026-11-16T14:00:00Z' },
        { startAtUtc: '2026-11-17T02:00:00Z', endAtUtc: '2026-11-17T05:00:00Z' },
        { startAtUtc: '2026-11-17T07:00:00Z', endAtUtc: '2026-11-17T11:00:00Z' },
        { startAtUtc: '2026-11-18T11:00:00Z', endAtUtc: '2026-11-18T14:00:00Z' },
        { startAtUtc: '2026-11-19T11:00:00Z', endAtUtc: '2026-11-19T14:00:00Z' },
        { startAtUtc: '2026-11-20T11:00:00Z', endAtUtc: '2026-11-20T14:00:00Z' },
        { startAtUtc: '2026-11-21T11:00:00Z', endAtUtc: '2026-11-21T14:00:00Z' },
      ]);
      setMessage('Availability saved');
    } catch (reason) {
      setMessage(apiMessage(reason, 'Unable to save availability.'));
    } finally { setSaving(false); }
  }
  return tutorShell('availability','Availability','tutor-availability-page',<div className="tutor-availability-layout"><section className="student-card tutor-weekly"><div><h2>Weekly availability</h2><span>Weekly hours • Asia/Ho_Chi_Minh</span></div>{blocks.map(([day,time],index)=><article key={day}><strong>{day}</strong><div><span className={index===1?'is-selected':''}>{time}</span></div></article>)}</section><aside><section className="student-card tutor-edit-availability"><h2>Edit availability</h2><p>Tuesday</p><TextField defaultValue="09:00" label="Start time"/><TextField defaultValue="12:00" label="End time"/><TextField defaultValue="Every week" label="Repeat"/><Button fullWidth onClick={()=>setAdded(true)} size="large">Add time block</Button>{added?<p className="tutor-added">09:00 – 12:00 added</p>:null}</section>{message ? <p aria-live="polite" className={message === 'Availability saved' ? 'tutor-added' : 'tm-field__message tm-field__message--error'}>{message}</p> : null}<Button disabled={saving} fullWidth onClick={saveAvailability} size="large">{saving ? 'Saving…' : 'Save availability'}</Button></aside></div>);
}

const requests=[['Nguyen Bao • Grade 9','Mathematics • Wed, 18 Nov, 18:00',1],['Tran Linh • Grade 10','Physics • Thu 19 Nov, 19:00',3],['Le Huy • Grade 11','Math • Sat 21 Nov, 15:30',2],['Pham Mai • Grade 12','Exam prep • Sun 22 Nov, 09:00',1]] as const;

export function TutorRequests() {
  const [accepted,setAccepted]=useState<string[]>([]);
  return tutorShell('bookings','Booking requests','tutor-requests',<><div className="tutor-request-tabs"><button className="is-active">Pending</button><button>Accepted</button><button>Declined</button></div><div className="tutor-request-list">{requests.map(([name,detail,image])=><article className="student-card" key={name}><img alt="" src={`/assets/figma/student-tutor-${image}.jpg`}/><div><h2>{name}</h2><p>{detail}</p><span>“Need help preparing for the next test.”</span></div>{accepted.includes(name)?<strong className="request-accepted">Request accepted</strong>:<div className="tutor-request-actions"><Button onClick={()=>setAccepted(current=>[...current,name])} variant="danger">Decline</Button><Button onClick={()=>setAccepted(current=>[...current,name])}>Accept</Button></div>}</article>)}</div></>);
}

export function TutorSchedule() {
  const loadBookings = useCallback(() => gatewayClient.listBookings(), []);
  const { data: remoteBookings } = useGatewayResource<Booking[] | null>(loadBookings, null);
  const days=['Tue 17','Wed 18','Thu 19','Fri 20','Sat 21','Sun 22','Mon 23'];
  const cells=Array.from({length:35},(_,index)=>({index,label:({1:'Mathematics|9:00',7:'Physics|11:00',11:'Physics|11:00',17:'Mathematics|13:00',23:'Physics|15:00',27:'Physics|15:00',29:'Mathematics|17:00',33:'Mathematics|17:00'} as Record<number,string>)[index]}));
  const mobileLessons = remoteBookings?.map((booking) => {
    const lesson = formatLesson(booking);
    return [lesson.time, lesson.title, lesson.note];
  }) ?? [['09:00','Mathematics • Bao','Online lesson • 60 min'],['11:00','Physics • Linh','Online lesson • 60 min'],['15:30','Math • Trang','Online lesson • 60 min'],['19:00','Exam prep • Huy','Online lesson • 60 min']];
  return tutorShell('schedule','Schedule','tutor-schedule',<><section className="student-card tutor-calendar"><div className="tutor-calendar__head"><h2>17 – 23 November 2026</h2><span>Asia/Ho_Chi_Minh</span></div><div className="tutor-calendar__days">{days.map(day=><span key={day}>{day}</span>)}</div><div className="tutor-calendar__grid">{cells.map(cell=><div className={cell.label?(cell.index===1||cell.index===29?'is-blue':'has-lesson'):''} key={cell.index}>{cell.label?cell.label.split('|').map(value=><span key={value}>{value}</span>):null}</div>)}</div></section><section className="tutor-mobile-schedule"><h2>18 November 2026</h2>{mobileLessons.map(([time,title,note],index)=><article key={`${time}-${title}`}><time>{time}</time><div className={index===0?'is-next':''}><strong>{title}</strong><span>{note}</span></div></article>)}</section></>,'Tutor schedule');
}

function TutorDetailRows({rows}:{rows:Array<[string,string]>}) { return <div className="tutor-detail-rows">{rows.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>; }

export function TutorLessonDetails() {
  return tutorShell('schedule','Lesson details','tutor-lesson-detail',<div className="tutor-detail-layout"><section className="student-card tutor-detail-card"><h2>Mathematics with Nguyen Bao</h2><span className="booking-status">Confirmed</span><TutorDetailRows rows={[["Student","Nguyen Bao • Grade 9"],["Date","Wednesday, 18 November 2026"],["Time","18:00 – 19:00"],["Format","Online • Google Meet"],["Student goal","Prepare for algebra midterm"],["Tutor notes","Bring practice set #4 and review common mistakes."]]}/></section><aside><Button fullWidth size="large">Start lesson</Button><Button fullWidth size="large" variant="secondary">Message student</Button><Button fullWidth size="large" variant="danger">Cancel lesson</Button></aside></div>);
}

export function TutorPublicProfile() {
  const navigate = useMotionNavigate();
  const profileId = typeof window === 'undefined' ? null : window.sessionStorage.getItem(tutorProfileKey);
  const loadProfile = useCallback(() => profileId ? gatewayClient.getTutor(profileId) : Promise.reject(new Error('Tutor profile has not been saved yet.')), [profileId]);
  const { data: profile } = useGatewayResource<TutorProfile | null>(loadProfile, null);
  const name = profile?.displayName ?? 'Nguyen Minh Anh';
  const avatar = profile?.avatarUrl ?? '/assets/figma/student-tutor-1.jpg';
  return tutorShell('profile','Public profile preview','tutor-public-profile',<section className="student-card tutor-public-card"><div className="tutor-public-head"><div className="profile-avatar"><img alt={name} src={avatar}/><span/></div><div><h2>{name}</h2><p>Mathematics &amp; Physics Tutor</p><strong>★ 4.9 • 126 reviews • 482 lessons</strong><span className="tutor-verified">Verified</span></div></div><div className="tutor-public-body"><div><h3>About me</h3><p>{profile?.bio ?? 'I help students understand difficult concepts, build confidence, and develop reliable study habits.'}</p><h3>Subjects</h3><div className="tag-row"><span>Mathematics</span><span>Physics</span><span>Exam prep</span></div></div><aside><strong>From 150,000₫ / hour</strong><Button fullWidth onClick={() => navigate('/tutor/onboarding', { viewTransition: true })} size="large">Edit profile</Button></aside></div></section>);
}

export function TutorNotifications() {
  const fallback=[['New booking request','Bao requested Mathematics on Tue at 18:00.','2 min ago',3],['Booking accepted','Your session with Linh is confirmed.','Yesterday',2],['Lesson starts soon','Mathematics with Bao starts in 30 minutes.','Yesterday',1],['Student cancelled lesson','Mai cancelled Saturday’s lesson.','Yesterday',3],['Profile approved','Students can now discover your profile.','Yesterday',2]] as const;
  const loadNotifications = useCallback(() => gatewayClient.listNotifications(), []);
  const { data, setData } = useGatewayResource(loadNotifications, null);
  const items = useMemo(() => data?.items.map((notification, index) => ({
    id: notification.id,
    title: notification.title,
    body: notification.body,
    time: new Date(notification.createdAtUtc).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    image: (index % 3) + 1,
    unread: notification.status === 'Unread',
    source: notification,
  })) ?? fallback.map(([title,body,time,image], index) => ({ id: title, title, body, time, image, unread: index === 0, source: undefined })), [data]);

  async function markRead(notification?: NotificationItem) {
    if (!notification || notification.status !== 'Unread') return;
    await gatewayClient.markNotificationRead(notification.id);
    setData((current) => current ? { ...current, items: current.items.map((item) => item.id === notification.id ? { ...item, status: 'Read' } : item) } : current);
  }
  return tutorShell('notifications','Notifications','tutor-notifications',<div className="notification-list">{items.map((item)=><article className={`student-card notification-item ${item.unread?'is-unread':''}`} key={item.id} onClick={() => void markRead(item.source)}><div className="notification-avatar"><img alt="" src={`/assets/figma/student-tutor-${item.image}.jpg`}/><span/></div><div><h2>{item.title}</h2><p>{item.body}</p></div><time>{item.time}</time></article>)}</div>);
}

function TutorToggle({defaultOn=false,description,label}:{defaultOn?:boolean;description:string;label:string}) {
  const [on,setOn]=useState(defaultOn); return <div className="setting-row"><div><strong>{label}</strong><span>{description}</span></div><button aria-checked={on} aria-label={label} className={on?'is-on':''} onClick={()=>setOn(value=>!value)} role="switch" type="button"><span/></button></div>;
}

export function TutorSettings() {
  return tutorShell('settings','Settings','tutor-settings',<section className="student-card tutor-settings-card"><h2>Tutor preferences</h2><TutorToggle label="Auto-accept repeat students" description="Automatically approve requests from existing students"/><TutorToggle defaultOn label="Booking reminders" description="Email and push alerts before lessons"/><TutorToggle defaultOn label="New request alerts" description="Notify immediately for booking requests"/><TutorToggle defaultOn label="Profile visibility" description="Allow students to find your profile"/><div className="tutor-policy"><div><strong>Cancellation policy</strong><span>Free cancellation up to 12 hours before a lesson</span></div><Button variant="secondary">Edit policy</Button></div><Button className="tutor-settings-save" size="large">Save settings</Button></section>);
}

export const tutorRoutes=[
  {path:'/tutor/dashboard',element:<TutorDashboard/>},{path:'/tutor/onboarding',element:<TutorOnboarding/>},{path:'/tutor/subjects-pricing',element:<SubjectsPricing/>},{path:'/tutor/availability',element:<TutorAvailability/>},{path:'/tutor/requests',element:<TutorRequests/>},{path:'/tutor/schedule',element:<TutorSchedule/>},{path:'/tutor/lessons/18-nov-math',element:<TutorLessonDetails/>},{path:'/tutor/public-profile',element:<TutorPublicProfile/>},{path:'/tutor/notifications',element:<TutorNotifications/>},{path:'/tutor/settings',element:<TutorSettings/>},
];
