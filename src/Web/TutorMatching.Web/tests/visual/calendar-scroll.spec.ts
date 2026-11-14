import { expect,test } from '@playwright/test';
test('calendar scrolls to evening without moving its frame or weekday header',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/student/dashboard');
  const frame=page.locator('.legacy-calendar-frame');
  const header=page.locator('.legacy-calendar__days');
  const initial=await frame.boundingBox();
  const initialHeader=await header.boundingBox();
  await frame.evaluate(element=>{element.scrollTop=element.scrollHeight;});
  await expect(frame.getByText('21:00',{exact:true})).toBeInViewport();
  expect((await frame.boundingBox())?.height).toBe(initial?.height);
  expect((await header.boundingBox())?.y).toBeCloseTo(initialHeader!.y,0);
});
