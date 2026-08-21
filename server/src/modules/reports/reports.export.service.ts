import { Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import * as projectsService from "../projects/projects.service";
import * as clientsService from "../clients/clients.service";
import * as paymentsService from "../payments/payments.service";
import * as payrollService from "../payroll/payroll.service";
import * as authService from "../auth/auth.service";
import { getSummary } from "../time-entries/time-entries.service";
import {
  formatCurrencyForReport,
  formatDateForReport,
  renderReportPdf,
  renderReportXlsx,
  type ReportDocument,
} from "./reportDocument";
import { renderWorkerReportPdf, type WorkerResumeReportData } from "./workerResumePdf";
import type { ExportReportQuery } from "./reports.validators";

type AuthUser = { id: string; role: Role };

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

async function buildProjectReport(user: AuthUser, projectId: string): Promise<ReportDocument> {
  const project = await projectsService.getProject(user, projectId);
  const [evidences, { payments, totalReceived }] = await Promise.all([
    prisma.evidence.findMany({
      where: { activity: { projectId } },
      include: {
        activity: { select: { title: true } },
        uploadedBy: { select: { name: true } },
        reviewedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    paymentsService.listForProject(projectId),
  ]);

  return {
    title: `Reporte de proyecto: ${project.name}`,
    subtitle: project.client ? `Cliente: ${project.client.name}` : "Sin cliente vinculado",
    generatedAt: new Date(),
    summary: [
      { label: "Estado", value: project.status },
      { label: "Cliente", value: project.client?.name ?? "Sin cliente" },
      { label: "Dirección", value: project.address ?? "—" },
      { label: "Creado el", value: formatDateForReport(project.createdAt) },
      { label: "Total de actividades", value: String(project.activities.length) },
      { label: "Total pagado", value: formatCurrencyForReport(totalReceived) },
    ],
    sections: [
      {
        title: "Actividades",
        columns: ["Título", "Estado", "Fecha programada", "Completada el", "Asignados"],
        rows: project.activities.map((activity) => [
          activity.title,
          activity.status,
          formatDateForReport(activity.scheduledDate),
          formatDateForReport(activity.completedAt),
          activity.assignments.map((assignment) => assignment.user.name).join(", ") || "—",
        ]),
      },
      {
        title: "Evidencias",
        columns: ["Actividad", "Estado", "Subida por", "Revisada por", "Fecha de subida"],
        rows: evidences.map((evidence) => [
          evidence.activity.title,
          evidence.status,
          evidence.uploadedBy.name,
          evidence.reviewedBy?.name ?? "—",
          formatDateForReport(evidence.createdAt),
        ]),
      },
      {
        title: "Pagos recibidos",
        columns: ["Fecha", "Monto", "Método", "Referencia", "Registrado por"],
        rows: payments.map((payment) => [
          formatDateForReport(payment.paymentDate),
          formatCurrencyForReport(Number(payment.amount)),
          payment.method,
          payment.reference ?? "—",
          payment.recordedBy.name,
        ]),
      },
    ],
  };
}

async function buildWorkerReport(user: AuthUser, userId: string): Promise<ReportDocument> {
  // Mismo porton de jerarquia que auth.service.ts: exportar el reporte de
  // un trabajador expone hourlyRate/overtimeHourlyRate/historial de
  // aumentos/puntaje — un ADMINISTRADOR no debe poder verlo de un GERENTE.
  await authService.ensureCanManageTarget(user, userId);

  const worker = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, email: true, hourlyRate: true, overtimeHourlyRate: true },
  });
  if (!worker) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }

  const [hoursSummary, payrollRuns, salaryHistory, monthlyScore] = await Promise.all([
    getSummary({ from: new Date(0), userId }),
    payrollService.listPayroll({ userId }),
    authService.getSalaryHistory(user, userId),
    authService.getMonthlyScore(user, userId),
  ]);
  const totalHours = roundToOneDecimal((hoursSummary[0]?.totalMinutes ?? 0) / 60);

  return {
    title: `Reporte de trabajador: ${worker.name}`,
    subtitle: `Rol: ${worker.role}`,
    generatedAt: new Date(),
    summary: [
      { label: "Email", value: worker.email },
      { label: "Precio por hora", value: worker.hourlyRate ? formatCurrencyForReport(worker.hourlyRate.toNumber()) : "No especificado" },
      {
        label: "Precio por hora extra",
        value: worker.overtimeHourlyRate ? formatCurrencyForReport(worker.overtimeHourlyRate.toNumber()) : "No especificado",
      },
      { label: "Horas trabajadas (total)", value: `${totalHours} h` },
      {
        label: `Puntaje de ${String(monthlyScore.month).padStart(2, "0")}/${monthlyScore.year}`,
        value: `${monthlyScore.currentScore} (base ${monthlyScore.baseScore})`,
      },
    ],
    sections: [
      {
        title: "Liquidaciones",
        columns: ["Período", "Horas normales", "Horas extra", "Pago neto", "Estado", "Pagada el"],
        rows: payrollRuns.map((run) => [
          `${formatDateForReport(run.periodStart)} – ${formatDateForReport(run.periodEnd)}`,
          `${roundToOneDecimal(run.normalMinutes / 60)} h`,
          `${roundToOneDecimal(run.overtimeMinutes / 60)} h`,
          formatCurrencyForReport(Number(run.netPay)),
          run.status,
          formatDateForReport(run.paidAt),
        ]),
      },
      {
        title: "Historial de aumentos",
        columns: ["Fecha", "Tarifa anterior", "Tarifa nueva", "Motivo", "Registrado por"],
        rows: salaryHistory.map((raise) => [
          formatDateForReport(raise.createdAt),
          raise.previousRate ? formatCurrencyForReport(raise.previousRate.toNumber()) : "—",
          formatCurrencyForReport(raise.newRate.toNumber()),
          raise.reason ?? "—",
          raise.createdBy.name,
        ]),
      },
      {
        title: "Eventos de puntaje (mes actual)",
        columns: ["Fecha", "Puntos", "Motivo", "Registrado por"],
        rows: monthlyScore.events.map((event) => [
          formatDateForReport(event.createdAt),
          String(event.points),
          event.reason,
          event.createdBy.name,
        ]),
      },
    ],
  };
}

