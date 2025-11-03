export type LaundryStatus = 1 | 2 | 3; // 1 = In progress, 2 = Done, 3 = Claimed & Paid

export interface CustomerRecord {
  id: string; // stable row id or generated id
  dateDropped: string; // ISO or display date
  customerName: string;
  totalWeightKg: number;
  status: LaundryStatus;
  datePaid?: string; // ISO date when claimed & paid
}

export function getStatusText(status: LaundryStatus): string {
  if (status === 1) return 'In progress';
  if (status === 2) return 'Done';
  if (status === 3) return 'Claimed & Paid';
  return 'Unknown';
}


