export type FinancialMovementType = "INGRESO" | "EGRESO";

export interface FinancialHistoryEntry {
  id: string;
  date: string;
  type: FinancialMovementType;
  // Numero crudo (no Decimal de DB) — mismo criterio que PayrollPreview.
  amount: number;
  recordedBy: { id: string; name: string };
  // Solo en INGRESO.
  projectId?: string;
  projectName?: string;
  clientId?: string | null;
  clientName?: string | null;
  // Solo en EGRESO.
  workerId?: string;
  workerName?: string;
  periodStart?: string;
  periodEnd?: string;
}

export interface FinancialHistoryResponse {
  entries: FinancialHistoryEntry[];
  totalIngresos: number;
  totalEgresos: number;
  balance: number;
}
