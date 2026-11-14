import assert from 'node:assert/strict';
const base='http://localhost:8080/api/v1';
async function login(email){const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'TutorDemo!2026'})});assert.equal(r.status,200);const s=await r.json();return {Authorization:`Bearer ${s.accessToken}`};}
async function mine(headers){const r=await fetch(base+'/courses/mine',{headers});assert.equal(r.status,200,await r.clone().text());return r.json();}
assert.equal((await fetch(base+'/courses/mine')).status,401);
const student=await login('student01@demo.tutormatching.test');
const own=await mine(student);assert.ok(own.some(c=>c.id==='ux-research'));assert.ok(own.every(c=>c.isEnrolled));
const before=own.length;
assert.equal((await fetch(base+'/courses/ux-research/enrollments',{method:'POST',headers:student})).status,200);
assert.equal((await mine(student)).length,before);
const other=await mine(await login('student24@demo.tutormatching.test'));assert.ok(other.length<own.length);
const teacher=await mine(await login('tutor01@demo.tutormatching.test'));assert.ok(teacher.some(c=>c.id==='ux-research'));assert.ok(!teacher.some(c=>c.id==='app-development'));
const second=await mine(await login('tutor02@demo.tutormatching.test'));assert.ok(second.some(c=>c.id==='app-development'));assert.ok(!second.some(c=>c.id==='ux-research'));
console.log('PASS: authenticated course library, persisted enrollments, idempotency, student isolation and tutor ownership.');
