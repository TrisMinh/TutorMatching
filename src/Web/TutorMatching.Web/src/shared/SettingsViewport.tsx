import {useLayoutEffect,useRef,type ReactNode} from 'react';

// Preserve the illustration and form proportions; scale the composition only when needed.
export function SettingsViewport({children}:{children:ReactNode}){
 const root=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const viewport=root.current!;const layout=viewport.firstElementChild as HTMLElement;
  function fit(){
   if(innerWidth<=850){layout.style.removeProperty('width');layout.style.removeProperty('zoom');return;}
   const width=Math.min(viewport.clientWidth,1440);
   layout.style.width=`${width}px`;
   const available=Math.max(1,innerHeight-viewport.getBoundingClientRect().top-24);
   const scale=Math.min(1,available/layout.offsetHeight);
   layout.style.zoom=String(scale);
  }
  fit();const observer=new ResizeObserver(fit);observer.observe(viewport);observer.observe(layout);window.addEventListener('resize',fit);
  return()=>{observer.disconnect();window.removeEventListener('resize',fit);};
 },[]);
 return <div ref={root} className="settings-fit-viewport">{children}</div>;
}
