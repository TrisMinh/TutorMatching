import {verifyEmail} from './verifyEmail';
import { test,expect } from '@playwright/test';
test('new enrollment appears in student library and owning tutor count',async({page,request})=>{
 const email=`course.e2e.${Date.now()}@example.com`;
 const password='TutorDemo!2026';
 expect((await request.post('http://localhost:8080/api/v1/auth/register',{data:{email,password,role:'Student'}})).ok()).toBeTruthy();await verifyEmail(request,email);
 const auth=await request.post('http://localhost:8080/api/v1/auth/login',{data:{email,password}});
 const session={...await auth.json(),role:'Student'};
 await page.addInitScript(value=>localStorage.setItem('tutormatching.auth.session',JSON.stringify(value)),session);
 await page.goto('/student/courses/ux-research');
 await page.getByRole('button',{name:'Enroll in course',exact:true}).click();
 await expect(page.getByRole('button',{name:'Enrolled',exact:true})).toBeDisabled();
 await page.getByRole('link',{name:'My courses',exact:true}).last().click();
  await expect(page).toHaveURL(/student\/courses$/);
 await expect(page.getByRole('heading',{name:'UX Research Class',exact:true})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('heading',{name:'UX Research Class',exact:true})).toBeVisible();
 const teacher=await request.post('http://localhost:8080/api/v1/auth/login',{data:{email:'tutor01@demo.tutormatching.test',password}});
 const own=await request.get('http://localhost:8080/api/v1/courses/mine',{headers:{Authorization:`Bearer ${(await teacher.json()).accessToken}`}});
 const course=(await own.json()).find((c:{id:string})=>c.id==='ux-research');
 expect(course.enrolled).toBeGreaterThan(0);
});
for(const role of ['Student','Tutor'] as const){
 test(`${role} course library and mobile layout`,async({page,request})=>{
  const response=await request.post('http://localhost:8080/api/v1/auth/login',{data:{email:`${role.toLowerCase()}01@demo.tutormatching.test`,password:'TutorDemo!2026'}});
  expect(response.ok()).toBeTruthy();const session={...await response.json(),role};
  await page.addInitScript(value=>localStorage.setItem('tutormatching.auth.session',JSON.stringify(value)),session);
  await page.goto(`/${role.toLowerCase()}/courses`);
  await expect(page.getByRole('heading',{name:'UX Research Class',exact:true,level:2})).toBeVisible();
  if(role==='Student'){
   await page.getByRole('link',{name:'View enrolled course'}).first().click();
   await expect(page.getByRole('button',{name:'Enrolled',exact:true})).toBeDisabled();
   await page.getByRole('link',{name:'My courses',exact:true}).last().click();
  }else{
   await page.getByRole('button',{name:'View session details'}).first().click();
   await expect(page.locator('.my-course-sessions article')).toHaveCount(4);
  }
  for(const width of [390,768,1440]){
   await page.setViewportSize({width,height:900});
   await expect(page.getByRole('region',{name:'Weekly calendar'})).toHaveCount(0);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  }
 });
}
