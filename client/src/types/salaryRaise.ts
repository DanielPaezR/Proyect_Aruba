export interface SalaryRaise {
  id: string;
  userId: string;
  previousRate: string | null;
  newRate: string;
  reason: string | null;
  createdById: string;
  createdBy: { id: string; name: string };
  createdAt: string;
}
