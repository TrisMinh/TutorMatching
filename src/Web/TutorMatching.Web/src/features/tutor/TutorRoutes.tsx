import {AccountSettingsPanel} from '../../shared/AccountSettingsPanel';
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { browserSession, gatewayClient, type GatewayError, type NotificationItem } from '../../api';
import { useGatewayResource } from '../../api/useGatewayResource';
import { Button } from '../../design-system/Button';
import { TextField } from '../../design-system/TextField';
import { AppShell } from '../../shared/AppShell';
import { MotionLink, useMotionNavigate } from '../../shared/MotionLink';
import './tutor.css';
import { MyCourses } from '../../shared/MyCourses';
import { SettingsCompanion } from '../../shared/SettingsCompanion';
import { SettingsViewport } from '../../shared/SettingsViewport';
import {NotificationDetails,notificationTitle} from '../../shared/notificationPresentation';
import { Navigate } from 'react-router-dom';
import { LiveTutorDashboard,LiveTutorBookings,LiveTutorLesson,LiveTutorAvailability,LiveTutorSubjects,TutorStudentProfile } from './TutorLive';

const tutorShell = (active: string, title: string, className: string, content: ReactNode, mobileTitle?: string) => (
  <AppShell active={active} contentClassName={`tutor-content ${className}`} mobileTitle={mobileTitle} mode="tutor" title={title}>{content}</AppShell>
);

const tutorProfileKey = 'tutormatching.tutor.profileId';

function apiMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}


export function TutorOnboarding() {
  const navigate = useMotionNavigate();
  const [headline, setHeadline] = useState(browserSession.load()?.displayName ?? '');
  const [bio, setBio] = useState('');
  const [experienceYears, setExperienceYears] = useState('0');
  const [avatar,setAvatar]=useState<string>();
  const [initializing,setInitializing]=useState(true);
  const [profileLoadFailed,setProfileLoadFailed]=useState(false);
  const [loadAttempt,setLoadAttempt]=useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(()=>{let cancelled=false;setInitializing(true);setProfileLoadFailed(false);setError('');gatewayClient.getMyTutorProfile().then(profile=>{if(cancelled)return;setHeadline(profile.displayName);setBio(profile.bio);setExperienceYears(String(profile.experienceYears));setAvatar(profile.avatarUrl??undefined);}).catch(reason=>{if(!cancelled&&(reason as GatewayError).status!==404){setProfileLoadFailed(true);setError('Unable to load your tutor profile. Retry before editing.');}}).finally(()=>{if(!cancelled)setInitializing(false);});return()=>{cancelled=true;};},[loadAttempt]);

  async function saveProfile() {
    if(initializing||profileLoadFailed)return;
    if(!headline.trim()||!Number.isInteger(Number(experienceYears))||Number(experienceYears)<0||Number(experienceYears)>80){setError('Enter your name and experience between 0 and 80 years.');return;}
    setSaving(true);
    setError('');
    try {
      const profile = await gatewayClient.saveTutorProfile({
        displayName: headline.trim() || 'Tutor',
        bio: bio.trim(),
        experienceYears: Math.max(0, Number.parseInt(experienceYears, 10) || 0),
        avatarUrl: avatar,
      });
      window.sessionStorage.setItem(tutorProfileKey, profile.id);
      window.dispatchEvent(new Event('tutormatching:tutor-profile-updated'));
      window.dispatchEvent(new Event('tutormatching:profile-updated'));
      navigate('/tutor/subjects-pricing', { viewTransition: true });
    } catch (reason) {
      setError(apiMessage(reason, 'Unable to save your tutor profile.'));
    } finally {
      setSaving(false);
    }
  }

  return tutorShell('profile','Set up your tutor profile','tutor-onboarding',<>
    <p className="tutor-step">Profile basics</p><section className="student-card tutor-form-card"><h2>Build a profile students can trust</h2><TextField label="Display name" onChange={(event) => setHeadline(event.target.value)} value={headline}/><div className="tm-field"><label className="tm-field__label" htmlFor="tutor-profile-bio">Bio</label><textarea className="tm-field__input" id="tutor-profile-bio" rows={4} maxLength={4000} onChange={event=>setBio(event.target.value)} value={bio}/></div><TextField label="Years of experience" min="0" onChange={(event) => setExperienceYears(event.target.value)} type="number" value={experienceYears}/></section>{error ? <p className="tm-field__message tm-field__message--error" role="alert">{error}</p> : null}<>{profileLoadFailed&&<Button variant="secondary" onClick={()=>{setInitializing(true);setLoadAttempt(v=>v+1);}}>Retry loading profile</Button>}</><Button className="tutor-form-save" disabled={saving||initializing||profileLoadFailed||!headline.trim()} onClick={saveProfile} size="large">{initializing?'Loading…':saving ? 'Saving…' : 'Save & continue'}</Button>
  </>);
}



