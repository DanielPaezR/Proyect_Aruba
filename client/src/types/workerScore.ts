export interface WorkerScoreEvent {
  id: string;
  userId: string;
  points: number;
  reason: string;
  createdById: string;
  createdBy: { id: string; name: string };
  createdAt: string;
}

export interface MonthlyScore {
  month: number;
  year: number;
  baseScore: number;
  currentScore: number;
  events: WorkerScoreEvent[];
}
