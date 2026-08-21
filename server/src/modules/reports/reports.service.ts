import { ActivityStatus, EvidenceStatus, PunchType, Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { walkClosedSessions, getSummary } from "../time-entries/time-entries.service";
import type { PerformanceReportQuery } from "./reports.validators";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function dateRange(from?: Date, to?: Date): { gte?: Date; lte?: Date } | undefined {
  if (!from && !to) {
    return undefined;
  }
  return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
}

/**
 * Costo promedio por actividad completada: para cada Activity COMPLETADA en
 * el rango, suma (minutos trabajados por sus asignados EN ESE activityId,
 * via TimeEntry.activityId, emparejados con el mismo pairing ENTRADA/SALIDA
 * que time-entries.service.ts) x hourlyRate de cada uno / 60, y promedia
 * entre todas las actividades completadas que califican. Una actividad sin
 * marcaciones ligadas a su activityId (el caso mas comun hoy — el cliente
 * todavia no ofrece "marcar para esta actividad") cuenta con costo 0, no se
 * excluye del promedio: sigue siendo una actividad completada real.
 */
async function getAvgCostPerCompletedActivity(filters: {
  from?: Date;
  to?: Date;
  projectId?: string;
  userId?: string;
}): Promise<{ avgCost: number | null; completedActivitiesCount: number }> {
  const completedAt = dateRange(filters.from, filters.to);

  const activities = await prisma.activity.findMany({
    where: {
      status: ActivityStatus.COMPLETADA,
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(completedAt ? { completedAt } : {}),
    },
    select: { id: true },
  });

  if (activities.length === 0) {
    return { avgCost: null, completedActivitiesCount: 0 };
  }

  const activityIds = activities.map((activity) => activity.id);

  const entries = await prisma.timeEntry.findMany({
    where: {
      activityId: { in: activityIds },
      ...(filters.userId ? { userId: filters.userId } : {}),
    },
    select: { activityId: true, userId: true, type: true, timestamp: true },
    orderBy: [{ activityId: "asc" }, { userId: "asc" }, { timestamp: "asc" }],
  });

  const userIds = [...new Set(entries.map((entry) => entry.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, hourlyRate: true },
  });
  const rateByUser = new Map(users.map((user) => [user.id, user.hourlyRate ? user.hourlyRate.toNumber() : null]));

  // activityId -> userId -> entradas/salidas ligadas a esa actividad puntual.
  const byActivity = new Map<string, Map<string, { type: PunchType; timestamp: Date }[]>>();
  for (const entry of entries) {
    if (!entry.activityId) continue;
    let byUser = byActivity.get(entry.activityId);
    if (!byUser) {
      byUser = new Map();
      byActivity.set(entry.activityId, byUser);
    }
    let userEntries = byUser.get(entry.userId);
    if (!userEntries) {
      userEntries = [];
      byUser.set(entry.userId, userEntries);
    }
    userEntries.push({ type: entry.type, timestamp: entry.timestamp });
  }

  let totalCost = 0;
  for (const activityId of activityIds) {
    const byUser = byActivity.get(activityId);
    if (!byUser) continue;
    for (const [userId, userEntries] of byUser) {
      const rate = rateByUser.get(userId);
      if (!rate) continue;
      const { netMinutes } = walkClosedSessions(userEntries);
      totalCost += (netMinutes / 60) * rate;
    }
  }

  return {
    avgCost: round2(totalCost / activities.length),
    completedActivitiesCount: activities.length,
  };
}

/**
 * Tiempo de demora promedio por proyecto: promedio de (fecha de la ultima
 * actividad completada del proyecto - project.createdAt) en dias, para
 * proyectos con al menos una actividad completada en el rango.
 */
async function getAvgProjectDelayDays(filters: {
  from?: Date;
  to?: Date;
  projectId?: string;
}): Promise<{ avgDelayDays: number | null; projectsCount: number }> {
  const completedAt = dateRange(filters.from, filters.to);

  const activities = await prisma.activity.findMany({
    where: {
      status: ActivityStatus.COMPLETADA,
      completedAt: { not: null },
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(completedAt ? { completedAt } : {}),
    },
    select: { projectId: true, completedAt: true, project: { select: { createdAt: true } } },
  });

  if (activities.length === 0) {
    return { avgDelayDays: null, projectsCount: 0 };
  }

  const byProject = new Map<string, { createdAt: Date; latestCompletedAt: Date }>();
  for (const activity of activities) {
    const completed = activity.completedAt!;
    const existing = byProject.get(activity.projectId);
    if (!existing) {
      byProject.set(activity.projectId, { createdAt: activity.project.createdAt, latestCompletedAt: completed });
    } else if (completed > existing.latestCompletedAt) {
      existing.latestCompletedAt = completed;
    }
  }

  const delaysInDays = [...byProject.values()].map(
    (entry) => (entry.latestCompletedAt.getTime() - entry.createdAt.getTime()) / (1000 * 60 * 60 * 24),
  );
  const avgDelayDays = delaysInDays.reduce((sum, days) => sum + days, 0) / delaysInDays.length;

  return { avgDelayDays: roundToOneDecimal(avgDelayDays), projectsCount: byProject.size };
}

export interface ApprovalBreakdown {
  approved: number;
  rejected: number;
  rate: number | null;
}

function toRate(approved: number, total: number): number | null {
  return total === 0 ? null : Math.round((approved / total) * 100);
}

/**
 * Ratio de aprobacion de evidencias, reutilizando el mismo criterio que
 * dashboard.service.ts (APROBADA / (APROBADA + RECHAZADA), null sin datos
 * en vez de 0%), pero desglosado por proyecto y por trabajador ademas del
 * total global.
 */
async function getEvidenceApproval(filters: {
  from?: Date;
  to?: Date;
  projectId?: string;
  userId?: string;
}): Promise<{
  overall: ApprovalBreakdown;
  byProject: (ApprovalBreakdown & { projectId: string; projectName: string })[];
  byWorker: (ApprovalBreakdown & { userId: string; userName: string })[];
}> {
  const reviewedAt = dateRange(filters.from, filters.to);

  const evidences = await prisma.evidence.findMany({
    where: {
      status: { in: [EvidenceStatus.APROBADA, EvidenceStatus.RECHAZADA] },
      ...(filters.userId ? { uploadedById: filters.userId } : {}),
      ...(filters.projectId ? { activity: { projectId: filters.projectId } } : {}),
      ...(reviewedAt ? { reviewedAt } : {}),
    },
    select: {
      status: true,
      uploadedById: true,
      uploadedBy: { select: { id: true, name: true } },
      activity: { select: { projectId: true, project: { select: { id: true, name: true } } } },
    },
  });

  const byProjectMap = new Map<string, { name: string; approved: number; total: number }>();
  const byWorkerMap = new Map<string, { name: string; approved: number; total: number }>();
  let overallApproved = 0;

  for (const evidence of evidences) {
    const isApproved = evidence.status === EvidenceStatus.APROBADA;
    if (isApproved) overallApproved += 1;

    const projectId = evidence.activity.projectId;
    const project = byProjectMap.get(projectId) ?? { name: evidence.activity.project.name, approved: 0, total: 0 };
    project.total += 1;
    if (isApproved) project.approved += 1;
    byProjectMap.set(projectId, project);

    const worker = byWorkerMap.get(evidence.uploadedById) ?? { name: evidence.uploadedBy.name, approved: 0, total: 0 };
    worker.total += 1;
    if (isApproved) worker.approved += 1;
    byWorkerMap.set(evidence.uploadedById, worker);
  }

  return {
    overall: {
      approved: overallApproved,
      rejected: evidences.length - overallApproved,
      rate: toRate(overallApproved, evidences.length),
    },
    byProject: [...byProjectMap.entries()].map(([projectId, value]) => ({
      projectId,
      projectName: value.name,
      approved: value.approved,
      rejected: value.total - value.approved,
      rate: toRate(value.approved, value.total),
    })),
    byWorker: [...byWorkerMap.entries()].map(([userId, value]) => ({
      userId,
      userName: value.name,
      approved: value.approved,
      rejected: value.total - value.approved,
      rate: toRate(value.approved, value.total),
    })),
  };
}

export interface WorkerProductivity {
  userId: string;
  userName: string;
  completedActivities: number;
  hoursWorked: number;
  // null si el trabajador no tiene horas en el rango — dividir entre 0 no
  // tiene un resultado sensato, mismo criterio que evidenceApprovalRate.
  activitiesPerHour: number | null;
}

/**
 * Productividad por trabajador: actividades completadas / horas trabajadas
 * totales en el rango, por cada TRABAJADOR_CAMPO. Las horas totales
 * reutilizan timeEntriesService.getSummary (mismo pairing ENTRADA/SALIDA
 * que el resto de la app) y a proposito NO quedan acotadas por projectId —
 * "horas trabajadas totales" es del trabajador en el rango, no solo las
 * ligadas (via activityId) a un proyecto puntual, ya que la mayoria de
 * marcaciones hoy no llevan activityId. projectId si acota el numerador
 * (actividades completadas de ESE proyecto).
 */
async function getProductivityByWorker(filters: {
  from?: Date;
  to?: Date;
  projectId?: string;
  userId?: string;
}): Promise<WorkerProductivity[]> {
  const completedAt = dateRange(filters.from, filters.to);

  const workers = await prisma.user.findMany({
    where: {
      role: Role.TRABAJADOR_CAMPO,
      ...(filters.userId ? { id: filters.userId } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (workers.length === 0) {
    return [];
  }

  // getSummary usa "hoy" como default cuando no se manda from/to/date — un
  // reporte sin rango explicito quiere "todo el historial", no solo hoy.
  const summaries = await getSummary({
    from: filters.from ?? new Date(0),
    to: filters.to,
    userId: filters.userId,
  });
  const hoursByUser = new Map(summaries.map((summary) => [summary.user.id, summary.totalMinutes / 60]));

  return Promise.all(
    workers.map(async (worker) => {
      const completedActivities = await prisma.activity.count({
        where: {
          assignments: { some: { userId: worker.id } },
          status: ActivityStatus.COMPLETADA,
          ...(filters.projectId ? { projectId: filters.projectId } : {}),
          ...(completedAt ? { completedAt } : {}),
        },
      });
      const hoursWorked = roundToOneDecimal(hoursByUser.get(worker.id) ?? 0);

      return {
        userId: worker.id,
        userName: worker.name,
        completedActivities,
        hoursWorked,
        activitiesPerHour: hoursWorked > 0 ? round2(completedActivities / hoursWorked) : null,
      };
    }),
  );
}

export async function getPerformanceReport(query: PerformanceReportQuery) {
  const filters = { from: query.from, to: query.to, projectId: query.projectId, userId: query.userId };

  const [costResult, delayResult, evidenceApproval, productivityByWorker] = await Promise.all([
    getAvgCostPerCompletedActivity(filters),
    getAvgProjectDelayDays(filters),
    getEvidenceApproval(filters),
    getProductivityByWorker(filters),
  ]);

  return {
    filters: {
      from: query.from ?? null,
      to: query.to ?? null,
      projectId: query.projectId ?? null,
      userId: query.userId ?? null,
    },
    avgCostPerCompletedActivity: costResult.avgCost,
    completedActivitiesCount: costResult.completedActivitiesCount,
    avgProjectDelayDays: delayResult.avgDelayDays,
    projectsWithCompletedActivityCount: delayResult.projectsCount,
    evidenceApproval,
    productivityByWorker,
  };
}
