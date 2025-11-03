import { LaundryStatus, getStatusText } from '../types';

export default function StatusBadge({ status }: { status: LaundryStatus }) {
  const cls =
    status === 1
      ? 'badge progress' // In progress -> green
      : status === 2
      ? 'badge info' // Done -> blue
      : 'badge warn'; // Claimed & Paid -> yellow
  return <span className={cls}>{getStatusText(status)}</span>;
}


