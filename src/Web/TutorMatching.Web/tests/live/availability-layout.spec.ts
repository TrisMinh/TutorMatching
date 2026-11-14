import {test,expect} from '@playwright/test';
test('availability list scrolls inside frame and editor stays visible beside it',async({page,request})=>{
 const login=await request.post('http://localhost:8080/api/v1/auth/login',{data:{email:'tutor01@demo.tutormatching.test',password:'TutorDemo!2026'}});
 await page.addInitScript(session=>localStorage.setItem('tutormatching.auth.session',JSON.stringify({...session,role:'Tutor'})),await login.json());
 await page.setViewportSize({width:1440,height:900});await page.goto('/tutor/availability');
 const list=page.getByRole('region',{name:'Saved time blocks'});await expect(list).toBeVisible();
 const editor=page.locator('.availability-editor');const listBox=await list.boundingBox();const editorBox=await editor.boundingBox();expect(editorBox!.x).toBeGreaterThan(listBox!.x+listBox!.width);
 const save=page.getByRole('button',{name:'Save availability',exact:true});await expect(save).toBeInViewport();
 expect(await list.evaluate(el=>el.scrollHeight>el.clientHeight)).toBeTruthy();await list.evaluate(el=>el.scrollTop=el.scrollHeight);await expect(save).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBeTruthy();
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'Add time block'})).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
