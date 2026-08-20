export type PayrollRunStatus = "BORRADOR" | "PAGADA";

/**
 * Resultado de GET /payroll/preview — mismo calculo que un PayrollRun pero
 * sin persistir nada todavia, por eso no tiene id/status/generatedBy/etc.
 * Los montos vienen como number (no string): a diferencia de PayrollRun, no
 * salen de una columna Decimal leida de la DB, son el resultado crudo del
 * calculo en el servidor.
 */
export interface PayrollPreview {
  userId: string;
  user: { id: string; name: string };
  periodStart: string;
  periodEnd: string;
  normalMinutes: number;
  overtimeMinutes: number;
  normalPay: number;
  overtimePay: number;
  totalAdvances: number;
  totalDeductions: number;
  netPay: number;
}

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
