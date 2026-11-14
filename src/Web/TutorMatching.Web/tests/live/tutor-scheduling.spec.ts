import {test,expect} from '@playwright/test';
async function signIn(page:any,request:any){const r=await request.post('http://localhost:8080/api/v1/auth/login',{data:{email:'tutor01@demo.tutormatching.test',password:'TutorDemo!2026'}});expect(r.ok()).toBeTruthy();await page.addInitScript((s:any)=>localStorage.setItem('tutormatching.auth.session',JSON.stringify({...s,role:'Tutor'})),await r.json());}
test('tutor schedule shows owned courses and bookings and opens actual lesson',async({page,request})=>{
 await signIn(page,request);await page.goto('/tutor/schedule');
 await expect(page.getByRole('region',{name:'Weekly calendar'})).toBeVisible();
 await page.getByRole('combobox',{name:/Courses I teach/}).click();
 await page.getByRole('option',{name:/UX Research Class/}).click();
 await expect(page.getByRole('region',{name:'Weekly calendar'}).getByRole('button',{name:/UX Research Class/}).first()).toBeAttached();
 await expect(page.getByRole('region',{name:'Weekly calendar'}).getByRole('button',{name:/App Development Course/})).toHaveCount(0);
 await page.goto('/tutor/requests');await expect(page.getByRole('button',{name:'Accept',exact:true})).toHaveCount(0);
 await page.getByRole('link',{name:'View booking'}).first().click();await expect(page).toHaveURL(/tutor\/lessons\/[a-f0-9-]+$/);
 await expect(page.getByText('Booking reference')).toBeVisible();
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
});
test('tutor availability loads saved dates and validates edits',async({page,request})=>{
 await signIn(page,request);await page.goto('/tutor/availability');
 await expect(page.getByRole('heading',{name:'Saved availability'})).toBeVisible();
 await page.getByLabel('Date', {exact:true}).fill('2026-12-30');await page.getByLabel('Start time',{exact:true}).fill('19:00');await page.getByLabel('End time',{exact:true}).fill('18:00');
 await page.getByRole('button',{name:'Add time block'}).click();await expect(page.getByRole('alert')).toContainText('End time');
});
test('tutor can persist availability and cancel a real booking through the UI',async({page,request})=>{
 const base='http://localhost:8080/api/v1';const password='TutorDemo!2026';const stamp=Date.now();
 async function account(role:string){const email=`ui.audit.${stamp}.${role}@demo.tutormatching.test`;expect((await request.post(base+'/auth/register',{data:{email,password,role}})).ok()).toBeTruthy();const login=await request.post(base+'/auth/login',{data:{email,password}});return {...await login.json(),role};}
 const tutor=await account('Tutor');const student=await account('Student');const tutorHeaders={Authorization:`Bearer ${tutor.accessToken}`};const studentHeaders={Authorization:`Bearer ${student.accessToken}`};
 const profile=await request.put(base+'/tutors/me',{headers:tutorHeaders,data:{displayName:'UI audit teacher',bio:'Scheduling validation',experienceYears:2,avatarUrl:'/assets/figma/student-tutor-1.jpg'}});expect(profile.ok()).toBeTruthy();const tutorId=(await profile.json()).id;
 const subjects=await (await request.get(base+'/subjects')).json();const subjectId=subjects[0].id;
 expect((await request.put(base+'/tutors/me/subjects',{headers:tutorHeaders,data:[{subjectId,proficiencyLevel:1}]})).ok()).toBeTruthy();
 expect((await request.put(base+'/students/me',{headers:studentHeaders,data:{displayName:'UI audit student',educationLevel:2,learningGoal:'Learning',timezone:'Asia/Ho_Chi_Minh'}})).ok()).toBeTruthy();
 await page.addInitScript(session=>localStorage.setItem('tutormatching.auth.session',JSON.stringify(session)),tutor);
 await page.goto('/tutor/availability');await expect(page.getByRole('heading',{name:'Saved availability'})).toBeVisible();
 const date=new Date();date.setUTCDate(date.getUTCDate()+12);const key=date.toISOString().slice(0,10);
 await page.getByLabel('Date',{exact:true}).fill(key);await page.getByLabel('Start time',{exact:true}).fill('10:00');await page.getByLabel('End time',{exact:true}).fill('12:00');
 await page.getByRole('button',{name:'Add time block'}).click();await page.getByRole('button',{name:'Save availability'}).click();await expect(page.getByText('Availability saved',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('button',{name:'Remove',exact:true})).toHaveCount(1);
 const startAtUtc=new Date(`${key}T10:00:00+07:00`).toISOString();
 const hold=await request.post(base+'/bookings/holds',{headers:studentHeaders,data:{tutorId,subjectId,startAtUtc}});expect(hold.status()).toBe(201);const h=await hold.json();
 const confirmation=await request.post(base+'/bookings',{headers:studentHeaders,data:{holdId:h.holdId,holdToken:h.holdToken}});expect(confirmation.status()).toBe(201);const booking=await confirmation.json();
 await page.goto(`/tutor/lessons/${booking.id}`);await expect(page.getByText(booking.id,{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cancel booking',exact:true}).click();await page.getByLabel('Cancellation reason').fill('Unable to teach this date');await page.getByRole('button',{name:'Confirm cancellation'}).click();
 await expect(page.locator('.booking-status')).toHaveText('Cancelled');await page.reload();await expect(page.locator('.booking-status')).toHaveText('Cancelled');
 const studentBookings=await (await request.get(base+'/bookings',{headers:studentHeaders})).json();expect(studentBookings.find((b:any)=>b.id===booking.id).status).toBe('Cancelled');
 await page.goto('/tutor/schedule');await expect(page.getByRole('region',{name:'Weekly calendar'}).locator('.course-calendar-event')).toHaveCount(0);
 await page.goto('/tutor/subjects-pricing');const proficiency=page.getByRole('combobox',{name:`${subjects[0].name} proficiency`});await proficiency.click();await page.getByRole('option',{name:'Expert',exact:true}).click();await page.getByRole('button',{name:'Save subjects',exact:true}).click();await expect(page.getByText('Teaching subjects saved',{exact:true})).toBeVisible();await page.reload();await expect(proficiency).toContainText('Expert');
});
test('tutor schedule handles dependency failure without showing sample lessons',async({page,request})=>{
 await signIn(page,request);await page.route('**/api/v1/courses/mine',route=>route.fulfill({status:503,json:{error:'Unavailable'}}));await page.goto('/tutor/schedule');
 await expect(page.getByRole('alert')).toContainText('Unable to load your personal schedule');await expect(page.getByRole('button',{name:'Try again'})).toBeVisible();await expect(page.locator('.course-calendar-event')).toHaveCount(0);
});
test('tutor core screens fit mobile and desktop',async({page,request})=>{
 await signIn(page,request);
 for(const route of ['dashboard','schedule','requests','availability','subjects-pricing']){
  await page.goto(`/tutor/${route}`);await expect(page.getByRole('alert')).toHaveCount(0);await page.waitForLoadState('networkidle');
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${route} at ${width}px`).toBeTruthy();}
  await expect(page.getByRole('combobox',{name:'Search anything'})).toBeVisible();
  if(route==='schedule')await page.screenshot({path:'test-results/tutor-schedule-audit.png',fullPage:true});
 }
});
test('timezone range matches calendar and failed profile loading cannot overwrite data',async({page,request})=>{
 await signIn(page,request);await page.goto('/tutor/schedule');await page.waitForLoadState('networkidle');
 await page.getByRole('combobox',{name:'Schedule timezone'}).click();await page.getByRole('option',{name:'(GMT +09:00) Tokyo',exact:true}).click();
 const monday=await page.locator('.course-calendar-header>span').nth(1).locator('small').textContent();await expect(page.locator('.legacy-date>span').first()).toContainText(monday!.replace(/^0/,''));
 await page.route('**/api/v1/tutors/me',route=>route.request().method()==='GET'?route.fulfill({status:503,json:{error:'Unavailable'}}):route.continue());
 await page.goto('/tutor/onboarding');await expect(page.getByRole('button',{name:'Retry loading profile'})).toBeVisible();await page.getByLabel('Display name',{exact:true}).fill('Attempted overwrite');await expect(page.getByRole('button',{name:'Save & continue'})).toBeDisabled();
 await page.unroute('**/api/v1/tutors/me');await page.getByRole('button',{name:'Retry loading profile'}).click();await expect(page.getByLabel('Display name',{exact:true})).toHaveValue('Nguyen Minh Anh');await expect(page.getByRole('button',{name:'Save & continue'})).toBeEnabled();
});
