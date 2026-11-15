import {act, cleanup, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {ActionNotifications} from './ActionNotifications';
import {notifyAction} from './notificationEvents';

afterEach(() => {cleanup(); vi.useRealTimers();});
it('shows action feedback outside the layout and removes it after 3 seconds', () => {
  vi.useFakeTimers();
  const {container} = render(<ActionNotifications />);
  act(() => notifyAction('Email verified successfully.'));
  expect(container).toBeEmptyDOMElement();
  expect(screen.getByRole('status')).toHaveTextContent('Email verified successfully.');
  act(() => vi.advanceTimersByTime(2999));
  expect(screen.getByRole('status')).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('restarts the 3-second window for the next operation', () => {
  vi.useFakeTimers();
  render(<ActionNotifications />);
  act(() => notifyAction('First action'));
  act(() => vi.advanceTimersByTime(2000));
  act(() => notifyAction('Second action'));
  act(() => vi.advanceTimersByTime(1500));
  expect(screen.getByRole('status')).toHaveTextContent('Second action');
  act(() => vi.advanceTimersByTime(1500));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
