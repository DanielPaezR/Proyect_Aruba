import { Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import type {
  CreateToolIncidentReportInput,
  ListToolIncidentReportsQuery,
  ResolveToolIncidentReportInput,
} from "./tool-incident-reports.validators";

type AuthUser = { id: string; role: Role };

// Quien puede reportar a nombre de otro (ademas del propio trabajador que
// tiene la herramienta a cargo) — mismo criterio que "omitir actividad":
// el dueño del recurso, o gestion.
const OVERRIDE_ROLES: Role[] = [Role.JEFE, Role.SUPERVISOR, Role.MERCADERISTA];

const toolIncidentReportInclude = {
  reportedBy: { select: { id: true, name: true } },
  toolAssignment: {
    select: {
      id: true,
      item: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
    },
  },
} as const;

async function getReportOrThrow(reportId: string) {
  const report = await prisma.toolIncidentReport.findUnique({ where: { id: reportId } });
  if (!report) {
    throw ApiError.notFound(ErrorCode.TOOL_INCIDENT_REPORT_NOT_FOUND, "Reporte no encontrado");
  }
  return report;
}

export async function listToolIncidentReports(filters: ListToolIncidentReportsQuery) {
  return prisma.toolIncidentReport.findMany({
    where: {
      ...(filters.status === "PENDIENTE" ? { resolvedAt: null } : {}),
      ...(filters.status === "RESUELTO" ? { resolvedAt: { not: null } } : {}),
    },
    include: toolIncidentReportInclude,
    orderBy: { reportedAt: "asc" },
  });
}

export async function createToolIncidentReport(user: AuthUser, input: CreateToolIncidentReportInput) {
  const assignment = await prisma.toolAssignment.findUnique({ where: { id: input.toolAssignmentId } });
  if (!assignment) {
    throw ApiError.notFound(ErrorCode.TOOL_ASSIGNMENT_NOT_FOUND, "Asignación de herramienta no encontrada");
  }

  const isHolder = assignment.userId === user.id;
  if (!isHolder && !OVERRIDE_ROLES.includes(user.role)) {
    throw ApiError.forbidden(ErrorCode.TOOL_NOT_ASSIGNED_TO_YOU, "Esta herramienta no está a tu cargo");
  }

  return prisma.toolIncidentReport.create({
    data: {
      toolAssignmentId: input.toolAssignmentId,
      reportedById: user.id,
      type: input.type,
      description: input.description,
    },
    include: toolIncidentReportInclude,
  });
}

export async function resolveToolIncidentReport(reportId: string, input: ResolveToolIncidentReportInput) {
  const existing = await getReportOrThrow(reportId);
  if (existing.resolvedAt) {
    throw ApiError.forbidden(ErrorCode.TOOL_INCIDENT_ALREADY_RESOLVED, "Este reporte ya fue resuelto");
  }

  return prisma.toolIncidentReport.update({
    where: { id: reportId },
    data: { resolvedAt: new Date(), resolutionNote: input.resolutionNote },
    include: toolIncidentReportInclude,
  });
}
