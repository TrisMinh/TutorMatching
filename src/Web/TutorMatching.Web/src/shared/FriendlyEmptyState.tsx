import type {ReactNode} from 'react';
import {MotionLink} from './MotionLink';
import './friendly-empty-state.css';

type Kind='calendar'|'bell'|'search'|'book';
export function FriendlyIllustration({kind='calendar'}:{kind?:Kind}){
 return <svg className="friendly-empty-art" viewBox="0 0 240 160" fill="none" aria-hidden="true" focusable="false">
  <ellipse cx="120" cy="79" rx="89" ry="65" fill="#eff6ff"/><ellipse cx="120" cy="145" rx="64" ry="7" fill="#e0ebfb"/>
  <g strokeLinecap="round"><path d="m40 48 2 8m-5-4 8 1m148 42 2 8m-5-4 8 1" stroke="#edbd67" strokeWidth="3"/><path d="m192 40 4-4M51 114l-4 4" stroke="#92bbf8" strokeWidth="3"/><circle cx="179" cy="120" r="3" fill="#86d9c1"/><circle cx="62" cy="28" r="3" fill="#accbfa"/></g>
  {kind==='calendar'?<><rect x="70" y="41" width="100" height="96" rx="17" fill="white" stroke="#b9d5fa" strokeWidth="2"/><path d="M71 59q0-17 17-17h64q17 0 17 17v13H71Z" fill="#dcecff"/><path d="M91 33v18m58-18v18" stroke="#5097f1" strokeWidth="6" strokeLinecap="round"/><rect x="85" y="83" width="17" height="15" rx="4" fill="#ebf3ff"/><rect x="138" y="83" width="17" height="15" rx="4" fill="#e3f5ee"/><path d="m88 126-6 12m70-12 6 12" stroke="#7caaf0" strokeWidth="5" strokeLinecap="round"/></>:kind==='bell'?<><path d="M79 108c13-11 8-21 11-41a30 30 0 0 1 60 0c3 20-2 30 11 41q4 8-6 8H85q-10 0-6-8Z" fill="#fff1cf" stroke="#e4ba62" strokeWidth="2"/><path d="M110 122q10 13 20 0" fill="#efc56f"/><path d="M120 32v-5" stroke="#d5a347" strokeWidth="6" strokeLinecap="round"/><path d="M72 54q-9 11-8 23m104-23q9 11 8 23" stroke="#f0ce8c" strokeWidth="3" strokeLinecap="round"/></>:kind==='search'?<><path d="m139 103 28 29" stroke="#74a9ed" strokeWidth="17" strokeLinecap="round"/><circle cx="110" cy="76" r="44" fill="#d9ecff" stroke="#5296eb" strokeWidth="4"/><circle cx="110" cy="76" r="34" fill="white"/><path d="M85 63q7-13 18-14" stroke="#e5f1ff" strokeWidth="5" strokeLinecap="round"/></>:<><rect x="76" y="35" width="90" height="102" rx="12" fill="#5e9ff3"/><path d="M90 33h63a10 10 0 0 1 10 10v81H91a8 8 0 0 1-8-8V40a7 7 0 0 1 7-7Z" fill="white" stroke="#c4dcfa" strokeWidth="2"/><path d="M137 34v23l-6-4-6 4V34" fill="#87d7c0"/><path d="M87 129h73" stroke="#c4dcfa" strokeWidth="3" strokeLinecap="round"/></>}
  <g transform={kind==='search'?'translate(-10 -8)':''}><path d="M104 83v4m30-4v4" stroke="#294c79" strokeWidth="4" strokeLinecap="round"/><path d="M112 96q7 8 14 0" stroke="#294c79" strokeWidth="2.6" strokeLinecap="round"/><ellipse cx="97" cy="94" rx="5" ry="3" fill="#ffc4be"/><ellipse cx="141" cy="94" rx="5" ry="3" fill="#ffc4be"/></g>
 </svg>;
}
export function FriendlyEmptyState({kind='calendar',title,description,action,secondary,compact=false}:{kind?:Kind;title:string;description:string;action?:{label:string;to?:string;onClick?:()=>void};secondary?:ReactNode;compact?:boolean}){
 return <section className={'friendly-empty-state'+(compact?' friendly-empty-state--compact':'')}>
  <FriendlyIllustration kind={kind}/><h3>{title}</h3><p>{description}</p>
  {action||secondary?<div className="friendly-empty-actions">{action?.to?<MotionLink className="friendly-empty-action" to={action.to}>{action.label}<span aria-hidden="true">→</span></MotionLink>:action?<button className="friendly-empty-action" type="button" onClick={action.onClick}>{action.label}</button>:null}{secondary}</div>:null}
 </section>;
}
