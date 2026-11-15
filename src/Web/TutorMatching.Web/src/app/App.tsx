import {ProfileCompletionGate} from '../shared/ProfileCompletionGate';
import {ActionNotifications} from '../shared/ActionNotifications';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { browserSession, type AccountRole } from '../api';
import { appRoutes } from './routes';
import { PersistentAppLayout } from '../shared/AppShell';

export function ProtectedRoute({ children, role }: { children: ReactNode; role: AccountRole }) {
  if (import.meta.env.VITE_DISABLE_AUTH_GUARD === 'true') return children;
  const session = browserSession.load();
  if (!session?.accessToken || !session.role) return <Navigate replace to="/auth/sign-in" />;
  if (session.role !== role) {
    return <Navigate replace to={session.role === 'Tutor' ? '/tutor/dashboard' : '/student/dashboard'} />;
  }
  return <ProfileCompletionGate role={role}>{children}</ProfileCompletionGate>;
}

export function App() {
  return (
    <>
    <ActionNotifications />
    <Routes>
      <Route path="/" element={<Navigate replace to="/auth/sign-in" />} />
      {(['Student','Tutor'] as const).map(role=><Route key={role} element={<ProtectedRoute role={role}><PersistentAppLayout mode={role==='Tutor'?'tutor':'student'}/></ProtectedRoute>}>
        {appRoutes.filter(route=>route.access===role).map(route=><Route key={route.path} path={route.path} element={route.element}/>)}
      </Route>)}
      {appRoutes.filter(route=>!route.access).map(route=><Route key={route.path} path={route.path} element={route.element}/>)}
    </Routes>
    </>
  );
}
