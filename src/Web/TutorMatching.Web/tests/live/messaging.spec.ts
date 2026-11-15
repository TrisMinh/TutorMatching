import {test,expect} from '@playwright/test';

test('student and tutor exchange persisted private messages with responsive inbox and recovery',async({browser,request})=>{
 test.setTimeout(90000);
 const login=async(email:string,role:'Student'|'Tutor')=>{
  const response=await request.post('/api/v1/auth/login',{data:{email,password:'TutorDemo!2026'}});expect(response.status()).toBe(200);return {...await response.json(),email,role};
 };
 const student=await login('student24@demo.tutormatching.test','Student'),tutor=await login('tutor17@demo.tutormatching.test','Tutor');
 const headers={Authorization:'Bearer '+tutor.accessToken},tutorProfile=await(await request.get('/api/v1/tutors/me',{headers})).json();
 const sc=await browser.newContext(),tc=await browser.newContext();
 await sc.addInitScript(session=>sessionStorage.setItem('tutormatching.auth.session',JSON.stringify(session)),student);
 await tc.addInitScript(session=>sessionStorage.setItem('tutormatching.auth.session',JSON.stringify(session)),tutor);
 const sp=await sc.newPage(),tp=await tc.newPage();const failures:string[]=[];
 sp.on('pageerror',error=>failures.push(error.message));tp.on('pageerror',error=>failures.push(error.message));
 try{
  await sp.goto('/student/tutors/'+tutorProfile.id);await sp.getByRole('link',{name:'Message tutor',exact:true}).click();
  await expect(sp).toHaveURL(/student\/messages\?conversation=/);await expect(sp.locator('.messages-thread-header h2')).toHaveText(tutorProfile.displayName);
  const id=new URL(sp.url()).searchParams.get('conversation')!;
  const run='Hello from browser '+Date.now();
  await sp.getByRole('textbox',{name:'Message',exact:true}).fill(run);
  await sp.getByRole('button',{name:'Send',exact:true}).click();await expect(sp.locator('.message-bubble').filter({hasText:run})).toBeVisible();
  await tp.goto('/tutor/messages');const row=tp.locator('.messages-conversation-list button').filter({hasText:run});
  await expect(row).toBeVisible();await expect(row.locator('.conversation-unread')).toBeVisible();await row.click();
  await expect(tp.locator('.message-bubble.is-peer').filter({hasText:run})).toBeVisible();
  await expect.poll(async()=>{const value=await request.get('/api/v1/conversations/'+id,{headers});return(await value.json()).unreadCount;}).toBe(0);
  const reply='Tutor reply '+Date.now();await tp.getByRole('textbox',{name:'Message',exact:true}).fill(reply);await tp.getByRole('button',{name:'Send',exact:true}).click();
  await expect(sp.locator('.message-bubble.is-peer').filter({hasText:reply})).toBeVisible({timeout:12000});
  await sp.reload();await expect(sp.locator('.message-bubble').filter({hasText:reply})).toBeVisible();
  const draft='Keep this draft '+Date.now();await sp.route('**/api/v1/conversations/'+id+'/messages',async route=>{if(route.request().method()==='POST')await route.fulfill({status:503,json:{title:'Messaging temporarily unavailable'}});else await route.continue();});
  await sp.getByRole('textbox',{name:'Message',exact:true}).fill(draft);await sp.getByRole('button',{name:'Send',exact:true}).click();
  await expect(sp.locator('.messages-send-error')).toContainText('Your draft is kept');await expect(sp.getByRole('textbox',{name:'Message',exact:true})).toHaveValue(draft);
  await sp.unroute('**/api/v1/conversations/'+id+'/messages');await sp.getByRole('button',{name:'Send',exact:true}).click();
  await expect(sp.locator('.message-bubble').filter({hasText:draft})).toHaveCount(1);await expect(sp.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('');
  // Render markup as plain text, never as executable HTML.
  const markup='<img src=x onerror=alert(1)> literal '+Date.now();await sp.getByRole('textbox',{name:'Message',exact:true}).fill(markup);await sp.getByRole('button',{name:'Send',exact:true}).click();
  await expect(sp.locator('.message-bubble').filter({hasText:markup})).toBeVisible();await expect(sp.locator('.message-bubble img')).toHaveCount(0);
  for(const width of [1920,768,390]){
   await sp.setViewportSize({width,height:1000});await sp.goto('/student/messages?conversation='+id);await expect(sp.locator('.message-bubble').filter({hasText:run})).toBeVisible();
   const textbox=await sp.getByRole('textbox',{name:'Message',exact:true}).boundingBox(),send=await sp.getByRole('button',{name:'Send',exact:true}).boundingBox();
   if(width===390)expect(send!.y+send!.height).toBeLessThanOrEqual(920);
   expect(textbox!.width).toBeGreaterThan(100);expect(send!.height).toBeGreaterThanOrEqual(44);expect(textbox!.x+textbox!.width+7).toBeLessThanOrEqual(send!.x);
   expect(await sp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
   await sp.screenshot({path:'../../../.logs/messaging-student-'+width+'.png',fullPage:true});
   if(width<=768){await sp.getByRole('button',{name:'Back to conversations'}).click();await expect(sp.locator('.messages-inbox')).toBeVisible();}
  }
  await tp.setViewportSize({width:390,height:1000});await tp.goto('/tutor/messages?conversation='+id);await expect(tp.getByRole('textbox',{name:'Message',exact:true})).toBeVisible();
  expect(await tp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();await tp.screenshot({path:'../../../.logs/messaging-tutor-390.png',fullPage:true});
  expect(failures).toEqual([]);
 }finally{await sc.close();await tc.close();}
});
