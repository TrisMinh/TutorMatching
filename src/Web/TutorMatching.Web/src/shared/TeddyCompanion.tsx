import './teddy-companion.css';

// Decorative only: use once in a spacious empty state, never alongside another mascot.
export function TeddyCompanion({className=''}:{className?:string}) {
 return <img className={'teddy-companion '+className} src="/assets/illustrations/teddy-reading.webp" alt="" aria-hidden="true" width="560" height="560" loading="lazy" decoding="async"/>;
}
