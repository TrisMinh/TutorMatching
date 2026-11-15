import {CourseLifecycleActions,CourseStatus,courseState} from './CourseLifecycleActions';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { gatewayClient, type Course } from '../api';
import { useGatewayResource } from '../api/useGatewayResource';
import { AppShell } from './AppShell';
import './my-courses.css';

function CourseDiscovery({preview=false}:{preview?:boolean}) {
  const load=useCallback(()=>gatewayClient.listCourses(),[]);
  const {data:courses,loading,error,reload}=useGatewayResource<Course[]>(load,[]);
  const items=preview?courses.slice(0,3):courses;
  return <section className="course-discovery" aria-labelledby="course-discovery-title">
    <header className="course-discovery-heading"><div><h2 id="course-discovery-title">{preview?'Explore your next course':'Find your next course'}</h2><p>See the tutor, schedule and available places before you register.</p></div>{preview&&courses.length>3?<Link to="/student/courses?view=discover" className="course-discovery-more">View all courses →</Link>:null}</header>
    {loading?<p role="status">Loading available courses…</p>:error?<section className="student-card course-discovery-feedback" role="alert"><p>Available courses could not be loaded.</p><button className="course-discovery-retry" onClick={()=>void reload()}>Try again</button></section>:items.length===0?<p className="course-discovery-feedback">No courses are currently available. Check back soon or find a tutor for a private lesson.</p>:<div className="course-discovery-grid">{items.map(course=><Link key={course.id} to={'/student/courses/'+course.id} className="student-card course-discovery-card"><img src={course.image} alt=""/><div><span className="my-course-category">{course.category}</span><h3>{course.title}</h3><p>{course.instructor}</p><div className="course-discovery-meta"><span>{course.sessions.length} sessions</span><span>{Math.max(0,course.capacity-course.enrolled)} places left</span></div><span className="course-discovery-action">View course <span aria-hidden="true">→</span></span></div></Link>)}</div>}
  </section>;
}

