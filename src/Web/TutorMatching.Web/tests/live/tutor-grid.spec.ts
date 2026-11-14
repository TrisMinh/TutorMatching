import {test,expect} from '@playwright/test';
test('tutor grids keep profile action below biography at all sizes',async({page,request})=>{
 const auth=await request.post('http://localhost:8080/api/v1/auth/login',{data:{email:'student01@demo.tutormatching.test',password:'TutorDemo!2026'}});
 await page.addInitScript(session=>localStorage.setItem('tutormatching.auth.session',JSON.stringify({...session,role:'Student'})),await auth.json());
 await page.goto('/student/find-tutors');await expect(page.locator('.tutor-card').first()).toBeVisible();
 for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:900});
  for(const size of ['small','medium','large']){
   await page.getByRole('button',{name:`${size} tutor cards`,exact:true}).click();
   await expect(page.locator('.tutor-grid')).toHaveClass(new RegExp(`tutor-grid--${size}`));
   const card=page.locator('.tutor-card').first();
   if(await card.locator('.tutor-card__bio').isVisible()){
    const bio=await card.locator('.tutor-card__bio').boundingBox();const button=await card.getByRole('link',{name:'View profile'}).boundingBox();
    expect(button!.y).toBeGreaterThanOrEqual(bio!.y+bio!.height);
    expect(bio!.height).toBeLessThanOrEqual(82);
    expect((await card.boundingBox())!.height).toBeLessThanOrEqual(500);
    expect(await card.locator('.tutor-card__bio').evaluate(el=>getComputedStyle(el).webkitLineClamp)).toBe('3');
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  }
 }
 await page.reload();await expect(page.getByRole('button',{name:'large tutor cards',exact:true})).toHaveAttribute('aria-pressed','true');
});
