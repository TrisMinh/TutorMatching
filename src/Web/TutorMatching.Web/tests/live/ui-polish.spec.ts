import {test,expect,type APIRequestContext,type Page} from '@playwright/test';

async function login(request:APIRequestContext,role:'Student'|'Tutor'){
 const email=role==='Student'?'student24@demo.tutormatching.test':'tutor18@demo.tutormatching.test';
 const response=await request.post('http://localhost:8080/api/v1/auth/login',{data:{email,password:'TutorDemo!2026'}});expect(response.status()).toBe(200);
 const session={...await response.json(),email,role};return {session,headers:{Authorization:'Bearer '+session.accessToken}};
}
async function prepare(page:Page,session:unknown){await page.addInitScript(value=>sessionStorage.setItem('tutormatching.auth.session',JSON.stringify(value)),session);}

test('student form preserves saved data and subject choices, with usable desktop/tablet/mobile controls',async({page,request})=>{
 test.setTimeout(45000);
 const {session,headers}=await login(request,'Student'),base='http://localhost:8080/api/v1';
 const original=await (await request.get(base+'/students/me',{headers})).json();
 await prepare(page,session);
 for(const width of [1920,768,390]){
  await page.setViewportSize({width,height:900});await page.goto('/student/complete-profile');
  await expect(page.getByLabel('Display name')).toHaveValue(original.displayName);
  await expect(page.getByLabel('Learning goal')).toHaveValue(original.learningGoal);
  await expect(page.getByRole('button',{name:'Save changes'})).toBeEnabled();
  await expect(page.getByRole('checkbox').first()).toBeVisible();
  const metrics=await page.locator('.profile-subject-option').evaluateAll(labels=>labels.map(label=>{const r=label.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
  expect(metrics.length).toBeGreaterThan(3);
  for(const box of metrics){expect(box.h).toBeGreaterThanOrEqual(44);expect(box.x+box.w).toBeLessThanOrEqual(width);}
  for(let i=0;i<metrics.length;i++)for(let j=i+1;j<metrics.length;j++){const a=metrics[i],b=metrics[j];expect(a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h).toBeFalsy();}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
 }
 try{
  await page.getByLabel('Learning goal').fill(original.learningGoal+' Updated during layout verification.');
  const first=page.getByRole('checkbox').first(),wasChecked=await first.isChecked();await first.setChecked(!wasChecked);
  await page.getByRole('button',{name:'Save changes'}).click();await expect(page).toHaveURL(/\/student\/find-tutors$/);
  await page.goto('/student/complete-profile');await expect(page.getByLabel('Learning goal')).toHaveValue(original.learningGoal+' Updated during layout verification.');
  await expect(page.getByRole('checkbox').first()).toBeChecked({checked:!wasChecked});
 }finally{
  expect((await request.put(base+'/students/me',{headers,data:original})).ok()).toBeTruthy();
  expect((await request.put(base+'/students/me/interests',{headers,data:original.interests})).ok()).toBeTruthy();
 }
});

test('tutor profile save button and biography fit tablet and phone widths',async({page,request})=>{
 const {session}=await login(request,'Tutor');await prepare(page,session);
 for(const width of [768,390]){
  await page.setViewportSize({width,height:900});await page.goto('/tutor/onboarding');
  await expect(page.getByLabel('Display name')).not.toHaveValue('');
  await expect(page.getByLabel('Bio')).toHaveJSProperty('tagName','TEXTAREA');
  const box=await page.getByRole('button',{name:'Save & continue'}).boundingBox();expect(box).toBeTruthy();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
 }
});

test('calendar aligns a month starting on Monday and keeps month navigation inside the viewport',async({page,request})=>{
 const {session}=await login(request,'Student');await prepare(page,session);
 const teachers=await (await request.get('http://localhost:8080/api/v1/tutors?page=1&pageSize=100')).json(),teacher=teachers.items.find((t:{displayName:string})=>t.displayName==='Mai Lan Anh');
 const details=await(await request.get('http://localhost:8080/api/v1/tutors/'+teacher.id)).json();
 await page.setViewportSize({width:390,height:844});await page.goto('/student/book/select-schedule?tutorId='+teacher.id+'&subjectId='+details.subjects[0].subjectId);
 for(let i=0;i<12;i++){
  const first=page.locator('.month-grid > button').first();await expect(first).toBeVisible();const day=await first.getAttribute('aria-label');
  if(new Date(day+'T12:00:00Z').getUTCDay()===1){const box=await first.boundingBox(),grid=await page.locator('.month-grid').boundingBox();expect(Math.abs(box!.x-grid!.x)).toBeLessThan(2);break;}
  await page.getByRole('button',{name:'Next month',exact:true}).click();
  if(i===11)throw new Error('No Monday-start month reached');
 }
 for(const name of ['Previous month','Next month']){const box=await page.getByRole('button',{name,exact:true}).boundingBox();expect(box!.width).toBeLessThanOrEqual(48);expect(box!.x+box!.width).toBeLessThanOrEqual(390);}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
});
