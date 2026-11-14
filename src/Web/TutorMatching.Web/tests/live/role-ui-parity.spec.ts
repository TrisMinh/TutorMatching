import {test,expect} from '@playwright/test';
test('student and tutor dashboards share calendar, rail, tabs and course grid layout',async({page,request})=>{
 const measurements:number[][]=[];
 for(const role of ['Student','Tutor']){
  const login=await request.post('http://localhost:8080/api/v1/auth/login',{data:{email:`${role.toLowerCase()}01@demo.tutormatching.test`,password:'TutorDemo!2026'}});const session={...await login.json(),role};
  await page.goto('/auth/sign-in');await page.evaluate(s=>localStorage.setItem('tutormatching.auth.session',JSON.stringify(s)),session);
  await page.setViewportSize({width:1440,height:1000});await page.goto(`/${role.toLowerCase()}/dashboard`);await page.waitForLoadState('networkidle');
  for(const selector of ['.dashboard-template','.dashboard-mini-calendar','.legacy-tabs','.course-view-toolbar','.course-tab-panel'])await expect(page.locator(selector)).toBeVisible();
  measurements.push(await page.locator('.dashboard-template').evaluate(el=>{const rect=el.getBoundingClientRect();return [rect.x,rect.width,parseFloat(getComputedStyle(el).columnGap)];}));
  await page.screenshot({path:`test-results/${role.toLowerCase()}-shared-dashboard.png`,fullPage:false});
  if(role==='Tutor'){
   for(const link of await page.locator('.dashboard-template a').all())expect(await link.getAttribute('href')).not.toMatch(/^\/student\//);
   await page.getByRole('tab',{name:'Webinar',exact:true}).click();await expect(page.locator('.course-tab-panel a')).toHaveCount(0);
  }
 }
 expect(measurements[1]).toEqual(measurements[0]);
});
test('shared tutor dashboard refreshes cancelled bookings everywhere and shows next course date',async({page,request})=>{
 const login=await request.post('http://localhost:8080/api/v1/auth/login',{data:{email:'tutor01@demo.tutormatching.test',password:'TutorDemo!2026'}});
 await page.addInitScript(session=>localStorage.setItem('tutormatching.auth.session',JSON.stringify({...session,role:'Tutor'})),await login.json());
 const course={id:'owned',title:'Owned course',instructor:'Teacher',category:'Workshop',image:'',capacity:10,enrolled:2,sessions:[{id:'past',startAtUtc:'2026-11-01T11:00:00Z',endAtUtc:'2026-11-01T12:00:00Z'},{id:'future',startAtUtc:'2026-12-14T11:00:00Z',endAtUtc:'2026-12-14T12:00:00Z'}]};
 let cancelled=false;
 await page.route('**/api/v1/courses/mine',r=>r.fulfill({json:[course]}));
 await page.route('**/api/v1/bookings',r=>r.fulfill({json:[{id:'booking-refresh',tutorId:'tutor',subjectId:'subject',status:cancelled?'Cancelled':'Confirmed',startAtUtc:'2026-12-14T12:00:00Z',endAtUtc:'2026-12-14T13:00:00Z'}]}));
 await page.goto('/tutor/dashboard');await expect(page.locator('.dashboard-additional-bookings a')).toHaveCount(1);
 await expect(page.locator('.dashboard-rail-section').filter({has:page.getByRole('heading',{name:'Upcoming Events',exact:true})}).locator('small')).toContainText('14 Dec');
 cancelled=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.locator('.dashboard-additional-bookings a')).toHaveCount(0);
});
