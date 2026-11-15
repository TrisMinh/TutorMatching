import {verifyEmail} from './verifyEmail';
import {test,expect} from '@playwright/test';
test('course owner manages registration, student withdraws, cancelled course leaves calendar and sends notice',async({browser,request})=>{
 const stamp=Date.now(),password='LifecycleUI!2026',id=`lifecycle-ui-${stamp}`;
 async function account(role:'Student'|'Tutor',suffix:string){const email=`lifecycle.ui.${stamp}.${suffix}@example.com`;expect((await request.post('http://localhost:8080/api/v1/auth/register',{data:{email,password,role}})).status()).toBe(201);await verifyEmail(request,email);return {...await (await request.post('http://localhost:8080/api/v1/auth/login',{data:{email,password}})).json(),role,email};}
 const teacher=await account('Tutor','teacher'),student=await account('Student','student');
 const auth=(session:{accessToken:string})=>({Authorization:`Bearer ${session.accessToken}`});
 expect((await request.put('http://localhost:8080/api/v1/tutors/me',{headers:auth(teacher),data:{displayName:'Lifecycle UI tutor',bio:'Isolated lifecycle UI fixture',experienceYears:3}})).status()).toBe(200);
 expect((await request.put('http://localhost:8080/api/v1/students/me',{headers:auth(student),data:{displayName:'Lifecycle UI student',educationLevel:2,learningGoal:'Verify lifecycle',timezone:'Asia/Ho_Chi_Minh'}})).status()).toBe(200);
 const start=new Date(Date.now()+14*86400000);start.setUTCHours(6,0,0,0);
 expect((await request.put('http://localhost:8080/api/v1/courses/'+id,{headers:auth(teacher),data:{title:'Lifecycle UI course',image:'/assets/figma/dashboard-research.png',category:'Workshop',description:'Isolated lifecycle UI fixture',capacity:3,sessions:[{startAtUtc:start.toISOString(),endAtUtc:new Date(+start+3600000).toISOString()}]}})).status()).toBe(200);
 const tc=await browser.newContext({baseURL:"http://localhost:3000"}),sc=await browser.newContext({baseURL:"http://localhost:3000"});
 await tc.addInitScript(s=>localStorage.setItem('tutormatching.auth.session',JSON.stringify(s)),teacher);await sc.addInitScript(s=>localStorage.setItem('tutormatching.auth.session',JSON.stringify(s)),student);
 const tutor=await tc.newPage(),learner=await sc.newPage();
 try{
 await tutor.goto('/tutor/courses?course='+id);await tutor.getByRole('button',{name:'Close registration',exact:true}).click();await tutor.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click();await expect(tutor.locator('.course-lifecycle>.course-state')).toHaveText('Registration closed');
 await learner.goto('/student/courses/'+id);await expect(learner.getByRole('button',{name:'Registration closed',exact:true})).toBeDisabled();
 await tutor.getByRole('button',{name:'Reopen registration'}).click();await tutor.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click();await expect(tutor.locator('.course-lifecycle>.course-state')).toHaveText('Registration open');
 await learner.reload();await learner.getByRole('button',{name:'Enroll in course',exact:true}).click();await expect(learner.getByRole('button',{name:'Enrolled',exact:true})).toBeDisabled();
 await learner.getByRole('button',{name:'Cancel registration',exact:true}).click();await learner.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click();await expect(learner.getByRole('button',{name:'Enroll in course',exact:true})).toBeEnabled();
 await learner.getByRole('button',{name:'Enroll in course',exact:true}).click();await expect(learner.getByRole('button',{name:'Enrolled',exact:true})).toBeDisabled();
 await tutor.reload();await tutor.getByRole('button',{name:'Cancel course',exact:true}).click();await tutor.getByLabel('Cancellation reason').fill('Instructor unavailable');await tutor.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click();await expect(tutor.locator('.course-lifecycle>.course-state')).toHaveText('Cancelled');
 await learner.reload();await expect(learner.getByRole('button',{name:'Course cancelled',exact:true})).toBeDisabled();await expect(learner.getByText('Instructor unavailable',{exact:false})).toBeVisible();
 await learner.goto('/student/dashboard');await expect(learner.getByRole('region',{name:'Weekly calendar'})).toBeVisible();expect(await learner.locator('.course-calendar-event').filter({hasText:'Lifecycle UI course'}).count()).toBe(0);
 await learner.getByRole('button',{name:'Notifications',exact:true}).click();await learner.getByRole('link').filter({hasText:'Course cancelled'}).click();await expect(learner).toHaveURL(new RegExp('/student/courses/'+id));
 await tutor.setViewportSize({width:390,height:844});expect(await tutor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 }finally{await tc.close();await sc.close();}
});

