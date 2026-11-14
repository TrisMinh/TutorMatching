import {expect,test} from '@playwright/test';
test('course tabs animate only their panel and navigation keeps the document',async({page})=>{
 await page.goto('/student/dashboard');await page.waitForLoadState('networkidle');
 await page.evaluate(()=>{(window as Window & {tabCheck?:boolean}).tabCheck=true;document.querySelector('.course-calendar-frame')?.setAttribute('data-stays','yes');});
 await page.getByRole('tab',{name:'Workshop',exact:true}).click();
 await expect(page.getByRole('tabpanel',{name:'Workshop',exact:true})).toHaveCSS('animation-name','tm-view-enter');
 await expect(page.locator('.course-calendar-frame')).toHaveAttribute('data-stays','yes');
 await page.getByRole('link',{name:'My bookings',exact:true}).click();
 await expect(page).toHaveURL(/\/student\/bookings$/);
 expect(await page.evaluate(()=>(window as Window & {tabCheck?:boolean}).tabCheck)).toBe(true);
});
