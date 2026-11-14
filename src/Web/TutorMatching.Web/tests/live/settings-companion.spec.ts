import {test,expect} from '@playwright/test';
test('settings pairs compact preferences with animated buddy and responsive controls',async({page,request})=>{
 const login=await request.post('http://localhost:8080/api/v1/auth/login',{data:{email:'tutor01@demo.tutormatching.test',password:'TutorDemo!2026'}});
 await page.addInitScript(session=>localStorage.setItem('tutormatching.auth.session',JSON.stringify({...session,role:'Tutor'})),await login.json());
 await page.setViewportSize({width:1600,height:1000});await page.goto('/tutor/settings');
 const companion=page.getByRole('complementary',{name:'Teach Buddy companion'});await expect(companion).toBeVisible();await expect(page.getByRole('img',{name:/Friendly blue and white robot/})).toBeVisible();
 const preferences=await page.locator('.tutor-settings-card').boundingBox();const scene=await companion.boundingBox();expect(scene!.x).toBeGreaterThan(preferences!.x+preferences!.width);
 const first=await page.locator('.companion-bubble strong').textContent();await page.getByRole('button',{name:'Say hello to Teach Buddy'}).click();await expect(page.locator('.companion-bubble strong')).not.toHaveText(first!);
 await page.getByRole('button',{name:'Pause companion animation'}).click();await expect(companion).toHaveClass(/is-paused/);expect(await page.locator('.buddy-robot').evaluate(el=>getComputedStyle(el).animationPlayState)).toBe('paused');
 await page.getByRole('button',{name:'Play companion animation'}).click();
 const toggle=page.getByRole('switch',{name:'Email reminders'});await toggle.click();await expect(toggle).toHaveAttribute('aria-checked','false');
 for(const width of [390,768,1600]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
 await page.screenshot({path:'test-results/settings-buddy-desktop.png',fullPage:true});
 for(const size of [{width:1366,height:650},{width:1440,height:768},{width:1920,height:900}]){
  await page.setViewportSize(size);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBeTruthy();
  await expect(page.getByRole('button',{name:'Save settings',exact:true})).toBeInViewport();
  await expect(page.getByRole('button',{name:'Say hello to Teach Buddy'})).toBeInViewport();
 }
 await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.buddy-robot').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});
