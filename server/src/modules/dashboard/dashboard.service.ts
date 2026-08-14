import { ActivityStatus, EvidenceStatus, ProjectPriority, ProjectStatus, PunchType } from "@prisma/client";
import { prisma } from "../../config/prisma";
import * as timeEntriesService from "../time-entries/time-entries.service";
import { arubaDateKey, arubaStartOfMonthUtc, arubaStartOfWeekUtc, arubaToday } from "../../utils/geo";

function dayRange(reference: Date) {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

const activitySummarySelect = {
  id: true,
  title: true,
  status: true,
  scheduledDate: true,
  project: { select: { id: true, name: true } },
} as const;

const PRIORITY_LEVELS: ProjectPriority[] = [
  ProjectPriority.URGENTE,
  ProjectPriority.ALTA,
  ProjectPriority.MEDIA,
  ProjectPriority.BAJA,
];

async function getSupervisorStats() {
  const thisWeekStart = arubaStartOfWeekUtc();
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    completedActivitiesThisWeek,
    completedActivitiesLastWeek,
    weekSummary,
    approvedLastMonth,
    rejectedLastMonth,
    activeProjects,
  ] = await Promise.all([
    prisma.activity.count({
      where: { status: ActivityStatus.COMPLETADA, completedAt: { gte: thisWeekStart } },
    }),
    prisma.activity.count({
      where: {
        status: ActivityStatus.COMPLETADA,
        completedAt: { gte: lastWeekStart, lt: thisWeekStart },
      },
    }),
    // Reusa el mismo pairing ENTRADA/SALIDA de time-entries.service.ts en vez
    // de reimplementarlo — sin userId trae a todos los TRABAJADOR_CAMPO.
    timeEntriesService.getSummary({ from: thisWeekStart }),
    prisma.evidence.count({
      where: { status: EvidenceStatus.APROBADA, reviewedAt: { gte: oneMonthAgo } },
    }),
    prisma.evidence.count({
      where: { status: EvidenceStatus.RECHAZADA, reviewedAt: { gte: oneMonthAgo } },
    }),
    prisma.project.findMany({
      where: { status: { notIn: [ProjectStatus.COMPLETADO, ProjectStatus.CANCELADO] } },
      select: { priority: true },
    }),
  ]);

  const teamHoursThisWeek = roundToOneDecimal(
    weekSummary.reduce((sum, userSummary) => sum + userSummary.totalMinutes, 0) / 60,
  );

  const topWorkersThisWeek = [...weekSummary]
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .slice(0, 3)
    .map((userSummary) => ({
      name: userSummary.user.name,
      hours: roundToOneDecimal(userSummary.totalMinutes / 60),
    }));

  const totalReviewedLastMonth = approvedLastMonth + rejectedLastMonth;
  // null (no un 0 o NaN) cuando no hubo revisiones — el cliente lo trata como
  // "sin datos todavia" en vez de mostrar una tasa de 0% enganosa.
  const evidenceApprovalRate =
    totalReviewedLastMonth === 0 ? null : Math.round((approvedLastMonth / totalReviewedLastMonth) * 100);

  const activeProjectsByPriority = Object.fromEntries(
    PRIORITY_LEVELS.map((level) => [level, activeProjects.filter((project) => project.priority === level).length]),
  ) as Record<ProjectPriority, number>;

  return {
    completedActivitiesThisWeek,
    completedActivitiesLastWeek,
    teamHoursThisWeek,
    evidenceApprovalRate,
    activeProjectsByPriority,
    topWorkersThisWeek,
  };
}

export async function getSupervisorDashboard(referenceDate = new Date()) {
  const { start, end } = dayRange(referenceDate);

  const [activitiesToday, pendingEvidencesCount, unassignedActivities, stats] = await Promise.all([
    prisma.activity.findMany({
      where: { scheduledDate: { gte: start, lt: end } },
      select: activitySummarySelect,
      orderBy: { scheduledDate: "asc" },
    }),
    prisma.evidence.count({ where: { status: EvidenceStatus.PENDIENTE } }),
    prisma.activity.findMany({
      where: {
        assignments: { none: {} },
        status: { notIn: [ActivityStatus.COMPLETADA, ActivityStatus.CANCELADA] },
      },
      select: activitySummarySelect,
      orderBy: { createdAt: "desc" },
    }),
    getSupervisorStats(),
  ]);

  const activitiesByStatus = Object.fromEntries(
    Object.values(ActivityStatus).map((status) => [
      status,
      activitiesToday.filter((activity) => activity.status === status),
    ]),
  ) as Record<ActivityStatus, typeof activitiesToday>;

  return {
    date: start,
    activitiesToday: {
      total: activitiesToday.length,
      byStatus: activitiesByStatus,
    },
    pendingEvidencesCount,
    unassignedActivities,
    stats,
  };
}

type DayEntry = { type: PunchType; timestamp: Date };

function dayHasCompletePair(dayEntries: DayEntry[]): boolean {
  let openEntradaAt: Date | null = null;
  for (const entry of dayEntries) {
    if (entry.type === PunchType.ENTRADA) {
      openEntradaAt = entry.timestamp;
    } else if (entry.type === PunchType.SALIDA && openEntradaAt) {
      return true;
    }
  }
  return false;
}

/**
 * Dias consecutivos (dentro de esta semana) con al menos un par ENTRADA+SALIDA
 * completo, contando hacia atras desde hoy. Si hoy todavia no tiene un par
 * completo (el dia esta en curso), no cuenta como que "rompio" la racha —
 * simplemente se evalua a partir de ayer.
 */
async function getPunchStreak(userId: string, weekStart: Date): Promise<number> {
  const entries = await prisma.timeEntry.findMany({
    where: { userId, timestamp: { gte: weekStart } },
    orderBy: { timestamp: "asc" },
    select: { type: true, timestamp: true },
  });

  const dayBuckets = new Map<string, DayEntry[]>();
  for (const entry of entries) {
    const key = arubaDateKey(entry.timestamp);
    const bucket = dayBuckets.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      dayBuckets.set(key, [entry]);
    }
  }

  const toDateKey = (d: Date) => d.toISOString().slice(0, 10);
  const weekStartKey = toDateKey(weekStart);

  let cursor = arubaToday();
  if (!dayHasCompletePair(dayBuckets.get(toDateKey(cursor)) ?? [])) {
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }

  let streak = 0;
  while (toDateKey(cursor) >= weekStartKey) {
    if (!dayHasCompletePair(dayBuckets.get(toDateKey(cursor)) ?? [])) {
      break;
    }
    streak += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }

  return streak;
}

export async function getWorkerDashboard(userId: string) {
  const thisWeekStart = arubaStartOfWeekUtc();
  const thisMonthStart = arubaStartOfMonthUtc();

  const [weekSummary, completedActivitiesThisMonth, pendingEvidencesCount, punchStreak] = await Promise.all([
    timeEntriesService.getSummary({ from: thisWeekStart, userId }),
    prisma.activity.count({
      where: {
        assignments: { some: { userId } },
        status: ActivityStatus.COMPLETADA,
        completedAt: { gte: thisMonthStart },
      },
    }),
    prisma.evidence.count({ where: { uploadedById: userId, status: EvidenceStatus.PENDIENTE } }),
    getPunchStreak(userId, thisWeekStart),
  ]);

  return {
    hoursThisWeek: roundToOneDecimal((weekSummary[0]?.totalMinutes ?? 0) / 60),
    completedActivitiesThisMonth,
    pendingEvidencesCount,
    punchStreak,
  };
}
