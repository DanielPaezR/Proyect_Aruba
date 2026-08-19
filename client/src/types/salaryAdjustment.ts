export type SalaryAdjustmentType = "ADELANTO" | "DESCUENTO";

export interface SalaryAdjustment {
  id: string;
  userId: string;
  type: SalaryAdjustmentType;
  amount: string;
  reason: string;
  effectiveDate: string;
  createdById: string;
  createdBy: { id: string; name: string };
  createdAt: string;
}
