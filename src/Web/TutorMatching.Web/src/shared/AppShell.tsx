import {MessageShortcut} from './MessageShortcut';
import {CourseTicker} from './CourseTicker';
import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import { Outlet } from 'react-router-dom';
import { gatewayClient } from '../api';
import { BrandMark } from '../design-system/BrandMark';
import { MotionLink, MotionNavLink, useMotionNavigate } from './MotionLink';
import { NotificationDropdown } from './NotificationDropdown';
import './status-colors.css';
import { GlobalSearch } from './GlobalSearch';

type AppShellProps = {
  active: string;
  children: ReactNode;
  title: string;
  contentClassName?: string;
  mode?: 'student' | 'tutor';
  mobileTitle?: string;
};
type ShellMetadata=Omit<AppShellProps,'children'|'mode'>;
const ShellRegistration=createContext<Dispatch<SetStateAction<ShellMetadata>>|null>(null);

export function PersistentAppLayout({mode}:{mode:'student'|'tutor'}){
  const [metadata,setMetadata]=useState<ShellMetadata>({active:'dashboard',title:''});
  return <ShellRegistration.Provider value={setMetadata}><AppShellFrame {...metadata} mode={mode}><Outlet/></AppShellFrame></ShellRegistration.Provider>;
}

// Pages declare their title and active menu item; the router owns the persistent frame.
export function AppShell(props:AppShellProps){
  const register=useContext(ShellRegistration);
  const {active,title,contentClassName,mobileTitle}=props;
  useLayoutEffect(()=>{
    if(register)register(previous=>previous.active===active&&previous.title===title&&previous.contentClassName===contentClassName&&previous.mobileTitle===mobileTitle?previous:{active,title,contentClassName,mobileTitle});
  },[register,active,title,contentClassName,mobileTitle]);
  return register?<>{props.children}</>:<AppShellFrame {...props}/>;
}

const navItems = [
  ['courses', '/student/courses', 'My courses', 'nav-teacher.svg'],
  ['dashboard', '/student/dashboard', 'Dashboard', 'nav-dashboard.svg'],
  ['find', '/student/find-tutors', 'Find a tutor', 'nav-search.svg'],
  ['bookings', '/student/bookings', 'My bookings', 'nav-clock.svg'],
  ['messages', '/student/messages', 'Messages', 'student-icon-20.svg'],
  ['notifications', '/student/notifications', 'Notifications', 'nav-bell.svg'],
  ['profile', '/student/profile', 'My profile', 'nav-profile.svg'],
  ['settings', '/student/settings', 'Settings', 'nav-settings.svg'],
] as const;

const mobileItems = [
  ['courses', '/student/courses', 'Courses', 'nav-teacher.svg'],
  ['dashboard', '/student/dashboard', 'Home', 'nav-dashboard.svg'],
  ['find', '/student/find-tutors', 'Search', 'nav-search.svg'],
  ['bookings', '/student/bookings', 'Bookings', 'nav-teacher-alt.svg'],
  ['profile', '/student/profile', 'Profile', 'nav-profile.svg'],
] as const;

const tutorNavItems = [
  ['courses', '/tutor/courses', 'My courses', 'nav-teacher.svg'],
  ['dashboard', '/tutor/dashboard', 'Dashboard', 'nav-dashboard.svg'],
  ['bookings', '/tutor/requests', 'Bookings', 'nav-teacher.svg'],
  ['availability', '/tutor/availability', 'Availability', 'nav-clock.svg'],
  ['profile', '/tutor/public-profile', 'My profile', 'nav-profile.svg'],
  ['messages', '/tutor/messages', 'Messages', 'student-icon-20.svg'],
  ['notifications', '/tutor/notifications', 'Notifications', 'nav-bell.svg'],
  ['settings', '/tutor/settings', 'Settings', 'nav-settings.svg'],
] as const;

const tutorMobileItems = [
  ['courses', '/tutor/courses', 'Courses', 'nav-teacher.svg'],
  ['dashboard', '/tutor/dashboard', 'Home', 'nav-dashboard.svg'],
  ['bookings', '/tutor/requests', 'Bookings', 'nav-teacher-alt.svg'],
  ['profile', '/tutor/public-profile', 'Profile', 'nav-profile.svg'],
] as const;

