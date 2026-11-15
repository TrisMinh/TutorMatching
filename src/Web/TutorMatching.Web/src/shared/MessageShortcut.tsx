import {useEffect,useState} from 'react';
import {gatewayClient} from '../api';
import {MotionLink} from './MotionLink';
import './messages.css';

export function MessageShortcut({mode}:{mode:'student'|'tutor'}){
 const [count,setCount]=useState(0);
 useEffect(()=>{
  let active=true,busy=false;
  const refresh=async()=>{if(busy||document.visibilityState==='hidden')return;busy=true;try{const value=await gatewayClient.unreadMessages();if(active)setCount(value.count);}catch{/* Keep navigation usable during a temporary outage. */}finally{busy=false;}};
  void refresh();const timer=setInterval(()=>void refresh(),12000);
  window.addEventListener('messages-updated',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('messages-updated',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[]);
 return <MotionLink className="message-shortcut" to={'/'+mode+'/messages'} aria-label="Messages"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20 14a4 4 0 0 1-4 4h-4l-5 3v-3a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4Z" strokeLinejoin="round"/><path d="M7 8h9M7 12h6" strokeLinecap="round"/></svg>{count>0?<span className="message-unread-badge" aria-label={count+' unread messages'}>{count>99?'99+':count}</span>:null}</MotionLink>;
}
