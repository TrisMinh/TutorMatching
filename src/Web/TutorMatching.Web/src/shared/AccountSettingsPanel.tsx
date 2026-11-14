import {useCallback,useEffect,useState} from 'react';
import {gatewayClient,type AccountPreferences} from '../api';
import {Button} from '../design-system/Button';
import {Select} from '../design-system/Select';
import {MotionLink} from './MotionLink';
import {Toast} from './Toast';
import './account-settings.css';

export function AccountSettingsPanel({mode}:{mode:'student'|'tutor'}){
 const [settings,setSettings]=useState<AccountPreferences>();
 const [original,setOriginal]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const close=useCallback(()=>setMessage(''),[]);
 const load=useCallback(async()=>{setError('');setSettings(undefined);try{const value=await gatewayClient.getSettings();setSettings(value);setOriginal(JSON.stringify(value));}catch(e){setError(e instanceof Error?e.message:'Unable to load settings.');}},[]);
 useEffect(()=>{void load();},[load]);
 const changed=Boolean(settings&&JSON.stringify(settings)!==original);
 async function save(){if(!settings||busy)return;setBusy(true);setError('');try{const saved=await gatewayClient.saveSettings(settings);setSettings(saved);setOriginal(JSON.stringify(saved));setMessage('Settings saved');}catch(e){setError(e instanceof Error?e.message:'Unable to save settings.');}finally{setBusy(false);}}
 function toggle(key:'emailReminders'|'inAppNotifications'|'enrollmentAlerts'|'profileVisible',label:string,description:string){return <div className="setting-row"><div><strong>{label}</strong><span>{description}</span></div><button type="button" role="switch" aria-label={label} aria-checked={settings?.[key]??false} disabled={!settings||busy} className={settings?.[key]?'is-on':''} onClick={()=>setSettings(current=>current?{...current,[key]:!current[key]}:current)}><span/></button></div>;}
 return <section className="student-card account-preferences tutor-settings-card" aria-busy={busy||!settings&&!error}>
  <h2>{mode==='tutor'?'Tutor preferences':'Account & preferences'}</h2>
  {!settings&&!error?<p role="status">Loading your preferences…</p>:null}
  {error?<div className="account-settings-error" role="alert"><p>{error}</p><button type="button" onClick={()=>void load()}>Reload settings</button></div>:null}
  {toggle('emailReminders','Email reminders','Receive an email before your lessons and course sessions')}
  {toggle('inAppNotifications','In-app notifications','Show booking updates in the notification list and bell')}
  {mode==='tutor'?<>
   {toggle('enrollmentAlerts','New student alerts','Show an alert when a student enrolls in your course')}
   {toggle('profileVisible','Profile visibility','Appear in student searches; existing bookings are kept')}
   <div className="tutor-policy"><div><strong>Cancellation policy</strong><span>Applies to new bookings only. Students must cancel before this deadline.</span></div><Select aria-label="Cancellation notice" disabled={!settings||busy} value={String(settings?.cancellationNoticeHours??12)} onChange={e=>setSettings(current=>current?{...current,cancellationNoticeHours:Number(e.target.value)}:current)}>{[0,6,12,24,48].map(hours=><option key={hours} value={hours}>{hours===0?'Until lesson starts':`${hours} hours before`}</option>)}</Select></div>
  </>:null}
  <div className="setting-password"><div><strong>Password</strong><span>Receive a secure, one-time reset link by email</span></div><MotionLink className="account-password-link" to="/auth/forgot-password">Change password →</MotionLink></div>
  <Button className="tutor-settings-save" disabled={!settings||busy||!changed} onClick={()=>void save()} size="large">{busy?'Saving…':'Save settings'}</Button>
  {message?<Toast message={message} onClose={close}/>:null}
 </section>;
}
