import {expect,test} from '@playwright/test';
test('week arrows slide calendar in opposite directions',async({page})=>{
 await page.goto('/student/dashboard');await page.waitForLoadState('networkidle');
 await page.evaluate(()=>{
   const original=Element.prototype.animate;
   (window as Window & {slideFrames?:unknown[]}).slideFrames=[];
   Element.prototype.animate=function(frames,options){if(this.classList.contains('course-calendar-timeline'))(window as Window & {slideFrames:unknown[]}).slideFrames.push(frames);return original.call(this,frames,options);};
 });
 await page.getByRole('button',{name:'Next week',exact:true}).click();
 await page.getByRole('button',{name:'Previous week',exact:true}).click();
 const frames=await page.evaluate(()=>(window as Window & {slideFrames:Array<Array<{transform:string}>>}).slideFrames);
 expect(frames[0][0].transform).toBe('translateX(35%)');
 expect(frames[1][0].transform).toBe('translateX(-35%)');
});