export function MyCourses({mode='student'}:{mode?:'student'|'tutor'}) {
  const load=useCallback(()=>gatewayClient.listMyCourses(),[]);
  const {data:courses,loading,error,reload}=useGatewayResource<Course[]>(load,[]);
  const [params,setParams]=useSearchParams();
  const [selected,setSelected]=useState<string|undefined>(()=>params.get('course')??undefined);
  const requestedCourse=params.get('course');
  useEffect(()=>setSelected(requestedCourse??undefined),[requestedCourse]);
  const current=mode==='tutor'?courses.find(c=>c.id===selected):undefined;
  const tutor=mode==='tutor';
  const discover=!tutor&&params.get('view')==='discover';
  function openCourse(id?:string){setSelected(id);setParams(id?{course:id}:{},{replace:false});}
  return <AppShell active="courses" mode={mode} title={tutor?'Courses I teach':discover?'Browse courses':'My courses'} contentClassName="my-courses-page">
    {!current&&<header className="my-courses-heading"><div><h2>{tutor?'Your teaching courses':discover?'A new way to keep learning':'Your enrolled courses'}</h2><p>{tutor?'Manage your courses and their session schedules.':discover?'Choose a course, review its schedule and register when you are ready.':'All your courses and session schedules, together in one place.'}</p></div>{!tutor&&<Link className="course-back-button" to={discover?"/student/courses":"/student/courses?view=discover"}>{discover?"My courses":"Browse courses"}</Link>}</header>}
    {discover?<CourseDiscovery/>:loading?<p role="status">Loading your courses…</p>:error?<section className="student-card course-discovery-feedback" role="alert"><h2>Your courses could not be loaded</h2><p>Please try again to see your registrations.</p><button className="course-discovery-retry" onClick={()=>void reload()}>Try again</button></section>:courses.length===0?<>
      <section className="student-card my-courses-empty" aria-labelledby="my-courses-empty-title">
        <div className="my-courses-empty-icon" aria-hidden="true"><svg width="44" height="44" viewBox="0 0 48 48" fill="none"><path d="M24 13c-5-4-11-5-18-3v25c7-2 13-1 18 3m0-25c5-4 11-5 18-3v25c-7-2-13-1-18 3m0-25v25" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 17c2-.3 4 0 6 1m-6 7c2-.3 4 0 6 1m12-8c2-1 4-1.3 6-1m-6 9c2-1 4-1.3 6-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></div>
        <h2 id="my-courses-empty-title">{tutor?'Your teaching library starts here':'Your next learning journey starts here'}</h2>
        <p>{tutor?'Courses assigned to your tutor account will appear here with their session schedules.':'You haven’t enrolled in a course yet. Explore a subject you love — your courses and upcoming sessions will appear here once you register.'}</p>
        {!tutor&&<div className="my-courses-empty-actions"><Link className="my-courses-primary" to="/student/courses?view=discover">Find a course <span aria-hidden="true">→</span></Link><Link className="my-courses-secondary" to="/student/find-tutors">Find a tutor</Link></div>}
      </section>
      {!tutor&&<CourseDiscovery preview/>}
    </>:<>
      {!current&&<section className="my-course-grid" aria-label="My courses">{courses.map(course=>{const next=courseState(course)==='Cancelled'?undefined:course.sessions.find(s=>+new Date(s.endAtUtc)>Date.now());return <article className="student-card my-course-card" key={course.id}><img src={course.image} alt=""/><div className="my-course-summary"><span className="my-course-category">{course.category}</span><h2>{course.title}</h2><CourseStatus course={course}/><p className="my-course-instructor">{course.instructor}</p><div className="my-course-meta"><span>{course.sessions.length} sessions</span><span>{course.enrolled}/{course.capacity} enrolled</span></div><div className="my-course-next"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.7"/><path d="M7 3v4m10-4v4M3 11h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg><span>{next?<><span className="my-course-next-label">Next session</span><time dateTime={next.startAtUtc}>{new Date(next.startAtUtc).toLocaleDateString('en-GB',{timeZone:'Asia/Ho_Chi_Minh',day:'numeric',month:'short'})} · {new Date(next.startAtUtc).toLocaleTimeString('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'})} <small>GMT+7</small></time></>:course.status==='Cancelled'?'Course cancelled':'All sessions completed'}</span></div>{tutor?<button className="my-course-action" aria-expanded={selected===course.id} onClick={()=>openCourse(course.id)}>View session details <span aria-hidden="true">↗</span></button>:<Link className="my-course-action" to={`/student/courses/${course.id}`}>View enrolled course <span aria-hidden="true">↗</span></Link>}</div></article>})}</section>}
      {current&&<section className="student-card course-details-card" aria-label="Teaching course details"><header className="course-details-actions"><div className="course-details-navigation"><button className="course-back-link my-course-back" type="button" onClick={()=>openCourse()}>← Back to my courses</button><Link className="course-library-link" to="/tutor/dashboard">Teaching schedule</Link></div><span className="my-course-category">{current.category}</span></header><CourseLifecycleActions course={current} mode="tutor" onChanged={async()=>{await reload();}}/><div className="course-details-body"><div className="course-details-intro"><img src={current.image} alt={current.title}/><h2>{current.title}</h2><p>{current.description}</p></div><div className="course-details-information"><div className="detail-rows">{[['Instructor',current.instructor],['Course type',current.category],['Enrolment',current.enrolled+' / '+current.capacity],['Sessions',String(current.sessions.length)]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><h3>Session schedule <small>(GMT+07)</small></h3><div className="course-session-grid my-course-sessions">{[...current.sessions].sort((a,b)=>a.startAtUtc.localeCompare(b.startAtUtc)).map((s,index)=><article key={s.id}><span>Session {index+1}</span><strong>{new Date(s.startAtUtc).toLocaleDateString('en-GB',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'short',year:'numeric'})}</strong><small>{new Date(s.startAtUtc).toLocaleTimeString('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'})} – {new Date(s.endAtUtc).toLocaleTimeString('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'})}</small></article>)}</div></div></div></section>}
    </>}
  </AppShell>;
}
