import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../design-system/Button';
import { TextField } from '../../design-system/TextField';
import { AppShell } from '../../shared/AppShell';
import './tutor.css';

const tutorShell = (active: string, title: string, className: string, content: ReactNode, mobileTitle?: string) => (
  <AppShell active={active} contentClassName={`tutor-content ${className}`} mobileTitle={mobileTitle} mode="tutor" title={title}>{content}</AppShell>
);

export function TutorDashboard() {
  const stats = [['Upcoming lessons','8','This week'],['Pending requests','3','This week'],['Hours taught','126','This week'],['Profile views','1,284','+18% this month']];
  const lessons = [['09:00','Mathematics • Lan Anh','Starts in 24 minutes'],['11:00','Physics • Quang Minh','Online lesson'],['15:30','Mathematics • Thu Trang','Online lesson'],['19:00','Exam prep • Gia Huy','Online lesson']];
  return tutorShell('dashboard','Welcome back, Minh Anh','tutor-dashboard',<>
    <div className="tutor-stats">{stats.map(([label,value,note])=><article className="student-card" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
    <div className="tutor-dashboard__columns"><section className="student-card tutor-today"><h2>Today’s schedule</h2>{lessons.map(([time,title,note],index)=><article className={index===0?'is-next':''} key={time}><p><strong>{time}</strong>　{title}</p><span>{note}</span></article>)}</section><section className="student-card tutor-request-summary"><h2>Booking requests</h2>{[['Bao • Grade 9','Requested Wed, 18 Nov • 18:00'],['Linh • Grade 12','Requested Thu, 19 Nov • 18:00'],['Huy • Grade 10','Requested Fri, 20 Nov • 18:00']].map(([name,time])=><article key={name}><div><strong>{name}</strong><span>{time}</span></div><Button>Review</Button></article>)}</section></div>
  </>);
}

export function TutorOnboarding() {
  return tutorShell('profile','Set up your tutor profile','tutor-onboarding',<>
    <p className="tutor-step">Step 1 of 4 • Profile basics</p><section className="student-card tutor-form-card"><h2>Build a profile students can trust</h2><TextField defaultValue="Math tutor helping students master exams" label="Professional headline"/><TextField defaultValue="Describe your approach, strengths, and experience" label="Bio"/><TextField defaultValue="Hanoi National University of Education" label="Education"/><TextField defaultValue="5 years" label="Years of experience"/><TextField defaultValue="Vietnamese, English" label="Languages"/></section><Button className="tutor-form-save" size="large">Save &amp; continue</Button>
  </>);
}

export function SubjectsPricing() {
  return tutorShell('profile','Subjects and pricing','tutor-subjects',<section className="student-card tutor-subject-card"><h2>What do you teach?</h2><p>Add subjects, levels, and your hourly rate.</p>{[['Mathematics','Grade 8–12','150,000₫'],['Physics','Grade 10–12','160,000₫'],['Exam preparation','High school','180,000₫']].map(([subject,level,price])=><article key={subject}><div><strong>{subject}</strong><span>{level}</span></div><p><strong>{price}</strong> / hour</p><Button variant="secondary">Edit</Button></article>)}<Button className="tutor-add-subject" variant="secondary">+ Add subject</Button><Button className="tutor-subject-save" size="large">Save changes</Button></section>);
}

export function TutorAvailability() {
  const [added,setAdded]=useState(false);
  const blocks=[['Mon','18:00 – 21:00'],['Tue','09:00 – 12:00 • 14:00 – 18:00'],['Wed','18:00 – 21:00'],['Thu','18:00 – 21:00'],['Fri','18:00 – 21:00'],['Sat','18:00 – 21:00'],['Sun','Unavailable']];
  return tutorShell('availability','Availability','tutor-availability-page',<div className="tutor-availability-layout"><section className="student-card tutor-weekly"><div><h2>Weekly availability</h2><span>Weekly hours • Asia/Ho_Chi_Minh</span></div>{blocks.map(([day,time],index)=><article key={day}><strong>{day}</strong><div><span className={index===1?'is-selected':''}>{time}</span></div></article>)}</section><aside><section className="student-card tutor-edit-availability"><h2>Edit availability</h2><p>Tuesday</p><TextField defaultValue="09:00" label="Start time"/><TextField defaultValue="12:00" label="End time"/><TextField defaultValue="Every week" label="Repeat"/><Button fullWidth onClick={()=>setAdded(true)} size="large">Add time block</Button>{added?<p className="tutor-added">09:00 – 12:00 added</p>:null}</section><Button fullWidth size="large">Save availability</Button></aside></div>);
}

const requests=[['Nguyen Bao • Grade 9','Mathematics • Wed, 18 Nov, 18:00',1],['Tran Linh • Grade 10','Physics • Thu 19 Nov, 19:00',3],['Le Huy • Grade 11','Math • Sat 21 Nov, 15:30',2],['Pham Mai • Grade 12','Exam prep • Sun 22 Nov, 09:00',1]] as const;

export function TutorRequests() {
  const [accepted,setAccepted]=useState<string[]>([]);
  return tutorShell('bookings','Booking requests','tutor-requests',<><div className="tutor-request-tabs"><button className="is-active">Pending</button><button>Accepted</button><button>Declined</button></div><div className="tutor-request-list">{requests.map(([name,detail,image])=><article className="student-card" key={name}><img alt="" src={`/assets/figma/student-tutor-${image}.jpg`}/><div><h2>{name}</h2><p>{detail}</p><span>“Need help preparing for the next test.”</span></div>{accepted.includes(name)?<strong className="request-accepted">Request accepted</strong>:<div className="tutor-request-actions"><Button onClick={()=>setAccepted(current=>[...current,name])} variant="danger">Decline</Button><Button onClick={()=>setAccepted(current=>[...current,name])}>Accept</Button></div>}</article>)}</div></>);
}

export function TutorSchedule() {
  const days=['Tue 17','Wed 18','Thu 19','Fri 20','Sat 21','Sun 22','Mon 23'];
  const cells=Array.from({length:35},(_,index)=>({index,label:({1:'Mathematics|9:00',7:'Physics|11:00',11:'Physics|11:00',17:'Mathematics|13:00',23:'Physics|15:00',27:'Physics|15:00',29:'Mathematics|17:00',33:'Mathematics|17:00'} as Record<number,string>)[index]}));
  return tutorShell('schedule','Schedule','tutor-schedule',<><section className="student-card tutor-calendar"><div className="tutor-calendar__head"><h2>17 – 23 November 2026</h2><span>Asia/Ho_Chi_Minh</span></div><div className="tutor-calendar__days">{days.map(day=><span key={day}>{day}</span>)}</div><div className="tutor-calendar__grid">{cells.map(cell=><div className={cell.label?(cell.index===1||cell.index===29?'is-blue':'has-lesson'):''} key={cell.index}>{cell.label?cell.label.split('|').map(value=><span key={value}>{value}</span>):null}</div>)}</div></section><section className="tutor-mobile-schedule"><h2>18 November 2026</h2>{[['09:00','Mathematics • Bao'],['11:00','Physics • Linh'],['15:30','Math • Trang'],['19:00','Exam prep • Huy']].map(([time,title],index)=><article key={time}><time>{time}</time><div className={index===0?'is-next':''}><strong>{title}</strong><span>Online lesson • 60 min</span></div></article>)}</section></>,'Tutor schedule');
}

function TutorDetailRows({rows}:{rows:Array<[string,string]>}) { return <div className="tutor-detail-rows">{rows.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>; }

export function TutorLessonDetails() {
  return tutorShell('schedule','Lesson details','tutor-lesson-detail',<div className="tutor-detail-layout"><section className="student-card tutor-detail-card"><h2>Mathematics with Nguyen Bao</h2><span className="booking-status">Confirmed</span><TutorDetailRows rows={[["Student","Nguyen Bao • Grade 9"],["Date","Wednesday, 18 November 2026"],["Time","18:00 – 19:00"],["Format","Online • Google Meet"],["Student goal","Prepare for algebra midterm"],["Tutor notes","Bring practice set #4 and review common mistakes."]]}/></section><aside><Button fullWidth size="large">Start lesson</Button><Button fullWidth size="large" variant="secondary">Message student</Button><Button fullWidth size="large" variant="danger">Cancel lesson</Button></aside></div>);
}

export function TutorPublicProfile() {
  return tutorShell('profile','Public profile preview','tutor-public-profile',<section className="student-card tutor-public-card"><div className="tutor-public-head"><div className="profile-avatar"><img alt="Nguyen Minh Anh" src="/assets/figma/student-tutor-1.jpg"/><span/></div><div><h2>Nguyen Minh Anh</h2><p>Mathematics &amp; Physics Tutor</p><strong>★ 4.9 • 126 reviews • 482 lessons</strong><span className="tutor-verified">Verified</span></div></div><div className="tutor-public-body"><div><h3>About me</h3><p>I help students understand difficult concepts, build confidence, and develop reliable study habits.</p><h3>Subjects</h3><div className="tag-row"><span>Mathematics</span><span>Physics</span><span>Exam prep</span></div></div><aside><strong>From 150,000₫ / hour</strong><Button fullWidth size="large">Edit profile</Button></aside></div></section>);
}

export function TutorNotifications() {
  const items=[['New booking request','Bao requested Mathematics on Tue at 18:00.','2 min ago',3],['Booking accepted','Your session with Linh is confirmed.','Yesterday',2],['Lesson starts soon','Mathematics with Bao starts in 30 minutes.','Yesterday',1],['Student cancelled lesson','Mai cancelled Saturday’s lesson.','Yesterday',3],['Profile approved','Students can now discover your profile.','Yesterday',2]] as const;
  return tutorShell('notifications','Notifications','tutor-notifications',<div className="notification-list">{items.map(([title,body,time,image],index)=><article className={`student-card notification-item ${index===0?'is-unread':''}`} key={title}><div className="notification-avatar"><img alt="" src={`/assets/figma/student-tutor-${image}.jpg`}/><span/></div><div><h2>{title}</h2><p>{body}</p></div><time>{time}</time></article>)}</div>);
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
