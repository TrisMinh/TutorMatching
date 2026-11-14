import {test,expect} from '@playwright/test';

for(const role of ['Student','Tutor'] as const){
 test(`${role} settings save to API and survive reload`,async({page,request})=>{
  const email=`prefs.ui.${Date.now()}.${role.toLowerCase()}@example.com`,password='PreferencesUI!2026';
  expect((await request.post('http://localhost:8080/api/v1/auth/register',{data:{email,password,role}})).status()).toBe(201);
  const session=await (await request.post('http://localhost:8080/api/v1/auth/login',{data:{email,password}})).json();
  await page.addInitScript(value=>localStorage.setItem('tutormatching.auth.session',JSON.stringify(value)),{...session,role,email});
  await page.setViewportSize({width:1440,height:900});await page.goto(`/${role.toLowerCase()}/settings`);
  const toggle=page.getByRole('switch',{name:'Email reminders'});await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute('aria-checked','true');await toggle.click();
  if(role==='Tutor'){await page.getByRole('combobox',{name:'Cancellation notice'}).click();await page.getByRole('option',{name:'24 hours before',exact:true}).click();}
  await page.getByRole('button',{name:'Save settings',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Settings saved'})).toBeVisible();
  await page.reload();await expect(toggle).toBeEnabled();await expect(toggle).toHaveAttribute('aria-checked','false');
  if(role==='Tutor')await expect(page.getByRole('combobox',{name:'Cancellation notice'})).toContainText('24 hours before');
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
 });
}

test('password recovery sends actual link and updates password through UI',async({page,request})=>{
 const email=`recovery.ui.${Date.now()}@example.com`,password='RecoveryUI!2026';
 expect((await request.post('http://localhost:8080/api/v1/auth/register',{data:{email,password,role:'Student'}})).status()).toBe(201);
 await page.goto('/auth/forgot-password');await page.getByLabel('Email address').fill(email);await page.getByRole('button',{name:'Send reset link'}).click();
 await expect(page.getByRole('heading',{name:'Check your email'})).toBeVisible();await expect(page.getByText(new RegExp(email.replaceAll('.','\\.')))).toBeVisible();
 const inbox=await (await request.get('http://localhost:8025/api/v1/messages?limit=200')).json();
 const mail=inbox.messages.find((m:{To:{Address:string}[];Subject:string})=>m.To?.some(to=>to.Address===email)&&m.Subject==='Reset your TutorMatching password');expect(mail).toBeTruthy();
 const message=await (await request.get('http://localhost:8025/api/v1/message/'+mail.ID)).json();
 const link=(message.Text as string).match(/http:\/\/localhost:3000\/auth\/reset-password\?token=[A-Fa-f0-9]+/)![0];
 await page.goto(link);await page.getByLabel('New password',{exact:true}).fill('NewRecoveryUI!2026');await page.getByLabel('Confirm password',{exact:true}).fill('NewRecoveryUI!2026');await page.getByRole('button',{name:'Reset password',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Password updated'})).toBeVisible();
 expect((await request.post('http://localhost:8080/api/v1/auth/login',{data:{email,password:'NewRecoveryUI!2026'}})).status()).toBe(200);
 await page.goto(link);await page.getByLabel('New password',{exact:true}).fill('ReplayedPassword!2026');await page.getByLabel('Confirm password',{exact:true}).fill('ReplayedPassword!2026');await page.getByRole('button',{name:'Reset password',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('invalid, expired or already used');
});
