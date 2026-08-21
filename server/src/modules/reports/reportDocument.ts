import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";

export interface ReportSummaryItem {
  label: string;
  value: string;
}

export interface ReportSection {
  title: string;
  columns: string[];
  // Cada celda ya viene formateada como string — el generador de datos
  // decide el formato (moneda, fecha, etc.), los renderers (PDF/XLSX) solo
  // se encargan de dibujar filas/columnas, no de interpretar el contenido.
  rows: string[][];
}

export interface ReportDocument {
  title: string;
  subtitle: string;
  generatedAt: Date;
  summary: ReportSummaryItem[];
  sections: ReportSection[];
}

const AWG_FORMATTER = new Intl.NumberFormat("nl-AW", { style: "currency", currency: "AWG" });

export function formatCurrencyForReport(amount: number): string {
  return AWG_FORMATTER.format(amount);
}

export function formatDateForReport(date: Date | string | null): string {
  if (!date) {
    return "—";
  }
  return new Date(date).toLocaleDateString("es-AW");
}

/**
 * Genera el PDF en memoria (sin tocar el filesystem, mismo criterio que
 * Cloudinary en el resto de la app) — junta los chunks del stream de pdfkit
 * en un Buffer en vez de escribir a disco.
 */
export function renderReportPdf(doc: ReportDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    pdf.fontSize(18).text(doc.title, { align: "left" });
    pdf.fontSize(11).fillColor("#555555").text(doc.subtitle);
    pdf
      .fontSize(9)
      .fillColor("#888888")
      .text(`Generado el ${formatDateForReport(doc.generatedAt)}`, { align: "left" });
    pdf.moveDown(1);

    if (doc.summary.length > 0) {
      pdf.fillColor("#000000").fontSize(12).text("Resumen", { underline: true });
      pdf.moveDown(0.3);
      for (const item of doc.summary) {
        pdf.fontSize(10).text(`${item.label}: ${item.value}`);
      }
      pdf.moveDown(1);
    }

    for (const section of doc.sections) {
      // drawRow() del bloque anterior deja pdf.x en la columna de la ultima
      // celda dibujada (text() con x/y explicitos no lo repone) — sin este
      // reset, el titulo de esta seccion heredaria esa x y se dibujaria
      // angosto/envuelto contra el margen derecho en vez de a todo el ancho.
      pdf.x = pdf.page.margins.left;
      if (pdf.y > 680) {
        pdf.addPage();
      }
      pdf.fontSize(13).text(section.title, { underline: true });
      pdf.moveDown(0.3);

      if (section.rows.length === 0) {
        pdf.fontSize(10).fillColor("#888888").text("Sin datos.");
        pdf.fillColor("#000000");
        pdf.moveDown(1);
        continue;
      }

      const pageWidth = pdf.page.width - pdf.page.margins.left - pdf.page.margins.right;
      const colWidth = pageWidth / section.columns.length;

      const drawRow = (cells: string[], isHeader: boolean) => {
        pdf.fontSize(9).font(isHeader ? "Helvetica-Bold" : "Helvetica");
        // Cada celda puede envolver a mas de una linea (ej. titulos largos
        // de actividad) — la fila entera usa la altura de la celda mas alta,
        // si no la siguiente fila se dibuja encima de las lineas extra.
        const cellHeights = cells.map((cell) => pdf.heightOfString(cell, { width: colWidth - 4 }));
        const rowHeight = Math.max(14, ...cellHeights) + 6;

        if (pdf.y + rowHeight > pdf.page.height - pdf.page.margins.bottom) {
          pdf.addPage();
        }
        const startY = pdf.y;
        cells.forEach((cell, index) => {
          pdf.text(cell, pdf.page.margins.left + index * colWidth, startY, {
            width: colWidth - 4,
          });
        });
        pdf.y = startY + rowHeight;
      };

      drawRow(section.columns, true);
      for (const row of section.rows) {
        drawRow(row, false);
      }
      pdf.font("Helvetica");
      pdf.moveDown(1.2);
    }

    pdf.end();
  });
}

/** Genera el XLSX en memoria — exceljs ya expone writeBuffer(), sin filesystem. */
export async function renderReportXlsx(doc: ReportDocument): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DECS";
  workbook.created = doc.generatedAt;

  const summarySheet = workbook.addWorksheet("Resumen");
  summarySheet.columns = [
    { header: "Campo", key: "label", width: 30 },
    { header: "Valor", key: "value", width: 40 },
  ];
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.addRow({ label: "Reporte", value: doc.title });
  summarySheet.addRow({ label: "Descripción", value: doc.subtitle });
  summarySheet.addRow({ label: "Generado el", value: formatDateForReport(doc.generatedAt) });
  for (const item of doc.summary) {
    summarySheet.addRow({ label: item.label, value: item.value });
  }

  for (const section of doc.sections) {
    // Excel no permite ":\/?*[]" en nombres de hoja ni mas de 31 caracteres.
    const sheetName = section.title.replace(/[:\\/?*[\]]/g, "").slice(0, 31);
    const sheet = workbook.addWorksheet(sheetName || "Datos");
    sheet.columns = section.columns.map((column) => ({ header: column, key: column, width: 22 }));
    sheet.getRow(1).font = { bold: true };
    for (const row of section.rows) {
      sheet.addRow(row);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
