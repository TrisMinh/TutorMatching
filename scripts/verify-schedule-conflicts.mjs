import assert from 'node:assert/strict';
const base='http://localhost:8080/api/v1';
async function login(email){const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'TutorDemo!2026'})});assert.equal(r.status,200);return (await r.json()).accessToken;}
const tutor=await login('tutor01@demo.tutormatching.test');
const course=await fetch(base+'/courses/ux-research').then(r=>r.json());
const response=await fetch(base+'/courses/conflict-probe-rejected',{method:'PUT',headers:{Authorization:`Bearer ${tutor}`,'Content-Type':'application/json'},body:JSON.stringify({title:'Must reject overlapping instructor session',image:course.image,category:course.category,description:'Validation probe',capacity:1,sessions:course.sessions})});
assert.equal(response.status,409,await response.text());
assert.equal((await fetch(base+'/courses/conflict-probe-rejected')).status,404);
const student=await login('student01@demo.tutormatching.test');
const results=await Promise.all(Array.from({length:2},()=>fetch(base+'/courses/ux-research/enrollments',{method:'POST',headers:{Authorization:`Bearer ${student}`}})));
assert.ok(results.every(r=>[200,409,503].includes(r.status)));
const after=await fetch(base+'/courses/ux-research').then(r=>r.json());assert.equal(after.enrolled,course.enrolled);
console.log('Instructor overlap rejected; rejected course not persisted; concurrent duplicate enrollment does not increase enrollment count.');
