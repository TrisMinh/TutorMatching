import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';

test('large profile photo is reduced, saved through the website proxy and survives reload',async({page,request})=>{
 test.setTimeout(45000);
 const email=execFileSync('docker',['compose','exec','-T','identity-db','psql','-U','identity_app','-d','identity_db','-Atc',"SELECT email FROM user_accounts WHERE email ~ '^registration[.]ui[.][0-9]+[.]student@example[.]com$' ORDER BY email DESC LIMIT 1"],{cwd:'../../..',encoding:'utf8'}).trim();
 test.skip(!email,'A verified registration UI fixture is required.');
 const login=await request.post('/api/v1/auth/login',{data:{email,password:'RegistrationUI!2026'}});expect(login.status()).toBe(200);
 const session={...await login.json(),email,role:'Student'},headers={Authorization:'Bearer '+session.accessToken};
 const original=await(await request.get('/api/v1/students/me',{headers})).json();
 await page.addInitScript(value=>sessionStorage.setItem('tutormatching.auth.session',JSON.stringify(value)),session);
 await page.goto('/student/profile');await expect(page.getByLabel('Full name')).toHaveValue(original.displayName);
 const input=page.locator('input[type=file]');
 const data=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=1300;canvas.height=1300;
  const context=canvas.getContext('2d')!,image=context.createImageData(1300,1300);
  for(let offset=0;offset<image.data.length;offset+=65536)crypto.getRandomValues(image.data.subarray(offset,Math.min(offset+65536,image.data.length)));
  for(let i=3;i<image.data.length;i+=4)image.data[i]=255;
  context.putImageData(image,0,0);return {png:canvas.toDataURL('image/png').split(',')[1],legacy:canvas.toDataURL('image/jpeg',0.8)};
 });
 const file=Buffer.from(data.png,'base64');expect(file.length).toBeGreaterThan(2*1024*1024);expect(file.length).toBeLessThan(10*1024*1024);
 try{
  // A valid legacy avatar above Nginx's former 1 MiB limit must also save.
  expect(data.legacy.length).toBeGreaterThan(1024*1024);expect(data.legacy.length).toBeLessThan(2_000_000);
  expect((await request.put('/api/v1/students/me',{headers,data:{displayName:original.displayName,educationLevel:original.educationLevel,learningGoal:original.learningGoal,timezone:original.timezone,avatarUrl:data.legacy}})).status()).toBe(200);
  await input.setInputFiles({name:'large-photo.png',mimeType:'image/png',buffer:file});
  await expect(page.getByRole('status').filter({hasText:'Photo ready.'})).toBeVisible();
  const preview=page.locator('.student-profile__photo .profile-avatar img');
  const dimensions=await preview.evaluate(async element=>{const img=element as HTMLImageElement;await img.decode();return [img.naturalWidth,img.naturalHeight];});expect(Math.max(...dimensions)).toBeLessThanOrEqual(1024);
  const saveResponse=page.waitForResponse(response=>response.url().endsWith('/api/v1/students/me')&&response.request().method()==='PUT');
  await page.getByRole('button',{name:'Save changes'}).click();const response=await saveResponse;expect(response.status()).toBe(200);
  expect(response.request().postData()!.length).toBeLessThan(1_810_000);
  const saved=await(await request.get('/api/v1/students/me',{headers})).json();expect(saved.avatarUrl.startsWith('data:image/')).toBeTruthy();
  await page.reload();await expect(preview).toBeVisible();expect(await preview.getAttribute('src')===saved.avatarUrl).toBeTruthy();
  await input.setInputFiles({name:'too-large.png',mimeType:'image/png',buffer:Buffer.alloc(10*1024*1024+1)});
  await expect(page.getByRole('status').filter({hasText:'up to 10 MB'})).toBeVisible();expect(await preview.getAttribute('src')===saved.avatarUrl).toBeTruthy();
  await input.setInputFiles({name:'unreadable.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
  await expect(page.getByRole('status').filter({hasText:'could not be opened'})).toBeVisible();
  expect(await preview.getAttribute('src')===saved.avatarUrl).toBeTruthy();
 }finally{
  expect((await request.put('/api/v1/students/me',{headers,data:{displayName:original.displayName,educationLevel:original.educationLevel,learningGoal:original.learningGoal,timezone:original.timezone,avatarUrl:original.avatarUrl||'/assets/figma/default-avatar.svg'}})).status()).toBe(200);
 }
});
