import {test,expect} from '@playwright/test';
test('bell opens inline and only See more navigates',async({page})=>{
 await page.route('**/api/v1/notifications?*',route=>route.fulfill({json:{items:[{id:'notice-1',title:'Booking confirmed',body:'Your lesson is booked.',status:'Unread',createdAtUtc:'2026-11-14T10:00:00Z'}],total:1,page:1,pageSize:100}}));
 for(const width of [390,1024,1440]){
  await page.setViewportSize({width,height:900});await page.goto('/student/dashboard');
  await page.getByRole('button',{name:'Notifications',exact:true}).click();
  await expect(page.getByRole('region',{name:'Recent notifications'})).toBeVisible();
  await expect(page).toHaveURL(/\/student\/dashboard$/);
  await expect(page.getByRole('region',{name:'Recent notifications'}).getByText('Booking confirmed')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('region',{name:'Recent notifications'})).toHaveCount(0);
  await page.getByRole('button',{name:'Notifications',exact:true}).click();
  await page.getByRole('link',{name:'See more'}).click();await expect(page).toHaveURL(/\/student\/notifications$/);
 }
});
