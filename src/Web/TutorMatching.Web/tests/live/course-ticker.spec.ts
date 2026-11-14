import {test,expect} from '@playwright/test';
test('course ticker moves right, pauses, previews real courses and fits mobile',async({page,request})=>{
 const auth=await request.post('http://localhost:8080/api/v1/auth/login',{data:{email:'tutor01@demo.tutormatching.test',password:'TutorDemo!2026'}});
 await page.addInitScript(session=>localStorage.setItem('tutormatching.auth.session',JSON.stringify({...session,role:'Tutor'})),await auth.json());
 await page.setViewportSize({width:1440,height:900});await page.goto('/tutor/courses');
 const ticker=page.getByRole('region',{name:'Featured courses'});await expect(ticker).toBeVisible();
 const track=page.locator('.course-ticker__track');
 const x=()=>track.evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m41);
 const before=await x();await expect.poll(x).toBeGreaterThan(before+2);
 await page.getByRole('button',{name:'Pause course ticker'}).click();await expect(track).toHaveCSS('animation-play-state','paused');
 const button=page.locator('.course-ticker__item').filter({hasText:'UX Research Class'}).filter({visible:true}).first();
 // Programmatic focus brings the keyboard-accessible original into view and pauses motion.
 await button.focus();await button.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('dialog').getByRole('heading')).toHaveText('UX Research Class');
 await page.getByRole('link',{name:'View course →'}).click();await expect(page).toHaveURL(/course=ux-research/);
 for(const width of [390,768,1920]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
 await page.emulateMedia({reducedMotion:'reduce'});await expect(track).toHaveCSS('animation-name','none');
});
