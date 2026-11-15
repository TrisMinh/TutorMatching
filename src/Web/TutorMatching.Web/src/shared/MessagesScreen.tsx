import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {useSearchParams} from 'react-router-dom';
import {gatewayClient,type Conversation,type ChatMessage} from '../api';
import {AppShell} from './AppShell';
import {FriendlyEmptyState} from './FriendlyEmptyState';
import {MotionLink} from './MotionLink';
import {Button} from '../design-system/Button';
import './messages.css';

const errorText=(error:unknown)=>error instanceof Error?error.message:'Unable to load messages. Try again.';
const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase();
const clock=(value:string)=>new Date(value).toLocaleTimeString('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'});
const day=(value:string)=>new Date(value).toLocaleDateString('en-GB',{timeZone:'Asia/Ho_Chi_Minh',day:'numeric',month:'short',year:'numeric'});
function mergeMessages(current:ChatMessage[],incoming:ChatMessage[]){return [...new Map([...current,...incoming].map(item=>[item.id,item])).values()].sort((a,b)=>a.id-b.id);}

export function MessagesScreen({mode='student'}:{mode?:'student'|'tutor'}){
 const [params,setParams]=useSearchParams(),id=params.get('conversation')??'',tutorId=params.get('tutor');
 const [conversations,setConversations]=useState<Conversation[]>([]),[total,setTotal]=useState(0),[pages,setPages]=useState(1);
 const [inboxLoading,setInboxLoading]=useState(true),[inboxError,setInboxError]=useState('');
 const [thread,setThread]=useState<Conversation|null>(null),[messages,setMessages]=useState<ChatMessage[]>([]);
 const [threadLoading,setThreadLoading]=useState(false),[threadError,setThreadError]=useState(''),[starting,setStarting]=useState(false),[startError,setStartError]=useState(''),[startAttempt,setStartAttempt]=useState(0);
 const [hasOlder,setHasOlder]=useState(false),[olderBusy,setOlderBusy]=useState(false),[attempt,setAttempt]=useState(0);
 const [drafts,setDrafts]=useState<Record<string,string>>({}),[sending,setSending]=useState(false),[sendError,setSendError]=useState('');
 const activeId=useRef(id);activeId.current=id;
 const list=useRef<HTMLDivElement>(null),tail=useRef<HTMLDivElement>(null),atBottom=useRef(true);
 const pending=useRef<{id:string;body:string;key:string}|undefined>(undefined);
 const draft=drafts[id]??'';
 const open=(value:string)=>setParams({conversation:value});
 const reloadInbox=useCallback(async()=>{
  const results=await Promise.all(Array.from({length:pages},(_,index)=>gatewayClient.listConversations(index+1)));
  setConversations([...new Map(results.flatMap(result=>result.items).map(item=>[item.id,item])).values()]);setTotal(results[0].total);setInboxError('');
 },[pages]);
 useEffect(()=>{
  let active=true,busy=false;
  async function refresh(){if(busy||document.visibilityState==='hidden')return;busy=true;try{const results=await Promise.all(Array.from({length:pages},(_,index)=>gatewayClient.listConversations(index+1)));if(active){setConversations([...new Map(results.flatMap(result=>result.items).map(item=>[item.id,item])).values()]);setTotal(results[0].total);setInboxError('');}}catch(error){if(active)setInboxError(errorText(error));}finally{busy=false;if(active)setInboxLoading(false);}}
  void refresh();const timer=setInterval(()=>void refresh(),8000);
  window.addEventListener('messages-updated',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('messages-updated',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[pages]);
 useEffect(()=>{
  if(!tutorId||mode!=='student')return;
  let active=true;setStarting(true);setStartError('');
  gatewayClient.startConversation(tutorId).then(conversation=>{if(active){setParams({conversation:conversation.id},{replace:true});void reloadInbox().catch(()=>{});}}).catch(error=>{if(active)setStartError(errorText(error));}).finally(()=>{if(active)setStarting(false);});
  return()=>{active=false;};
 },[tutorId,mode,setParams,reloadInbox,startAttempt]);
 useEffect(()=>{
  let active=true,busy=false,lastId=0,readThrough=0;
  setMessages([]);setThread(null);setThreadError('');setSendError('');setHasOlder(false);setThreadLoading(!!id);atBottom.current=true;
  if(!id)return;
  async function read(last:number){if(!last||last<=readThrough||document.visibilityState==='hidden'||!atBottom.current)return;await gatewayClient.markMessagesRead(id,last);if(!active)return;readThrough=last;setConversations(current=>current.map(c=>c.id===id?{...c,unreadCount:0}:c));window.dispatchEvent(new Event('messages-updated'));}
  async function refresh(initial=false){
   if(busy||(!initial&&document.visibilityState==='hidden'))return;busy=true;
   try{
    if(initial){
     const [conversation,page]=await Promise.all([gatewayClient.getConversation(id),gatewayClient.getMessages(id)]);if(!active)return;
     setThread(conversation);setMessages(page.items);setHasOlder(page.hasMore);lastId=page.items.at(-1)?.id??0;
     requestAnimationFrame(()=>{if(active)tail.current?.scrollIntoView({block:'nearest'});});
    }else{
     for(let batch=0;batch<10;batch++){
      const page=await gatewayClient.getMessages(id,{after:lastId});if(!active)return;
      if(page.items.length){lastId=page.items.at(-1)!.id;setMessages(current=>mergeMessages(current,page.items));if(atBottom.current)requestAnimationFrame(()=>{if(active)tail.current?.scrollIntoView({block:'nearest'});});}
      if(!page.hasMore)break;
     }
    }
    await read(lastId);if(active)setThreadError('');
   }catch(error){if(active)setThreadError(errorText(error));}finally{busy=false;if(active)setThreadLoading(false);}
  }
  void refresh(true);const timer=setInterval(()=>void refresh(),3000);
  const visible=()=>{if(document.visibilityState==='visible')void refresh();};document.addEventListener('visibilitychange',visible);
  return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[id,attempt]);
 async function older(){
  if(!id||!messages.length||olderBusy)return;const selected=id,oldHeight=list.current?.scrollHeight??0;setOlderBusy(true);
  try{const page=await gatewayClient.getMessages(id,{before:messages[0].id});if(activeId.current!==selected)return;setMessages(current=>mergeMessages(page.items,current));setHasOlder(page.hasMore);requestAnimationFrame(()=>{if(list.current)list.current.scrollTop+=list.current.scrollHeight-oldHeight;});}catch(error){if(activeId.current===selected)setThreadError(errorText(error));}finally{setOlderBusy(false);}
 }
 async function send(event?:FormEvent){
  event?.preventDefault();const body=draft.trim(),selected=id;
  if(!body||body.length>2000||sending||!thread||threadLoading)return;
  const key=pending.current?.id===id&&pending.current.body===body?pending.current.key:crypto.randomUUID();pending.current={id,body,key};setSending(true);setSendError('');
  try{
   const message=await gatewayClient.sendMessage(id,body,key);
   setDrafts(current=>({...current,[selected]:current[selected]?.trim()===body?'':current[selected]}));pending.current=undefined;
   if(activeId.current===selected){setMessages(current=>mergeMessages(current,[message]));atBottom.current=true;requestAnimationFrame(()=>tail.current?.scrollIntoView({block:'nearest'}));}
   window.dispatchEvent(new Event('messages-updated'));
  }catch(error){if(activeId.current===selected)setSendError(errorText(error));}finally{setSending(false);}
 }
 return <AppShell active="messages" mode={mode} title="Messages" contentClassName="messages-page">
  <div className={'messages-workspace'+(id||(tutorId&&mode==='student')?' has-thread':'')}>
   <aside className="messages-inbox" aria-label="Conversations"><header><div><span className="messages-eyebrow">Stay connected</span><h2>Your conversations</h2></div>{mode==='student'?<MotionLink to="/student/find-tutors" className="messages-new-link">Find a tutor</MotionLink>:null}</header>
    {inboxError?<div className="messages-error" role="alert"><p>{inboxError}</p><Button variant="secondary" onClick={()=>void reloadInbox().catch(error=>setInboxError(errorText(error)))}>Retry inbox</Button></div>:null}
    {inboxLoading?<p className="messages-loading" role="status">Loading conversations…</p>:!conversations.length&&!inboxError?<FriendlyEmptyState compact kind="book" title="A conversation starts here" description={mode==='student'?'Ask a tutor about a subject or a lesson before you book.':'Students can contact you from your profile. Their messages will appear here.'} action={mode==='student'?{label:'Find a tutor',to:'/student/find-tutors'}:undefined}/>:<ul className="messages-conversation-list">{conversations.map(conversation=><li key={conversation.id}><button type="button" className={id===conversation.id?'is-selected':''} onClick={()=>open(conversation.id)} aria-current={id===conversation.id?'true':undefined}><span className="message-avatar" aria-hidden="true">{initials(conversation.peerName)}</span><span className="conversation-text"><strong>{conversation.peerName}</strong><span>{conversation.lastMessage??'Say hello and start learning together.'}</span></span>{conversation.unreadCount>0?<span className="conversation-unread" aria-label={conversation.unreadCount+' unread'}>{conversation.unreadCount}</span>:null}</button></li>)}</ul>}
    {conversations.length<total?<Button variant="secondary" onClick={()=>setPages(value=>value+1)}>More conversations</Button>:null}
   </aside>
   <section className="messages-thread" aria-label="Message conversation">
    {starting?<p className="messages-loading" role="status">Opening conversation…</p>:startError?<div className="messages-error" role="alert"><p>{startError}</p><Button onClick={()=>setStartAttempt(value=>value+1)}>Try again</Button><Button variant="secondary" onClick={()=>setParams({})}>Back to conversations</Button></div>:!id?<div className="messages-welcome"><FriendlyEmptyState kind="book" title="A little hello goes a long way" description="Choose a conversation to talk about learning goals, available times and your next lesson."/></div>:<>
     <header className="messages-thread-header"><button className="messages-back" type="button" onClick={()=>setParams({})} aria-label="Back to conversations">←</button><span className="message-avatar" aria-hidden="true">{thread?initials(thread.peerName):'…'}</span><div><h2>{thread?.peerName??'Conversation'}</h2><p>{thread?thread.peerRole+' · Messages update automatically':'Loading conversation…'}</p></div>{thread&&mode==='student'?<MotionLink className="messages-profile-link" to={'/student/tutors/'+thread.tutorId}>View profile</MotionLink>:null}</header>
     {threadError?<div className="messages-error" role="alert"><p>{threadError}</p><Button variant="secondary" onClick={()=>setAttempt(value=>value+1)}>Retry messages</Button></div>:null}
     <div className="messages-history" ref={list} role="log" aria-label="Message history" aria-live="polite" aria-relevant="additions" onScroll={()=>{if(list.current)atBottom.current=list.current.scrollHeight-list.current.scrollTop-list.current.clientHeight<80;}}>
      {threadLoading?<p role="status">Loading messages…</p>:messages.length===0&&!threadError?<div className="messages-first-note"><span aria-hidden="true">♡</span><h3>Start with a hello</h3><p>Share what you’d like to learn or ask about a suitable time.</p></div>:null}
      {hasOlder?<button className="messages-load-older" type="button" disabled={olderBusy} onClick={()=>void older()}>{olderBusy?'Loading…':'Load earlier messages'}</button>:null}
      {messages.map((message,index)=><div className="message-entry" key={message.id}>{(!index||day(messages[index-1].createdAtUtc)!==day(message.createdAtUtc))?<p className="message-day">{day(message.createdAtUtc)}</p>:null}<article className={'message-bubble '+(message.isMine?'is-mine':'is-peer')}><p>{message.body}</p><time dateTime={message.createdAtUtc}>{clock(message.createdAtUtc)}{message.isMine?' · Sent':''}</time></article></div>)}<div ref={tail}/>
     </div>
     <form className="messages-composer" onSubmit={event=>void send(event)}>
      {sendError?<p className="messages-send-error" role="alert">{sendError} Your draft is kept. Try sending again.</p>:null}
      <div><label className="sr-only" htmlFor="message-draft">Message</label><textarea id="message-draft" rows={2} maxLength={2000} placeholder="Write a message…" value={draft} disabled={!thread||threadLoading} onChange={event=>setDrafts(current=>({...current,[id]:event.target.value}))} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void send();}}}/><Button type="submit" disabled={!draft.trim()||sending||!thread||threadLoading}>{sending?'Sending…':'Send'}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m3 3 19 9-19 9 4-9-4-9Zm4 9h15" strokeLinejoin="round"/></svg></Button></div>
      <p>Enter to send · Shift + Enter for a new line <span>{draft.length}/2000</span></p>
     </form>
    </>}
   </section>
  </div>
 </AppShell>;
}
