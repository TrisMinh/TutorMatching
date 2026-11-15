import {gatewayClient} from '../api';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('application routes', () => {
  it('redirects the root route to the approved sign-in screen', async () => {
    renderAt('/');

    expect(await screen.findByRole('heading', { name: 'Welcome back!' })).toBeInTheDocument();
  });

  it('renders the approved not-found state for an unknown route', () => {
    renderAt('/missing-screen');

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute(
      'href',
      '/student/dashboard',
    );
  });

  it('redirects anonymous users away from protected student routes', async () => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    renderAt('/student/dashboard');

    expect(await screen.findByRole('heading', { name: 'Welcome back!' })).toBeInTheDocument();
  });

  it('redirects signed-in users away from the other account role', async () => {
    window.sessionStorage.setItem('tutormatching.auth.session', JSON.stringify({ accessToken: 'test', refreshToken: 'test', role: 'Student' }));
    vi.spyOn(gatewayClient,'getStudentProfile').mockResolvedValue({id:'student',userId:'user',displayName:'Test Student',educationLevel:2,learningGoal:'Practice',timezone:'Asia/Ho_Chi_Minh',status:'Active',version:1,interests:[]});
    renderAt('/tutor/dashboard');

    expect(await screen.findByRole('heading', { name: 'Welcome, Test Student' })).toBeInTheDocument();
  });
});

afterEach(()=>vi.restoreAllMocks());
