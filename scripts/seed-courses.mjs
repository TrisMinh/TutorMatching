import {requireMailpitForDemo} from './verify-demo-email.mjs';
requireMailpitForDemo();
const base='http://localhost:8080/api/v1';
async function api(path,method='GET',body,token){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${r.status} ${path}: ${await r.text()}`);return r.status===204?null:r.json();}
async function login(role,i){return (await api('/auth/login','POST',{email:`${role}${String(i).padStart(2,'0')}@demo.tutormatching.test`,password:'TutorDemo!2026'})).accessToken;}
const courses=[
 ['ux-research','UX Research Class','dashboard-research.png','Personal Coaching'],
 ['app-development','App Development Course','dashboard-app.png','Workshop'],
 ['figma-workshop','Figma UI/UX Workshop','dashboard-figma.png','Workshop'],
 ['design-webinar','Webinar','dashboard-course-ui.png','Webinar'],
 ['portfolio-review','Portfolio Review','dashboard-course-ui.png','One by One'],
 ['photography-practice','Portrait Lighting Practice','dashboard-course-camera.png','Workshop'],
 ['prototype-review','Prototype Feedback','dashboard-figma.png','Personal Coaching'],
 ['portrait-photography','Portrait Photography Masterclass','dashboard-course-camera.png','One by One'],
 ['interface-design','User Interface Design Masterclass','dashboard-course-ui.png','Workshop'],
 ['css-designers','CSS for Designers','dashboard-app.png','Workshop'],
 ['design-foundations','3D Design Foundations','dashboard-figma.png','Workshop'],
 ['composition','Design Composition','dashboard-course-ui.png','Personal Coaching'],
 ['color','Color Psychology','dashboard-figma.png','Webinar'],
 ['typography','Typography in UX/UI','dashboard-research.png','Webinar'],
 ['figma-ui-design','Figma UI UX Design','dashboard-course-ui.png','Workshop'],
];
const existing=await api('/courses');
const subjects=await api('/subjects');
const students=await Promise.all(Array.from({length:8},(_,i)=>login('student',i+1)));
const studentBusy=new Map();
for(const token of students){const [mine,bookings]=await Promise.all([api('/courses/mine','GET',undefined,token),api('/bookings','GET',undefined,token)]);studentBusy.set(token,[...mine.filter(c=>c.status!=='Cancelled').flatMap(c=>c.sessions.map(s=>({...s,courseId:c.id}))),...bookings.filter(b=>b.status==='Confirmed')]);}
const overlaps=(a,b)=>Date.parse(a.startAtUtc)<Date.parse(b.endAtUtc)&&Date.parse(b.startAtUtc)<Date.parse(a.endAtUtc);
for(let i=0;i<courses.length;i++){
 const [slug,baseTitle,image,category]=courses[i],cohort=new Date().toISOString().slice(0,10),id='catalog-'+cohort+'-'+slug,title=baseTitle+' · '+cohort;
 const current=existing.find(course=>course.id===id),token=await login('tutor',i+1),participants=students.slice(0,category==='One by One'?1:3+i%5);
 const code=slug.includes('photograph')?'PHOTOGRAPHY':slug.includes('typograph')?'TYPOGRAPHY':slug.includes('ux-research')?'UX':slug.includes('app-development')?'PROGRAMMING':slug.includes('css')?'WEB':slug.includes('portfolio')?'PORTFOLIO':slug.includes('figma')||slug.includes('prototype')?'FIGMA':'DESIGN';
 const subject=subjects.find(s=>s.code===code);
 if(subject){const profile=await api('/tutors/me','GET',undefined,token);if(!profile.subjects.some(s=>s.subjectId===subject.id))await api('/tutors/me/subjects','PUT',[...profile.subjects.map(s=>({subjectId:s.subjectId,proficiencyLevel:s.proficiencyLevel})),{subjectId:subject.id,proficiencyLevel:2}],token);}
 const [owned,bookings]=await Promise.all([api('/courses/mine','GET',undefined,token),api('/bookings','GET',undefined,token)]);
 const busy=[...owned.filter(c=>c.id!==id&&c.status!=='Cancelled').flatMap(c=>c.sessions),...bookings.filter(b=>b.status==='Confirmed'),...participants.flatMap(student=>studentBusy.get(student).filter(s=>s.courseId!==id))];
 let sessions=current?.sessions;
 const available=items=>items?.length===4&&items.every(item=>Date.parse(item.startAtUtc)>Date.now()&&!busy.some(other=>overlaps(item,other)));
 if(!available(sessions)){
  sessions=null;
  for(let day=2+i;day<65&&!sessions;day++)for(const hour of [13,14,15,12,11]){
   const start=new Date();start.setUTCDate(start.getUTCDate()+day);start.setUTCHours(hour,0,0,0);
   const candidate=Array.from({length:4},(_,week)=>({startAtUtc:new Date(+start+week*7*86400000).toISOString(),endAtUtc:new Date(+start+week*7*86400000+3600000).toISOString()}));
   if(available(candidate)){sessions=candidate;break;}
  }
 }
 if(!sessions)throw new Error('No conflict-free schedule found for '+id);
 if(!current||JSON.stringify(current.sessions.map(({startAtUtc,endAtUtc})=>({startAtUtc,endAtUtc})))!==JSON.stringify(sessions.map(({startAtUtc,endAtUtc})=>({startAtUtc,endAtUtc}))))
  await api(`/courses/${id}`,'PUT',{title,image:`/assets/figma/${image}`,category,description:`${title}: four guided sessions with practical exercises, feedback and a final review. All sessions use Asia/Ho_Chi_Minh time.`,capacity:category==='One by One'?1:20,sessions},token);
 for(const student of participants){await api(`/courses/${id}/enrollments`,'POST',{},student);studentBusy.set(student,[...studentBusy.get(student).filter(s=>s.courseId!==id),...sessions.map(s=>({...s,courseId:id}))]);}
 console.log('Linked course '+(i+1)+'/'+courses.length+': '+title);
}
const saved=await api('/courses');
for(const c of saved){if(c.enrolled>c.capacity||c.sessions.length<1)throw new Error('Invalid course relations');}
console.log(JSON.stringify({courses:saved.length,sessions:saved.reduce((n,c)=>n+c.sessions.length,0),enrollments:saved.reduce((n,c)=>n+c.enrolled,0)}));
