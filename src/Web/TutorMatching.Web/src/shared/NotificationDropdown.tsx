import {FriendlyEmptyState} from './FriendlyEmptyState';
import {useEffect,useId,useRef,useState} from 'react';
import {gatewayClient,type NotificationItem} from '../api';
import {MotionLink} from './MotionLink';
import './notification-dropdown.css';
import {NotificationDetails,notificationTitle} from './notificationPresentation';

export function NotificationDropdown({mode}:{mode:'student'|'tutor'}){
 const [open,setOpen]=useState(false);
 const [items,setItems]=useState<NotificationItem[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState(false);
 const [partial,setPartial]=useState(false);
 const root=useRef<HTMLDivElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 const id=useId();
 useEffect(()=>{
   if(!open)return;
   let active=true;setLoading(true);setError(false);
   gatewayClient.listNotifications().then(page=>{if(active){setItems([...page.items].sort((a,b)=>b.createdAtUtc.localeCompare(a.createdAtUtc)).slice(0,5));setPartial(!!page.partial);}}).catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setLoading(false);});
   function outside(event:PointerEvent){if(!root.current?.contains(event.target as Node))setOpen(false);}
   function escape(event:KeyboardEvent){if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}}
   document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
   return()=>{active=false;document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[open]);
 return <div className="notification-dropdown" ref={root}>
   <button ref={trigger} type="button" aria-label="Notifications" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>setOpen(value=>!value)}><img alt="" src="/assets/figma/nav-bell.svg"/></button>
   {open?<section id={id} className="notification-dropdown-panel" role="region" aria-label="Recent notifications"><header><h2>Notifications</h2><small>{items.filter(item=>item.status==='Unread').length} unread</small></header><div className="notification-dropdown-list" aria-live="polite">{partial&&!loading&&!error&&<p role="status">Some notifications could not be loaded. Available notifications are shown below.</p>}{loading?<p>Loading notifications…</p>:error?<p role="alert">Unable to load notifications. Close and reopen to retry.</p>:items.length?items.map(item=><article className={item.status==='Unread'?'is-unread':''} key={item.id}><MotionLink className="notification-item-link" to={item.courseId?(mode==='tutor'?`/tutor/courses?course=${encodeURIComponent(item.courseId)}`:`/student/courses/${encodeURIComponent(item.courseId)}`):item.bookingId?`/${mode}/${mode==='tutor'?'lessons':'bookings'}/${item.bookingId}`:`/${mode}/notifications`} onClick={()=>{if(item.status==='Unread')void gatewayClient.markNotificationRead(item.id).catch(()=>{});setOpen(false);}}><h3>{notificationTitle(item)}</h3><NotificationDetails item={item}/><time dateTime={item.createdAtUtc}>{new Date(item.createdAtUtc).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time></MotionLink>{item.status==='Unread'?<i aria-label="Unread"/>:null}</article>):<FriendlyEmptyState compact kind="bell" title="You’re all caught up" description="No notifications yet. New updates will appear here."/>}</div><MotionLink className="notification-see-more" to={`/${mode}/notifications`} onClick={()=>setOpen(false)}>See more →</MotionLink></section>:null}
 </div>;
}
