import PDFDocument from "pdfkit";
import { formatCurrencyForReport, formatDateForReport } from "./reportDocument";

// Mismos colores de marca ya establecidos en client/src/index.css
// (--navy-900, --lime-500, --gold-500) — coherentes con el resto de la
// identidad visual de la app, no un esquema nuevo para el PDF.
const NAVY = "#111b29";
const LIME = "#8dc63f";
const GOLD = "#d4b84a";
const WHITE = "#ffffff";
const MUTED = "#6b7280";
const BORDER = "#e2e5e9";

const MARGIN_X = 40;
const MARGIN_BOTTOM = 40;

const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  GERENTE: "Gerente",
  SUPERVISOR: "Supervisor",
  TRABAJADOR_CAMPO: "Trabajador de campo",
  MERCADERISTA: "Mercaderista",
};

export interface WorkerResumePayrollRun {
  periodStart: Date;
  periodEnd: Date;
  normalMinutes: number;
  overtimeMinutes: number;
  netPay: number;
  status: string;
  paidAt: Date | null;
}

export interface WorkerResumeSalaryRaise {
  createdAt: Date;
  previousRate: number | null;
  newRate: number;
  reason: string | null;
  createdByName: string;
}

export interface WorkerResumeScoreEvent {
  createdAt: Date;
  points: number;
  reason: string;
  createdByName: string;
}

