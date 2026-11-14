import {useEffect,useState} from 'react';
import type {NotificationItem} from '../api';
export const notificationTitle=(item:NotificationItem)=>item.title;
const format=(value:string)=>new Date(value).toLocaleString('en-GB',{timeZone:'Asia/Ho_Chi_Minh',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function notificationSummary(item:NotificationItem){
 if(item.startAtUtc&&!Number.isNaN(+new Date(item.startAtUtc)))return `${format(item.startAtUtc)} (GMT+7)${item.type==='BookingCancelled'?' · Cancelled':''}`;
 return item.body.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/g,value=>`${format(value)} (GMT+7)`).replace(/#?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,'').replace(/\s+/g,' ').trim();
}
export function NotificationAvatar({item}:{item:NotificationItem}){
 const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[item.avatarUrl]);
 const initials=(item.actorName??'').trim().split(/\s+/).filter(Boolean).map(word=>word[0]).filter((_,index,all)=>index===0||index===all.length-1).join('').toUpperCase();
 return <span className="notification-person" title={item.actorName} aria-label={item.actorName?`Avatar of ${item.actorName}`:'Student avatar'}>{item.avatarUrl&&!failed?<img src={item.avatarUrl} alt="" onError={()=>setFailed(true)}/>:initials||<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6"/><path d="M4 21v-2a8 8 0 0 1 16 0v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>}</span>;
}
export function NotificationDetails({item}:{item:NotificationItem}){
 const summary=item.type==='CourseEnrolled'&&item.className&&!item.startAtUtc?'':notificationSummary(item);
 return <div className="notification-details"><div className="notification-actor"><NotificationAvatar item={item}/>{item.actorName&&<span>{item.actorName}</span>}</div>{item.className&&<p className="notification-class">{item.className}</p>}{summary&&summary!==item.className&&<p>{summary}</p>}</div>;
}
