import { useCallback, useState } from 'react';
import { gatewayClient } from '../../api';
import { useGatewayResource } from '../../api/useGatewayResource';
import { AppShell } from '../../shared/AppShell';
import { MotionLink as Link } from '../../shared/MotionLink';
import { Button } from '../../design-system/Button';

const zone = 'Asia/Ho_Chi_Minh';
const localDate = (value: string | Date) => new Intl.DateTimeFormat('en-CA', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const time = (value: string) => new Date(value).toLocaleTimeString('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit'});
export function StudentSchedule() {
  const [anchor,setAnchor] = useState(() => localDate(new Date()));
  const [selected,setSelected] = useState('');
  const load = useCallback(async () => {
    const [bookings,subjects,profile] = await Promise.all([gatewayClient.listBookings(),gatewayClient.listSubjects(),gatewayClient.getStudentProfile().catch(()=>null)]);
    const tutors = await Promise.all([...new Set(bookings.map(b=>b.tutorId))].map(id=>gatewayClient.getTutor(id)));
    return {bookings,subjects,profile,tutors};
  },[]);
  const {data,loading,error,reload} = useGatewayResource(load,null);
  const monday = new Date(`${anchor}T00:00:00+07:00`);
  const weekday = new Date(`${anchor}T12:00:00Z`).getUTCDay();
  monday.setUTCDate(monday.getUTCDate()-((weekday+6)%7));
  const days = Array.from({length:7},(_,i)=>new Date(+monday+i*86400000));
  const lessons = (data?.bookings ?? []).filter(b=>b.status==='Confirmed' && days.some(d=>localDate(d)===localDate(b.startAtUtc))).sort((a,b)=>a.startAtUtc.localeCompare(b.startAtUtc));
  const booking = data?.bookings.find(b=>b.id===selected);
  const title = (subjectId:string) => data?.subjects.find(s=>s.id===subjectId)?.name ?? 'Lesson';
  const tutor = (tutorId:string) => data?.tutors.find(t=>t.id===tutorId);
  function shift(amount:number) { setAnchor(localDate(new Date(+monday+amount*86400000))); }
  return <AppShell active="dashboard" contentClassName="student-dashboard live-schedule" title={`Good morning, ${data?.profile?.displayName ?? 'Minh'}`}>
    <section className="dashboard-template"><div className="dashboard-legacy">
      <div className="legacy-schedule-head"><h2>My Schedule</h2><span>Asia/Ho_Chi_Minh (GMT+07)</span></div>
      <div className="legacy-date"><span>{days[0].toLocaleDateString('en-GB',{timeZone:zone,day:'numeric',month:'short'})} – {days[6].toLocaleDateString('en-GB',{timeZone:zone,day:'numeric',month:'short',year:'numeric'})}</span><button aria-label="Previous week" onClick={()=>shift(-7)}>‹</button><button aria-label="Next week" onClick={()=>shift(7)}>›</button><Button onClick={()=>setAnchor(localDate(new Date()))} variant="secondary">Today</Button></div>
      {loading?<p role="status">Loading schedule…</p>:error?<div role="alert">Unable to load schedule. <Button onClick={()=>void reload()}>Try again</Button></div>:null}
      <div className="live-week-grid">{days.map(day=><section className="live-day" key={localDate(day)}><h3>{day.toLocaleDateString('en-GB',{timeZone:zone,weekday:'short',day:'numeric'})}</h3>{lessons.filter(b=>localDate(b.startAtUtc)===localDate(day)).map((b,index)=><button aria-label={`${title(b.subjectId)} ${time(b.startAtUtc)}`} className={`live-lesson tone-${index%3}`} key={b.id} onClick={()=>setSelected(b.id)}><img alt="" src={tutor(b.tutorId)?.avatarUrl || '/assets/figma/student-tutor-1.jpg'}/><span><strong>{title(b.subjectId)}</strong><small>{time(b.startAtUtc)} – {time(b.endAtUtc)}</small><small>{tutor(b.tutorId)?.displayName}</small></span></button>)}</section>)}</div>
      {!loading&&!error&&!lessons.length?<p className="dashboard-feedback">No lessons this week. Choose another week or <Link to="/student/find-tutors">find a tutor</Link>.</p>:null}
    </div><aside className="dashboard-rail"><section className="dashboard-mini-calendar"><h2>Choose date</h2><input aria-label="Calendar date" type="date" value={anchor} onChange={e=>e.target.value&&setAnchor(e.target.value)}/></section><section className="dashboard-rail-section"><h2>Upcoming lessons</h2>{data?.bookings.filter(b=>b.status==='Confirmed'&&new Date(b.endAtUtc)>new Date()).sort((a,b)=>a.startAtUtc.localeCompare(b.startAtUtc)).slice(0,6).map(b=><Link key={b.id} to={`/student/bookings/${b.id}`}><img width="40" height="40" alt="" src={tutor(b.tutorId)?.avatarUrl || '/assets/figma/student-tutor-1.jpg'}/><span><strong>{title(b.subjectId)}</strong><small>{localDate(b.startAtUtc)} · {time(b.startAtUtc)}</small></span></Link>)}</section></aside></section>
    {booking?<div className="schedule-event-overlay"><section role="dialog" aria-modal="true" aria-label="Lesson details"><Button onClick={()=>setSelected('')} variant="secondary">Close</Button><h2>{title(booking.subjectId)}</h2><p>{tutor(booking.tutorId)?.displayName}</p><p>{localDate(booking.startAtUtc)} · {time(booking.startAtUtc)} – {time(booking.endAtUtc)}</p><Link className="student-primary-link" to={`/student/bookings/${booking.id}`}>View booking</Link></section></div>:null}
  </AppShell>;
}
