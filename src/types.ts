export interface WorkDay {
  day: number;
  hours: string;
  project: string;
  description?: string;
  marked?: boolean;
  isOffDay?: boolean;
}

export interface WorkMonth {
  name: string;
  role: string;
  month: number;
  year: number;
  days: WorkDay[];
  signature?: string;
  totalHours: number;
  totalEarnings: number;
}
