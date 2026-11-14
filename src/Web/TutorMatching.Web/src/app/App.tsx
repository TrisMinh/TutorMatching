import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { browserSession, type AccountRole } from '../api';
import { appRoutes } from './routes';

export function ProtectedRoute({ children, role }: { children: ReactNode; role: AccountRole }) {
  if (import.meta.env.VITE_DISABLE_AUTH_GUARD === 'true') return children;
  const session = browserSession.load();
  if (!session?.accessToken || !session.role) return <Navigate replace to="/auth/sign-in" />;
  if (session.role !== role) {
    return <Navigate replace to={session.role === 'Tutor' ? '/tutor/dashboard' : '/student/dashboard'} />;
  }
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate replace to="/auth/sign-in" />} />
      {appRoutes.map((route) => (
        <Route key={route.path} path={route.path} element={route.access ? <ProtectedRoute role={route.access}>{route.element}</ProtectedRoute> : route.element} />
      ))}
    </Routes>
  );
}
