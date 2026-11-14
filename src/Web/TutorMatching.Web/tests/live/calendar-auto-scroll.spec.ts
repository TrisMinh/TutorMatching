import {test,expect} from '@playwright/test';
test('selecting evening course date scrolls from morning booking to evening',async({page,request})=>{
 const login=await request.post('http://localhost:8080/api/v1/auth/login',{data:{email:'student01@demo.tutormatching.test',password:'TutorDemo!2026'}});
 await page.addInitScript(session=>localStorage.setItem('tutormatching.auth.session',JSON.stringify({...session,role:'Student'})),await login.json());
 await page.route('**/api/v1/courses/mine',r=>r.fulfill({json:[{id:'evening',title:'Evening course',category:'Workshop',instructor:'Teacher',enrolled:1,capacity:20,image:'',sessions:[{id:'session',startAtUtc:'2026-12-15T12:00:00Z',endAtUtc:'2026-12-15T13:00:00Z'}]}]}));
 await page.route('**/api/v1/bookings',r=>r.fulfill({json:[{id:'morning',tutorId:'teacher',subjectId:'math',status:'Confirmed',startAtUtc:'2026-12-14T02:00:00Z',endAtUtc:'2026-12-14T03:00:00Z'}]}));
 await page.goto('/student/dashboard');
 const calendar=page.getByRole('region',{name:'Weekly calendar'});
 await expect.poll(()=>calendar.evaluate(el=>el.scrollTop)).toBeGreaterThan(500);
 await page.getByRole('button',{name:'2026-12-15',exact:true}).click();
 await expect.poll(()=>calendar.evaluate(el=>el.scrollTop)).toBeGreaterThan(1400);
 await page.getByRole('button',{name:'2026-12-14',exact:true}).click();
 await expect.poll(()=>calendar.evaluate(el=>el.scrollTop)).toBeLessThan(800);
});
