import {test,expect} from '@playwright/test';
test('month arrows and course sizing animate the affected content',async({page,request})=>{
 const login=await request.post('http://localhost:8080/api/v1/auth/login',{data:{email:'student01@demo.tutormatching.test',password:'TutorDemo!2026'}});
 await page.addInitScript(session=>{
  localStorage.setItem('tutormatching.auth.session',JSON.stringify({...session,role:'Student'}));
  const animate=Element.prototype.animate;
  Element.prototype.animate=function(frames,options){this.setAttribute('data-motion-played','true');return animate.call(this,frames,options);};
 },await login.json());
 await page.goto('/student/dashboard');
 await expect(page.locator('.course-tab-panel a').first()).toBeVisible();
 const month=await page.locator('.dashboard-mini-calendar h2').textContent();
 await page.getByRole('button',{name:'Next month',exact:true}).click();
 await expect(page.locator('.dashboard-mini-calendar h2')).not.toHaveText(month!);
 await expect(page.locator('.dashboard-mini-calendar__days')).toHaveAttribute('data-motion-played','true');
 await page.getByRole('button',{name:'large cards',exact:true}).click();
 await expect(page.locator('.course-tab-panel a').first()).toHaveAttribute('data-motion-played','true');
 await expect(page.getByRole('button',{name:'large cards',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'small cards',exact:true}).click();
 await expect(page.locator('.course-tab-panel')).toHaveClass(/course-size-small/);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('.dashboard-mini-calendar__days').evaluate(el=>el.removeAttribute('data-motion-played'));
 await page.getByRole('button',{name:'Previous month',exact:true}).click();
 await expect(page.locator('.dashboard-mini-calendar__days')).not.toHaveAttribute('data-motion-played');
});
