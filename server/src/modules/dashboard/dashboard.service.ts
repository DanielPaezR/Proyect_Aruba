import { ActivityStatus, EvidenceStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";

function dayRange(reference: Date) {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

const activitySummarySelect = {
  id: true,
  title: true,
  status: true,
  scheduledDate: true,
  project: { select: { id: true, name: true } },
} as const;

export async function getSupervisorDashboard(referenceDate = new Date()) {
  const { start, end } = dayRange(referenceDate);

  const [activitiesToday, pendingEvidencesCount, unassignedActivities] = await Promise.all([
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
  };
}
