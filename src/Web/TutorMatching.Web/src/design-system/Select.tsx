import {Children,isValidElement,useEffect,useId,useLayoutEffect,useRef,useState,type SelectHTMLAttributes,type ReactElement,type ChangeEvent} from 'react';
import {createPortal} from 'react-dom';
import './select.css';
export function Select({children,value,defaultValue,onChange,id,className='',disabled,...props}:SelectHTMLAttributes<HTMLSelectElement>){
 const generated=useId();const menuId=`${generated}-options`;
 const options=Children.toArray(children).flatMap(child=>isValidElement(child)?[child as ReactElement<{value:string;children:string;disabled?:boolean}>]:[]);
 const [internal,setInternal]=useState(String(defaultValue??options[0]?.props.value??''));
 const current=String(value??internal);const [open,setOpen]=useState(false);const [active,setActive]=useState(0);
 const [position,setPosition]=useState({left:0,top:0,width:0,maxHeight:280});
 const button=useRef<HTMLButtonElement>(null);const menu=useRef<HTMLDivElement>(null);const search=useRef('');const lastType=useRef(0);
 useLayoutEffect(()=>{
  if(!open)return;
  const place=()=>{const rect=button.current!.getBoundingClientRect();const below=innerHeight-rect.bottom-16;const above=rect.top-16;const height=Math.min(280,Math.max(below,above));setPosition({left:Math.max(8,Math.min(rect.left,innerWidth-rect.width-8)),top:below>=Math.min(180,above)?rect.bottom+6:Math.max(8,rect.top-height-6),width:Math.min(Math.max(rect.width,210),innerWidth-16),maxHeight:height});};
  place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  const close=(e:PointerEvent)=>{if(!button.current?.contains(e.target as Node)&&!menu.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);
  return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);document.removeEventListener('pointerdown',close);};
 },[open]);
 useEffect(()=>{if(open)menu.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({block:'nearest'});},[active,open]);
 function choose(index:number){const option=options[index];if(!option||option.props.disabled)return;const next=String(option.props.value);setInternal(next);onChange?.({target:{value:next},currentTarget:{value:next}} as ChangeEvent<HTMLSelectElement>);setOpen(false);button.current?.focus();}
 return <><button {...{'aria-label':props['aria-label'],'aria-describedby':props['aria-describedby'],'aria-invalid':props['aria-invalid']}} ref={button} id={id} className={`tm-select ${className}`} type="button" role="combobox" aria-expanded={open} aria-controls={menuId} aria-haspopup="listbox" aria-activedescendant={open?`${menuId}-${active}`:undefined} disabled={disabled} onClick={()=>{setActive(Math.max(0,options.findIndex(o=>String(o.props.value)===current)));setOpen(v=>!v);}} onKeyDown={e=>{
  if(e.key==='Escape'){setOpen(false);return;}if(e.key==='Tab'){setOpen(false);return;}
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();setOpen(true);setActive(index=>{const direction=e.key==='ArrowUp'?-1:1;let next=e.key==='Home'?0:e.key==='End'?options.length-1:Math.max(0,Math.min(options.length-1,index+direction));while(options[next]?.props.disabled&&next>=0&&next<options.length)next+=direction;return Math.max(0,Math.min(options.length-1,next));});}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();if(open)choose(active);else{setActive(Math.max(0,options.findIndex(o=>String(o.props.value)===current)));setOpen(true);}}
  else if(e.key.length===1){search.current=Date.now()-lastType.current>700?e.key:search.current+e.key;lastType.current=Date.now();const index=options.findIndex(o=>!o.props.disabled&&String(o.props.children).toLowerCase().startsWith(search.current.toLowerCase()));if(index>=0){setActive(index);setOpen(true);}}
 }}><span>{options.find(o=>String(o.props.value)===current)?.props.children??current}</span><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>{open&&createPortal(<div ref={menu} id={menuId} role="listbox" aria-label={props['aria-label']??'Options'} className="tm-select-menu" style={position}>{options.map((option,index)=><div role="option" id={`${menuId}-${index}`} key={`${option.props.value}-${index}`} data-index={index} aria-selected={String(option.props.value)===current} aria-disabled={option.props.disabled} className={active===index?'is-focused':''} onPointerDown={e=>e.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>choose(index)}><span>{option.props.children}</span>{String(option.props.value)===current&&<span aria-hidden="true">✓</span>}</div>)}</div>,document.body)}</>;
}
