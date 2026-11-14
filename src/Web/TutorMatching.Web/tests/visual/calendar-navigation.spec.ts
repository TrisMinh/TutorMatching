import {test,expect} from '@playwright/test';
test('mini calendar selects the corresponding week and day',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('/student/dashboard');await page.waitForLoadState('networkidle');
 const days=page.locator('.dashboard-mini-calendar__days button');
 const target=days.nth(20);const date=await target.getAttribute('aria-label');await target.click();
 await expect(page.getByRole('button',{name:date!,exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.course-calendar-header > span.is-selected')).toHaveCount(1);
 await expect(page.locator('.course-calendar-day.is-selected')).toHaveCount(1);
 const month=await page.locator('.dashboard-mini-calendar h2').textContent();
 await page.getByRole('button',{name:'Next month',exact:true}).click();
 await expect(page.locator('.dashboard-mini-calendar h2')).not.toHaveText(month!);
});
