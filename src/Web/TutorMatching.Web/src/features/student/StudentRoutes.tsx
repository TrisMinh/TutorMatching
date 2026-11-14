import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { gatewayClient, type Booking, type NotificationItem, type StudentProfile, type Subject, type TutorProfile } from '../../api';
import { useGatewayResource } from '../../api/useGatewayResource';
import { Button } from '../../design-system/Button';
import { TextField } from '../../design-system/TextField';
import { AppShell } from '../../shared/AppShell';
import { MotionLink as Link, useMotionNavigate } from '../../shared/MotionLink';
import { studentBookings, studentNotifications, studentTutors } from '../../shared/fixtures';
import './student.css';
import { calendarEvents } from '../../shared/calendarEvents';
import { CourseIcon, TrendIcon } from '../../design-system/CourseIcon';
import { CourseCalendar, calendarWeek, calendarDay, calendarZones } from './CourseCalendar';
import { Toast } from '../../shared/Toast';
import {NotificationDetails,notificationTitle} from '../../shared/notificationPresentation';
import { BookingDetailsPanel } from '../../shared/BookingDetailsPanel';
import { Select } from '../../design-system/Select';
import { MyCourses } from '../../shared/MyCourses';

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
  return <TemplateDashboardReference />;
}

export function TemplateDashboardReference({mode='student',active='dashboard'}:{mode?:'student'|'tutor';active?:string}={}) {
  const isTutor=mode==='tutor';
  const prefix=isTutor?'/tutor':'/student';
  const coursePath=(id:string)=>isTutor?`/tutor/courses?course=${encodeURIComponent(id)}`:`/student/courses/${id}`;
  const bookingPath=(id:string)=>isTutor?`/tutor/lessons/${id}`:`/student/bookings/${id}`;
  const loadTutor=useCallback(()=>isTutor?gatewayClient.getMyTutorProfile():Promise.resolve(null),[isTutor]);
  const {data:tutorAccount}=useGatewayResource(loadTutor,null);
  const [scheduleZone,setScheduleZone]=useState(()=>{const saved=localStorage.getItem('tutormatching.scheduleZone');return calendarZones.some(item=>item[0]===saved)?saved!:'Asia/Ho_Chi_Minh';});
  const navigate=useMotionNavigate();
  const loadCourses=useCallback(()=>isTutor?gatewayClient.listMyCourses():gatewayClient.listCourses(),[isTutor]);
  const {data:realCourses,reload:reloadCatalog}=useGatewayResource(loadCourses,[]);
  const loadPersonalSchedule=useCallback(async()=>{
    const [courses,bookings,subjects]=await Promise.all([gatewayClient.listMyCourses(),gatewayClient.listBookings(),gatewayClient.listSubjects()]);
    const lessons=bookings.filter(b=>b.status==='Confirmed').map(b=>({
      id:`booking:${b.id}`,title:`${subjects.find(s=>s.id===b.subjectId)?.name??'Private'} lesson`,
      tutorId:b.tutorId,instructor:'Private lesson',image:'/assets/figma/student-tutor-1.jpg',category:'Booking',description:'Confirmed private booking',capacity:1,enrolled:1,
      sessions:[{id:b.id,startAtUtc:b.startAtUtc,endAtUtc:b.endAtUtc}],
    }));
    return [...courses,...lessons];
  },[]);
  const {data:personalSchedule,loading:scheduleLoading,error:scheduleError,reload:reloadSchedule}=useGatewayResource(loadPersonalSchedule,[]);
  const enrolledSchedule=personalSchedule.filter(item=>!item.id.startsWith('booking:'));
  function showScheduleItem(id:string){
    const item=personalSchedule.find(c=>c.id===id);
    const session=item?.sessions.find(s=>+new Date(s.endAtUtc)>Date.now())??item?.sessions[0];
    if(!session)return;
    const key=new Intl.DateTimeFormat('en-CA',{timeZone:scheduleZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(session.startAtUtc));
    setWeekOffset(Math.floor((+calendarDay(key,scheduleZone)-+calendarWeek(personalSchedule,0,scheduleZone))/(7*86400000)));
    setSelectedDate(key);setMonthShift(0);
  }
  const loadBookings = useCallback(() => gatewayClient.listBookings(), []);
  const { data: remoteBookings, loading, error, reload } = useGatewayResource<Booking[] | null>(loadBookings, null);
  useEffect(()=>{if(!isTutor)return;const refresh=()=>{void reloadSchedule();void reload();void reloadCatalog();};window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[isTutor,reloadSchedule,reload,reloadCatalog]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [courseFilter, setCourseFilter] = useState('All Course');
  const [courseSize,setCourseSize]=useState<'small'|'medium'|'large'>(()=>{const saved=window.localStorage.getItem('tutormatching.courseView');return saved==='small'||saved==='large'?saved:'medium';});
  const [selectedDate,setSelectedDate]=useState('');
  const [monthShift,setMonthShift]=useState(0);
  const [selectedEvent, setSelectedEvent] = useState('');
  const upcomingCourseEvents=isTutor?realCourses.map(c=>({...c,sessions:[...c.sessions].filter(s=>+new Date(s.endAtUtc)>Date.now()).sort((a,b)=>a.startAtUtc.localeCompare(b.startAtUtc))})).filter(c=>c.sessions.length).sort((a,b)=>a.sessions[0].startAtUtc.localeCompare(b.sessions[0].startAtUtc)).slice(0,3):realCourses.filter(course=>['typography','figma-ui-design'].includes(course.id));
  const mockEvent = calendarEvents.find(event=>event.title===selectedEvent);
  const realEvent = realCourses.find(course=>course.title===selectedEvent);
  const firstSession = realEvent?.sessions[0];
  const eventDetails = realEvent ? {title:realEvent.title,image:realEvent.image.replace('/assets/figma/',''),description:realEvent.description,instructor:realEvent.instructor,day:firstSession?new Date(firstSession.startAtUtc).toLocaleDateString('en-GB',{timeZone:'Asia/Ho_Chi_Minh'}):'',time:firstSession?new Date(firstSession.startAtUtc).toLocaleTimeString('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'}):'',format:realEvent.category,participants:[`${realEvent.enrolled} / ${realEvent.capacity} enrolled`]} : mockEvent;
  const weekStart=calendarWeek(personalSchedule,weekOffset,scheduleZone);
  const weekHasSessions=personalSchedule.some(c=>c.sessions.some(s=>+new Date(s.startAtUtc)>=+weekStart&&+new Date(s.startAtUtc)<+weekStart+7*86400000));
  const weekLabel = `${weekStart.toLocaleDateString('en-GB',{timeZone:scheduleZone,day:'numeric',month:'short'})} – ${new Date(+weekStart+6*86400000).toLocaleDateString('en-GB',{timeZone:scheduleZone,day:'numeric',month:'short',year:'numeric'})}`;
  const upcomingBookings = (remoteBookings ?? []).filter((booking) => booking.status !== 'Cancelled' && new Date(booking.endAtUtc).getTime() > Date.now());
  const upcomingCount = upcomingBookings.length;
  const courseTabs = ['All Course', 'One by One', 'Webinar', 'Personal Coaching', 'Workshop'];
  const localWeek=selectedDate?new Date(selectedDate+'T12:00:00Z'):new Date(new Intl.DateTimeFormat('en-CA',{timeZone:scheduleZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(weekStart)+'T12:00:00Z');
  const monthStart=new Date(Date.UTC(localWeek.getUTCFullYear(),localWeek.getUTCMonth()+monthShift,1));
  const gridStart=new Date(+monthStart-((monthStart.getUTCDay()+6)%7)*86400000);
  const miniCalendarDays=Array.from({length:42},(_,index)=>new Date(+gridStart+index*86400000));
  const miniDaysRef=useRef<HTMLDivElement>(null);
  const previousMonth=useRef(+monthStart);
  const coursePanelRef=useRef<HTMLDivElement>(null);
  const courseRects=useRef(new Map<string,DOMRect>());
  useLayoutEffect(()=>{
    const direction=Math.sign(+monthStart-previousMonth.current);
    previousMonth.current=+monthStart;
    if(!direction||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const animation=miniDaysRef.current?.animate([{transform:`translateX(${direction*22}px)`,opacity:0},{transform:'translateX(0)',opacity:1}],{duration:240,easing:'cubic-bezier(.22,1,.36,1)'});
    return()=>animation?.cancel();
  },[+monthStart]);
  function changeCourseSize(size:'small'|'medium'|'large'){
    if(size===courseSize)return;
    courseRects.current=new Map(Array.from(coursePanelRef.current?.querySelectorAll('a')??[],element=>[element.getAttribute('href')!,element.getBoundingClientRect()]));
    setCourseSize(size);localStorage.setItem('tutormatching.courseView',size);
  }
  useLayoutEffect(()=>{
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){courseRects.current.clear();return;}
    const animations=Array.from(coursePanelRef.current?.querySelectorAll('a')??[],element=>{
      const before=courseRects.current.get(element.getAttribute('href')!);
      if(!before)return;
      const after=element.getBoundingClientRect();
      return element.animate([{transform:`translate(${before.left-after.left}px,${before.top-after.top}px) scale(${before.width/after.width},${before.height/after.height})`,opacity:.7},{transform:'none',opacity:1}],{duration:260,easing:'cubic-bezier(.22,1,.36,1)'});
    });
    courseRects.current.clear();
    return()=>animations.forEach(animation=>animation?.cancel());
  },[courseSize]);
  function selectCalendarDate(date:Date){
    const key=date.toISOString().slice(0,10);
    const localMidnight=calendarDay(key,scheduleZone);
    setWeekOffset(Math.floor((+localMidnight-+calendarWeek(personalSchedule,0,scheduleZone))/(7*86400000)));
    setSelectedDate(key);setMonthShift(0);
  }

  return (
    <AppShell active={active} mode={mode} contentClassName="student-dashboard" title={isTutor?(active==='schedule'?'Schedule':`Good morning, ${tutorAccount?.displayName??'Tutor'}`):'Good morning, Minh'}>
      <section className="dashboard-compact" hidden>
        <div className="dashboard-stats">
          {[['Upcoming', String(upcomingCount)], ['Hours learned', '24'], ['Tutors', '5']].map(([label, value]) => (
            <article key={label}><span>{label}</span><strong>{value}</strong></article>
          ))}
        </div>
        <div className="dashboard-week">
          <div className="dashboard-week__header"><h2>This week</h2><Link to={isTutor?'/tutor/requests':'/student/bookings'} viewTransition>View bookings</Link></div>
          {loading ? <p className="dashboard-feedback" role="status">Loading your schedule…</p> : error ? <div className="dashboard-feedback" role="alert"><p>Unable to load your schedule.</p><Button onClick={() => void reload()} variant="secondary">Try again</Button></div> : upcomingCount === 0 ? <div className="dashboard-feedback"><h3>No upcoming lessons</h3><p>Find a tutor and book a time that works for you.</p><Link className="student-primary-link" to="/student/find-tutors">Find a tutor</Link></div> : null}
          <div className="dashboard-week__days">
            {weekdays.map((day, dayIndex) => (
              <div className="dashboard-week__day" key={day}>
                <span>{day}</span>
                {upcomingBookings.filter(booking => new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(booking.startAtUtc)) === weekdays[dayIndex]).map(booking => <Link className="has-lesson" key={booking.id} to={bookingPath(booking.id)}><strong>Lesson</strong><small>{new Date(booking.startAtUtc).toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'})}</small></Link>)}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard-template" aria-label="My schedule">
        {eventDetails ? <div className="schedule-event-overlay" onClick={() => setSelectedEvent('')}><section aria-label="Event details" aria-modal="true" role="dialog" onClick={event => event.stopPropagation()}><Button onClick={() => setSelectedEvent('')} variant="secondary">Close</Button><img className="calendar-detail-photo" alt="" src={`/assets/figma/${eventDetails.image}`}/><h2>{eventDetails.title}</h2><p>{eventDetails.description}</p><DetailRows rows={[["Instructor",eventDetails.instructor],["Date",eventDetails.day],["Time",`${eventDetails.time} (GMT+07)`],["Format",eventDetails.format],["Participants",eventDetails.participants.join(', ')]]}/></section></div> : null}
        <div className="dashboard-legacy">
          <div className="legacy-schedule-head"><h2>{isTutor?'Teaching Schedule':'My Schedule'}</h2></div>
          <div className="legacy-date">
            <span>{weekLabel}</span>
            <button aria-label="Previous week" onClick={() => {setWeekOffset((value) => value - 1);setSelectedDate('');setMonthShift(0);}} type="button">‹</button>
            <button aria-label="Next week" onClick={() => {setWeekOffset((value) => value + 1);setSelectedDate('');setMonthShift(0);}} type="button">›</button>
            <Select className="schedule-timezone" aria-label="Schedule timezone" value={scheduleZone} onChange={event=>{setScheduleZone(event.target.value);localStorage.setItem('tutormatching.scheduleZone',event.target.value);setSelectedDate('');setMonthShift(0);}}>{calendarZones.map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select>
          </div>
          <div className="schedule-legend"><span>● {isTutor?'Courses I teach':'Enrolled courses'}</span><span>● Confirmed bookings</span></div>
          {enrolledSchedule.length>0&&<div className="schedule-course-jump"><label htmlFor="enrolled-course-jump">{isTutor?'Courses I teach':'Enrolled courses'} ({enrolledSchedule.length})</label><Select id="enrolled-course-jump" value="" onChange={e=>showScheduleItem(e.target.value)}><option value="">{isTutor?'Go to a teaching session…':'Go to a course’s next session…'}</option>{enrolledSchedule.map(course=><option key={course.id} value={course.id}>{course.title}</option>)}</Select><Link to={`${prefix}/courses`}>View all</Link></div>}
          {scheduleLoading?<p role="status">Loading your personal schedule…</p>:scheduleError?<div role="alert">Unable to load your personal schedule. <Button onClick={()=>void reloadSchedule()}>Try again</Button></div>:null}
          <CourseCalendar courses={personalSchedule} offset={weekOffset} zone={scheduleZone} selectedDate={selectedDate} onOpen={id=>navigate(id.startsWith('booking:')?bookingPath(id.slice(8)):coursePath(id),{viewTransition:true})}/>
          {!scheduleLoading&&!scheduleError&&personalSchedule.length>0&&!weekHasSessions&&<p role="status">No sessions this week. Your enrolled courses are still saved; select a course above to jump to its next session.</p>}
          {!scheduleLoading&&!scheduleError&&!personalSchedule.length?<p>No enrolled courses or confirmed bookings yet. Browse the courses below to get started.</p>:null}
          <div className="legacy-tabs" role="tablist" aria-label="Course type">{courseTabs.map(tab=><button aria-selected={courseFilter===tab} className={courseFilter===tab?'is-active':''} key={tab} onClick={()=>setCourseFilter(tab)} role="tab" type="button">{tab}</button>)}</div>
          <div className="course-view-toolbar"><span>Course view</span><div role="group" aria-label="Course card size">{(['small','medium','large'] as const).map((size,index)=><button aria-label={`${size} cards`} title={`${size[0].toUpperCase()+size.slice(1)} cards`} aria-pressed={courseSize===size} key={size} onClick={()=>changeCourseSize(size)} type="button"><svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">{Array.from({length:3-index},(_,column)=>Array.from({length:2},(_,row)=><rect key={`${column}-${row}`} x={1+column*(16/(3-index))} y={2+row*8} width={16/(3-index)-2} height="6" rx="1"/>))}</svg></button>)}</div></div>
          <div ref={coursePanelRef} className={`legacy-courses course-tab-panel course-size-${courseSize}`} key={courseFilter} role="tabpanel" aria-label={courseFilter}>
            {realCourses.filter(course=>courseFilter==='All Course'||course.category===courseFilter).map(course=><Link key={course.id} to={coursePath(course.id)} viewTransition><img src={course.image} alt=""/><strong>{course.title}</strong><span>{course.instructor}</span></Link>)}
          </div>
          {upcomingBookings.length ? <section className="dashboard-additional-bookings"><h2>Your booked lessons</h2><div className="legacy-courses">{upcomingBookings.map((booking,index)=><Link key={booking.id} to={bookingPath(booking.id)} viewTransition><img alt="" src={`/assets/figma/student-tutor-${index%3+1}.jpg`}/><strong>Online lesson</strong><span>{new Date(booking.startAtUtc).toLocaleString('en-GB',{timeZone:'Asia/Ho_Chi_Minh',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span></Link>)}</div></section> : null}
        </div>

        <aside className="dashboard-rail" aria-label="Calendar and events">
          <section className="dashboard-mini-calendar">
            <div><h2>{monthStart.toLocaleDateString('en-GB',{timeZone:'UTC',month:'long',year:'numeric'})}</h2><span className="mini-month-actions"><button aria-label="Previous month" onClick={()=>setMonthShift(value=>value-1)}>‹</button><button aria-label="Next month" onClick={()=>setMonthShift(value=>value+1)}>›</button></span></div>
            <div className="dashboard-mini-calendar__weekdays">{['Mo','Tu','We','Th','Fr','Sa','Su'].map(day=><strong key={day}>{day}</strong>)}</div>
            <div ref={miniDaysRef} className="dashboard-mini-calendar__days">{miniCalendarDays.map(day=>{const key=day.toISOString().slice(0,10);return <button aria-label={key} aria-pressed={selectedDate===key} className={`${day.getUTCMonth()!==monthStart.getUTCMonth()?'is-muted ':''}${selectedDate===key?'is-selected':''}`} key={key} onClick={()=>selectCalendarDate(day)} type="button">{day.getUTCDate()}</button>;})}</div>
          </section>
          <section className="dashboard-rail-section"><h2>Upcoming Events</h2>{upcomingCourseEvents.map((course)=><Link key={course.id} to={coursePath(course.id)} viewTransition><span className={`dashboard-event-icon ${course.id==='figma-ui-design'?'is-figma':'is-yellow'}`}><CourseIcon kind={course.id==='figma-ui-design'?1:0}/></span><span><strong>{course.title}</strong><small>{course.sessions[0] ? new Date(course.sessions[0].startAtUtc).toLocaleString('en-GB',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : 'Schedule pending'}</small></span><svg className="rail-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.5"/></svg></Link>)}</section>
          <section className="dashboard-rail-section dashboard-top-courses"><h2>{isTutor?"Your Courses":"Top Performing Courses"}</h2>{(isTutor?[...realCourses].sort((a,b)=>b.enrolled-a.enrolled).slice(0,4):["css-designers","design-foundations","composition","color"].map(id=>realCourses.find(c=>c.id===id)).filter((c):c is NonNullable<typeof c>=>!!c)).map((course,index)=><Link key={course.id} to={coursePath(course.id)} viewTransition><span className={`dashboard-course-icon course-${index+1}`}><CourseIcon kind={index+2}/></span><span><strong>{course.title}</strong><small>{isTutor?`${course.enrolled} / ${course.capacity} enrolled`:course.instructor}</small></span><i><TrendIcon/></i></Link>)}</section>
        </aside>
      </section>
    </AppShell>
  );
}

export function CompleteProfileScreen() {
  const navigate = useMotionNavigate();
  const [schoolLevel,setSchoolLevel]=useState('Grade 10');
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
        educationLevel: schoolLevel==='Primary'?0:schoolLevel==='Grade 6–9'?1:schoolLevel==='University'?3:schoolLevel==='Adult'?4:2,
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
        <TextField value={schoolLevel} onChange={event=>setSchoolLevel(event.target.value)} label="School level" />
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
  const [gridSize,setGridSize]=useState<'small'|'medium'|'large'>(()=>{const saved=localStorage.getItem('tutormatching.tutorGrid');return saved==='small'||saved==='large'?saved:'medium';});
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [availableToday, setAvailableToday] = useState(false);
  const [subjectFilter,setSubjectFilter]=useState('');
  const [sortOrder,setSortOrder]=useState('relevance');
  const [savedTutors, setSavedTutors] = useState<string[]>([]);
  const loadSubjects = useCallback(() => gatewayClient.listSubjects(), []);
  const { data: subjects } = useGatewayResource(loadSubjects, null);
  const mathematics = subjects?.find((subject) => subject.id === subjectFilter);
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
    const results=availableTutors.filter((tutor) => !normalized||`${tutor.name} ${tutor.subjects}`.toLowerCase().includes(normalized));
    return sortOrder==='name'?results.sort((a,b)=>a.name.localeCompare(b.name)):results;
  }, [availableTutors, submittedQuery,sortOrder]);

  return (
    <AppShell active="find" contentClassName="find-tutors" mobileTitle="Find tutors" title="Find the right tutor">
      <section className="tutor-search-toolbar" aria-label="Search and filters">
      <form className="tutor-search" onSubmit={(event) => { event.preventDefault(); setSubmittedQuery(query); }}>
        <input onChange={(event) => setQuery(event.target.value)} placeholder="Search by subject, tutor name, or keyword" value={query} />
        <Button size="large" type="submit">Search</Button>
      </form>
      <div className="tutor-filter-bar"><label>Subject<Select value={subjectFilter} onChange={event=>{setSubjectFilter(event.target.value);setAvailableToday(false);}}><option value="">All subjects</option>{subjects?.map(subject=><option key={subject.id} value={subject.id}>{subject.name}</option>)}</Select></label><label>Availability<Select disabled={!subjectFilter} value={availableToday?'today':'any'} onChange={event=>setAvailableToday(event.target.value==='today')}><option value="any">Any time</option><option value="today">Available today</option></Select></label><label>Sort by<Select value={sortOrder} onChange={event=>setSortOrder(event.target.value)}><option value="relevance">Relevance</option><option value="name">Name A–Z</option></Select></label><Button variant="secondary" onClick={()=>{setSubjectFilter('');setAvailableToday(false);setSortOrder('relevance');setQuery('');setSubmittedQuery('');}}>Clear filters</Button></div>
      </section>
      <div className="tutor-results-title"><h2>Tutors matching your search</h2><div className="course-view-toolbar tutor-view-toolbar"><span>Grid view</span><div role="group" aria-label="Tutor grid size">{(['small','medium','large'] as const).map((size,index)=><button key={size} type="button" aria-label={`${size} tutor cards`} aria-pressed={gridSize===size} title={`${size} cards`} onClick={()=>{setGridSize(size);localStorage.setItem('tutormatching.tutorGrid',size);}}><svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">{Array.from({length:3-index},(_,col)=>Array.from({length:2},(_,row)=><rect key={`${col}-${row}`} x={1+col*(16/(3-index))} y={2+row*8} width={16/(3-index)-2} height="6" rx="1"/>))}</svg></button>)}</div></div></div>
      <span aria-live="polite" className="sr-only">{loading ? 'Loading tutors' : `${tutors.length} tutors found`}</span>
      <div className={`tutor-grid tutor-grid--${gridSize}`} key={gridSize}>
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
  const loadCourses=useCallback(()=>gatewayClient.listCourses(),[]);
  const {data:catalog}=useGatewayResource(loadCourses,[]);
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
      {tutor&&<section className="student-card"><h2>Courses by {displayName}</h2><div className="my-course-grid">{catalog.filter(c=>c.tutorId===tutor.id).map(c=><Link className="my-course-card" key={c.id} to={`/student/courses/${c.id}`} viewTransition><img src={c.image} alt=""/><div><h3>{c.title}</h3><p>{c.category} · {c.sessions.length} sessions</p><small>{c.enrolled} / {c.capacity} enrolled</small></div></Link>)}</div>{!catalog.some(c=>c.tutorId===tutor.id)&&<p>No published courses from this tutor yet.</p>}</section>}
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
      <div className="booking-tabs" role="tablist">{['Upcoming','Completed','Cancelled'].map(tab=><button data-status={tab} aria-selected={activeTab===tab} className={activeTab===tab?'is-active':''} key={tab} onClick={()=>setActiveTab(tab)} role="tab" type="button">{tab}</button>)}</div>
      <div className="booking-list">{visibleBookings.length ? visibleBookings.map((booking)=><article className="student-card booking-item" key={booking.id ?? `${booking.day}-${booking.title}`}><div className="booking-date"><strong>{booking.day}</strong><span>{booking.month}</span></div><div className="booking-item__content"><h2>{booking.title}</h2><p>{booking.time} • {booking.format}</p></div><span className="booking-status" data-status={booking.status}>{booking.status}</span><Link className="student-primary-link" to={booking.id ? `/student/bookings/${booking.id}` : '/student/bookings/TM-20261118-1042'} viewTransition>{booking.action}</Link></article>) : <p className="booking-empty">No {activeTab.toLowerCase()} bookings.</p>}</div>
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
      <BookingDetailsPanel title={title} status={booking?.status??'Confirmed'} rows={rows} backTo="/student/dashboard" actions={<>
<Button fullWidth onClick={()=>setActionMessage('The meeting room opens 10 minutes before the lesson.')} size="large">Join lesson</Button><Button fullWidth onClick={()=>navigate('/student/book/select-schedule',{viewTransition:true})} size="large" variant="secondary">Reschedule</Button>{actionMessage?<p className="booking-action-message" aria-live="polite">{actionMessage}</p>:null}{error ? <p className="tm-field__message tm-field__message--error" role="alert">{error}</p> : null}<Button disabled={cancelling || booking?.status === 'Cancelled'} fullWidth onClick={cancelBooking} size="large" variant="danger">{cancelling ? 'Cancelling…' : booking?.status === 'Cancelled' ? 'Booking cancelled' : 'Cancel booking'}</Button>
      </>}/>
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
      <div className="notification-list">{notifications ? notifications.map((notification)=><article className={`student-card notification-item notification-with-details ${notification.status==='Unread'?'is-unread':''}`} key={notification.id} onClick={() => void markRead(notification)}><div><h2>{notificationTitle(notification)}</h2><NotificationDetails item={notification}/></div><time>{new Date(notification.createdAtUtc).toLocaleDateString()}</time></article>) : studentNotifications.map(([title,body,time,image],index)=><article className={`student-card notification-item ${index<2?'is-unread':''}`} key={title}><div className="notification-avatar"><img alt="" src={`/assets/figma/student-tutor-${image}.jpg`}/><span /></div><div><h2>{title}</h2><p>{body}</p></div><time>{time}</time></article>)}</div>
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
    if(profile.avatarUrl)setAvatar(profile.avatarUrl);
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
      await gatewayClient.saveStudentProfile({ displayName, educationLevel, learningGoal, timezone, avatarUrl:avatar });
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

export function CourseDetailsScreen() {
  const loadMine=useCallback(()=>gatewayClient.listMyCourses(),[]);
  const {data:mine,reload:reloadMine}=useGatewayResource(loadMine,[]);
  const {courseId}=useParams();
  const load=useCallback(()=>gatewayClient.getCourse(courseId ?? ''),[courseId]);
  const {data:course,loading,reload}=useGatewayResource(load,null);
  const [message,setMessage]=useState('');
  const closeToast=useCallback(()=>setMessage(''),[]);
  const [submitting,setSubmitting]=useState(false);
  const enrolled=mine.some(c=>c.id===courseId);
  async function enroll(){setMessage('');setSubmitting(true);try{await gatewayClient.enrollCourse(courseId!);setMessage('You are enrolled');await Promise.all([reload(),reloadMine()]);}catch(reason){setMessage(reason instanceof Error?reason.message:'Unable to enroll');}finally{setSubmitting(false);}}
  return <AppShell active="dashboard" contentClassName="course-details-page" title={course?.title ?? 'Course details'}>
    <section className="student-card course-details-card">
      <header className="course-details-actions"><div className="course-details-navigation"><Link className="course-back-link" to="/student/dashboard">← Back to schedule</Link><Link className="course-library-link" to="/student/courses">My courses</Link></div>{course?<Button disabled={submitting||enrolled} onClick={()=>void enroll()}>{enrolled?'Enrolled':submitting?'Enrolling…':'Enroll in course'}</Button>:null}</header>
      {message?<Toast message={message} tone={message==='You are enrolled'?'success':'error'} onClose={closeToast}/>:null}
      {course?<div className="course-details-body"><div className="course-details-intro"><img alt={course.title} src={course.image}/><h2>{course.title}</h2><p>{course.description}</p></div><div className="course-details-information"><DetailRows rows={[["Instructor",course.instructor],["Type",course.category],["Enrolment",`${course.enrolled} / ${course.capacity}`]]}/><h3>Session schedule <small>(GMT+07)</small></h3><div className="course-session-grid">{[...course.sessions].sort((a,b)=>a.startAtUtc.localeCompare(b.startAtUtc)).map((session,index)=><article key={session.id}><span>Session {index+1}</span><strong>{new Date(session.startAtUtc).toLocaleDateString('en-GB',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'short',year:'numeric'})}</strong><small>{new Date(session.startAtUtc).toLocaleTimeString('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'})} – {new Date(session.endAtUtc).toLocaleTimeString('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'})}</small></article>)}</div></div></div>:<p>{loading?'Loading course…':'This course is unavailable.'}</p>}
    </section>
  </AppShell>;
}

export const studentRoutes = [
  { path: '/student/courses', element: <MyCourses /> },
  { path: '/student/courses/:courseId', element: <CourseDetailsScreen /> },
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
