export type PayrollRunStatus = "BORRADOR" | "PAGADA";

export interface PayrollRun {
  id: string;
  userId: string;
  user: { id: string; name: string };
  periodStart: string;
  periodEnd: string;
  normalMinutes: number;
  overtimeMinutes: number;
  // Decimal serializado por Prisma/Express como string (ej. "160.00").
  normalPay: string;
  overtimePay: string;
  totalAdvances: string;
  totalDeductions: string;
  netPay: string;
  status: PayrollRunStatus;
  generatedById: string;
  generatedBy: { id: string; name: string };
  generatedAt: string;
  paidAt: string | null;
  notes: string | null;
}
