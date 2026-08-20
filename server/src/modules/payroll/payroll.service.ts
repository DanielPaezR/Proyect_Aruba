import { PayrollStatus, SalaryAdjustmentType } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import { arubaDayRangeUtc } from "../../utils/geo";
import * as timeEntriesService from "../time-entries/time-entries.service";
import type { GeneratePayrollInput, ListPayrollQuery, PreviewPayrollQuery } from "./payroll.validators";

const payrollRunInclude = {
  user: { select: { id: true, name: true } },
  generatedBy: { select: { id: true, name: true } },
} as const;

interface PayrollPeriodInput {
  userId: string;
  periodStart: string;
  periodEnd: string;
}

interface PayrollCalculation {
  userId: string;
  user: { id: string; name: string };
  periodStart: Date;
  periodEnd: Date;
  normalMinutes: number;
  overtimeMinutes: number;
  normalPay: number;
  overtimePay: number;
  totalAdvances: number;
  totalDeductions: number;
  netPay: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Combina horas trabajadas (reusando timeEntriesService.getSummary sobre el
 * rango [periodStart, periodEnd) exclusivo) + tarifas de User +
 * SalaryAdjustment del mismo rango. Compartido por previewPayroll (solo
 * lectura) y generatePayroll (persiste el resultado) — el preview tiene que
 * dar exactamente los mismos numeros que terminan guardados, incluidas las
 * mismas validaciones/errores (tarifa faltante, periodo ya pagado), para que
 * quien revisa el preview no se lleve una sorpresa distinta al confirmar.
 */
async function computePayroll(input: PayrollPeriodInput): Promise<PayrollCalculation> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, name: true, hourlyRate: true, overtimeHourlyRate: true },
  });
  if (!user) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }
  if (user.hourlyRate === null) {
    throw ApiError.badRequest(
      ErrorCode.HOURLY_RATE_NOT_SET,
      "Este trabajador no tiene un precio por hora configurado — no se puede liquidar sin tarifa",
    );
  }

  // periodStart/periodEnd se guardan (si se genera) como el dia calendario
  // elegido (ambos inclusive); queryEnd es solo para las consultas de este
  // rango, nunca se persiste (ver comentario del modelo PayrollRun en
  // schema.prisma).
  const periodStart = arubaDayRangeUtc(input.periodStart).start;
  const periodEnd = arubaDayRangeUtc(input.periodEnd).start;
  const queryEnd = arubaDayRangeUtc(input.periodEnd).end;

  const alreadyPaid = await prisma.payrollRun.findFirst({
    where: { userId: input.userId, periodStart, periodEnd, status: PayrollStatus.PAGADA },
    select: { id: true },
  });
  if (alreadyPaid) {
    throw ApiError.conflict(
      ErrorCode.PAYROLL_PERIOD_ALREADY_PAID,
      "Ya existe una liquidación pagada para este trabajador en este período exacto",
    );
  }

  const [summaryBuckets, adjustments] = await Promise.all([
    timeEntriesService.getSummary({ userId: input.userId, from: periodStart, to: queryEnd }),
    prisma.salaryAdjustment.findMany({
      where: { userId: input.userId, effectiveDate: { gte: periodStart, lt: queryEnd } },
    }),
  ]);

  const bucket = summaryBuckets[0];
  const normalMinutes = bucket?.normalMinutes ?? 0;
  const overtimeMinutes = bucket?.overtimeMinutes ?? 0;

  if (overtimeMinutes > 0 && user.overtimeHourlyRate === null) {
    throw ApiError.badRequest(
      ErrorCode.OVERTIME_RATE_NOT_SET,
      "Este trabajador tiene horas extra en el período pero no tiene un precio por hora extra configurado",
    );
  }

  const normalPay = round2((normalMinutes / 60) * Number(user.hourlyRate));
  const overtimePay = round2(user.overtimeHourlyRate ? (overtimeMinutes / 60) * Number(user.overtimeHourlyRate) : 0);

  const totalAdvances = round2(
    adjustments
      .filter((adjustment) => adjustment.type === SalaryAdjustmentType.ADELANTO)
      .reduce((sum, adjustment) => sum + Number(adjustment.amount), 0),
  );
  const totalDeductions = round2(
    adjustments
      .filter((adjustment) => adjustment.type === SalaryAdjustmentType.DESCUENTO)
      .reduce((sum, adjustment) => sum + Number(adjustment.amount), 0),
  );

  const netPay = round2(normalPay + overtimePay - totalAdvances - totalDeductions);

  return {
    userId: input.userId,
    user: { id: user.id, name: user.name },
    periodStart,
    periodEnd,
    normalMinutes,
    overtimeMinutes,
    normalPay,
    overtimePay,
    totalAdvances,
    totalDeductions,
    netPay,
  };
}

/** Solo lectura: mismo calculo que generatePayroll, nunca crea un PayrollRun. */
export async function previewPayroll(query: PreviewPayrollQuery): Promise<PayrollCalculation> {
  return computePayroll(query);
}

export async function generatePayroll(generatedById: string, input: GeneratePayrollInput) {
  const calculation = await computePayroll(input);

  return prisma.payrollRun.create({
    data: {
      userId: calculation.userId,
      periodStart: calculation.periodStart,
      periodEnd: calculation.periodEnd,
      normalMinutes: calculation.normalMinutes,
      overtimeMinutes: calculation.overtimeMinutes,
      normalPay: calculation.normalPay,
      overtimePay: calculation.overtimePay,
      totalAdvances: calculation.totalAdvances,
      totalDeductions: calculation.totalDeductions,
      netPay: calculation.netPay,
      generatedById,
    },
    include: payrollRunInclude,
  });
}

export async function listPayroll(query: ListPayrollQuery) {
  const periodStartFilter: { gte?: Date; lte?: Date } = {};
  if (query.from) {
    periodStartFilter.gte = arubaDayRangeUtc(query.from).start;
  }
  if (query.to) {
    periodStartFilter.lte = arubaDayRangeUtc(query.to).start;
  }

  return prisma.payrollRun.findMany({
    where: {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(Object.keys(periodStartFilter).length > 0 ? { periodStart: periodStartFilter } : {}),
    },
    include: payrollRunInclude,
    orderBy: { periodStart: "desc" },
  });
}

export async function markPayrollPaid(id: string) {
  const run = await prisma.payrollRun.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!run) {
    throw ApiError.notFound(ErrorCode.PAYROLL_RUN_NOT_FOUND, "Liquidación no encontrada");
  }
  if (run.status === PayrollStatus.PAGADA) {
    throw ApiError.conflict(ErrorCode.PAYROLL_RUN_ALREADY_PAID, "Esta liquidación ya está marcada como pagada");
  }

  return prisma.payrollRun.update({
    where: { id },
    data: { status: PayrollStatus.PAGADA, paidAt: new Date() },
    include: payrollRunInclude,
  });
}
