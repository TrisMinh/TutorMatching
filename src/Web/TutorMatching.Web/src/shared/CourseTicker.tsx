import {useEffect,useRef,useState} from 'react';
import {gatewayClient,type Course} from '../api';
import {MotionLink} from './MotionLink';
import './course-ticker.css';

export function CourseTicker({mode}:{mode:'student'|'tutor'}){
 const [courses,setCourses]=useState<Course[]>([]);
 const [mine,setMine]=useState<string[]>([]);
 const [paused,setPaused]=useState(false);
 const [selected,setSelected]=useState<Course>();
 const viewport=useRef<HTMLDivElement>(null);
 const group=useRef<HTMLDivElement>(null);
 const dialog=useRef<HTMLDialogElement>(null);
 const [copies,setCopies]=useState(1);
 const [duration,setDuration]=useState(60);
 useEffect(()=>{let active=true;const refresh=()=>gatewayClient.listCourses().then(value=>{if(active)setCourses(value);}).catch(()=>{});void refresh();window.addEventListener('courses-changed',refresh);if(mode==='tutor')gatewayClient.listMyCourses().then(value=>{if(active)setMine(value.map(c=>c.id));}).catch(()=>{});return()=>{active=false;window.removeEventListener('courses-changed',refresh);};},[mode]);
 useEffect(()=>{if(!courses.length)return;const measure=()=>{const width=group.current?.scrollWidth??0;if(width){setCopies(Math.max(1,Math.ceil((viewport.current?.clientWidth??0)/width)));setDuration(Math.max(24,width/32));}};measure();const observer=new ResizeObserver(measure);if(viewport.current)observer.observe(viewport.current);if(group.current)observer.observe(group.current);return()=>observer.disconnect();},[courses]);
 useEffect(()=>{if(selected&&!dialog.current?.open)dialog.current?.showModal();},[selected]);
 if(!courses.length)return null;
 const item=(course:Course,duplicate=false)=><button type="button" className="course-ticker__item" key={course.id} tabIndex={duplicate?-1:0} onClick={()=>setSelected(course)} title={course.title}><img src={course.image} width="26" height="26" alt="" onError={e=>{e.currentTarget.src='/assets/figma/dashboard-research.png';}}/><span>{course.title}</span><svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 12 12 4M4 4h8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>;
 return <>
  <section className={`course-ticker ${paused||selected?'is-paused':''}`} aria-label="Featured courses">
   <div className="course-ticker__label"><span aria-hidden="true"/> <strong>Discover courses</strong></div>
   <div className="course-ticker__viewport" ref={viewport}>
    <div className="course-ticker__track" style={{animationDuration:`${duration*copies}s`}}>
     <div className="course-ticker__group"><div className="course-ticker__repeat course-ticker__original" ref={group}>{courses.map(c=>item(c))}</div>{Array.from({length:copies-1},(_,i)=><div className="course-ticker__repeat" aria-hidden="true" key={i}>{courses.map(c=>item(c,true))}</div>)}</div>
     <div className="course-ticker__group" aria-hidden="true">{Array.from({length:copies},(_,i)=><div className="course-ticker__repeat" key={i}>{courses.map(c=>item(c,true))}</div>)}</div>
    </div>
   </div>
   <button type="button" className="course-ticker__pause" aria-label={paused?'Play course ticker':'Pause course ticker'} aria-pressed={paused} onClick={()=>setPaused(value=>!value)}>{paused?<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="m5 3 8 5-8 5z"/></svg>:<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="4" y="3" width="3" height="10" rx="1"/><rect x="9" y="3" width="3" height="10" rx="1"/></svg>}</button>
  </section>
  <dialog className="course-ticker-preview" ref={dialog} onClose={()=>setSelected(undefined)} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close();}} aria-labelledby="course-preview-title">
   {selected?<><button className="course-ticker-preview__close" type="button" aria-label="Close course preview" onClick={()=>dialog.current?.close()}>×</button><img className="course-ticker-preview__image" src={selected.image} alt=""/><span className="course-ticker-preview__category">{selected.category}</span><h2 id="course-preview-title">{selected.title}</h2><p className="course-ticker-preview__instructor">{selected.instructor}</p><p>{selected.description}</p><div className="course-ticker-preview__meta"><span>{selected.sessions.length} sessions</span><span>{selected.enrolled}/{selected.capacity} enrolled</span></div>{mode==='student'||mine.includes(selected.id)?<MotionLink className="student-primary-link" to={mode==='student'?`/student/courses/${encodeURIComponent(selected.id)}`:`/tutor/courses?course=${encodeURIComponent(selected.id)}`} onClick={()=>dialog.current?.close()}>View course →</MotionLink>:null}</>:null}
  </dialog>
 </>;
}
