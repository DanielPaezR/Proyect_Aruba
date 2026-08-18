export const PAYMENT_METHODS = ["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "OTRO"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface Payment {
  id: string;
  projectId: string;
  amount: string;
  paymentDate: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  recordedById: string;
  recordedBy: { id: string; name: string };
  createdAt: string;
}

/** Forma de GET /api/clients/:clientId/payments — incluye el proyecto, para el historial across todos los proyectos del cliente. */
export interface PaymentWithProject extends Payment {
  project: { id: string; name: string };
}

export interface PaymentsListResponse {
  payments: Payment[];
  totalReceived: number;
}

export interface ClientPaymentsListResponse {
  payments: PaymentWithProject[];
  totalReceived: number;
}