export interface WorkerResumeReportData {
  name: string;
  role: string;
  email: string;
  phone: string | null;
  hireDate: Date | null;
  specialties: string[];
  workDaysPerWeek: number | null;
  workScheduleNote: string | null;
  hourlyRate: number | null;
  overtimeHourlyRate: number | null;
  totalHours: number;
  payrollRuns: WorkerResumePayrollRun[];
  salaryHistory: WorkerResumeSalaryRaise[];
  monthlyScore: {
    month: number;
    year: number;
    currentScore: number;
    baseScore: number;
    events: WorkerResumeScoreEvent[];
  };
  generatedAt: Date;
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

/** "2 años y 3 meses" a partir de hireDate hasta ahora — nunca negativo. */
function formatTenure(hireDate: Date, now: Date): string {
  let years = now.getFullYear() - hireDate.getFullYear();
  let months = now.getMonth() - hireDate.getMonth();
  if (now.getDate() < hireDate.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  years = Math.max(0, years);
  months = Math.max(0, months);

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? "año" : "años"}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? "mes" : "meses"}`);
  return parts.length > 0 ? parts.join(" y ") : "Menos de un mes";
}

/**
 * Reporte de trabajador en PDF, SEPARADO de renderReportPdf (la tabla
 * generica que sigue usando el Excel de trabajador y los reportes de
 * proyecto/cliente) — este es especificamente una "hoja de vida": foto +
 * perfil arriba, contenido financiero/laboral abajo con el mismo
 * tratamiento visual limpio en vez de una tabla de filas/columnas.
 *
 * photoBuffer ya viene descargado (ver fetchImageBuffer en
 * reports.export.service.ts) — pdfkit no puede tomar una URL directo, y
 * esta funcion no hace I/O de red, solo dibuja lo que se le pasa.
 */
export function renderWorkerReportPdf(data: WorkerResumeReportData, photoBuffer: Buffer | null): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ margin: 0, size: "A4" });
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    const pageWidth = pdf.page.width;
    const pageHeight = pdf.page.height;
    const contentWidth = pageWidth - MARGIN_X * 2;

    function ensureSpace(height: number) {
      if (pdf.y + height > pageHeight - MARGIN_BOTTOM) {
        pdf.addPage({ margin: 0, size: "A4" });
        pdf.x = MARGIN_X;
        pdf.y = MARGIN_BOTTOM;
      }
    }

    function sectionTitle(title: string) {
      pdf.x = MARGIN_X;
      ensureSpace(28);
      pdf.rect(MARGIN_X, pdf.y + 2, 4, 13).fill(GOLD);
      pdf.fillColor(NAVY).font("Helvetica-Bold").fontSize(13).text(title, MARGIN_X + 10, pdf.y);
      pdf.moveDown(0.5);
      pdf.x = MARGIN_X;
    }

    // Tabla con encabezado navy/blanco — mismo pairing de contraste que el
    // resto de la app (navy-900 de fondo, texto claro encima).
    function styledTable(columns: string[], rows: string[][]) {
      pdf.x = MARGIN_X;
      if (rows.length === 0) {
        pdf.font("Helvetica").fontSize(10).fillColor(MUTED).text("Sin datos.", MARGIN_X);
        pdf.fillColor(NAVY);
        pdf.moveDown(1);
        return;
      }

      const colWidth = contentWidth / columns.length;

      function drawRow(cells: string[], isHeader: boolean) {
        pdf.font(isHeader ? "Helvetica-Bold" : "Helvetica").fontSize(9);
        const cellHeights = cells.map((cell) => pdf.heightOfString(cell, { width: colWidth - 8 }));
        const rowHeight = Math.max(16, ...cellHeights) + 8;

        ensureSpace(rowHeight);
        const startY = pdf.y;

        if (isHeader) {
          pdf.rect(MARGIN_X, startY, contentWidth, rowHeight).fill(NAVY);
        }
        pdf.fillColor(isHeader ? WHITE : NAVY);
        cells.forEach((cell, index) => {
          pdf.text(cell, MARGIN_X + index * colWidth + 4, startY + 4, { width: colWidth - 8 });
        });
        pdf.fillColor(NAVY);
        pdf.x = MARGIN_X;
        pdf.y = startY + rowHeight;
      }

      drawRow(columns, true);
      rows.forEach((row, index) => {
        drawRow(row, false);
        // Linea divisoria sutil entre filas de datos (no despues del header,
        // que ya tiene su propio bloque de color).
        if (index < rows.length - 1) {
          pdf.moveTo(MARGIN_X, pdf.y).lineTo(MARGIN_X + contentWidth, pdf.y).strokeColor(BORDER).stroke();
        }
      });
      pdf.moveDown(1.2);
    }

    function statPair(items: { label: string; value: string }[]) {
      const colWidth = contentWidth / items.length;
      const startY = pdf.y;
      ensureSpace(40);
      items.forEach((item, index) => {
        const x = MARGIN_X + index * colWidth;
        pdf.font("Helvetica").fontSize(9).fillColor(MUTED).text(item.label, x, startY, { width: colWidth - 8 });
        pdf
          .font("Helvetica-Bold")
          .fontSize(14)
          .fillColor(NAVY)
          .text(item.value, x, startY + 13, { width: colWidth - 8 });
      });
      pdf.x = MARGIN_X;
      pdf.y = startY + 40;
    }

    // ---------- Header tipo hoja de vida ----------
    pdf.rect(0, 0, pageWidth, 8).fill(NAVY);

    const photoSize = 80;
    const photoX = MARGIN_X;
    const photoY = 30;
    const photoCenterX = photoX + photoSize / 2;
    const photoCenterY = photoY + photoSize / 2;

    if (photoBuffer) {
      pdf.save();
      pdf.circle(photoCenterX, photoCenterY, photoSize / 2).clip();
      pdf.image(photoBuffer, photoX, photoY, { width: photoSize, height: photoSize, cover: [photoSize, photoSize] });
      pdf.restore();
    } else {
      pdf.save();
      pdf.circle(photoCenterX, photoCenterY, photoSize / 2).fill(NAVY);
      pdf.restore();
      const initials = getInitials(data.name);
      pdf
        .font("Helvetica-Bold")
        .fontSize(26)
        .fillColor(LIME)
        .text(initials, photoX, photoCenterY - 13, { width: photoSize, align: "center" });
    }

    const infoX = photoX + photoSize + 24;
    const infoWidth = pageWidth - MARGIN_X - infoX;

    pdf.font("Helvetica-Bold").fontSize(20).fillColor(NAVY).text(data.name, infoX, photoY - 2, { width: infoWidth });

    const roleLabel = ROLE_LABELS[data.role] ?? data.role;
    const roleY = photoY - 2 + pdf.heightOfString(data.name, { width: infoWidth }) + 6;
    pdf.font("Helvetica-Bold").fontSize(10);
    const roleWidth = pdf.widthOfString(roleLabel) + 16;
    pdf.roundedRect(infoX, roleY, roleWidth, 18, 9).fill(GOLD);
    pdf.fillColor(NAVY).text(roleLabel, infoX + 8, roleY + 4);

    const contactParts = [data.email, data.phone].filter((value): value is string => Boolean(value));
    pdf
      .font("Helvetica")
      .fontSize(10)
      .fillColor(MUTED)
      .text(contactParts.join("  ·  "), infoX, roleY + 26, { width: infoWidth });

    pdf.font("Helvetica-Bold").fontSize(12).fillColor(NAVY).text("DECS", 0, 20, { width: pageWidth - MARGIN_X, align: "right" });
    pdf
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED)
      .text("Hoja de vida", 0, 34, { width: pageWidth - MARGIN_X, align: "right" });

    const headerBottom = Math.max(photoY + photoSize, roleY + 26 + 16) + 20;
    pdf.moveTo(MARGIN_X, headerBottom).lineTo(pageWidth - MARGIN_X, headerBottom).strokeColor(GOLD).lineWidth(2).stroke();
    pdf.lineWidth(1);

    pdf.x = MARGIN_X;
    pdf.y = headerBottom + 20;

    // ---------- Perfil ----------
    sectionTitle("Perfil");

    const tenure = data.hireDate ? formatTenure(data.hireDate, data.generatedAt) : null;
    pdf.font("Helvetica").fontSize(10).fillColor(NAVY);
    pdf.text(
      data.hireDate
        ? `Fecha de ingreso: ${formatDateForReport(data.hireDate)} (${tenure} de antigüedad)`
        : "Fecha de ingreso: No especificada",
      MARGIN_X,
    );
    pdf.moveDown(0.4);
    pdf.text(
      data.workDaysPerWeek ? `Días de trabajo por semana: ${data.workDaysPerWeek}` : "Días de trabajo por semana: No especificado",
    );
    pdf.moveDown(0.4);
    pdf.text(`Horario: ${data.workScheduleNote ?? "No especificado"}`);
    pdf.moveDown(0.6);

    pdf.font("Helvetica").fontSize(10).fillColor(MUTED).text("Especialidades", MARGIN_X);
    pdf.moveDown(0.25);
    if (data.specialties.length === 0) {
      pdf.font("Helvetica").fontSize(10).fillColor(NAVY).text("No especificadas", MARGIN_X);
      pdf.moveDown(0.8);
    } else {
      const chipHeight = 20;
      let chipX = MARGIN_X;
      ensureSpace(chipHeight);
      let chipRowY = pdf.y;
      pdf.font("Helvetica").fontSize(9);
      for (const specialty of data.specialties) {
        const chipWidth = pdf.widthOfString(specialty) + 16;
        if (chipX + chipWidth > MARGIN_X + contentWidth) {
          chipX = MARGIN_X;
          pdf.y = chipRowY + chipHeight + 6;
          ensureSpace(chipHeight);
          chipRowY = pdf.y;
        }
        pdf.roundedRect(chipX, chipRowY, chipWidth, chipHeight, 10).fill(LIME);
        pdf.fillColor(NAVY).text(specialty, chipX + 8, chipRowY + 5);
        chipX += chipWidth + 8;
      }
      pdf.x = MARGIN_X;
      pdf.y = chipRowY + chipHeight + 12;
    }

    // ---------- Compensación ----------
    sectionTitle("Compensación");
    statPair([
      { label: "PRECIO POR HORA", value: data.hourlyRate ? formatCurrencyForReport(data.hourlyRate) : "No especificado" },
      {
        label: "PRECIO POR HORA EXTRA",
        value: data.overtimeHourlyRate ? formatCurrencyForReport(data.overtimeHourlyRate) : "No especificado",
      },
      { label: "HORAS TRABAJADAS (TOTAL)", value: `${data.totalHours} h` },
    ]);
    pdf.moveDown(0.6);

    // ---------- Liquidaciones ----------
    sectionTitle("Liquidaciones");
    styledTable(
      ["Período", "Horas normales", "Horas extra", "Pago neto", "Estado", "Pagada el"],
      data.payrollRuns.map((run) => [
        `${formatDateForReport(run.periodStart)} – ${formatDateForReport(run.periodEnd)}`,
        `${roundToOneDecimal(run.normalMinutes / 60)} h`,
        `${roundToOneDecimal(run.overtimeMinutes / 60)} h`,
        formatCurrencyForReport(run.netPay),
        run.status,
        formatDateForReport(run.paidAt),
      ]),
    );

    // ---------- Historial de aumentos ----------
    sectionTitle("Historial de aumentos");
    styledTable(
      ["Fecha", "Tarifa anterior", "Tarifa nueva", "Motivo", "Registrado por"],
      data.salaryHistory.map((raise) => [
        formatDateForReport(raise.createdAt),
        raise.previousRate ? formatCurrencyForReport(raise.previousRate) : "—",
        formatCurrencyForReport(raise.newRate),
        raise.reason ?? "—",
        raise.createdByName,
      ]),
    );

    // ---------- Puntaje del mes actual ----------
    sectionTitle(`Puntaje de ${String(data.monthlyScore.month).padStart(2, "0")}/${data.monthlyScore.year}`);
    statPair([
      { label: "PUNTAJE ACTUAL", value: String(data.monthlyScore.currentScore) },
      { label: "BASE DEL MES", value: String(data.monthlyScore.baseScore) },
    ]);
    pdf.moveDown(0.6);
    styledTable(
      ["Fecha", "Puntos", "Motivo", "Registrado por"],
      data.monthlyScore.events.map((event) => [
        formatDateForReport(event.createdAt),
        String(event.points),
        event.reason,
        event.createdByName,
      ]),
    );

    pdf.end();
  });
}
