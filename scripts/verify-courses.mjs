import assert from 'node:assert/strict';
const base='http://localhost:8080/api/v1';
const courses=await fetch(base+'/courses').then(r=>r.json());
assert.ok(courses.length>=15);
for(const course of courses){
 assert.ok(course.tutorId&&course.instructor&&course.image);
 assert.ok(course.enrolled<=course.capacity);
 assert.equal(course.sessions.length,4);
 const detail=await fetch(base+'/courses/'+course.id).then(r=>r.json());
 assert.equal(detail.title,course.title);
 assert.equal(detail.enrolled,course.enrolled);
 for(const session of detail.sessions)assert.ok(new Date(session.endAtUtc)>new Date(session.startAtUtc));
}
const login=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'student01@demo.tutormatching.test',password:'TutorDemo!2026'})}).then(r=>r.json());
const headers={Authorization:`Bearer ${login.accessToken}`};
const before=courses.find(c=>c.id==='ux-research').enrolled;
assert.equal((await fetch(base+'/courses/ux-research/enrollments',{method:'POST',headers})).status,200);
const after=await fetch(base+'/courses/ux-research').then(r=>r.json());assert.equal(after.enrolled,before);
assert.equal((await fetch(base+'/courses/ux-research',{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:'{}'})).status,403);
console.log(`Verified ${courses.length} persisted courses, instructor links, capacity, detail consistency, idempotent enrollment and role authorization.`);
