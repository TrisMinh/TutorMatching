import {expect,test} from '@playwright/test';
test('template cards stay present and do not overlap',async({page})=>{
 for(const width of [500,850,1280,1600,1920]){
  await page.setViewportSize({width,height:900});await page.goto('/student/dashboard');
  await expect(page.locator('.legacy-event--research')).toBeAttached();
  await expect(page.locator('.legacy-event--webinar')).toBeAttached();
  await page.waitForTimeout(400);
  const overlaps=await page.locator('.legacy-event').evaluateAll(elements=>{const r=elements.map(e=>e.getBoundingClientRect());return r.flatMap((a,i)=>r.slice(i+1).filter(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top));});
  expect(overlaps,`width ${width}`).toEqual([]);
 }
});
