import {test,expect} from '@playwright/test';

test('real booking confirmation has clear details, illustration and separate responsive actions',async({page,request})=>{
 test.setTimeout(40000);
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
 await expect(page.getByRole('heading',{name:'Booking details',exact:true})).toBeVisible();expect(errors).toEqual([]);
});
