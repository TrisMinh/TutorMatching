import './primitives.css';

export type Status = 'confirmed' | 'pending' | 'cancelled' | 'completed';

const labels: Record<Status, string> = {
  confirmed: 'Confirmed',
  pending: 'Pending',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`tm-status tm-status--${status}`}>{labels[status]}</span>;
}
