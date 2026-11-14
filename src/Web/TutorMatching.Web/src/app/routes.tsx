import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { authRoutes } from '../features/auth/AuthRoutes';

export type AppRoute = {
  path: string;
  element: ReactNode;
};

export function NotFoundFoundation() {
  return (
    <main className="foundation-screen">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p>The page you’re looking for isn’t available.</p>
      <Link className="foundation-link" to="/student/dashboard">
        Back to dashboard
      </Link>
    </main>
  );
}

export const appRoutes: AppRoute[] = [
  ...authRoutes,
  { path: '*', element: <NotFoundFoundation /> },
];
