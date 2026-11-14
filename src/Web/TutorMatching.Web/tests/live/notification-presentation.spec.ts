import {test,expect} from '@playwright/test';
test('booking notifications show class, Vietnam time and participant avatar instead of raw IDs',async({page,request})=>{
 const login=await request.post('http://localhost:8080/api/v1/auth/login',{data:{email:'tutor01@demo.tutormatching.test',password:'TutorDemo!2026'}});
 await page.addInitScript(s=>localStorage.setItem('tutormatching.auth.session',JSON.stringify({...s,role:'Tutor'})),await login.json());
 const id='11111111-1111-4111-8111-111111111111';
 const booking={id,studentId:'learner',tutorId:'teacher',subjectId:'english',status:'Confirmed',startAtUtc:'2026-11-22T20:00:00Z',endAtUtc:'2026-11-22T21:00:00Z'};
 await page.route('**/api/v1/notifications?*',r=>r.fulfill({json:{items:[{id:'notice',bookingId:id,type:'BookingConfirmed',title:'Booking confirmed',body:`Booking ${id} starts at 2026-11-22T20:00:00.0000000+00:00.`,status:'Unread',createdAtUtc:'2026-11-14T11:31:00Z'}],total:1,page:1,pageSize:100}}));
 await page.route('**/api/v1/courses/enrollment-notifications',r=>r.fulfill({json:[]}));await page.route('**/api/v1/bookings',r=>r.fulfill({json:[booking]}));await page.route('**/api/v1/subjects',r=>r.fulfill({json:[{id:'english',name:'English',code:'ENG'}]}));await page.route(`**/api/v1/bookings/${id}`,r=>r.fulfill({json:{booking,studentName:'Linh Tran',studentAvatarUrl:'/assets/figma/student-tutor-2.jpg'}}));
 await page.goto('/tutor/dashboard');await page.getByRole('button',{name:'Notifications',exact:true}).click();const panel=page.getByRole('region',{name:'Recent notifications'});
 await expect(panel.getByRole('heading',{name:'Booking confirmed',exact:true})).toBeVisible();await expect(panel.getByText('Linh Tran',{exact:true})).toBeVisible();await expect(panel.getByText('English',{exact:true})).toBeVisible();await expect(panel.getByText('23 Nov, 03:00 (GMT+7)',{exact:true})).toBeVisible();await expect(panel.getByLabel('Avatar of Linh Tran').locator('img')).toHaveAttribute('src','/assets/figma/student-tutor-2.jpg');
 await expect(panel).not.toContainText(id);await expect(panel).not.toContainText('T20:00:00');await panel.getByRole('link',{name:'See more'}).click();await expect(page.locator('.notification-list')).toContainText('English');await expect(page.locator('.notification-list')).not.toContainText(id);
 await expect(page.locator('.notification-actor>.notification-person')).toHaveCSS('position','static');
});