export function TutorPublicProfile() {
  const navigate=useMotionNavigate();
  const load=useCallback(async()=>({profile:await gatewayClient.getMyTutorProfile(),subjects:await gatewayClient.listSubjects()}),[]);
  const {data,loading,error,reload}=useGatewayResource(load,null);
  const profile=data?.profile;
  return tutorShell('profile','Public profile preview','tutor-live',<>
    {loading?<p role="status">Loading your profile…</p>:error?<section className="student-card" role="alert"><p>Unable to load your profile.</p><Button onClick={()=>void reload()}>Try again</Button><Button variant="secondary" onClick={()=>navigate('/tutor/onboarding')}>Set up profile</Button></section>:profile&&<section className="student-card">
      <div className="tutor-public-head"><div className="profile-avatar"><img alt={profile.displayName} src={profile.avatarUrl||'/assets/figma/student-tutor-1.jpg'}/></div><div><h2>{profile.displayName}</h2><p>{profile.experienceYears} years of teaching experience</p></div></div>
      <h3>About me</h3><p>{profile.bio||'No biography added yet.'}</p><h3>Teaching subjects</h3><div className="tag-row">{profile.subjects.map(subject=><span key={subject.subjectId}>{data.subjects.find(s=>s.id===subject.subjectId)?.name??'Subject'}</span>)}</div>{!profile.subjects.length&&<p>No teaching subjects selected.</p>}
      <div className="tutor-calendar-controls"><Button onClick={()=>navigate('/tutor/onboarding')}>Edit profile</Button><Button variant="secondary" onClick={()=>navigate('/tutor/subjects-pricing')}>Edit subjects</Button></div>
    </section>}
  </>);
}

export function TutorNotifications() {
  const load=useCallback(()=>gatewayClient.listNotifications(),[]);
  const {data,loading,error,reload,setData}=useGatewayResource(load,null);
  const [readError,setReadError]=useState('');
  async function read(item:NotificationItem){
    if(item.status!=='Unread')return;
    try{await gatewayClient.markNotificationRead(item.id);setData(value=>value?{...value,items:value.items.map(n=>n.id===item.id?{...n,status:'Read'}:n)}:value);}
    catch{setReadError('Unable to mark this notification as read.');}
  }
  return tutorShell('notifications','Notifications','tutor-notifications',<>
    {loading?<p role="status">Loading notifications…</p>:error?<div role="alert"><p>Unable to load notifications.</p><Button onClick={()=>void reload()}>Try again</Button></div>:<div className="notification-list">{data?.items.map(item=><article className={`student-card notification-item notification-with-details ${item.status==='Unread'?'is-unread':''}`} key={item.id}><MotionLink className="notification-item-link" to={item.courseId?`/tutor/courses?course=${encodeURIComponent(item.courseId)}`:item.bookingId?`/tutor/lessons/${item.bookingId}`:'/tutor/notifications'} onClick={()=>void read(item)}><h2>{notificationTitle(item)}</h2><NotificationDetails item={item}/></MotionLink><time>{new Date(item.createdAtUtc).toLocaleString('en-GB',{timeZone:'Asia/Ho_Chi_Minh',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time></article>)}{!data?.items.length&&<p>No notifications yet.</p>}</div>}{data?.partial&&<p role="status">Some notifications could not be loaded. Available notifications are shown above.</p>}{readError&&<p role="alert">{readError}</p>}
  </>);
}

export function TutorSettings() {
  return tutorShell('settings','Settings','tutor-settings',<SettingsViewport><div className="settings-layout"><AccountSettingsPanel mode="tutor"/><SettingsCompanion/></div></SettingsViewport>);
}

export const tutorRoutes=[
  {path:'/tutor/lessons/:bookingId/student',element:<TutorStudentProfile/>},
  {path:'/tutor/courses',element:<MyCourses mode="tutor"/>},
  {path:'/tutor/dashboard',element:<LiveTutorDashboard/>},{path:'/tutor/onboarding',element:<TutorOnboarding/>},{path:'/tutor/subjects-pricing',element:<LiveTutorSubjects/>},{path:'/tutor/availability',element:<LiveTutorAvailability/>},{path:'/tutor/requests',element:<LiveTutorBookings/>},{path:'/tutor/schedule',element:<Navigate to="/tutor/dashboard" replace/>},{path:'/tutor/lessons/:bookingId',element:<LiveTutorLesson/>},{path:'/tutor/public-profile',element:<TutorPublicProfile/>},{path:'/tutor/notifications',element:<TutorNotifications/>},{path:'/tutor/settings',element:<TutorSettings/>},
];
