import {useCallback,useRef,useState} from 'react';
import {gatewayClient,type Course} from '../api';
import {Button} from '../design-system/Button';
import {TextField} from '../design-system/TextField';
import {Toast} from './Toast';
import './course-lifecycle.css';

export function courseState(course:Course){
 if(course.status==='Cancelled')return 'Cancelled';
 if(course.sessions.length&&course.sessions.every(s=>Date.parse(s.endAtUtc)<=Date.now()))return 'Completed';
 if(course.sessions.some(s=>Date.parse(s.startAtUtc)<=Date.now()))return 'InProgress';
 return course.status??'Open';
}
export function CourseStatus({course}:{course:Course}){const status=courseState(course);return <span className="course-state" data-state={status}>{status==='Closed'?'Registration closed':status==='Open'?'Registration open':status==='InProgress'?'In progress':status}</span>;}

export function CourseLifecycleActions({course,mode,enrolled=false,onChanged}:{course:Course;mode:'student'|'tutor';enrolled?:boolean;onChanged:()=>Promise<unknown>}){
 const [busy,setBusy]=useState(false);const [action,setAction]=useState<'withdraw'|'cancel'|'Open'|'Closed'>();
 const [reason,setReason]=useState('');const [error,setError]=useState('');const [message,setMessage]=useState('');
 const dialog=useRef<HTMLDialogElement>(null);const close=useCallback(()=>setMessage(''),[]);
 const state=courseState(course),started=course.sessions.some(s=>Date.parse(s.startAtUtc)<=Date.now());
 function open(next:typeof action){setAction(next);setReason('');setError('');dialog.current?.showModal();}
 async function confirm(){if(!action||busy)return;setBusy(true);setError('');try{
  if(action==='withdraw')await gatewayClient.withdrawCourse(course.id);
  else await gatewayClient.changeCourseStatus(course.id,action==='cancel'?'Cancelled':action,course.version??1,reason.trim());
  dialog.current?.close();await onChanged();window.dispatchEvent(new Event('courses-changed'));
  setMessage(action==='withdraw'?'Registration cancelled':action==='cancel'?'Course cancelled and students notified':action==='Closed'?'Registration closed':'Registration reopened');
 }catch(e){setError(e instanceof Error?e.message:'Unable to update course.');}finally{setBusy(false);}}
 return <div className="course-lifecycle">
  <CourseStatus course={course}/>
  {state==='Cancelled'?<p className="course-cancellation-note">{course.cancellationReason||'The tutor has cancelled this course.'} Your course history remains available.</p>:null}
  {mode==='tutor'&&state!=='Cancelled'&&state!=='Completed'?<div className="course-lifecycle__buttons">{!started?<Button variant="secondary" disabled={busy} onClick={()=>open(state==='Closed'?'Open':'Closed')}>{state==='Closed'?'Reopen registration':'Close registration'}</Button>:null}<Button variant="danger" disabled={busy} onClick={()=>open('cancel')}>Cancel course</Button></div>:null}
  {mode==='student'&&enrolled&&state!=='Cancelled'&&state!=='Completed'?<>{started?<p>Registration changes are closed after the first session starts.</p>:<Button variant="secondary" disabled={busy} onClick={()=>open('withdraw')}>Cancel registration</Button>}</>:null}
  <dialog className="course-lifecycle-dialog" ref={dialog} aria-labelledby={`lifecycle-title-${course.id}`} onCancel={event=>{if(busy)event.preventDefault();}}>
   <h2 id={`lifecycle-title-${course.id}`}>{action==='withdraw'?'Cancel your registration?':action==='cancel'?'Cancel this course?':action==='Closed'?'Close registration?':'Reopen registration?'}</h2><strong>{course.title}</strong>
   <p>{action==='withdraw'?'Your place will be released and this course will leave your upcoming schedule. You may register again while registration is open.':action==='cancel'?'Remaining sessions will leave the active schedule. All enrolled students receive an in-app notice. This cannot be undone.':action==='Closed'?'Existing students and sessions remain unchanged. New students cannot register.':'Students can register again if places are available and their schedules do not conflict.'}</p>
   {action==='cancel'?<TextField label="Cancellation reason" value={reason} maxLength={300} onChange={e=>setReason(e.target.value)} required/>:null}
   {error?<p className="course-lifecycle-error" role="alert">{error}</p>:null}
   <div className="course-lifecycle__buttons"><Button variant="secondary" disabled={busy} onClick={()=>dialog.current?.close()}>Keep as is</Button><Button variant={action==='cancel'?'danger':'primary'} disabled={busy||action==='cancel'&&!reason.trim()} onClick={()=>void confirm()}>{busy?'Updating…':'Confirm'}</Button></div>
  </dialog>
  {message?<Toast message={message} onClose={close}/>:null}
 </div>;
}
