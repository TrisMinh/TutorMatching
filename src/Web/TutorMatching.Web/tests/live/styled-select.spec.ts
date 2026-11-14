import {test,expect} from '@playwright/test';
test('shared dropdowns style and select values on calendar, filters and profile',async({page,request})=>{
 const auth=await request.post('http://localhost:8080/api/v1/auth/login',{data:{email:'student01@demo.tutormatching.test',password:'TutorDemo!2026'}});
 await page.addInitScript(session=>localStorage.setItem('tutormatching.auth.session',JSON.stringify({...session,role:'Student'})),await auth.json());
 await page.goto('/student/dashboard');
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});
  for(const dropdown of await page.locator('button.tm-select').all()){
   const box=await dropdown.boundingBox();const arrow=await dropdown.locator('svg').boundingBox();
   if(box&&arrow)expect(box.x+box.width-arrow.x-arrow.width).toBeGreaterThanOrEqual(18);
  }
 }
 const timezone=page.getByRole('combobox',{name:'Schedule timezone'});await timezone.click();
 await expect(page.getByRole('listbox')).toHaveClass('tm-select-menu');
 await page.getByRole('option',{name:'(GMT +00:00) UTC',exact:true}).click();await expect(timezone).toContainText('UTC');
 await timezone.click();await timezone.press('Escape');await expect(page.getByRole('listbox')).toHaveCount(0);
 await page.getByRole('combobox',{name:/Enrolled courses/}).click();await page.getByRole('option',{name:'UX Research Class',exact:true}).click();
 await expect(page.getByRole('region',{name:'Weekly calendar'}).getByRole('button',{name:/UX Research Class/}).first()).toBeAttached();
 await page.goto('/student/find-tutors');await page.getByRole('combobox',{name:'Sort by',exact:true}).click();await page.getByRole('option',{name:'Name A–Z',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Sort by',exact:true})).toContainText('Name A–Z');
 await page.goto('/student/profile');const grade=page.getByRole('combobox',{name:'School level',exact:true});await grade.click();await page.getByRole('option',{name:'Grade 12',exact:true}).click();await expect(grade).toContainText('Grade 12');
 await page.setViewportSize({width:390,height:844});await grade.click();const box=await page.getByRole('listbox').boundingBox();expect(box!.x+box!.width).toBeLessThanOrEqual(390);await grade.press('Escape');
 await expect(page.locator('select')).toHaveCount(0);
});
