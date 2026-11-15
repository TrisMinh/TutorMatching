import {test,expect} from '@playwright/test';

test('actual tutor profile keeps long availability bounded and does not stretch biography or course cards',async({page,request})=>{
 test.setTimeout(45000);
 const tutorId='ad97b2b8-e248-424e-b621-98330fe7438f';
 const profileResponse=await request.get('/api/v1/tutors/'+tutorId);expect(profileResponse.status()).toBe(200);const tutor=await profileResponse.json();
 const future=tutor.availability.filter((item:{endAtUtc:string})=>Date.parse(item.endAtUtc)>Date.now());expect(future.length).toBeGreaterThan(4);
 const login=await request.post('/api/v1/auth/login',{data:{email:'student24@demo.tutormatching.test',password:'TutorDemo!2026'}});expect(login.status()).toBe(200);
 await page.addInitScript(session=>sessionStorage.setItem('tutormatching.auth.session',JSON.stringify(session)),{...await login.json(),role:'Student'});
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 for(const width of [1920,768,390]){
  await page.setViewportSize({width,height:1000});await page.goto('/student/tutors/'+tutorId);
  const about=page.locator('.public-tutor-about'),availability=page.locator('.public-tutor-availability'),courses=page.locator('.public-tutor-courses');
  await expect(about.getByRole('heading')).toContainText(tutor.displayName);
  await expect(page.locator('.public-tutor-window')).toHaveCount(4);
  let starts=await page.locator('.public-tutor-window').evaluateAll(rows=>rows.map(row=>Date.parse(row.getAttribute('data-start')!)));
  expect(starts).toEqual([...starts].sort((a,b)=>a-b));
  const aboutBox=await about.boundingBox(),availabilityBox=await availability.boundingBox(),coursesBox=await courses.boundingBox();
  expect(aboutBox!.height).toBeLessThan(400);expect(availabilityBox!.height).toBeLessThan(650);
  if(width===1920){expect(coursesBox!.y-aboutBox!.y-aboutBox!.height).toBeGreaterThanOrEqual(20);expect(coursesBox!.y-aboutBox!.y-aboutBox!.height).toBeLessThan(30);}
  for(const link of [page.getByRole('link',{name:'Book a lesson',exact:true}),page.getByRole('link',{name:'Message tutor',exact:true})]){
   await expect(link).toBeVisible();const box=await link.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
  }
  await page.getByRole('button',{name:/Show all .* time blocks/}).click();await expect(page.locator('.public-tutor-window')).toHaveCount(future.length);
  const bounds=await page.locator('.public-tutor-windows').evaluate(element=>({height:element.clientHeight,scrollHeight:element.scrollHeight}));expect(bounds.height).toBeLessThanOrEqual(300);expect(bounds.scrollHeight).toBeGreaterThan(bounds.height);
  starts=await page.locator('.public-tutor-window').evaluateAll(rows=>rows.map(row=>Date.parse(row.getAttribute('data-start')!)));expect(starts).toEqual([...starts].sort((a,b)=>a-b));
  await page.getByRole('button',{name:'Show fewer dates'}).click();await expect(page.locator('.public-tutor-window')).toHaveCount(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  await page.locator('.public-tutor-course img').evaluateAll(async images=>{await Promise.all(images.map(img=>(img as HTMLImageElement).decode()));});
  await page.screenshot({path:'../../../.logs/tutor-profile-fixed-'+width+'.png',fullPage:true});
 }
 expect(errors).toEqual([]);
});
