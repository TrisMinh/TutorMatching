import {useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {gatewayClient} from '../api';
import './global-search.css';
type Result={id:string;title:string;detail:string;kind:string;to:string};
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
export function GlobalSearch({mode}:{mode:'student'|'tutor'}){
 const [query,setQuery]=useState('');const [open,setOpen]=useState(false);const [items,setItems]=useState<Result[]>([]);const [loading,setLoading]=useState(false);const [failed,setFailed]=useState(false);const [active,setActive]=useState(-1);
 const root=useRef<HTMLDivElement>(null);const navigate=useNavigate();
 useEffect(()=>{const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
 useEffect(()=>{
  if(!open)return;
  let cancelled=false;
  const timer=setTimeout(async()=>{
   setLoading(true);setFailed(false);
   const results=await Promise.allSettled([mode==='student'?gatewayClient.listCourses():gatewayClient.listMyCourses(),gatewayClient.listSubjects(),gatewayClient.listBookings(),mode==='student'?gatewayClient.searchTutors(undefined,1,100):Promise.resolve({items:[]})]);
   if(cancelled)return;
   const [courses,subjects,bookings,tutors]=results;
   const names=subjects.status==='fulfilled'?subjects.value:[];
   const rows:Result[]=[];
   if(courses.status==='fulfilled')rows.push(...courses.value.map(c=>({id:`course-${c.id}`,title:c.title,detail:`${c.instructor} · ${c.category}`,kind:'Course',to:mode==='student'?`/student/courses/${c.id}`:`/tutor/courses?course=${encodeURIComponent(c.id)}`})));
   if(tutors.status==='fulfilled')rows.push(...tutors.value.items.map(t=>({id:`tutor-${t.id}`,title:t.displayName,detail:t.subjects.map(s=>names.find(n=>n.id===s.subjectId)?.name).filter(Boolean).join(' · '),kind:'Tutor',to:`/student/tutors/${t.id}`})));
   if(bookings.status==='fulfilled')rows.push(...bookings.value.map(b=>({id:`booking-${b.id}`,title:`${names.find(s=>s.id===b.subjectId)?.name??'Private'} lesson`,detail:`${new Date(b.startAtUtc).toLocaleString('en-GB',{timeZone:'Asia/Ho_Chi_Minh',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} · ${b.status} · ${b.id}`,kind:'Booking',to:mode==='student'?`/student/bookings/${b.id}`:`/tutor/lessons/${b.id}`})));
   const needle=normalize(query.trim());
   const filtered=needle?rows.filter(r=>normalize(`${r.title} ${r.detail} ${r.kind}`).includes(needle)):rows;
   filtered.sort((a,b)=>Number(normalize(b.title).startsWith(needle))-Number(normalize(a.title).startsWith(needle)));
   setItems(filtered.slice(0,12));setFailed(results.some(r=>r.status==='rejected'));setLoading(false);setActive(-1);
  },250);
  return()=>{cancelled=true;clearTimeout(timer);};
 },[query,open,mode]);
 function go(item:Result){setOpen(false);setQuery('');navigate(item.to,{viewTransition:true});}
 return <div className="global-search" ref={root}><label className="student-global-search"><img src="/assets/figma/nav-search.svg" alt=""/><input role="combobox" aria-label="Search anything" aria-expanded={open} aria-controls="global-search-results" aria-autocomplete="list" aria-activedescendant={active>=0?items[active]?.id:undefined} placeholder="Search courses, tutors, bookings…" value={query} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setLoading(true);setActive(-1);setOpen(true);}} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);return;}if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);setActive(v=>Math.min(v+1,items.length-1));}if(e.key==='ArrowUp'){e.preventDefault();setActive(v=>Math.max(0,v-1));}if(e.key==='Enter'){e.preventDefault();if(!loading&&items.length)go(items[Math.max(0,active)]);}}}/></label>
 {open&&<div className="global-search-panel"><header>{query.trim()?'Search results':'Explore'}<small>Courses · {mode==='student'?'Tutors · ':''}Your bookings</small></header>{loading?<p role="status">Searching…</p>:null}{failed&&!loading?<p role="status">Some results could not be loaded. Try searching again.</p>:null}<div role="listbox" id="global-search-results" aria-label="Search suggestions">{!loading&&items.map((item,index)=><button type="button" role="option" aria-selected={active===index} id={item.id} key={item.id} onClick={()=>go(item)} onMouseEnter={()=>setActive(index)}><span className={`search-kind kind-${item.kind.toLowerCase()}`}>{item.kind}</span><span><strong>{item.title}</strong><small>{item.detail}</small></span><span aria-hidden="true">↗</span></button>)}</div>{!loading&&!items.length?<p>No results for “{query}”. Try a course name, tutor name, subject or booking ID.</p>:null}<footer>↑ ↓ to select · Enter to open · Esc to close</footer></div>}
 </div>;
}
