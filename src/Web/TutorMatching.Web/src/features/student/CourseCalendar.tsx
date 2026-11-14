import type { Course } from '../../api';
import {useEffect,useLayoutEffect,useRef} from 'react';
import { MemberAvatars } from '../../shared/MemberAvatars';
export const calendarZones=[['Asia/Ho_Chi_Minh','(GMT +07:00) Vietnam',420],['UTC','(GMT +00:00) UTC',0],['Asia/Dubai','(GMT +04:00) Dubai',240],['Asia/Kolkata','(GMT +05:30) India',330],['Asia/Dhaka','(GMT +06:00) Dhaka',360],['Asia/Singapore','(GMT +08:00) Singapore',480],['Asia/Tokyo','(GMT +09:00) Tokyo',540]] as const;
export function calendarDay(key:string,zone='Asia/Ho_Chi_Minh'){
  const minutes=calendarZones.find(item=>item[0]===zone)?.[2]??420;
  return new Date(+new Date(key+'T00:00:00Z')-minutes*60000);
}
export function calendarWeek(courses:Course[],offset:number,zone='Asia/Ho_Chi_Minh'){
  const first=courses.flatMap(c=>c.sessions).sort((a,b)=>a.startAtUtc.localeCompare(b.startAtUtc))[0];
  const date=new Date(first?.startAtUtc ?? Date.now());
  const key=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  const monday=calendarDay(key,zone);
  const weekday=new Date(key+'T12:00:00Z').getUTCDay();
  monday.setUTCDate(monday.getUTCDate()-(weekday+6)%7+offset*7);
  return monday;
}
export function CourseCalendar({courses,offset,onOpen,selectedDate,zone='Asia/Ho_Chi_Minh'}:{courses:Course[];offset:number;selectedDate?:string;zone?:string;onOpen:(id:string)=>void}){
 const frame=useRef<HTMLDivElement>(null);
 const previousOffset=useRef(offset);
 useLayoutEffect(()=>{
   const direction=Math.sign(offset-previousOffset.current);
   previousOffset.current=offset;
   const root=frame.current;
   if(!root||!direction||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
   const animations=Array.from(root.querySelectorAll('.course-calendar-header,.course-calendar-timeline'),element=>element.animate([
     {transform:`translateX(${direction*35}%)`,opacity:0},
     {transform:'translateX(0)',opacity:1},
   ],{duration:320,easing:'cubic-bezier(0.22, 1, 0.36, 1)'}));
   return()=>animations.forEach(animation=>animation.cancel());
 },[offset]);
 const monday=calendarWeek(courses,offset,zone);
 const hasPositioned=useRef(false);
 useEffect(()=>{
   const root=frame.current;if(!root)return;
   const from=selectedDate?+calendarDay(selectedDate,zone):+monday;
   const until=from+(selectedDate?1:7)*86400000;
   const sessions=courses.flatMap(c=>c.sessions).filter(s=>+new Date(s.startAtUtc)>=from&&+new Date(s.startAtUtc)<until);
   // In week view, start at the earliest clock time so no morning lessons are hidden.
   const minutes=sessions.map(s=>{
     const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(s.startAtUtc));
     return Number(parts.find(p=>p.type==='hour')?.value)*60+Number(parts.find(p=>p.type==='minute')?.value);
   });
   if(!minutes.length)return;
   const top=Math.max(0,Math.min(...minutes)/60*80-70);
   root.scrollTo({top,behavior:hasPositioned.current&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'instant'});
   hasPositioned.current=true;
 },[courses,offset,zone,selectedDate,+monday]);
 const days=Array.from({length:7},(_,i)=>new Date(+monday+i*86400000));
 useEffect(()=>{
   const root=frame.current;if(!root)return;
   const selectedIndex=selectedDate?Math.floor((+calendarDay(selectedDate,zone)-+monday)/86400000):-1;
   root.querySelectorAll('.course-calendar-header > span').forEach((element,index)=>element.classList.toggle('is-selected',index===selectedIndex+1&&selectedIndex>=0));
   root.querySelectorAll('.course-calendar-day').forEach((element,index)=>element.classList.toggle('is-selected',index===selectedIndex));
 },[offset,selectedDate,courses,zone]);
 return <div ref={frame} className="course-calendar-frame" role="region" aria-label="Weekly calendar" tabIndex={0}><div className="course-calendar-header"><span/>{days.map(day=><span key={+day}>{day.toLocaleDateString('en-GB',{timeZone:zone,weekday:'short'})}<small>{day.toLocaleDateString('en-GB',{timeZone:zone,day:'2-digit',month:'short'})}</small></span>)}</div><div className="course-calendar-timeline"><div className="course-calendar-hours">{Array.from({length:24},(_,h)=><span key={h}>{String(h).padStart(2,'0')}:00</span>)}</div>{days.map(day=>{
 const events=courses.flatMap(course=>course.sessions.map(session=>({course,session}))).filter(e=>+new Date(e.session.startAtUtc)>=+day&&+new Date(e.session.startAtUtc)<+day+86400000).sort((a,b)=>a.session.startAtUtc.localeCompare(b.session.startAtUtc));
 const groups:typeof events[]=[];
 let end=0;
 for(const event of events){if(+new Date(event.session.startAtUtc)>=end){groups.push([]);end=0;}groups[groups.length-1].push(event);end=Math.max(end,+new Date(event.session.endAtUtc));}
 return <div className="course-calendar-day" key={+day}>{groups.flatMap(group=>group.map((event,index)=>{
 const start=(+new Date(event.session.startAtUtc)-+day)/3600000;
 const duration=(+new Date(event.session.endAtUtc)-+new Date(event.session.startAtUtc))/3600000;
 const tone=event.course.category==='Booking'?'booking':event.course.category==='Webinar'?'cyan':event.course.id.includes('figma')?'coral':event.course.id.includes('app')?'blue':'white';
 return <button key={event.session.id} className={`course-calendar-event tone-${tone}`} style={{top:start*80+4,left:`calc(${index/group.length*100}% + 5px)`,width:`calc(${100/group.length}% - 10px)`,height:Math.max(44,duration*80-8)}} onClick={()=>onOpen(event.course.id)} aria-label={`${event.course.title}, ${new Date(event.session.startAtUtc).toLocaleString('en-GB',{timeZone:zone})}`}><img alt="" src={event.course.image}/><span className="course-calendar-event-copy"><strong>{event.course.title}</strong><small>{new Date(event.session.startAtUtc).toLocaleTimeString('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit'})}</small><MemberAvatars count={event.course.enrolled}/></span></button>;
 }))}</div>;
 })}</div></div>;
}
