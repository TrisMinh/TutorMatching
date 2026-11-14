import {useId,useState} from 'react';
import './settings-companion.css';
const tips=[
 {title:'A little less admin. A little more teaching.',body:'Keep your preferences together, then get back to what you do best.'},
 {title:'Make room for your next great lesson.',body:'Check your teaching schedule to see courses and private bookings in one place.'},
 {title:'Your time deserves a little care.',body:'Add your available dates before students choose a lesson time.'},
];
export function SettingsCompanion(){
 const [tip,setTip]=useState(0);const [paused,setPaused]=useState(false);const id=useId().replaceAll(':','');
 return <aside className={`settings-companion ${paused?'is-paused':''}`} aria-label="Teach Buddy companion">
  <div className="companion-intro"><span className="companion-eyebrow"><span/> TEACH BUDDY</span><h2>Your space.<br/><em>Your pace.</em></h2><p>A little company while you make<br/>Teach. feel more like you.</p></div>
  <div className="companion-scene">
   <div className="companion-bubble" key={tip} aria-live="polite"><span className="bubble-spark" aria-hidden="true">✦</span><strong>{tips[tip].title}</strong><p>{tips[tip].body}</p><div className="companion-tip-dots" aria-hidden="true">{tips.map((_,index)=><i key={index} className={index===tip?'is-current':''}/>)}</div></div>
   <svg className="buddy-illustration" viewBox="0 0 560 410" fill="none" role="img" aria-label="Friendly blue and white robot waving beside a lesson planning computer">
    <defs>
     <linearGradient id={`${id}-shell`} x1="225" y1="170" x2="370" y2="300" gradientUnits="userSpaceOnUse"><stop stopColor="#fff"/><stop offset=".6" stopColor="#edf5ff"/><stop offset="1" stopColor="#b5d3fc"/></linearGradient>
     <linearGradient id={`${id}-blue`} x1="220" y1="230" x2="330" y2="360" gradientUnits="userSpaceOnUse"><stop stopColor="#559fff"/><stop offset="1" stopColor="#0765e8"/></linearGradient>
     <linearGradient id={`${id}-screen`} x1="100" y1="90" x2="320" y2="250" gradientUnits="userSpaceOnUse"><stop stopColor="#fdfefe"/><stop offset="1" stopColor="#e9f3ff"/></linearGradient>
     <linearGradient id={`${id}-face`} x1="240" y1="167" x2="348" y2="246" gradientUnits="userSpaceOnUse"><stop stopColor="#223c62"/><stop offset="1" stopColor="#102746"/></linearGradient>
     <filter id={`${id}-shadow`} x="-30%" y="-30%" width="170%" height="180%"><feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#3063ae" floodOpacity=".14"/></filter>
    </defs>
    <ellipse cx="294" cy="371" rx="196" ry="17" fill="#d8e8fb" opacity=".6"/>
    <g className="buddy-computer" transform="rotate(-7 200 180)">
     <rect x="75" y="73" width="256" height="192" rx="18" fill="#cadcf4"/>
     <rect x="80" y="68" width="256" height="190" rx="18" fill="white" stroke="#c5d9f6" strokeWidth="2"/>
     <rect x="93" y="82" width="230" height="158" rx="10" fill={`url(#${id}-screen)`}/>
     <circle cx="106" cy="94" r="3" fill="#ffbfba"/><circle cx="117" cy="94" r="3" fill="#ffdb84"/><circle cx="128" cy="94" r="3" fill="#90dfc1"/>
     <text x="109" y="120" fill="#738db0" fontSize="9" fontFamily="Arial,sans-serif" letterSpacing="2">LESSON PLAN</text>
     {[0,1,2].map((n)=><g key={n}><rect x="107" y={133+n*29} width="185" height="22" rx="6" fill="white"/><rect x="115" y={139+n*29} width="10" height="10" rx="3" fill={n===2?'#fff0cc':'#e3f6ef'}/>{n<2?<path d={`M118 ${144+n*29}l2 2 3-4`} stroke="#46b48d" strokeWidth="1.4" strokeLinecap="round"/>:<circle cx="120" cy={144+n*29} r="2" fill="#d5a740"/>}<rect x="135" y={140+n*29} width={92-n*16} height="4" rx="2" fill="#d6e4f6"/><rect x="135" y={147+n*29} width="54" height="3" rx="1.5" fill="#e9eff8"/></g>)}
     <path d="M181 258v40h52v-40" fill="#c2d8f5"/><path d="M164 300c0-7 6-12 13-12h60c7 0 13 5 13 12v3h-86v-3Z" fill="#d9e7f8"/>
    </g>
    <g className="buddy-note" transform="rotate(9 424 137)"><rect x="388" y="97" width="75" height="78" rx="10" fill="#fff1cb"/><rect x="413" y="91" width="28" height="12" rx="3" fill="#f6d687"/><path d="M406 121h38m-38 12h29m-29 12h34" stroke="#d5ba78" strokeWidth="3" strokeLinecap="round"/><path d="m430 157 5 5 9-11" stroke="#bc9a4d" strokeWidth="2" strokeLinecap="round"/></g>
    <g className="buddy-robot" filter={`url(#${id}-shadow)`}>
     <g className="buddy-wave"><path d="M351 277c25 0 37-20 44-44" stroke="#c4dcfc" strokeWidth="22" strokeLinecap="round"/><path d="M352 273c21 0 31-17 36-36" stroke="white" strokeWidth="12" strokeLinecap="round"/><rect x="375" y="204" width="32" height="39" rx="15" transform="rotate(20 375 204)" fill={`url(#${id}-shell)`}/><path d="m385 219 3-15m6 16 4-12" stroke="#a8c8f3" strokeWidth="3" strokeLinecap="round"/></g>
     <path d="M255 269c-29 7-39 28-36 50" stroke="#c1d9f9" strokeWidth="23" strokeLinecap="round"/><path d="M254 266c-23 8-33 26-30 46" stroke="white" strokeWidth="12" strokeLinecap="round"/>
     <rect x="259" y="320" width="28" height="36" rx="13" fill="#b7d4f8"/><rect x="313" y="320" width="28" height="36" rx="13" fill="#b7d4f8"/>
     <rect x="247" y="344" width="44" height="20" rx="10" fill="#f6faff"/><rect x="309" y="344" width="44" height="20" rx="10" fill="#f6faff"/>
     <rect x="246" y="249" width="107" height="91" rx="35" fill={`url(#${id}-blue)`}/><path d="M263 263c17-8 47-9 69 0" stroke="#92bfff" strokeWidth="4" strokeLinecap="round"/>
     <rect x="269" y="279" width="61" height="38" rx="15" fill="#dcecff"/><circle cx="299" cy="298" r="10" fill="white"/><path d="m294 298 4 4 7-8" stroke="#3e8cf2" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
     <path d="M296 151v-22" stroke="#8eb9ee" strokeWidth="6" strokeLinecap="round"/><circle className="buddy-antenna" cx="296" cy="124" r="10" fill="#53cfd3"/><circle cx="293" cy="121" r="3" fill="#b2ffff"/>
     <rect x="220" y="186" width="18" height="39" rx="9" fill="#78acf0"/><rect x="359" y="186" width="18" height="39" rx="9" fill="#78acf0"/>
     <rect x="232" y="151" width="132" height="108" rx="41" fill={`url(#${id}-shell)`}/><path d="M251 164c23-10 65-9 88 0" stroke="white" strokeWidth="5" strokeLinecap="round"/>
     <rect x="246" y="173" width="104" height="65" rx="25" fill={`url(#${id}-face)`}/>
     <g className="buddy-eyes"><rect x="265" y="193" width="11" height="17" rx="5.5" fill="#8cecf3"/><rect x="318" y="193" width="11" height="17" rx="5.5" fill="#8cecf3"/></g>
     <path d="M287 214q10 10 20 0" stroke="#8cecf3" strokeWidth="3" strokeLinecap="round"/>
     <ellipse cx="260" cy="215" rx="6" ry="3" fill="#ffb8c8" opacity=".7"/><ellipse cx="335" cy="215" rx="6" ry="3" fill="#ffb8c8" opacity=".7"/>
    </g>
    <g className="buddy-sparkles" stroke="#73a5ed" strokeWidth="2" strokeLinecap="round"><path d="M463 241v12m-6-6h12M183 302v10m-5-5h10"/><circle cx="429" cy="307" r="4"/><circle cx="138" cy="273" r="3" fill="#9ed5cd" stroke="none"/></g>
    <path d="M119 348h72m-60 9h48" stroke="#c2d9f6" strokeWidth="5" strokeLinecap="round"/>
   </svg>
   <button type="button" className="companion-hello" aria-label="Say hello to Teach Buddy" onClick={()=>setTip(v=>(v+1)%tips.length)}>Say hello <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
  </div>
  <footer className="companion-footer"><span><i/> A little help. A lot of heart.</span><button type="button" aria-label={paused?'Play companion animation':'Pause companion animation'} aria-pressed={paused} onClick={()=>setPaused(v=>!v)}>{paused?<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="m5 3 8 5-8 5V3Z"/></svg>:<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 3h3v10H4zm5 0h3v10H9z"/></svg>}</button></footer>
 </aside>;
}
