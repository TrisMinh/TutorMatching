import {test,expect} from '@playwright/test';

test('lost enrollment response retries without duplicating enrollment or tutor notice',async({page,request})=>{
 const base='http://localhost:8080/api/v1';const password='TutorDemo!2026';const stamp=Date.now();const email=`course.e2e.${stamp}@example.com`;const name=`Retry learner ${stamp}`;
 expect((await request.post(base+'/auth/register',{data:{email,password,role:'Student'}})).status()).toBe(201);
 const session=await(await request.post(base+'/auth/login',{data:{email,password}})).json();const headers={Authorization:`Bearer ${session.accessToken}`};
 expect((await request.put(base+'/students/me',{headers,data:{displayName:name,educationLevel:2,learningGoal:'Learn design',timezone:'Asia/Ho_Chi_Minh',avatarUrl:'/assets/figma/student-tutor-2.jpg'}})).status()).toBe(200);
 const before=await(await request.get(base+'/courses/ux-research')).json();
 await page.addInitScript(s=>localStorage.setItem('tutormatching.auth.session',JSON.stringify({...s,role:'Student'})),session);
 let attempts=0;
 await page.route('**/api/v1/courses/ux-research/enrollments',async route=>{
  if(route.request().method()!=='POST'){await route.continue();return;}
  attempts++;
  if(attempts===1){
   try{const committed=await route.fetch();expect(committed.status()).toBe(200);await route.abort('connectionreset');}
   catch{try{await route.abort('failed');}catch{}throw new Error('Enrollment commit probe failed; check trusted local CA/network. Request credentials omitted.');}
  }
  else await route.continue();
 });
 await page.goto('/student/courses/ux-research');
 await page.getByRole('button',{name:'Enroll in course',exact:true}).click();
 await expect(page.getByRole('button',{name:'Enrolled',exact:true})).toBeVisible();expect(attempts).toBe(2);
 const after=await(await request.get(base+'/courses/ux-research')).json();expect(after.enrolled).toBe(before.enrolled+1);
 const teacher=await(await request.post(base+'/auth/login',{data:{email:'tutor01@demo.tutormatching.test',password}})).json();
 const notices=await(await request.get(base+'/courses/enrollment-notifications',{headers:{Authorization:`Bearer ${teacher.accessToken}`}})).json();
 expect(notices.filter((item:any)=>item.studentName===name&&item.courseId==='ux-research')).toHaveLength(1);
});