function AssetIcon({ asset }: { asset: string }) {
  const source = asset.endsWith('.svg') ? asset : `student-icon-${asset}.svg`;
  return <img alt="" aria-hidden="true" src={`/assets/figma/${source}`} />;
}

function AppShellFrame({ active, children, contentClassName = '', mode = 'student', mobileTitle, title }: AppShellProps) {
  const navigate = useMotionNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const isTutor = mode === 'tutor';
  const desktopNavigation = isTutor ? tutorNavItems : navItems;
  const mobileNavigation = isTutor ? tutorMobileItems : mobileItems;
  const [tutorAccount,setTutorAccount]=useState<{displayName:string;avatarUrl?:string|null}>();
  useEffect(()=>{
    let cancelled=false;
    const refresh=()=>{void (isTutor?gatewayClient.getMyTutorProfile():gatewayClient.getStudentProfile()).then(profile=>{if(!cancelled)setTutorAccount(profile);}).catch(()=>{});};
    refresh();window.addEventListener('tutormatching:profile-updated',refresh);
    return()=>{cancelled=true;window.removeEventListener('tutormatching:profile-updated',refresh);};
  },[isTutor]);
  const accountName = tutorAccount?.displayName ?? (isTutor?'Tutor':'Student');
  const accountImage = tutorAccount?.avatarUrl || '/assets/figma/default-avatar.svg';

  async function logout() {
    setLoggingOut(true);
    try {
      await gatewayClient.logout();
    } finally {
      navigate('/auth/sign-in', { replace: true, viewTransition: true });
    }
  }


  return (
    <div className={`student-shell ${isTutor ? 'student-shell--tutor' : ''}`}>
      <aside className="student-sidebar">
        <MotionLink className="student-brand" to={isTutor ? '/tutor/dashboard' : '/student/dashboard'}>
          <BrandMark />
          <span>Teach.</span>
        </MotionLink>
        <div className="student-account">
          <img alt={accountName} src={accountImage} />
          <div><strong>{accountName}</strong><span>{isTutor ? 'Tutor account' : 'Student account'}</span></div>
        </div>
        <nav aria-label="Student navigation">
          {desktopNavigation.map(([id, to, label, icon]) => (
            <MotionNavLink className={id === active ? 'is-active' : ''} key={id} to={to}>
              <AssetIcon asset={icon} />
              <span>{label}</span>
            </MotionNavLink>
          ))}
        </nav>
        <button className="student-logout" disabled={loggingOut} onClick={logout} type="button"><svg className="student-logout__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/><path d="M9 12h12m-4-4 4 4-4 4"/></svg><span>{loggingOut ? 'Logging out…' : 'Log out'}</span></button>
      </aside>
      <section className="student-workspace">
        <header className="student-topbar">
          <h1><span>{title}</span>{mobileTitle ? <span className="student-mobile-title">{mobileTitle}</span> : null}</h1>
          <GlobalSearch mode={mode}/>
          <div className="student-topbar__actions">
            {isTutor ? <span className="tutor-mode">Tutor mode</span> : null}
            <MessageShortcut mode={mode}/>
            <NotificationDropdown mode={mode}/>
            <strong>{accountName}</strong>
            <MotionLink aria-label="Open my profile" to={isTutor ? '/tutor/public-profile' : '/student/profile'}><img className="student-topbar__avatar" alt={accountName} src={accountImage} /></MotionLink>

          </div>
        </header>
        <CourseTicker mode={mode}/>
        <main className={`student-content ${contentClassName}`.trim()}>{children}</main>
      </section>
      <nav className="student-mobile-nav" aria-label="Mobile student navigation" style={{gridTemplateColumns:`repeat(${mobileNavigation.length},minmax(0,1fr))`}}>
        {mobileNavigation.map(([id, to, label, icon]) => (
          <MotionNavLink className={id === active ? 'is-active' : ''} key={id} to={to}>
            <AssetIcon asset={icon} />
            <span>{label}</span>
          </MotionNavLink>
        ))}
      </nav>
    </div>
  );
}
