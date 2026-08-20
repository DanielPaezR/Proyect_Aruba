import { PayrollStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import type { FinancialHistoryQuery } from "./financial-history.validators";

export type FinancialMovementType = "INGRESO" | "EGRESO";

export interface FinancialHistoryEntry {
  id: string;
  date: Date;
  type: FinancialMovementType;
  amount: number;
  recordedBy: { id: string; name: string };
  // Solo para INGRESO (viene de Payment, siempre tiene proyecto).
  projectId?: string;
  projectName?: string;
  clientId?: string | null;
  clientName?: string | null;
  // Solo para EGRESO (viene de PayrollRun).
  workerId?: string;
  workerName?: string;
  periodStart?: Date;
  periodEnd?: Date;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Combina Payment (ingresos) y PayrollRun en estado PAGADA (egresos) en una
 * sola vista — nunca duplica su logica de calculo, solo lee lo que ya existe
 * en cada uno. Los BORRADOR no cuentan (todavia no son un movimiento real,
 * ver comentario del modelo PayrollRun) y SalaryAdjustment no se suma aparte
 * (ya esta incorporado dentro de PayrollRun.netPay).
 *
 * userId solo aplica a egresos (un Payment no tiene trabajador asociado) y
 * projectId/clientId solo aplican a ingresos (un PayrollRun no tiene
 * proyecto/cliente) — cuando el filtro no aplica al otro lado, ese lado
 * queda fuera de la lista en vez de ignorar el filtro, para que "filtrar
 * por trabajador" realmente reduzca la lista a solo sus egresos.
 */
export async function getFinancialHistory(query: FinancialHistoryQuery) {
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (query.from) {
    dateFilter.gte = query.from;
  }
  if (query.to) {
    dateFilter.lte = query.to;
  }
  const hasDateFilter = Object.keys(dateFilter).length > 0;

  const includeIncome = query.type !== "EGRESO" && !query.userId;
  const includeExpense = query.type !== "INGRESO" && !query.projectId && !query.clientId;

  const [payments, payrollRuns] = await Promise.all([
    includeIncome
      ? prisma.payment.findMany({
          where: {
            ...(hasDateFilter ? { paymentDate: dateFilter } : {}),
            ...(query.projectId ? { projectId: query.projectId } : {}),
            ...(query.clientId ? { project: { clientId: query.clientId } } : {}),
          },
          include: {
            recordedBy: { select: { id: true, name: true } },
            project: { select: { id: true, name: true, client: { select: { id: true, name: true } } } },
          },
          orderBy: { paymentDate: "desc" },
        })
      : Promise.resolve([]),
    includeExpense
      ? prisma.payrollRun.findMany({
          where: {
            status: PayrollStatus.PAGADA,
            ...(hasDateFilter ? { paidAt: dateFilter } : {}),
            ...(query.userId ? { userId: query.userId } : {}),
          },
          include: {
            user: { select: { id: true, name: true } },
            generatedBy: { select: { id: true, name: true } },
          },
          orderBy: { paidAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const entries: FinancialHistoryEntry[] = [
    ...payments.map(
      (payment): FinancialHistoryEntry => ({
        id: payment.id,
        date: payment.paymentDate,
        type: "INGRESO",
        amount: Number(payment.amount),
        recordedBy: payment.recordedBy,
        projectId: payment.project.id,
        projectName: payment.project.name,
        clientId: payment.project.client?.id ?? null,
        clientName: payment.project.client?.name ?? null,
      }),
    ),
    // paidAt nunca es null aca: status=PAGADA lo garantiza (ver markPayrollPaid).
    ...payrollRuns.map(
      (run): FinancialHistoryEntry => ({
        id: run.id,
        date: run.paidAt!,
        type: "EGRESO",
        amount: Number(run.netPay),
        recordedBy: run.generatedBy,
        workerId: run.user.id,
        workerName: run.user.name,
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
      }),
    ),
  ];

  entries.sort((a, b) => b.date.getTime() - a.date.getTime());

  const totalIngresos = round2(payments.reduce((sum, payment) => sum + Number(payment.amount), 0));
  const totalEgresos = round2(payrollRuns.reduce((sum, run) => sum + Number(run.netPay), 0));
  const balance = round2(totalIngresos - totalEgresos);

  return { entries, totalIngresos, totalEgresos, balance };
}
