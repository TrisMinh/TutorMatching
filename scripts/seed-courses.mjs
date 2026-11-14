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
const students=await Promise.all(Array.from({length:8},(_,i)=>login('student',i+1)));
for(let i=0;i<courses.length;i++){
 if(existing.some(course=>course.id===courses[i][0])) continue;
 const [id,title,image,category]=courses[i];const token=await login('tutor',i+1);
 const start=new Date();start.setUTCHours(2+i%6,0,0,0);start.setUTCDate(start.getUTCDate()+1+i);
 const sessions=Array.from({length:4},(_,week)=>({startAtUtc:new Date(+start+week*7*86400000).toISOString(),endAtUtc:new Date(+start+week*7*86400000+3600000).toISOString()}));
 await api(`/courses/${id}`,'PUT',{title,image:`/assets/figma/${image}`,category,description:`${title}: four guided sessions with practical exercises, individual feedback and a final review. All sessions use Asia/Ho_Chi_Minh time.`,capacity:category==='One by One'?1:20,sessions},token);
 for(const student of students.slice(0,category==='One by One'?1:3+i%5))await api(`/courses/${id}/enrollments`,'POST',{},student);
}
const saved=await api('/courses');
for(const c of saved){if(c.enrolled>c.capacity||c.sessions.length!==4)throw new Error('Invalid course relations');}
console.log(JSON.stringify({courses:saved.length,sessions:saved.reduce((n,c)=>n+c.sessions.length,0),enrollments:saved.reduce((n,c)=>n+c.enrolled,0)}));
