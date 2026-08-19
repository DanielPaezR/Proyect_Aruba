export interface SalaryRaise {
  id: string;
  userId: string;
  previousRate: string | null;
  newRate: string;
  previousOvertimeRate: string | null;
  newOvertimeRate: string | null;
  reason: string | null;
  createdById: string;
  createdBy: { id: string; name: string };
  createdAt: string;
}