const PHOTO_FETCH_TIMEOUT_MS = 8000;
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Descarga la foto de perfil a un Buffer — pdfkit no puede tomar una URL
 * directo. Nunca lanza: cualquier falla (red, tipo no soportado por
 * pdfkit —solo JPEG/PNG—, respuesta no-2xx, timeout) devuelve null y el
 * renderer cae al placeholder de iniciales en vez de romper el PDF entero
 * por una foto inaccesible.
 */
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PHOTO_FETCH_TIMEOUT_MS);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("jpeg") && !contentType.includes("jpg") && !contentType.includes("png")) {
      // pdfkit solo soporta JPEG/PNG — una foto subida como WEBP (el
      // cliente lo acepta, ver profile.ts) no se puede incrustar.
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > PHOTO_MAX_BYTES) {
      return null;
    }
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

async function buildWorkerResumeReport(
  user: AuthUser,
  userId: string,
): Promise<{ data: WorkerResumeReportData; photoUrl: string | null }> {
  await authService.ensureCanManageTarget(user, userId);

  const worker = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      role: true,
      email: true,
      phone: true,
      photoUrl: true,
      hireDate: true,
      specialties: true,
      workDaysPerWeek: true,
      workScheduleNote: true,
      hourlyRate: true,
      overtimeHourlyRate: true,
    },
  });
  if (!worker) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }

  const [hoursSummary, payrollRuns, salaryHistory, monthlyScore] = await Promise.all([
    getSummary({ from: new Date(0), userId }),
    payrollService.listPayroll({ userId }),
    authService.getSalaryHistory(user, userId),
    authService.getMonthlyScore(user, userId),
  ]);

  return {
    data: {
      name: worker.name,
      role: worker.role,
      email: worker.email,
      phone: worker.phone,
      hireDate: worker.hireDate,
      specialties: worker.specialties,
      workDaysPerWeek: worker.workDaysPerWeek,
      workScheduleNote: worker.workScheduleNote,
      hourlyRate: worker.hourlyRate ? worker.hourlyRate.toNumber() : null,
      overtimeHourlyRate: worker.overtimeHourlyRate ? worker.overtimeHourlyRate.toNumber() : null,
      totalHours: roundToOneDecimal((hoursSummary[0]?.totalMinutes ?? 0) / 60),
      payrollRuns: payrollRuns.map((run) => ({
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
        normalMinutes: run.normalMinutes,
        overtimeMinutes: run.overtimeMinutes,
        netPay: Number(run.netPay),
        status: run.status,
        paidAt: run.paidAt,
      })),
      salaryHistory: salaryHistory.map((raise) => ({
        createdAt: raise.createdAt,
        previousRate: raise.previousRate ? raise.previousRate.toNumber() : null,
        newRate: raise.newRate.toNumber(),
        reason: raise.reason,
        createdByName: raise.createdBy.name,
      })),
      monthlyScore: {
        month: monthlyScore.month,
        year: monthlyScore.year,
        currentScore: monthlyScore.currentScore,
        baseScore: monthlyScore.baseScore,
        events: monthlyScore.events.map((event) => ({
          createdAt: event.createdAt,
          points: event.points,
          reason: event.reason,
          createdByName: event.createdBy.name,
        })),
      },
      generatedAt: new Date(),
    },
    photoUrl: worker.photoUrl,
  };
}

