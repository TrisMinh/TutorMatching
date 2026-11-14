import type { ReactNode } from 'react';
import type { AppRoute } from '../../app/routes';
import './states.css';

const assetRoot = '/assets/figma/states';

type StandardStateProps = {
  title: string;
  description: string;
  icon: string;
  action?: string;
  tone?: 'blue' | 'yellow' | 'red' | 'green';
  actionTone?: 'blue' | 'red';
  children?: ReactNode;
};

function StandardState({
  title,
  description,
  icon,
  action,
  tone = 'blue',
  actionTone = 'blue',
  children,
}: StandardStateProps) {
  return (
    <main className="state-canvas">
      <section className="state-card" aria-labelledby="state-title">
        <div className={`state-icon state-icon--${tone}`} aria-hidden="true">
          <img src={`${assetRoot}/${icon}.svg`} alt="" />
        </div>
        <h1 id="state-title">{title}</h1>
        <p>{description}</p>
        {children ??
          (action ? (
            <button className={`state-action state-action--${actionTone}`} type="button">
              {action}
            </button>
          ) : null)}
      </section>
    </main>
  );
}

function LoadingState() {
  return (
    <StandardState
      title="Loading your content"
      description="Just a moment while we get everything ready."
      icon="loading"
    >
      <div className="state-skeleton" aria-label="Loading">
        <span />
        <span />
        <span />
      </div>
    </StandardState>
  );
}

function CancelConfirmation() {
  return (
    <main className="state-canvas state-canvas--overlay">
      <section
        className="cancel-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-title"
        aria-describedby="cancel-description"
      >
        <div className="cancel-dialog__icon" aria-hidden="true">
          <img src={`${assetRoot}/cancel-warning.svg`} alt="" />
        </div>
        <h1 id="cancel-title">Cancel this booking?</h1>
        <p id="cancel-description">The student or tutor will be notified immediately.</p>
        <div className="cancel-dialog__actions">
          <button type="button">Keep booking</button>
          <button className="cancel-dialog__danger" type="button">Cancel booking</button>
        </div>
      </section>
    </main>
  );
}

function ValidationStates() {
  return (
    <main className="state-canvas state-canvas--form">
      <section className="validation-card" aria-labelledby="validation-title">
        <h1 id="validation-title">Form validation</h1>
        <div className="validation-field validation-field--error">
          <label htmlFor="validation-email">Email address</label>
          <input
            id="validation-email"
            type="email"
            defaultValue="student@email"
            aria-invalid="true"
            aria-describedby="email-error"
          />
          <small id="email-error">Invalid email address</small>
        </div>
        <div className="validation-field validation-field--warning">
          <label htmlFor="validation-password">Password</label>
          <input
            id="validation-password"
            type="password"
            defaultValue="Tutor1"
            aria-describedby="password-help"
          />
          <small id="password-help">At least 8 characters</small>
        </div>
        <div className="validation-field validation-field--success">
          <label htmlFor="validation-name">Full name</label>
          <input
            id="validation-name"
            type="text"
            defaultValue="Minh Anh"
            aria-invalid="false"
          />
          <small>Looks good</small>
        </div>
      </section>
    </main>
  );
}

const toasts = [
  { title: 'Changes saved', icon: 'toast-success', tone: 'success', role: 'status' },
  { title: 'New availability found', icon: 'toast-info', tone: 'info', role: 'status' },
  { title: 'Your hold expires in 02:14', icon: 'toast-warning', tone: 'warning', role: 'status' },
  { title: 'Could not save changes', icon: 'toast-error', tone: 'error', role: 'alert' },
] as const;

function ToastStack() {
  return (
    <main className="state-canvas state-canvas--toasts">
      <section className="toast-stack" aria-label="Notifications">
        {toasts.map((toast, index) => (
          <div
            className={`state-toast state-toast--${toast.tone}`}
            role={toast.role}
            aria-label={toast.title}
            key={toast.title}
          >
            <img src={`${assetRoot}/${toast.icon}.svg`} alt="" aria-hidden="true" />
            <h1>{toast.title}</h1>
            <button type="button" aria-label={`Dismiss ${toast.title}`}>
              ×
            </button>
            {index === 2 ? <div className="state-toast__progress" aria-hidden="true" /> : null}
          </div>
        ))}
      </section>
    </main>
  );
}

function BookingHold() {
  return (
    <StandardState
      title="Your slot is on hold"
      description="Complete the booking before the timer ends."
      icon="booking-hold"
    >
      <div className="hold-actions">
        <strong role="timer" aria-live="off">09:42</strong>
        <button className="state-action state-action--blue" type="button">
          Confirm booking
        </button>
      </div>
    </StandardState>
  );
}

export const stateRoutes: AppRoute[] = [
  { path: '/states/loading', element: <LoadingState /> },
  {
    path: '/states/empty-bookings',
    element: (
      <StandardState
        title="No bookings yet"
        description="Find a tutor and schedule your first lesson."
        icon="empty-bookings"
        action="Find a tutor"
      />
    ),
  },
  {
    path: '/states/no-results',
    element: (
      <StandardState
        title="No tutors found"
        description="Try removing a filter or searching another subject."
        icon="no-results"
        action="Clear filters"
      />
    ),
  },
  {
    path: '/states/offline',
    element: (
      <StandardState
        title="You’re offline"
        description="Check your internet connection and try again."
        icon="offline"
        tone="yellow"
        action="Retry"
      />
    ),
  },
  {
    path: '/states/403',
    element: (
      <StandardState
        title="Access denied"
        description="You don’t have permission to view this page."
        icon="forbidden"
        tone="red"
        action="Go to dashboard"
        actionTone="red"
      />
    ),
  },
  {
    path: '/states/404',
    element: (
      <StandardState
        title="Page not found"
        description="The page may have moved or no longer exists."
        icon="not-found"
        action="Go back home"
      />
    ),
  },
  {
    path: '/states/500',
    element: (
      <StandardState
        title="Something went wrong"
        description="Our service had a problem. Your data is safe."
        icon="server-error"
        tone="red"
        action="Try again"
        actionTone="red"
      />
    ),
  },
  {
    path: '/states/booking-conflict',
    element: (
      <StandardState
        title="Time slot unavailable"
        description="Another student just booked this slot. Choose another time."
        icon="booking-conflict"
        tone="yellow"
        action="Choose another slot"
      />
    ),
  },
  {
    path: '/states/booking-success',
    element: (
      <StandardState
        title="Booking confirmed"
        description="The lesson is now in your schedule."
        icon="booking-success"
        tone="green"
        action="View booking"
      />
    ),
  },
  {
    path: '/states/session-expired',
    element: (
      <StandardState
        title="Session expired"
        description="Sign in again to continue where you left off."
        icon="session-expired"
        tone="yellow"
        action="Sign in"
      />
    ),
  },
  {
    path: '/states/rate-limited',
    element: (
      <StandardState
        title="Too many attempts"
        description="Please wait a moment before trying again."
        icon="rate-limited"
        tone="yellow"
        action="Got it"
      />
    ),
  },
  {
    path: '/states/maintenance',
    element: (
      <StandardState
        title="Scheduled maintenance"
        description="TutorMatching will be back shortly."
        icon="maintenance"
        action="View status"
      />
    ),
  },
  { path: '/states/cancel-confirmation', element: <CancelConfirmation /> },
  { path: '/states/validation', element: <ValidationStates /> },
  { path: '/states/toasts', element: <ToastStack /> },
  { path: '/states/booking-hold', element: <BookingHold /> },
];
