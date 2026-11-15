import {test,expect} from '@playwright/test';

for(const role of ['Student','Tutor'] as const){
 test(role+' empty states stay helpful and fit desktop, tablet and mobile',async({page,request})=>{
  test.setTimeout(60000);
  const email=role==='Student'?'student24@demo.tutormatching.test':'tutor18@demo.tutormatching.test';
  const result=await request.post('/api/v1/auth/login',{data:{email,password:'TutorDemo!2026'}});expect(result.status()).toBe(200);
  const session={...await result.json(),email,role};
  await page.addInitScript(value=>sessionStorage.setItem('tutormatching.auth.session',JSON.stringify(value)),session);
  // Exercise genuine empty response shapes without changing existing user data.
  await page.route('**/api/v1/bookings',route=>route.fulfill({json:[]}));
  await page.route('**/api/v1/notifications?*',route=>route.fulfill({json:{items:[],page:1,pageSize:100,total:0}}));
  await page.route('**/api/v1/courses/lifecycle-notifications',route=>route.fulfill({json:[]}));
  await page.route('**/api/v1/courses/enrollment-notifications',route=>route.fulfill({json:[]}));
  await page.route('**/api/v1/tutors?*',route=>route.fulfill({json:{items:[],page:1,pageSize:100,total:0}}));
  if(role==='Tutor')await page.route('**/api/v1/tutors/me',async route=>{
   const response=await route.fetch();const profile=await response.json();await route.fulfill({response,json:{...profile,availability:[]}});
  });
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const paths=role==='Student'?['/student/bookings','/student/notifications','/student/find-tutors','/student/book/review','/student/book/select-schedule']:['/tutor/requests','/tutor/notifications','/tutor/availability'];
  for(const width of [1920,768,390]){
   await page.setViewportSize({width,height:900});
   for(const path of paths){
    await page.goto(path);await expect(page.locator('.friendly-empty-state').first()).toBeVisible();
    await expect(page.locator('.friendly-empty-art').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
    for(const button of await page.locator('.friendly-empty-action').all()){
     const box=await button.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);
    }
    if(path.endsWith('/notifications')||path.endsWith('/bookings')||path.endsWith('/availability'))await page.screenshot({path:'../../../.logs/empty-'+role.toLowerCase()+'-'+path.split('/').at(-1)+'-'+width+'.png',fullPage:true});
   }
  }
  if(role==='Student'){
   await page.goto('/student/bookings');await page.getByRole('link',{name:'Find a tutor',exact:true}).last().click();await expect(page).toHaveURL(/student\/find-tutors$/);
   await page.route('**/api/v1/bookings',route=>route.fulfill({status:503,json:{title:'Temporarily unavailable'}}));
   await page.goto('/student/bookings');await expect(page.getByRole('alert')).toContainText('could not be loaded');
   await expect(page.locator('.friendly-empty-state')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
 });
}