async function buildClientReport(clientId: string): Promise<ReportDocument> {
  const client = await clientsService.getClient(clientId);
  const { payments, totalReceived } = await paymentsService.listForClient(clientId);

  return {
    title: `Reporte de cliente: ${client.name}`,
    subtitle: client.email ? `${client.phone} · ${client.email}` : client.phone,
    generatedAt: new Date(),
    summary: [
      { label: "Teléfono", value: client.phone },
      { label: "Email", value: client.email ?? "—" },
      { label: "Total de proyectos", value: String(client.projects.length) },
      { label: "Total pagado (todos los proyectos)", value: formatCurrencyForReport(totalReceived) },
    ],
    sections: [
      {
        title: "Proyectos",
        columns: ["Nombre", "Estado", "Creado el"],
        rows: client.projects.map((project) => [project.name, project.status, formatDateForReport(project.createdAt)]),
      },
      {
        title: "Historial de pagos",
        columns: ["Proyecto", "Fecha", "Monto", "Método", "Referencia", "Registrado por"],
        rows: payments.map((payment) => [
          payment.project.name,
          formatDateForReport(payment.paymentDate),
          formatCurrencyForReport(Number(payment.amount)),
          payment.method,
          payment.reference ?? "—",
          payment.recordedBy.name,
        ]),
      },
    ],
  };
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();
}

export interface GeneratedReportFile {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

// PDF de trabajador: "hoja de vida" dedicada (foto + perfil), NO la tabla
// generica — el Excel de trabajador y los PDF de proyecto/cliente siguen
// el camino generico de abajo sin cambios.
async function generateWorkerResumePdf(user: AuthUser, userId: string): Promise<GeneratedReportFile> {
  const { data, photoUrl } = await buildWorkerResumeReport(user, userId);
  const photoBuffer = photoUrl ? await fetchImageBuffer(photoUrl) : null;
  const buffer = await renderWorkerReportPdf(data, photoBuffer);

  return {
    buffer,
    filename: `${slugify(`hoja-de-vida-${data.name}`)}.pdf`,
    contentType: "application/pdf",
  };
}

export async function generateReportExport(user: AuthUser, query: ExportReportQuery): Promise<GeneratedReportFile> {
  if (query.type === "worker" && query.format === "pdf") {
    return generateWorkerResumePdf(user, query.id);
  }

  let doc: ReportDocument;
  if (query.type === "project") {
    doc = await buildProjectReport(user, query.id);
  } else if (query.type === "worker") {
    doc = await buildWorkerReport(user, query.id);
  } else {
    doc = await buildClientReport(query.id);
  }

  const buffer =
    query.format === "pdf" ? await renderReportPdf(doc) : await renderReportXlsx(doc);

  const extension = query.format === "pdf" ? "pdf" : "xlsx";
  const contentType =
    query.format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  return {
    buffer,
    filename: `${slugify(doc.title)}.${extension}`,
    contentType,
  };
}
