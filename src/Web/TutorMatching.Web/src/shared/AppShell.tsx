import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { BrandMark } from '../design-system/BrandMark';

type AppShellProps = {
  active: 'dashboard' | 'find' | 'bookings' | 'notifications' | 'profile' | 'settings';
  children: ReactNode;
  title: string;
  contentClassName?: string;
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
  ['bookings', '/student/bookings', 'Bookings', 'nav-clock.svg'],
  ['profile', '/student/profile', 'Profile', 'nav-profile.svg'],
] as const;

function AssetIcon({ asset }: { asset: string }) {
  const source = asset.endsWith('.svg') ? asset : `student-icon-${asset}.svg`;
  return <img alt="" aria-hidden="true" src={`/assets/figma/${source}`} />;
}

export function AppShell({ active, children, contentClassName = '', title }: AppShellProps) {
  return (
    <div className="student-shell">
      <aside className="student-sidebar">
        <a className="student-brand" href="/student/dashboard">
          <BrandMark />
          <span>Teach.</span>
        </a>
        <div className="student-account">
          <img alt="Minh" src="/assets/figma/student-tutor-1.jpg" />
          <div><strong>Minh</strong><span>Student account</span></div>
        </div>
        <nav aria-label="Student navigation">
          {navItems.map(([id, to, label, icon]) => (
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
          <h1>{title}</h1>
          <label className="student-global-search">
            <span className="sr-only">Search anything</span>
            <AssetIcon asset="nav-search.svg" />
            <input placeholder="Search anything..." />
          </label>
          <div className="student-topbar__actions">
            <button aria-label="Messages" type="button"><AssetIcon asset="20" /></button>
            <button aria-label="Notifications" type="button"><AssetIcon asset="nav-bell.svg" /><span /></button>
            <strong>Minh</strong>
            <img className="student-topbar__avatar" alt="Minh" src="/assets/figma/student-tutor-1.jpg" />
          </div>
        </header>
        <main className={`student-content ${contentClassName}`.trim()}>{children}</main>
      </section>
      <nav className="student-mobile-nav" aria-label="Mobile student navigation">
        {mobileItems.map(([id, to, label, icon]) => (
          <NavLink className={id === active ? 'is-active' : ''} key={id} to={to}>
            <AssetIcon asset={icon} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
