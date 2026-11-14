export function MemberAvatars({count}:{count:number}) {
  const total=Math.max(0,Math.floor(count));
  const visible=Math.min(total,3);
  return <span className="legacy-avatars" aria-label={`${total} members`} title={`${total} members`}>
    {Array.from({length:visible},(_,index)=><img alt="" key={index} src={`/assets/figma/dashboard-avatar-${index+1}.png`}/>)}
    {total>visible?<span className="legacy-avatars__more" aria-label={`${total-visible} more members`}>+{total-visible}</span>:null}
  </span>;
}
