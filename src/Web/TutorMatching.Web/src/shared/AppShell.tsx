import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { BrandMark } from '../design-system/BrandMark';

type AppShellProps = {
  active: string;
  children: ReactNode;
  title: string;
  contentClassName?: string;
  mode?: 'student' | 'tutor';
  mobileTitle?: string;
};

const navItems = [
  ['dashboard', '/student/dashboard', 'Dashboard', 'nav-dashboard.svg'],
  ['find', '/student/find-tutors', 'Find a tutor', 'nav-search.svg'],
  ['bookings', '/student/bookings', 'My bookings', 'nav-clock.svg'],
  ['notifications', '/student/notifications', 'Notifications', 'nav-bell.svg'],
  ['profile', '/student/profile', 'My profile', 'nav-profile.svg'],
  ['settings', '/student/settings', 'Settings', 'nav-settings.svg'],
] as const;

const mobileItems = [
  ['dashboard', '/student/dashboard', 'Home', 'nav-dashboard.svg'],
  ['find', '/student/find-tutors', 'Search', 'nav-search.svg'],
  ['bookings', '/student/bookings', 'Bookings', 'nav-teacher-alt.svg'],
  ['profile', '/student/profile', 'Profile', 'nav-profile.svg'],
] as const;

const tutorNavItems = [
  ['dashboard', '/tutor/dashboard', 'Dashboard', 'nav-dashboard.svg'],
  ['schedule', '/tutor/schedule', 'Schedule', 'nav-clock.svg'],
  ['bookings', '/tutor/requests', 'Bookings', 'nav-teacher.svg'],
  ['availability', '/tutor/availability', 'Availability', 'nav-clock.svg'],
  ['profile', '/tutor/public-profile', 'My profile', 'nav-profile.svg'],
  ['notifications', '/tutor/notifications', 'Notifications', 'nav-bell.svg'],
  ['settings', '/tutor/settings', 'Settings', 'nav-settings.svg'],
] as const;

const tutorMobileItems = [
  ['dashboard', '/tutor/dashboard', 'Home', 'nav-dashboard.svg'],
  ['schedule', '/tutor/schedule', 'Schedule', 'nav-clock.svg'],
  ['bookings', '/tutor/requests', 'Bookings', 'nav-teacher-alt.svg'],
  ['profile', '/tutor/public-profile', 'Profile', 'nav-profile.svg'],
] as const;

function AssetIcon({ asset }: { asset: string }) {
  const source = asset.endsWith('.svg') ? asset : `student-icon-${asset}.svg`;
  return <img alt="" aria-hidden="true" src={`/assets/figma/${source}`} />;
}

export function AppShell({ active, children, contentClassName = '', mode = 'student', mobileTitle, title }: AppShellProps) {
  const isTutor = mode === 'tutor';
  const desktopNavigation = isTutor ? tutorNavItems : navItems;
  const mobileNavigation = isTutor ? tutorMobileItems : mobileItems;
  const accountName = isTutor ? 'Minh Anh' : 'Minh';
  const accountImage = isTutor ? '/assets/figma/student-tutor-3.jpg' : '/assets/figma/student-tutor-1.jpg';
  return (
    <div className={`student-shell ${isTutor ? 'student-shell--tutor' : ''}`}>
      <aside className="student-sidebar">
        <a className="student-brand" href="/student/dashboard">
          <BrandMark />
          <span>Teach.</span>
        </a>
        <div className="student-account">
          <img alt={accountName} src={accountImage} />
          <div><strong>{accountName}</strong><span>{isTutor ? 'Tutor account' : 'Student account'}</span></div>
        </div>
        <nav aria-label="Student navigation">
          {desktopNavigation.map(([id, to, label, icon]) => (
            <NavLink className={id === active ? 'is-active' : ''} key={id} to={to}>
              <AssetIcon asset={icon} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <a className="student-logout" href="/auth/sign-in"><AssetIcon asset="nav-logout.svg" /><span>Log out</span></a>
      </aside>
      <section className="student-workspace">
        <header className="student-topbar">
          <h1><span>{title}</span>{mobileTitle ? <span className="student-mobile-title">{mobileTitle}</span> : null}</h1>
          <label className="student-global-search">
            <span className="sr-only">Search anything</span>
            <AssetIcon asset="nav-search.svg" />
            <input placeholder="Search anything..." />
          </label>
          <div className="student-topbar__actions">
            {isTutor ? <span className="tutor-mode">Tutor mode</span> : null}
            <button aria-label="Messages" type="button"><AssetIcon asset="20" /></button>
            <button aria-label="Notifications" type="button"><AssetIcon asset="nav-bell.svg" /><span /></button>
            <strong>{accountName}</strong>
            <img className="student-topbar__avatar" alt={accountName} src={accountImage} />
          </div>
        </header>
        <main className={`student-content ${contentClassName}`.trim()}>{children}</main>
      </section>
      <nav className="student-mobile-nav" aria-label="Mobile student navigation">
        {mobileNavigation.map(([id, to, label, icon]) => (
          <NavLink className={id === active ? 'is-active' : ''} key={id} to={to}>
            <AssetIcon asset={icon} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
