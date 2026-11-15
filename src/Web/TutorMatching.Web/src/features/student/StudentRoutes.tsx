import {FriendlyEmptyState} from '../../shared/FriendlyEmptyState';
import {prepareAvatar} from '../../shared/prepareAvatar';
import {notifyAction} from '../../shared/notificationEvents';
import {TutorProfileScreen,SelectScheduleScreen,ReviewBookingScreen,BookingConfirmedScreen,BookingDetailsScreen} from './BookingFlow';
import {CourseLifecycleActions,courseState} from '../../shared/CourseLifecycleActions';
import {AccountSettingsPanel} from '../../shared/AccountSettingsPanel';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { browserSession, gatewayClient, type Booking, type NotificationItem, type StudentProfile, type Subject, type TutorProfile } from '../../api';
import { useGatewayResource } from '../../api/useGatewayResource';
import { Button } from '../../design-system/Button';
import { TextField } from '../../design-system/TextField';
import { AppShell } from '../../shared/AppShell';
import { MotionLink as Link, useMotionNavigate } from '../../shared/MotionLink';
import './student.css';
import { CourseIcon, TrendIcon } from '../../design-system/CourseIcon';
import { CourseCalendar, calendarWeek, calendarDay, calendarZones } from './CourseCalendar';
import { Toast } from '../../shared/Toast';
import {NotificationDetails,notificationTitle} from '../../shared/notificationPresentation';
import { BookingDetailsPanel } from '../../shared/BookingDetailsPanel';
import { Select } from '../../design-system/Select';
import { MyCourses } from '../../shared/MyCourses';

