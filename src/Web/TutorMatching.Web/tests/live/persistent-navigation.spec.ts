import {test,expect} from '@playwright/test';
for(const role of ['Student','Tutor']){
 test(`${role} navigation preserves the shell without document reloads`,async({page,request})=>{
  const login=await request.post('http://localhost:8080/api/v1/auth/login',{data:{email:`${role.toLowerCase()}01@demo.tutormatching.test`,password:'TutorDemo!2026'}});
  await page.addInitScript(session=>{if(!sessionStorage.getItem('navigation-test-initialized')){localStorage.setItem('tutormatching.auth.session',JSON.stringify(session));sessionStorage.setItem('navigation-test-initialized','true');}},{...await login.json(),role});
  await page.goto(`/${role.toLowerCase()}/dashboard`);await page.waitForLoadState('networkidle');
  await page.evaluate(()=>{(window as any).__navigationNodes={sidebar:document.querySelector('.student-sidebar'),header:document.querySelector('.student-topbar'),main:document.querySelector('.student-content'),avatar:document.querySelector('.student-topbar__avatar')};});
  let documents=0;page.on('request',r=>{if(r.isNavigationRequest()&&r.frame()===page.mainFrame())documents++;});
  for(const [name,path] of [['My courses','courses'],[role==='Tutor'?'Bookings':'My bookings',role==='Tutor'?'requests':'bookings'],['Settings','settings']]){
   await page.locator('.student-sidebar').getByRole('link',{name,exact:true}).click();await expect(page).toHaveURL(new RegExp(`/${role.toLowerCase()}/${path}$`));
   expect(await page.evaluate(()=>{const saved=(window as any).__navigationNodes;return saved&&saved.sidebar===document.querySelector('.student-sidebar')&&saved.header===document.querySelector('.student-topbar')&&saved.main===document.querySelector('.student-content')&&saved.avatar===document.querySelector('.student-topbar__avatar');})).toBeTruthy();
  }
  expect(documents).toBe(0);await expect(page.locator('.student-sidebar')).toHaveCount(1);await expect(page.locator('main')).toHaveCount(1);
  await page.getByRole('button',{name:'Log out',exact:true}).click();await expect(page).toHaveURL(/auth\/sign-in$/);await expect(page.locator('.student-sidebar')).toHaveCount(0);
  await page.goto(`/${role.toLowerCase()}/dashboard`);await expect(page).toHaveURL(/auth\/sign-in$/);
 });
}
test('persistent tutor shell refreshes identity after profile save without rebuilding',async({page,request})=>{
 const login=await request.post('http://localhost:8080/api/v1/auth/login',{data:{email:'tutor01@demo.tutormatching.test',password:'TutorDemo!2026'}});
 await page.addInitScript(session=>localStorage.setItem('tutormatching.auth.session',JSON.stringify({...session,role:'Tutor'})),await login.json());
 let changed=false;
 await page.route('**/api/v1/tutors/me',async route=>{
  if(route.request().method()==='PUT'){changed=true;await route.fulfill({json:{id:'fixture',displayName:'Updated Tutor',version:2}});return;}
  await route.fulfill({json:{id:'fixture',displayName:changed?'Updated Tutor':'Original Tutor',bio:'Teaching',experienceYears:4,avatarUrl:'/assets/figma/student-tutor-1.jpg',subjects:[],availability:[]}});
 });
 await page.goto('/tutor/onboarding');await expect(page.locator('.student-account strong')).toHaveText('Original Tutor');await page.locator('.student-sidebar').evaluate(el=>el.setAttribute('data-preserved','true'));
 await page.getByLabel('Display name',{exact:true}).fill('Updated Tutor');await page.getByRole('button',{name:'Save & continue'}).click();await expect(page).toHaveURL(/tutor\/subjects-pricing$/);await expect(page.locator('.student-account strong')).toHaveText('Updated Tutor');await expect(page.locator('.student-sidebar')).toHaveAttribute('data-preserved','true');
});
