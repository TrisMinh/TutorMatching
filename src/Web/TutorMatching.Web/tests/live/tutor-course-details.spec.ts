import {test,expect} from '@playwright/test';
test('teaching course uses student detail layout and compact library cards',async({page,request})=>{
 const auth=await request.post('http://localhost:8080/api/v1/auth/login',{data:{email:'tutor01@demo.tutormatching.test',password:'TutorDemo!2026'}});
 await page.addInitScript(session=>localStorage.setItem('tutormatching.auth.session',JSON.stringify({...session,role:'Tutor'})),await auth.json());
 await page.setViewportSize({width:1920,height:1080});await page.goto('/tutor/courses?course=ux-research');
 const detail=page.getByRole('region',{name:'Teaching course details'});
 await expect(detail.locator('.course-details-intro img')).toBeVisible();await expect(detail.locator('.course-session-grid article')).toHaveCount(4);await expect(page.locator('.my-course-grid')).toHaveCount(0);
 for(const width of [390,768,1920]){await page.setViewportSize({width,height:1080});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();const style=await detail.evaluate(el=>getComputedStyle(el).paddingLeft);expect(parseFloat(style)).toBeGreaterThanOrEqual(14);}
 await page.screenshot({path:'test-results/tutor-course-details.png',fullPage:true});
 await page.getByRole('button',{name:'Back to my courses'}).click();await expect(page).toHaveURL(/tutor\/courses$/);await expect(page.locator('.my-course-card')).toHaveCount(1);expect((await page.locator('.my-course-card').boundingBox())!.width).toBeLessThan(500);
 await page.getByRole('button',{name:'View session details'}).click();await expect(page).toHaveURL(/course=ux-research/);await page.reload();await expect(detail).toBeVisible();
});
