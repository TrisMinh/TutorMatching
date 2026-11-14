import {test,expect} from '@playwright/test';
test('global search suggests matching courses, books, tutors and handles empty queries',async({page,request})=>{
 const login=await request.post('http://localhost:8080/api/v1/auth/login',{data:{email:'student01@demo.tutormatching.test',password:'TutorDemo!2026'}});
 await page.addInitScript(session=>localStorage.setItem('tutormatching.auth.session',JSON.stringify({...session,role:'Student'})),await login.json());
 await page.goto('/student/dashboard');
 const search=page.getByRole('combobox',{name:'Search anything'});
 await search.fill('UX Research');
 const option=page.getByRole('option').filter({hasText:'UX Research Class'});
 await expect(option).toBeVisible();
 await search.press('ArrowDown');await search.press('Enter');
 await expect(page).toHaveURL(/student\/courses\/ux-research$/);
 await search.fill('Nguyen');await expect(page.getByRole('option').filter({hasText:'Tutor'}).first()).toBeVisible();
 await search.fill('zzzzzzz-not-found');await expect(page.getByText(/No results for/)).toBeVisible();
 await expect(page).toHaveURL(/student\/courses\/ux-research$/);
 await search.press('Escape');await expect(page.getByRole('listbox')).toHaveCount(0);
 await search.fill('Confirmed');await expect(page.getByRole('option').filter({hasText:'Booking'}).first()).toBeVisible();
 await page.setViewportSize({width:390,height:844});await expect(search).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
