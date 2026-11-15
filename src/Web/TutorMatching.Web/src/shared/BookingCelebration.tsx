import {useId} from 'react';

export function BookingCelebration(){
 const id=useId().replaceAll(':','');
 return <svg className="booking-success-art" viewBox="0 0 280 180" fill="none" aria-hidden="true">
  <defs><linearGradient id={id+'-book'} x1="96" y1="66" x2="171" y2="160" gradientUnits="userSpaceOnUse"><stop stopColor="#4da1ff"/><stop offset="1" stopColor="#0875f5"/></linearGradient><linearGradient id={id+'-paper'} x1="111" y1="58" x2="179" y2="144" gradientUnits="userSpaceOnUse"><stop stopColor="white"/><stop offset="1" stopColor="#e8f3ff"/></linearGradient></defs>
  <ellipse cx="140" cy="91" rx="102" ry="75" fill="#f0f7ff"/>
  <ellipse cx="140" cy="163" rx="78" ry="8" fill="#dfeaff"/>
  <g className="booking-art-confetti" strokeLinecap="round"><path d="m51 55-6-5m177 65 7 3M72 122l-5 5m127-96 3-7" stroke="#72aaff" strokeWidth="4"/><path d="m66 34 2 10m-5-6 9 2m158 37 1 10m-6-5 10 1" stroke="#f4bf61" strokeWidth="3"/><circle cx="211" cy="49" r="4" fill="#83d6bd"/><circle cx="47" cy="102" r="3" fill="#9ac5ff"/><circle cx="185" cy="145" r="3" fill="#f0c266"/></g>
  <g transform="rotate(9 195 74)"><rect x="166" y="35" width="67" height="77" rx="12" fill="white" stroke="#cbdff7" strokeWidth="2"/><path d="M166 55h67" stroke="#d8e6f8" strokeWidth="2"/><path d="M182 29v13m35-13v13" stroke="#88b4ed" strokeWidth="5" strokeLinecap="round"/><circle cx="199" cy="81" r="18" fill="#e0f7ed"/><path d="m190 81 6 6 12-13" stroke="#239c70" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></g>
  <g className="booking-art-buddy"><path d="M98 109c-16 0-24-9-29-18" stroke="#3289f5" strokeWidth="10" strokeLinecap="round"/><path d="m66 92-3-10m6 7 3-9" stroke="#3289f5" strokeWidth="5" strokeLinecap="round"/><path d="M172 109c12 0 19-9 24-17" stroke="#3289f5" strokeWidth="10" strokeLinecap="round"/><path d="m195 94 7-7m-5 5 2-11" stroke="#3289f5" strokeWidth="5" strokeLinecap="round"/>
   <path d="M103 57h61a10 10 0 0 1 10 10v75a10 10 0 0 1-10 10h-61a12 12 0 0 1-12-12V69a12 12 0 0 1 12-12Z" fill={'url(#'+id+'-book)'} stroke="#1678eb" strokeWidth="2"/>
   <path d="M106 55h56a10 10 0 0 1 10 10v72h-66a7 7 0 0 1-7-7V62a7 7 0 0 1 7-7Z" fill={'url(#'+id+'-paper)'} stroke="#c8e0ff" strokeWidth="2"/>
   <path d="M101 140h65m-65 5h65" stroke="#cee3ff" strokeWidth="2" strokeLinecap="round"/>
   <path d="M157 56v22l-6-4-6 4V56" fill="#7bd5bc"/>
   <path d="M116 91v5m29-5v5" stroke="#183e75" strokeWidth="4.5" strokeLinecap="round"/>
   <path d="M124 104q7 9 14 0" stroke="#183e75" strokeWidth="3" strokeLinecap="round"/>
   <ellipse cx="110" cy="103" rx="5" ry="3" fill="#ffbfbd"/><ellipse cx="151" cy="103" rx="5" ry="3" fill="#ffbfbd"/>
   <path d="m116 152-2 8h-9m46-8 2 8h9" stroke="#2479dd" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
  </g>
 </svg>;
}
