import { Navigate, Route, Routes } from 'react-router-dom';
import { appRoutes } from './routes';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate replace to="/auth/sign-in" />} />
      {appRoutes.map((route) => (
        <Route key={route.path} path={route.path} element={route.element} />
      ))}
    </Routes>
  );
}
