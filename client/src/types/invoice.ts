export const INVOICE_STATUSES = ["PENDIENTE_REVISION", "APROBADA", "DEVUELTA"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface Invoice {
  id: string;
  projectId: string;
  uploadedById: string;
  uploadedBy: { id: string; name: string };
  fileUrl: string;
  filePublicId: string;
  status: InvoiceStatus;
  reviewComment: string | null;
  reviewedById: string | null;
  reviewedBy: { id: string; name: string } | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Forma de GET /api/invoices (Jefe) — incluye el proyecto, para la cola across todos los proyectos. */
export interface InvoiceWithProject extends Invoice {
  project: { id: string; name: string };
}
