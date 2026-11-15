import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const base=process.env.UI_AUDIT_BASE_URL??'http://localhost:3000',api='http://localhost:8080/api/v1';
const output=resolve(process.cwd(),'../../../.logs/ui-audit');mkdirSync(output,{recursive:true});
async function json(path,token,body){const response=await fetch(api+path,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});if(!response.ok)throw new Error(path+': '+response.status);return response.json();}
const browser=await chromium.launch({channel:'chrome',headless:true}),report=[];
try{for(const role of ['Student','Tutor']){
 const email=role==='Student'?'student24@demo.tutormatching.test':'tutor18@demo.tutormatching.test';
 const tokens=await json('/auth/login',null,{email,password:'TutorDemo!2026'}),user=await json('/users/me',tokens.accessToken),profile=await json(role==='Student'?'/students/me':'/tutors/me',tokens.accessToken);
 const bookings=await json('/bookings',tokens.accessToken),courses=await json('/courses',tokens.accessToken),mine=await json('/courses/mine',tokens.accessToken),search=await json('/tutors?page=1&pageSize=100');
 const teacher=role==='Tutor'?profile:search.items.find(t=>t.displayName==='Mai Lan Anh'),full=await json('/tutors/'+teacher.id),subjectId=full.subjects[0]?.subjectId,start=full.availability.find(w=>Date.parse(w.startAtUtc)>Date.now())?.startAtUtc??new Date(Date.now()+86400000).toISOString(),prefix='/'+role.toLowerCase();
 const routes=role==='Student'?[prefix+'/complete-profile',prefix+'/profile',prefix+'/dashboard',prefix+'/find-tutors',prefix+'/tutors/'+teacher.id,prefix+`/book/select-schedule?tutorId=${teacher.id}&subjectId=${subjectId}&startAtUtc=${encodeURIComponent(start)}`,prefix+'/bookings',...(bookings[0]?[prefix+'/bookings/'+bookings[0].id]:[]),prefix+'/courses',...(courses[0]?[prefix+'/courses/'+courses[0].id]:[]),prefix+'/notifications',prefix+'/settings']:[prefix+'/onboarding',prefix+'/public-profile',prefix+'/dashboard',prefix+'/subjects-pricing',prefix+'/availability',prefix+'/requests',...(bookings[0]?[prefix+'/lessons/'+bookings[0].id,prefix+'/lessons/'+bookings[0].id+'/student']:[]),prefix+'/courses'+(mine[0]?'?course='+mine[0].id:''),prefix+'/notifications',prefix+'/settings'];
 for(const width of [1920,768,390]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});
  await context.addInitScript(session=>sessionStorage.setItem('tutormatching.auth.session',JSON.stringify(session)),{...tokens,...user});
  for(const [index,path] of routes.entries()){
   const page=await context.newPage(),errors=[],serverErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=500&&r.url().includes('/api/'))serverErrors.push(r.status()+' '+new URL(r.url()).pathname);});
   try{
    await page.goto(base+path,{waitUntil:'networkidle',timeout:20000});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(100);
    const layout=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+2,heading:document.querySelector('h1')?.textContent,offenders:[...document.querySelectorAll('main *, .student-content *,form *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.right>innerWidth+3&&getComputedStyle(e).position!=='fixed';}).slice(0,8).map(e=>({tag:e.tagName,cls:e.className,right:Math.round(e.getBoundingClientRect().right)}))}));
    const file=role.toLowerCase()+'-'+width+'-'+String(index).padStart(2,'0')+'.png';await page.screenshot({path:resolve(output,file),fullPage:true});report.push({role,width,path,...layout,errors,serverErrors,screenshot:file});console.log(`${role} ${width} ${path}: ${layout.overflow?'OVERFLOW':'fits'}${errors.length?' JS ERROR':''}${serverErrors.length?' API ERROR':''}`);
   }catch(error){report.push({role,width,path,errors:[String(error)]});console.log('AUDIT ERROR '+path);}await page.close();
  }await context.close();
 }
}}finally{await browser.close();writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2));}
const failed=report.filter(r=>r.overflow||r.errors.length||r.serverErrors?.length);console.log(`Audited ${report.length} views; ${failed.length} need attention.`);if(failed.length)process.exitCode=1;
