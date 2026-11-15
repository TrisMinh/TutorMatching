import {test,expect} from '@playwright/test';

test('real booking confirmation has clear details, illustration and separate responsive actions',async({page,request})=>{
 test.setTimeout(60000);
 const email='student24@demo.tutormatching.test';
 const login=await request.post('/api/v1/auth/login',{data:{email,password:'TutorDemo!2026'}});expect(login.status()).toBe(200);
 const session={...await login.json(),email,role:'Student'},headers={Authorization:'Bearer '+session.accessToken};
 const response=await request.get('/api/v1/bookings',{headers});expect(response.status()).toBe(200);
 const payload=await response.json(),bookings=Array.isArray(payload)?payload:payload.items;
 const booking=bookings.find((b:{status:string})=>b.status==='Confirmed');expect(booking).toBeTruthy();
 const tutor=await(await request.get('/api/v1/tutors/'+booking.tutorId,{headers})).json();
 await page.addInitScript(value=>sessionStorage.setItem('tutormatching.auth.session',JSON.stringify(value)),session);
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 for(const width of [1920,768,390]){
  await page.setViewportSize({width,height:1000});await page.goto('/student/book/confirmed?bookingId='+booking.id);
  await expect(page.getByRole('heading',{name:'Your lesson is booked!'})).toBeVisible();
  await expect(page.locator('.booking-success-art')).toBeVisible();
  await expect(page.locator('.booking-success-status')).toHaveText('Confirmed');
  await expect(page.locator('.booking-success-details dd').first()).toHaveText(tutor.displayName);
  await expect(page.locator('.booking-success-details dd')).toHaveCount(4);
  await expect(page.locator('.booking-success-reference')).toContainText(booking.id);
  const primary=page.getByRole('link',{name:'View booking details'}),secondary=page.getByRole('link',{name:'Back to dashboard',exact:true});
  const a=await primary.boundingBox(),b=await secondary.boundingBox();
  expect(a!.height).toBeGreaterThanOrEqual(44);expect(b!.height).toBeGreaterThanOrEqual(44);
  expect(a!.x<b!.x+b!.width&&b!.x<a!.x+a!.width&&a!.y<b!.y+b!.height&&b!.y<a!.y+a!.height).toBeFalsy();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  await page.screenshot({path:'../../../.logs/booking-confirmation-'+width+'.png',fullPage:true});
 }
 await page.getByRole('link',{name:'View booking details'}).click();await expect(page).toHaveURL(new RegExp('/student/bookings/'+booking.id+'$'));
 await expect(page.getByRole('heading',{name:'Booking details',exact:true})).toBeVisible();
 for(const width of [1920,768,390]){
  await page.setViewportSize({width,height:1000});await page.goto('/student/bookings/'+booking.id);
  const card=page.locator('.lesson-detail-card'),title=page.locator('#lesson-detail-title');
  await expect(title).toContainText(tutor.displayName);
  const cardBox=await card.boundingBox(),titleBox=await title.boundingBox();
  expect(titleBox!.x-cardBox!.x).toBeGreaterThanOrEqual(20);
  expect(titleBox!.y-cardBox!.y).toBeGreaterThanOrEqual(20);
  expect(cardBox!.width).toBeLessThanOrEqual(1000);
  const facts=page.locator('.lesson-detail-fact');await expect(facts).toHaveCount(4);
  for(const item of await facts.all()){
   const box=await item.boundingBox(),text=await item.locator('dd').boundingBox();
   expect(text!.x-box!.x).toBeGreaterThanOrEqual(16);expect(text!.x+text!.width).toBeLessThanOrEqual(box!.x+box!.width-10);
  }
  const actions=page.locator('.lesson-detail-actions'),cancel=actions.getByRole('button'),back=actions.getByRole('link',{name:'My bookings',exact:true});
  const a=await cancel.boundingBox(),b=await back.boundingBox();
  expect(a!.height).toBeGreaterThanOrEqual(44);expect(b!.height).toBeGreaterThanOrEqual(44);
  const gap=Math.max(a!.x-b!.x-b!.width,b!.x-a!.x-a!.width,a!.y-b!.y-b!.height,b!.y-a!.y-a!.height);
  expect(gap).toBeGreaterThanOrEqual(11);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  await page.screenshot({path:'../../../.logs/booking-details-'+width+'.png',fullPage:true});
 }
 const original=await(await request.get('/api/v1/bookings/'+booking.id,{headers})).json();
 await page.route('**/api/v1/bookings/'+booking.id,route=>route.fulfill({json:{...original,booking:{...original.booking,status:'Cancelled'}}}));
 await page.reload();await expect(page.getByRole('button',{name:'Booking cancelled',exact:true})).toBeDisabled();
 await expect(page.getByRole('heading',{name:'This booking has been cancelled'})).toBeVisible();
 await page.unroute('**/api/v1/bookings/'+booking.id);
 await page.route('**/api/v1/bookings/'+booking.id,route=>route.fulfill({json:{...original,booking:{...original.booking,status:'Confirmed',cancellationDeadlineUtc:'2026-01-01T00:00:00Z'}}}));
 await page.reload();await expect(page.getByRole('button',{name:'Cancellation window closed'})).toBeDisabled();
 await expect(page.getByRole('heading',{name:'The cancellation window has closed'})).toBeVisible();
 expect(errors).toEqual([]);
});
