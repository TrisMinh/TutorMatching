import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';

test('empty course library and discovery fit desktop, tablet and phone',async({page,request})=>{
 test.setTimeout(45000);
 const email=execFileSync('docker',['compose','exec','-T','identity-db','psql','-U','identity_app','-d','identity_db','-Atc',"SELECT email FROM user_accounts WHERE email ~ '^registration[.]ui[.][0-9]+[.]student@example[.]com$' ORDER BY email DESC LIMIT 1"],{cwd:'../../..',encoding:'utf8'}).trim();
 test.skip(!email,'A verified registration UI fixture is required.');
 const result=await request.post('http://localhost:8080/api/v1/auth/login',{data:{email,password:'RegistrationUI!2026'}});expect(result.status()).toBe(200);
 const session={...await result.json(),email,role:'Student'};
 await page.addInitScript(value=>sessionStorage.setItem('tutormatching.auth.session',JSON.stringify(value)),session);
 const failures:string[]=[];page.on('pageerror',error=>failures.push(error.message));
 page.on('response',response=>{if(response.url().includes('/api/')&&response.status()>=500)failures.push(String(response.status())+' '+response.url());});
 for(const width of [1920,768,390]){
  await page.setViewportSize({width,height:1000});await page.goto('/student/courses');
  await expect(page.getByRole('heading',{name:'Your next learning journey starts here'})).toBeVisible();
  await expect(page.locator('.course-discovery-card').first()).toBeVisible();
  const teddy=page.locator('.teddy-companion');await expect(teddy).toHaveCount(1);
  await teddy.evaluate(async element=>{await(element as HTMLImageElement).decode();});
  const teddyBox=await teddy.boundingBox();expect(teddyBox!.width).toBeLessThanOrEqual(190);
  if(width===390)expect(teddyBox!.width).toBeLessThanOrEqual(150);
  for(const link of await page.locator('.my-courses-empty-actions a').all()){
   const box=await link.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  await page.locator('.course-discovery-card > img').evaluateAll(async images=>{await Promise.all(images.map(image=>(image as HTMLImageElement).decode()));});
  await page.screenshot({path:'../../../.logs/course-library-empty-'+width+'.png',fullPage:true});
 }
 await page.getByRole('link',{name:'Find a course',exact:true}).click();
 await expect(page).toHaveURL(/view=discover/);await expect(page.getByRole('heading',{name:'Find your next course'})).toBeVisible();
 await expect(page.locator('.course-discovery-card').first()).toBeVisible();
 const count=await page.locator('.course-discovery-card').count();expect(count).toBeGreaterThan(3);
 const destination=await page.locator('.course-discovery-card').first().getAttribute('href');
 await page.locator('.course-discovery-card').first().click();
 await expect(page).toHaveURL(new RegExp(destination+'$'));
 await expect(page.locator('.course-details-card')).toBeVisible();expect(failures).toEqual([]);
});