function DetailRows({rows}: {rows: Array<[string, string]>}) {return <div className="detail-rows">{rows.map(([label,value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>;}
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const educationLabels = ['Primary', 'Grade 6–9', 'Grade 10', 'University', 'Adult'];
type TutorCard = {id:string;name:string;shortName:string;subjects:string;mobileSubjects:string;image:string;bio:string;experience:number};
type BookingCard = {id:string;day:string;month:string;title:string;time:string;format:string;status:string;action:string};
function mapTutor(profile:TutorProfile, _index:number, subjects:Subject[]):TutorCard {
  const names=profile.subjects.map(item=>subjects.find(subject=>subject.id===item.subjectId)?.name).filter(Boolean).join(' • ');
  return {id:profile.id,name:profile.displayName,shortName:profile.displayName,subjects:names||'No subjects listed',mobileSubjects:names||'No subjects listed',image:profile.avatarUrl||'/assets/figma/default-avatar.svg',bio:profile.bio,experience:profile.experienceYears};
}
function formatBooking(booking:Booking):BookingCard {
 const start=new Date(booking.startAtUtc),end=new Date(booking.endAtUtc);
 return {id:booking.id,day:new Intl.DateTimeFormat('en',{day:'2-digit',timeZone:'Asia/Ho_Chi_Minh'}).format(start),month:new Intl.DateTimeFormat('en',{month:'short',timeZone:'Asia/Ho_Chi_Minh'}).format(start).toUpperCase(),title:`${booking.subjectName??'Tutoring'}${booking.tutorName?' with '+booking.tutorName:''}`,time:`${start.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'})} – ${end.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'})}`,format:'60-minute lesson',status:booking.status==='Confirmed'&&+end<Date.now()?'Completed':booking.status,action:'View details'};
}

export function StudentDashboard() {
  return <TemplateDashboardReference />;
}

export function TemplateDashboardReference({mode='student',active='dashboard'}:{mode?:'student'|'tutor';active?:string}={}) {
  const isTutor=mode==='tutor';
  const prefix=isTutor?'/tutor':'/student';
  const coursePath=(id:string)=>isTutor?`/tutor/courses?course=${encodeURIComponent(id)}`:`/student/courses/${id}`;
  const bookingPath=(id:string)=>isTutor?`/tutor/lessons/${id}`:`/student/bookings/${id}`;
  const loadTutor=useCallback(()=>isTutor?gatewayClient.getMyTutorProfile():gatewayClient.getStudentProfile(),[isTutor]);
  const {data:tutorAccount}=useGatewayResource<{displayName:string;avatarUrl?:string|null}|null>(loadTutor,null);
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
    return [...courses.filter(c=>c.status!=='Cancelled'),...lessons];
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
  useEffect(()=>{const refresh=()=>{void reloadSchedule();void reload();void reloadCatalog();};window.addEventListener('focus',refresh);window.addEventListener('courses-changed',refresh);return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('courses-changed',refresh);};},[reloadSchedule,reload,reloadCatalog]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [courseFilter, setCourseFilter] = useState('All Course');
  const [courseSize,setCourseSize]=useState<'small'|'medium'|'large'>(()=>{const saved=window.localStorage.getItem('tutormatching.courseView');return saved==='small'||saved==='large'?saved:'medium';});
  const [selectedDate,setSelectedDate]=useState('');
  const [monthShift,setMonthShift]=useState(0);
  const [selectedEvent, setSelectedEvent] = useState('');
  const upcomingCourseEvents=realCourses.filter(c=>c.status!=='Cancelled').map(c=>({...c,sessions:[...c.sessions].filter(s=>+new Date(s.endAtUtc)>Date.now()).sort((a,b)=>a.startAtUtc.localeCompare(b.startAtUtc))})).filter(c=>c.sessions.length).sort((a,b)=>a.sessions[0].startAtUtc.localeCompare(b.sessions[0].startAtUtc)).slice(0,3);
  const realEvent = realCourses.find(course=>course.title===selectedEvent);
  const firstSession = realEvent?.sessions[0];
  const eventDetails = realEvent ? {title:realEvent.title,image:realEvent.image.replace('/assets/figma/',''),description:realEvent.description,instructor:realEvent.instructor,day:firstSession?new Date(firstSession.startAtUtc).toLocaleDateString('en-GB',{timeZone:'Asia/Ho_Chi_Minh'}):'',time:firstSession?new Date(firstSession.startAtUtc).toLocaleTimeString('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'}):'',format:realEvent.category,participants:[`${realEvent.enrolled} / ${realEvent.capacity} enrolled`]} : undefined;
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
    <AppShell active={active} mode={mode} contentClassName="student-dashboard" title={isTutor?(active==='schedule'?'Schedule':`Good morning, ${tutorAccount?.displayName??'Tutor'}`):`Welcome, ${tutorAccount?.displayName??browserSession.load()?.displayName??'Student'}`}>
      <section className="dashboard-compact" hidden>
        <div className="dashboard-stats">
          {[['Upcoming', String(upcomingCount)], ['Hours learned', '24'], ['Tutors', '5']].map(([label, value]) => (
            <article key={label}><span>{label}</span><strong>{value}</strong></article>
          ))}
        </div>
        <div className="dashboard-week">
          <div className="dashboard-week__header"><h2>This week</h2><Link to={isTutor?'/tutor/requests':'/student/bookings'} viewTransition>View bookings</Link></div>
          {loading ? <p className="dashboard-feedback" role="status">Loading your schedule…</p> : error ? <div className="dashboard-feedback" role="alert"><p>Unable to load your schedule.</p><Button onClick={() => void reload()} variant="secondary">Try again</Button></div> : upcomingCount === 0 ? <FriendlyEmptyState compact kind="calendar" title="No upcoming lessons" description="Make a little room for learning. Find a tutor and choose your first lesson." action={{label:'Find a tutor',to:'/student/find-tutors'}}/> : null}
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
            {realCourses.filter(course=>course.status!=='Cancelled').filter(course=>courseFilter==='All Course'||course.category===courseFilter).map(course=><Link key={course.id} to={coursePath(course.id)} viewTransition><img src={course.image} alt=""/><strong>{course.title}</strong><span>{course.instructor}</span></Link>)}
          </div>
          {upcomingBookings.length ? <section className="dashboard-additional-bookings"><h2>{isTutor?'Your upcoming lessons':'Your booked lessons'}</h2><div className="legacy-courses">{upcomingBookings.map((booking,index)=><Link key={booking.id} to={bookingPath(booking.id)} viewTransition><img alt="" src={`/assets/figma/student-tutor-${index%3+1}.jpg`}/><strong>{isTutor?'Teaching session':'Online lesson'}</strong><span>{new Date(booking.startAtUtc).toLocaleString('en-GB',{timeZone:'Asia/Ho_Chi_Minh',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span></Link>)}</div></section> : null}
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
  const [displayName, setDisplayName] = useState(browserSession.load()?.displayName ?? '');
  const [level, setLevel] = useState('-1');
  const [goal, setGoal] = useState('');
  const [timezone,setTimezone] = useState('Asia/Ho_Chi_Minh');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [initializing,setInitializing] = useState(true);
  const [profileError,setProfileError] = useState('');
  const [attempt,setAttempt] = useState(0);
  const [error, setError] = useState('');
  const load = useCallback(() => gatewayClient.listSubjects(), []);
  const {data: subjects,loading:subjectsLoading,error:subjectsError,reload:reloadSubjects} = useGatewayResource(load, []);
  useEffect(()=>{
    let active=true;setInitializing(true);setProfileError('');
    gatewayClient.getStudentProfile().then(value=>{
      if(!active)return;
      const levels=['Primary','LowerSecondary','UpperSecondary','University','Adult'];
      setDisplayName(value.displayName);setGoal(value.learningGoal);setTimezone(value.timezone);
      setLevel(String(typeof value.educationLevel==='number'?value.educationLevel:levels.indexOf(String(value.educationLevel))));
      setSelected(value.interests.map(item=>item.subjectId));
    }).catch(async reason=>{
      if(!active)return;
      if((reason as {status?:number}).status!==404){setProfileError('Your profile could not be loaded. Retry before making changes.');return;}
      try{const user=await gatewayClient.getCurrentUser();if(active&&user.displayName)setDisplayName(user.displayName);}catch{/* The user can enter their name when Identity cannot supply it. */}
    }).finally(()=>{if(active)setInitializing(false);});
    return()=>{active=false;};
  },[attempt]);
  async function save(event: React.FormEvent) {
    event.preventDefault();if(initializing||profileError)return;
    if(!displayName.trim()){setError('Enter your name.');return;}
    setBusy(true);setError('');
    try {
      await gatewayClient.saveStudentProfile({displayName: displayName.trim(), educationLevel: level === '' ? -1 : Number(level), learningGoal: goal.trim(), timezone});
      if(!subjectsError&&!subjectsLoading)await gatewayClient.saveStudentInterests(selected.map((subjectId,index) => ({subjectId, priority: Math.min(index + 1,5)})));
      window.dispatchEvent(new Event('tutormatching:profile-updated'));
      notifyAction('Your learning profile has been saved.');
      navigate('/student/find-tutors', {replace: true});
    } catch (reason) {const text=reason instanceof Error?reason.message:'Unable to save profile.';setError(text);notifyAction(text,'error');} finally {setBusy(false);}
  }
  const unavailable=busy||initializing||!!profileError;
  return <AppShell active="profile" contentClassName="profile-onboarding" title="Your learning profile">
    <div className="profile-setup-heading"><span className="profile-setup-eyebrow">Your learning profile</span><h2>Tell us how you learn</h2><p>These details are optional. You can use your account now and add them whenever you like.</p></div>
    <form className="student-card profile-setup-card" onSubmit={event => void save(event)} aria-busy={initializing||busy}>
      <div className="profile-setup-section"><h3>About you</h3><p>Your tutor will see these details when you book a lesson.</p></div>
      {initializing?<p role="status">Loading your profile…</p>:null}
      {profileError?<div className="profile-form-error" role="alert"><p>{profileError}</p><Button type="button" variant="secondary" onClick={()=>setAttempt(value=>value+1)}>Retry loading profile</Button></div>:null}
      <div className="profile-setup-grid">
        <TextField label="Display name" autoComplete="name" placeholder="Your full name" required disabled={unavailable} maxLength={100} value={displayName} onChange={event => setDisplayName(event.target.value)} />
        <div className="tm-field"><label className="tm-field__label" htmlFor="profile-school-level">School level <span>(optional)</span></label><Select id="profile-school-level" aria-label="School level" disabled={unavailable} value={level} onChange={event => setLevel(event.target.value)}><option value="-1">Not specified</option>{educationLabels.map((label,index) => <option value={index} key={label}>{label}</option>)}</Select></div>
      </div>
      <div className="tm-field profile-setup-goal"><label className="tm-field__label" htmlFor="profile-learning-goal">Learning goal <span>(optional)</span></label><textarea className="tm-field__input" id="profile-learning-goal" aria-label="Learning goal" rows={3} maxLength={2000} disabled={unavailable} placeholder="For example, build confidence in mathematics or prepare for an English exam." value={goal} onChange={event=>setGoal(event.target.value)}/><p className="profile-field-hint">Tell your tutor what you would like to work towards.</p></div>
      <fieldset className="profile-subjects" disabled={unavailable}><legend>Subjects you want to learn <span>Optional</span></legend><p>Choose the subjects you are interested in. You can change them later.</p>
        {subjectsLoading?<p role="status">Loading subjects…</p>:null}
        <div className="profile-subject-grid">{subjects.map(subject => <label className={`profile-subject-option ${selected.includes(subject.id)?'is-selected':''}`} key={subject.id}><input type="checkbox" checked={selected.includes(subject.id)} onChange={event => setSelected(current => event.target.checked ? [...current,subject.id] : current.filter(id => id !== subject.id))} /><span>{subject.name}</span></label>)}</div>
      </fieldset>
      {subjectsError?<div className="profile-form-error" role="alert"><p>Subjects are temporarily unavailable. You can save your other details and add subjects later.</p><Button type="button" variant="secondary" onClick={()=>void reloadSubjects()}>Reload subjects</Button></div>:null}
      {error?<p className="profile-form-error" role="alert">{error}</p>:null}
      <div className="profile-setup-footer"><Link to="/student/dashboard">Do this later</Link><p>{selected.length?`${selected.length} subject${selected.length===1?'':'s'} selected`:'Your details are saved to your account.'}</p><Button type="submit" disabled={unavailable}>{busy?'Saving…':'Save changes'}<span aria-hidden="true">→</span></Button></div>
    </form>
  </AppShell>;
}

export function FindTutorsScreen() {
  const [gridSize,setGridSize]=useState<'small'|'medium'|'large'>(()=>{const saved=localStorage.getItem('tutormatching.tutorGrid');return saved==='small'||saved==='large'?saved:'medium';});
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [availableToday, setAvailableToday] = useState(false);
  const [subjectFilter,setSubjectFilter]=useState('');
  const [sortOrder,setSortOrder]=useState('relevance');
  const [savedTutors, setSavedTutors] = useState<string[]>([]);
  const [savingTutor,setSavingTutor]=useState('');
  useEffect(()=>{let active=true;gatewayClient.getSavedTutors().then(values=>{if(active)setSavedTutors(values);}).catch(()=>{});return()=>{active=false;};},[]);
  async function toggleTutor(id:string){setSavingTutor(id);const saved=!savedTutors.includes(id);try{await gatewayClient.saveTutor(id,saved);setSavedTutors(current=>saved?[...current,id]:current.filter(value=>value!==id));notifyAction(saved?'Tutor saved to your account.':'Tutor removed from saved tutors.');}catch(reason){notifyAction(reason instanceof Error?reason.message:'Unable to save tutor.','error');}finally{setSavingTutor('');}}

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
  const { data: remoteTutors, loading, error: tutorError, reload: reloadTutors } = useGatewayResource(loadTutors, null);
  const availableTutors = useMemo<TutorCard[]>(
    () => remoteTutors ? remoteTutors.items.map((tutor, index) => mapTutor(tutor, index, subjects ?? [])) : [],
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
      {tutorError ? <section role="alert"><p>Unable to load tutors.</p><Button onClick={() => void reloadTutors()}>Try again</Button></section> : null}
      {!loading && !tutorError && !tutors.length ? <FriendlyEmptyState kind="search" title="No tutors match this search." description="A different subject or a broader search might lead you to your next great tutor." action={{label:'Clear filters',onClick:()=>{setSubjectFilter('');setAvailableToday(false);setQuery('');setSubmittedQuery('');}}}/> : null}
      <div className={`tutor-grid tutor-grid--${gridSize}`} key={gridSize}>
        {tutors.map((tutor) => (
          <article className="tutor-card" key={tutor.id}>
            <button aria-label={`${savedTutors.includes(tutor.id) ? 'Remove' : 'Save'} ${tutor.shortName}`} aria-pressed={savedTutors.includes(tutor.id)} className={`tutor-card__favorite ${savedTutors.includes(tutor.id) ? 'is-saved' : ''}`} disabled={!!savingTutor} onClick={() => void toggleTutor(tutor.id)} type="button"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill={savedTutors.includes(tutor.id)?'currentColor':'none'} stroke="currentColor" strokeWidth="1.7"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg></button>
            <div className="tutor-card__avatar"><img alt={tutor.name} src={tutor.image}/><span /></div>
            <h3 className="desktop-name">{tutor.name}</h3><h3 className="mobile-name">{tutor.shortName}</h3>
            <p className="tutor-card__subjects desktop-name">{tutor.subjects}</p><p className="tutor-card__subjects mobile-name">{tutor.mobileSubjects}</p>
            <p className="tutor-card__rating">{tutor.experience} years of teaching experience</p>
            <p className="tutor-card__bio">{tutor.bio || 'No biography provided.'}</p>
            <Link className="student-primary-link" to={`/student/tutors/${tutor.id}`} viewTransition>View profile</Link>
          </article>
        ))}
      </div>
    </AppShell>
  );
}

export function BookingsScreen() {
  const loadBookings = useCallback(() => gatewayClient.listBookings(), []);
  const { data: remoteBookings,loading,error,reload } = useGatewayResource<Booking[] | null>(loadBookings, null);
  const bookings: BookingCard[] = remoteBookings ? remoteBookings.map(formatBooking) : [];
  const [activeTab, setActiveTab] = useState('Upcoming');
  const visibleBookings = bookings.filter((booking) => activeTab === 'Upcoming' ? !['Completed','Cancelled'].includes(booking.status) : booking.status === activeTab);
  return (
    <AppShell active="bookings" contentClassName="bookings" title="My bookings">
      <div className="booking-tabs" role="tablist">{['Upcoming','Completed','Cancelled'].map(tab=><button data-status={tab} aria-selected={activeTab===tab} className={activeTab===tab?'is-active':''} key={tab} onClick={()=>setActiveTab(tab)} role="tab" type="button">{tab}</button>)}</div>
      <div className="booking-list">{loading?<p role="status">Loading your bookings…</p>:error?<section className="student-card" role="alert"><h2>Your bookings could not be loaded</h2><p>Try again to see your saved lessons.</p><Button onClick={()=>void reload()}>Try again</Button></section>:visibleBookings.length ? visibleBookings.map((booking)=><article className="student-card booking-item" key={booking.id ?? `${booking.day}-${booking.title}`}><div className="booking-date"><strong>{booking.day}</strong><span>{booking.month}</span></div><div className="booking-item__content"><h2>{booking.title}</h2><p>{booking.time} • {booking.format}</p></div><span className="booking-status" data-status={booking.status}>{booking.status}</span><Link className="student-primary-link" to={booking.id ? `/student/bookings/${booking.id}` : '/student/bookings/TM-20261118-1042'} viewTransition>{booking.action}</Link></article>) : <FriendlyEmptyState kind="calendar" illustration={activeTab==='Upcoming'?'teddy':'icon'} title={`No ${activeTab.toLowerCase()} bookings.`} description={activeTab==='Upcoming'?'Your next learning adventure is waiting. Choose a tutor and a time that suits you.':'Bookings in this category will appear here. Your upcoming lessons are in the Upcoming tab.'} action={activeTab==='Upcoming'?{label:'Find a tutor',to:'/student/find-tutors'}:undefined}/>}</div>
    </AppShell>
  );
}

export function NotificationsScreen() {
 const load=useCallback(()=>gatewayClient.listNotifications(),[]);
 const {data,loading,error,reload,setData}=useGatewayResource(load,null);
 const [failure,setFailure]=useState('');
 async function read(item:NotificationItem){if(item.status!=='Unread')return;try{await gatewayClient.markNotificationRead(item.id);setData(value=>value?{...value,items:value.items.map(n=>n.id===item.id?{...n,status:'Read'}:n)}:value);}catch(reason){setFailure(reason instanceof Error?reason.message:'Unable to update notification.');}}
 return <AppShell active="notifications" contentClassName="notifications" title="Notifications">{loading?<p role="status">Loading notifications…</p>:error?<section role="alert"><p>Unable to load notifications.</p><Button onClick={()=>void reload()}>Try again</Button></section>:<div className="notification-list">{data?.items.map(item=><article className={`student-card notification-item notification-with-details ${item.status==='Unread'?'is-unread':''}`} key={item.id}><Link onClick={()=>void read(item)} to={item.courseId?`/student/courses/${encodeURIComponent(item.courseId)}`:item.bookingId?`/student/bookings/${item.bookingId}`:'/student/notifications'} className="notification-item-link"><h2>{notificationTitle(item)}</h2><NotificationDetails item={item}/></Link><time>{new Date(item.createdAtUtc).toLocaleString('en-GB',{timeZone:'Asia/Ho_Chi_Minh'})}</time></article>)}{!data?.items.length&&<FriendlyEmptyState kind="bell" title="No notifications yet." description="You’re all caught up. Updates about your bookings and courses will appear here." action={{label:'Explore courses',to:'/student/courses?view=discover'}}/>}</div>}{failure&&<p role="alert">{failure}</p>}</AppShell>;
}

export function StudentProfileScreen() {
 const load=useCallback(()=>gatewayClient.getStudentProfile(),[]);
 const {data:profile,loading,error,reload}=useGatewayResource(load,null);
 const [name,setName]=useState(''),[goal,setGoal]=useState(''),[level,setLevel]=useState(''),[zone,setZone]=useState('Asia/Ho_Chi_Minh');
 const [avatar,setAvatar]=useState('/assets/figma/default-avatar.svg');
 const [busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');
 const photo=useRef<HTMLInputElement>(null);
 const [preparingPhoto,setPreparingPhoto]=useState(false);
 useEffect(()=>{if(!profile)return;setName(profile.displayName);setGoal(profile.learningGoal);setZone(profile.timezone);setAvatar(profile.avatarUrl||'/assets/figma/default-avatar.svg');const levels=['Primary','LowerSecondary','UpperSecondary','University','Adult'];setLevel(String(typeof profile.educationLevel==='number'?profile.educationLevel:levels.indexOf(String(profile.educationLevel))));},[profile]);
 async function save(event:React.FormEvent){event.preventDefault();if(preparingPhoto||busy)return;setBusy(true);setFeedback('');try{await gatewayClient.saveStudentProfile({displayName:name.trim(),educationLevel:level === '' ? -1 : Number(level),learningGoal:goal.trim(),timezone:zone,avatarUrl:avatar});window.dispatchEvent(new Event('tutormatching:profile-updated'));setFeedback('Profile saved');notifyAction('Profile saved.');await reload();}catch(reason){setFeedback(reason instanceof Error?reason.message:'Unable to save profile.');}finally{setBusy(false);}}
 async function changePhoto(file?:File){if(!file)return;setPreparingPhoto(true);setFeedback('');try{setAvatar(await prepareAvatar(file));setFeedback('Photo ready. Save changes to update your profile.');}catch(reason){setFeedback(reason instanceof Error?reason.message:'Unable to prepare the image.');}finally{setPreparingPhoto(false);if(photo.current)photo.current.value='';}}
 return <AppShell active="profile" contentClassName="student-profile" title="My profile">{loading?<p>Loading profile…</p>:error?<section className="student-card"><p>Your profile could not be loaded.</p><Button onClick={()=>void reload()}>Try again</Button></section>:profile&&<form className="student-card student-profile__card" onSubmit={event=>void save(event)}><div className="student-profile__photo"><div className="profile-avatar"><img alt="" src={avatar}/></div><input type="file" accept="image/*" className="student-photo-input" ref={photo} disabled={preparingPhoto||busy} onChange={event=>void changePhoto(event.target.files?.[0])}/><div className="student-photo-actions"><Button disabled={preparingPhoto||busy} onClick={()=>photo.current?.click()}>{preparingPhoto?'Preparing photo…':'Change photo'}</Button><p>JPG, PNG or WebP, up to 10 MB.</p></div></div><div className="student-profile__fields">
      <TextField label="Full name" required maxLength={100} value={name} onChange={event=>setName(event.target.value)}/>
      <TextField label="Email" readOnly value={browserSession.load()?.email??''}/>
      <div className="tm-field"><label className="tm-field__label" htmlFor="student-profile-level">School level (optional)</label><Select id="student-profile-level" aria-label="School level" value={level} onChange={event=>setLevel(event.target.value)}><option value="-1">Not specified</option>{educationLabels.map((label,index)=><option key={label} value={index}>{label}</option>)}</Select></div>
      <div className="tm-field"><label className="tm-field__label" htmlFor="student-profile-zone">Timezone</label><Select id="student-profile-zone" aria-label="Timezone" value={zone} onChange={event=>setZone(event.target.value)}>{calendarZones.map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select></div>
      <div className="tm-field student-profile-goal"><label className="tm-field__label" htmlFor="student-profile-goal">Learning goal (optional)</label><textarea className="tm-field__input" id="student-profile-goal" aria-label="Learning goal" rows={3} maxLength={2000} value={goal} onChange={event=>setGoal(event.target.value)}/></div>
      <p className="student-profile-goal"><Link to="/student/complete-profile">Edit learning subjects (optional)</Link></p>
    </div><div className="profile-editor-footer">{feedback?<p role="status">{feedback}</p>:<p>Your email is linked to your verified account.</p>}<Button type="submit" disabled={busy||preparingPhoto}>{busy?'Saving…':'Save changes'}</Button></div></form>}</AppShell>;
}

export function StudentSettingsScreen() {
 return <AppShell active="settings" contentClassName="student-settings" title="Settings"><AccountSettingsPanel mode="student"/></AppShell>;
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
      <header className="course-details-actions"><div className="course-details-navigation"><Link className="course-back-link" to="/student/dashboard">← Back to schedule</Link><Link className="course-library-link" to="/student/courses">My courses</Link></div>{course?<Button disabled={submitting||enrolled||courseState(course)!=='Open'||course.enrolled>=course.capacity||course.sessions.some(s=>Date.parse(s.startAtUtc)<=Date.now())} onClick={()=>void enroll()}>{courseState(course)==='Cancelled'?'Course cancelled':enrolled?'Enrolled':submitting?'Enrolling…':courseState(course)!=='Open'?'Registration closed':course.enrolled>=course.capacity?'Course full':course.sessions.some(s=>Date.parse(s.startAtUtc)<=Date.now())?'Registration closed':'Enroll in course'}</Button>:null}</header>
      {message?<Toast message={message} tone={message==='You are enrolled'?'success':'error'} onClose={closeToast}/>:null}
      {course?<CourseLifecycleActions course={course} mode="student" enrolled={enrolled} onChanged={async()=>{await Promise.all([reload(),reloadMine()]);}}/>:null}
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
  { path: '/student/tutors/:tutorId', element: <TutorProfileScreen /> },
  { path: '/student/book/select-schedule', element: <SelectScheduleScreen /> },
  { path: '/student/book/review', element: <ReviewBookingScreen /> },
  { path: '/student/book/confirmed', element: <BookingConfirmedScreen /> },
  { path: '/student/bookings', element: <BookingsScreen /> },
  { path: '/student/bookings/:bookingId', element: <BookingDetailsScreen /> },
  { path: '/student/notifications', element: <NotificationsScreen /> },
  { path: '/student/profile', element: <StudentProfileScreen /> },
  { path: '/student/settings', element: <StudentSettingsScreen /> },
];
