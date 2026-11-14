import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import './toast.css';
export function Toast({message,tone='success',onClose}:{message:string;tone?:'success'|'error';onClose:()=>void}){
 const [closing,setClosing]=useState(false);
 useEffect(()=>{const hide=window.setTimeout(()=>setClosing(true),2800);const finish=window.setTimeout(onClose,3000);return()=>{clearTimeout(hide);clearTimeout(finish);};},[message,onClose]);
 return createPortal(<div className={`app-toast app-toast--${tone} ${closing?'is-leaving':''}`} role={tone==='error'?'alert':'status'}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/>{tone==='success'?<path d="m8 12 3 3 5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>:<path d="M12 7v6m0 3v1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>}</svg><p>{message}</p><button aria-label="Dismiss notification" onClick={onClose} type="button">×</button><span className="app-toast-progress"/></div>,document.body);
}
