import {test,expect} from '@playwright/test';
test('boxed student name opens actual participant profile and protects it from other accounts',async({page,request})=>{
 const base='http://localhost:8080/api/v1';const password='TutorDemo!2026';
 async function login(email:string){const r=await request.post(base+'/auth/login',{data:{email,password}});expect(r.ok()).toBeTruthy();return r.json();}
 const teacher=await login('tutor01@demo.tutormatching.test');const headers={Authorization:`Bearer ${teacher.accessToken}`};
 const bookings=await (await request.get(base+'/bookings',{headers})).json();const booking=bookings.find((b:any)=>b.status==='Confirmed');expect(booking).toBeTruthy();
 const response=await request.get(base+`/bookings/${booking.id}/student-profile`,{headers});expect(response.status()).toBe(200);const student=await response.json();expect(student.id).toBe(booking.studentId);expect(student.displayName).toBeTruthy();expect(student.learningGoal).toBeTruthy();
 const stranger=await login('tutor02@demo.tutormatching.test');expect((await request.get(base+`/bookings/${booking.id}/student-profile`,{headers:{Authorization:`Bearer ${stranger.accessToken}`}})).status()).toBe(404);
 const learner=await login('student01@demo.tutormatching.test');expect((await request.get(base+`/bookings/${booking.id}/student-profile`,{headers:{Authorization:`Bearer ${learner.accessToken}`}})).status()).toBe(403);
 await page.addInitScript(s=>localStorage.setItem('tutormatching.auth.session',JSON.stringify({...s,role:'Tutor'})),teacher);
 await page.goto(`/tutor/lessons/${booking.id}`);const link=page.getByRole('link',{name:`View profile of ${student.displayName}`,exact:true});await expect(link).toHaveClass('booking-student-link');expect(await link.evaluate(el=>getComputedStyle(el).borderRadius)).toBe('12px');await link.click();
 await expect(page).toHaveURL(new RegExp(`/tutor/lessons/${booking.id}/student$`));await expect(page.getByRole('heading',{name:student.displayName,exact:true})).toBeVisible();await expect(page.getByText(student.learningGoal,{exact:true})).toBeVisible();
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
 await page.getByRole('link',{name:'Back to booking'}).click();await expect(page).toHaveURL(new RegExp(`/tutor/lessons/${booking.id}$`));
});
