import axios from "axios";
import type { TFunction } from "i18next";
import { apiClient } from "../api/client";
import { translateErrorCode, type ApiErrorBody } from "../api/apiError";

export type ReportExportType = "project" | "worker" | "client";
export type ReportExportFormat = "pdf" | "xlsx";

function extractFilename(contentDisposition: unknown, fallback: string): string {
  if (typeof contentDisposition !== "string") {
    return fallback;
  }
  const match = /filename="?([^"]+)"?/.exec(contentDisposition);
  return match?.[1] ?? fallback;
}

/**
 * axios con responseType "blob" deja el cuerpo del error tambien como Blob
 * (no lo parsea como JSON aunque el servidor haya mandado un errorCode) —
 * hay que leerlo aparte para poder traducirlo, translateApiError no sirve
 * directo aca.
 */
async function blobErrorToMessage(t: TFunction, error: unknown): Promise<string> {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      const text = await error.response.data.text();
      const body = JSON.parse(text) as ApiErrorBody;
      return translateErrorCode(t, body.errorCode);
    } catch {
      // el cuerpo no era JSON (ej. error de red antes de llegar al servidor)
    }
  }
  return translateErrorCode(t, undefined);
}

/**
 * Descarga directa del archivo (Content-Disposition: attachment) — crea un
 * <a download> efimero apuntando a un blob: URL, sin pasar por el
 * filesystem del servidor en ningun momento. Devuelve null si la descarga
 * arrancó bien, o un mensaje de error ya traducido si falló.
 */
export async function downloadReportExport(
  t: TFunction,
  type: ReportExportType,
  id: string,
  format: ReportExportFormat,
): Promise<string | null> {
  try {
    const response = await apiClient.get<Blob>("/reports/export", {
      params: { type, id, format },
      responseType: "blob",
    });

    const filename = extractFilename(response.headers["content-disposition"], `reporte.${format}`);
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return null;
  } catch (error) {
    return blobErrorToMessage(t, error);
  }
}
