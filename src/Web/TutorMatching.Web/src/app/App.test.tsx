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
});
