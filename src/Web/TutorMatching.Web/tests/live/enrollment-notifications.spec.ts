import {test,expect} from '@playwright/test';
test('direct enrollment creates exactly one owned tutor alert that opens the course and persists read status',async({page,request})=>{
 const base='http://localhost:8080/api/v1';const password='TutorDemo!2026';const stamp=Date.now();const email=`course.e2e.${stamp}@example.com`;const name=`New learner ${stamp}`;
 expect((await request.post(base+'/auth/register',{data:{email,password,role:'Student'}})).ok()).toBeTruthy();
 const learner=await (await request.post(base+'/auth/login',{data:{email,password}})).json();const studentHeaders={Authorization:`Bearer ${learner.accessToken}`};
 expect((await request.put(base+'/students/me',{headers:studentHeaders,data:{displayName:name,educationLevel:2,learningGoal:'Learn design',timezone:'Asia/Ho_Chi_Minh',avatarUrl:'/assets/figma/student-tutor-2.jpg'}})).ok()).toBeTruthy();
 const teacher=await (await request.post(base+'/auth/login',{data:{email:'tutor01@demo.tutormatching.test',password}})).json();const headers={Authorization:`Bearer ${teacher.accessToken}`};
 for(let i=0;i<2;i++){const enrolled=await request.post(base+'/courses/ux-research/enrollments',{headers:studentHeaders});expect(enrolled.status()).toBe(200);expect((await enrolled.json()).enrolled).toBe(true);}
 const mine=await (await request.get(base+'/courses/mine',{headers:studentHeaders})).json();expect(mine.some((c:any)=>c.id==='ux-research')).toBeTruthy();
 async function notices(){const r=await request.get(base+'/courses/enrollment-notifications',{headers});expect(r.status()).toBe(200);return r.json();}
 const alerts=(await notices()).filter((n:any)=>n.studentName===name);expect(alerts).toHaveLength(1);const notice=alerts[0];expect(notice.status).toBe('Unread');expect(notice.courseId).toBe('ux-research');
 const other=await (await request.post(base+'/auth/login',{data:{email:'tutor02@demo.tutormatching.test',password}})).json();const others=await (await request.get(base+'/courses/enrollment-notifications',{headers:{Authorization:`Bearer ${other.accessToken}`}})).json();expect(others.some((n:any)=>n.id===notice.id)).toBeFalsy();
 expect((await request.put(base+'/courses/enrollment-notifications/'+notice.id.slice(11)+'/read',{headers:{Authorization:`Bearer ${other.accessToken}`}})).status()).toBe(404);
 expect((await request.get(base+'/courses/enrollment-notifications',{headers:studentHeaders})).status()).toBe(403);
 await page.addInitScript(s=>localStorage.setItem('tutormatching.auth.session',JSON.stringify({...s,role:'Tutor'})),teacher);
 await page.route('**/api/v1/notifications?*',route=>route.fulfill({status:503,json:{error:'Notification service unavailable'}}));
 await page.goto('/tutor/dashboard');await page.getByRole('button',{name:'Notifications',exact:true}).click();
 const panel=page.getByRole('region',{name:'Recent notifications'});const ownNotice=panel.locator('article').filter({has:page.getByLabel(`Avatar of ${name}`)});await expect(ownNotice.getByRole('heading',{name:'New student enrolled',exact:true})).toBeVisible();await expect(ownNotice.getByText(name,{exact:true})).toBeVisible();await expect(ownNotice.getByText('UX Research Class',{exact:true})).toBeVisible();await expect(panel.getByLabel(`Avatar of ${name}`).locator('img')).toHaveAttribute('src','/assets/figma/student-tutor-2.jpg');await expect(panel.getByRole('status')).toContainText('Some notifications');await ownNotice.getByRole('link').click();
 await expect(page).toHaveURL(/tutor\/courses\?course=ux-research$/);await expect(page.getByRole('region',{name:'Teaching course details'})).toBeVisible();
 await expect.poll(async()=>(await notices()).find((n:any)=>n.id===notice.id).status).toBe('Read');
 await page.unroute('**/api/v1/notifications?*');
 await page.goto('/tutor/notifications');await expect(page.locator('.notification-item').filter({has:page.getByLabel(`Avatar of ${name}`)}).getByRole('heading',{name:'New student enrolled',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:/Accept|Reject/})).toHaveCount(0);
});
