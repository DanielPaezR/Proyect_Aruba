/** PDF vs imagen — usa mimeType si esta disponible; si no, cae a detectar
 * la extension de fileUrl. Compartido por WorkerDocumentCard (mimeType
 * real) y ProjectInvoicesSection (Invoice no tiene mimeType, siempre cae
 * al fallback de extension — las facturas solo se suben en PDF). */
export function inferDocumentMediaType(doc: { mimeType?: string | null; fileUrl: string }): "IMAGEN" | "PDF" {
  if (doc.mimeType === "application/pdf") {
    return "PDF";
  }
  if (doc.mimeType) {
    return "IMAGEN";
  }
  return doc.fileUrl.toLowerCase().endsWith(".pdf") ? "PDF" : "IMAGEN";
}
