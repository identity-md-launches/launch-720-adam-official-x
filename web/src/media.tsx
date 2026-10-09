import { useEffect, useRef, useState, type ReactNode } from 'react';
// Presentation-only helpers: icons, scroll reveal, count-up numbers and the locally hosted videos.
// Nothing here touches contracts, wallets or RPC configuration.
const paths:Record<string,ReactNode>={
 x:<path d="M4 4l16 16M20 4L4 20"/>,
 copy:<><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/></>,
 check:<path d="M5 12l4 4L19 7"/>,
 external:<><path d="M14 5h5v5M19 5l-8 8"/><path d="M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4"/></>,
 arrow:<path d="M5 12h14M13 6l6 6-6 6"/>,
 play:<path d="M7 5v14l12-7z"/>,
 pause:<path d="M8 5v14M16 5v14"/>,
 sound:<><path d="M4 10v4h4l5 4V6l-5 4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></>,
 muted:<><path d="M4 10v4h4l5 4V6l-5 4z"/><path d="M17 9l4 6M21 9l-4 6"/></>,
 wallet:<><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 14h2"/></>,
 refresh:<><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/></>,
 bolt:<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>,
 logo:<><path d="M4 20L12 4l8 16"/><path d="M8 14h8"/></>,
 spark:<path d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18"/>,
 menu:<path d="M4 7h16M4 12h16M4 17h16"/>,
 close:<path d="M6 6l12 12M18 6L6 18"/>,
};
export function Icon({name,size=18}:{name:keyof typeof paths;size?:number}){return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill={name==='play'?'currentColor':'none'} stroke={name==='play'?'none':'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;}
export const XLogo=({size=18}:{size?:number})=><svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M18.2 2h3.4l-7.4 8.5L23 22h-6.8l-5.3-7-6.1 7H1.4l7.9-9.1L1 2h7l4.8 6.4zm-1.2 18h1.9L7.1 3.9H5.1z"/></svg>;
function useMedia(query:string){const [match,setMatch]=useState(()=>typeof matchMedia==='function'&&matchMedia(query).matches);useEffect(()=>{const m=matchMedia(query);const on=()=>setMatch(m.matches);on();m.addEventListener('change',on);return()=>m.removeEventListener('change',on);},[query]);return match;}
export const useReducedMotion=()=>useMedia('(prefers-reduced-motion: reduce)');
export const useCompact=()=>useMedia('(max-width: 767px)');
// Scroll reveal: elements with data-reveal fade/slide in once. Reduced motion shows them immediately through CSS.
export function useReveal(dependency:unknown){useEffect(()=>{const nodes=Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)'));if(!nodes.length)return;if(!('IntersectionObserver' in window)){nodes.forEach(n=>n.classList.add('is-in'));return;}const io=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.add('is-in');io.unobserve(e.target);}},{rootMargin:'0px 0px -8% 0px',threshold:.1});nodes.forEach(n=>io.observe(n));return()=>io.disconnect();},[dependency]);}
// Count-up number. Animates from zero the first time the element is visible, then follows value changes instantly.
export function Count({value,render}:{value:number|undefined;render:(n:number)=>string}){
 const ref=useRef<HTMLSpanElement>(null);const [shown,setShown]=useState<number|undefined>(undefined);const played=useRef(false);const reduced=useReducedMotion();
 useEffect(()=>{if(value===undefined){setShown(undefined);return;}if(played.current||reduced||!('IntersectionObserver' in window)){played.current=true;setShown(value);return;}const el=ref.current;if(!el)return;let frame=0;const io=new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))return;io.disconnect();played.current=true;const start=performance.now(),duration=1100;const tick=(t:number)=>{const p=Math.min(1,(t-start)/duration);const eased=1-Math.pow(1-p,3);setShown(value*eased);if(p<1)frame=requestAnimationFrame(tick);else setShown(value);};frame=requestAnimationFrame(tick);},{threshold:.3});io.observe(el);return()=>{io.disconnect();cancelAnimationFrame(frame);};},[value,reduced]);
 return <span ref={ref} className="count">{shown===undefined?(value===undefined?'—':render(value)):render(shown)}</span>;
}
const video=(name:string)=>({mp4:`./video/${name}.mp4`,webm:`./video/${name}.webm`,poster:`./video/${name}.jpg`});
// Hero background. Autoplays muted and looped on wide screens; posters replace autoplay on compact screens and under reduced motion.
export function HeroVideo(){
 const compact=useCompact(),reduced=useReducedMotion();const ref=useRef<HTMLVideoElement>(null);const [paused,setPaused]=useState(false);const src=video('hero');
 const still=compact||reduced;
 useEffect(()=>{const v=ref.current;if(!v||still)return;if(paused)v.pause();else v.play().catch(()=>{});},[paused,still]);
 if(still)return <img className="hero-media" src={src.poster} srcSet="./video/hero-480.jpg 480w, ./video/hero.jpg 960w" sizes="100vw" alt="" width="960" height="540" fetchPriority="high" decoding="async"/>;
 return <>
  <video ref={ref} className="hero-media" autoPlay muted loop playsInline preload="metadata" poster={src.poster} aria-hidden="true" tabIndex={-1} disablePictureInPicture><source src={src.webm} type="video/webm"/><source src={src.mp4} type="video/mp4"/></video>
  <button type="button" className="hero-pause" aria-pressed={paused} onClick={()=>setPaused(p=>!p)}><Icon name={paused?'play':'pause'} size={16}/>{paused?'Play background':'Pause background'}</button>
 </>;
}
// Watch card: poster first, plays on hover or tap, muted by default with a sound toggle, links to the original X post.
export function WatchCard({name,title,text,href,orientation='portrait'}:{name:string;title:string;text:string;href:string;orientation?:'portrait'|'landscape'}){
 const ref=useRef<HTMLVideoElement>(null);const [playing,setPlaying]=useState(false);const [muted,setMuted]=useState(true);const reduced=useReducedMotion();const src=video(name);
 const play=()=>{const v=ref.current;if(!v)return;v.muted=muted;v.play().then(()=>setPlaying(true)).catch(()=>setPlaying(false));};
 const pause=()=>{ref.current?.pause();setPlaying(false);};
 const toggle=()=>playing?pause():play();
 useEffect(()=>{if(ref.current)ref.current.muted=muted;},[muted]);
 return <article className={`watch-card ${orientation}`} data-reveal>
  <div className="watch-frame" onMouseEnter={reduced?undefined:play} onMouseLeave={reduced?undefined:pause}>
   <video ref={ref} poster={src.poster} preload="none" playsInline loop muted onClick={toggle} aria-hidden="true" tabIndex={-1} onPause={()=>setPlaying(false)} onPlay={()=>setPlaying(true)}><source src={src.webm} type="video/webm"/><source src={src.mp4} type="video/mp4"/></video>
   <div className={`watch-overlay ${playing?'is-playing':''}`}>
    <button type="button" className="watch-play" onClick={toggle} aria-pressed={playing} aria-label={`${playing?'Pause':'Play'} video: ${title}`}><Icon name={playing?'pause':'play'} size={28}/></button>
   </div>
   <div className="watch-tools">
    <button type="button" className="chip-button" onClick={()=>setMuted(m=>!m)} aria-pressed={!muted}><Icon name={muted?'muted':'sound'} size={16}/>{muted?'Sound off':'Sound on'}</button>
   </div>
  </div>
  <div className="watch-meta"><div><h3>{title}</h3><p>{text}</p></div><a className="button ghost" href={href} target="_blank" rel="noopener noreferrer"><XLogo size={16}/>Open on X<span className="sr-only"> (opens in a new tab)</span></a></div>
 </article>;
}
