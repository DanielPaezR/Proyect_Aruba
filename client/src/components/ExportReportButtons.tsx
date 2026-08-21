import { useState } from "react";
import { useTranslation } from "react-i18next";
import { downloadReportExport, type ReportExportFormat, type ReportExportType } from "../utils/reportExport";

interface ExportReportButtonsProps {
  type: ReportExportType;
  id: string;
}

/** Botones "Exportar" (PDF/Excel) reutilizados en ProjectDetailPage,
 * WorkerProfilePage, y ClientDetailPage — misma descarga directa, sin
 * escribir nada al filesystem del cliente salvo lo que el navegador guarde
 * por si solo via el <a download>. */
export function ExportReportButtons({ type, id }: ExportReportButtonsProps) {
  const { t } = useTranslation(["reports", "common"]);
  const [exportingFormat, setExportingFormat] = useState<ReportExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(format: ReportExportFormat) {
    setError(null);
    setExportingFormat(format);
    const errorMessage = await downloadReportExport(t, type, id, format);
    if (errorMessage) {
      setError(errorMessage);
    }
    setExportingFormat(null);
  }

  return (
    <>
      <button type="button" onClick={() => void handleExport("pdf")} disabled={exportingFormat !== null}>
        {exportingFormat === "pdf" ? t("export.exportingPdf") : t("export.exportPdfButton")}
      </button>
      <button type="button" onClick={() => void handleExport("xlsx")} disabled={exportingFormat !== null}>
        {exportingFormat === "xlsx" ? t("export.exportingExcel") : t("export.exportExcelButton")}
      </button>
      {error && (
        <span className="form-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
