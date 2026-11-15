import {requireMailpitForDemo, verifyDemoEmail} from './verify-demo-email.mjs';
requireMailpitForDemo();
// Local demo accounts only. Uses production API validation and event delivery.
const base = 'http://localhost:8080/api/v1';
const password = 'TutorDemo!2026';
async function api(path, method = 'GET', body, token) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
  return response.status === 204 ? undefined : response.json();
}
async function account(email, role) {
  const response = await fetch(base + '/auth/register', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,role})});
  if (!response.ok && response.status !== 409) throw new Error(await response.text());
  if (response.status === 201) await verifyDemoEmail(email);
  let login = await fetch(base + '/auth/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  if (login.status === 403) {await verifyDemoEmail(email); login = await fetch(base + '/auth/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});}
  if (!login.ok) throw new Error('Unable to log in to demo account: ' + login.status);
  const token = (await login.json()).accessToken;
  const settings = await api('/users/me/settings','GET',undefined,token);
  if (settings.emailReminders) await api('/users/me/settings','PUT',{...settings,emailReminders:false},token);
  return token;
}
const subjects = await api('/subjects');
if (!subjects.length) throw new Error('Subject catalog is empty');
const names = ['Nguyen Minh Anh','Tran Thu Ha','Le Quang Huy','Pham Ngoc Linh','Hoang Duc Bao','Vo Thanh Mai','Dang Gia Khanh','Bui Phuong Thao','Do Tuan Kiet','Ngo Hong Nhung','Duong Hai Nam','Ly Thuy Duong','Phan Anh Tuan','Vu Kim Chi','Trinh Minh Chau','Dinh Bao Ngoc','Cao Hoang Long','Mai Lan Anh'];
const start = new Date(); start.setUTCHours(2,0,0,0); start.setUTCDate(start.getUTCDate()+1);
const tutors=[];
for(let i=0;i<names.length;i++) {
  const token=await account(`tutor${String(i+1).padStart(2,'0')}@demo.tutormatching.test`,'Tutor');
  const subject=subjects[i%subjects.length];
  const profile=await api('/tutors/me','PUT',{displayName:names[i],bio:`${names[i]} teaches ${subject.name} with structured lessons, practical exercises and a personalised study plan. ${3+i%10} years of experience supporting school students and exam preparation. Lessons include a diagnostic review, guided practice and clear homework feedback.`,experienceYears:3+i%10,avatarUrl:`/assets/figma/student-tutor-${1+i%3}.jpg`},token);
  await api('/tutors/me/subjects','PUT',[{subjectId:subject.id,proficiencyLevel:2}],token);
  const windows=Array.from({length:21},(_,day)=>{const date=new Date(start);date.setUTCDate(date.getUTCDate()+day);return {startAtUtc:date.toISOString(),endAtUtc:new Date(+date+10*3600000).toISOString()};});
  await api('/tutors/me/availability','PUT',windows,token);
  tutors.push({...profile,subject,token});
}
let created=0;
for(let i=0;i<24;i++) {
  const token=await account(`student${String(i+1).padStart(2,'0')}@demo.tutormatching.test`,'Student');
  await api('/students/me','PUT',{displayName:`${names[i%names.length]} ${i+1}`,educationLevel:2,learningGoal:`Improve ${subjects[i%subjects.length].name} through weekly practice and prepare for the next school examination.`,timezone:'Asia/Ho_Chi_Minh',avatarUrl:`/assets/figma/dashboard-avatar-${1+i%3}.png`},token);
  await api('/students/me/interests','PUT',[{subjectId:subjects[i%subjects.length].id,priority:1}],token);
  const existing=await api('/bookings','GET',undefined,token);
  if(existing.some(booking=>booking.status==='Confirmed'&&Date.parse(booking.endAtUtc)>Date.now())) continue;
  for(let lesson=0;lesson<4;lesson++) {
    const tutor=tutors[i%tutors.length];
    const slot=new Date(start);slot.setUTCDate(slot.getUTCDate()+lesson*3+Math.floor(i/18));slot.setUTCHours(2+i%6);
    const hold=await api('/bookings/holds','POST',{tutorId:tutor.id,subjectId:tutor.subject.id,startAtUtc:slot.toISOString()},token);
    const booking=await api('/bookings','POST',{holdId:hold.holdId,holdToken:hold.holdToken},token);
    if(lesson===3 && i%4===0) await api(`/bookings/${booking.id}?reasonCode=StudentRequested`,'DELETE',undefined,token);
    created++;
  }
}
console.log(JSON.stringify({tutors:tutors.length,students:24,createdBookings:created,availabilityWindows:tutors.length*21,demoPassword:password},null,2));
