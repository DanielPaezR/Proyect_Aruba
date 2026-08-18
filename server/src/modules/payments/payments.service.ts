import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import type { CreatePaymentInput } from "./payments.validators";

const paymentInclude = {
  recordedBy: { select: { id: true, name: true } },
} as const;

function sumAmounts(payments: { amount: unknown }[]): number {
  return payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
}

async function ensureProjectHasClient(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, clientId: true } });
  if (!project) {
    throw ApiError.notFound(ErrorCode.PROJECT_NOT_FOUND, "Proyecto no encontrado");
  }
  if (!project.clientId) {
    throw ApiError.badRequest(
      ErrorCode.PROJECT_HAS_NO_CLIENT,
      "El proyecto no tiene un cliente vinculado — vincula uno antes de registrar pagos",
    );
  }
}

async function ensureClientExists(clientId: string) {
  const exists = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!exists) {
    throw ApiError.notFound(ErrorCode.CLIENT_NOT_FOUND, "Cliente no encontrado");
  }
}

export async function listForProject(projectId: string) {
  const payments = await prisma.payment.findMany({
    where: { projectId },
    include: paymentInclude,
    orderBy: { paymentDate: "desc" },
  });

  return { payments, totalReceived: sumAmounts(payments) };
}

/** Historial completo de un cliente, across todos sus proyectos — no solo por proyecto individual. */
export async function listForClient(clientId: string) {
  await ensureClientExists(clientId);

  const payments = await prisma.payment.findMany({
    where: { project: { clientId } },
    include: {
      ...paymentInclude,
      project: { select: { id: true, name: true } },
    },
    orderBy: { paymentDate: "desc" },
  });

  return { payments, totalReceived: sumAmounts(payments) };
}

export async function createPayment(recorderId: string, projectId: string, input: CreatePaymentInput) {
  await ensureProjectHasClient(projectId);

  return prisma.payment.create({
    data: {
      projectId,
      recordedById: recorderId,
      amount: input.amount,
      paymentDate: input.paymentDate,
      method: input.method,
      reference: input.reference,
      notes: input.notes,
    },
    include: paymentInclude,
  });
}

export async function deletePayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { id: true } });
  if (!payment) {
    throw ApiError.notFound(ErrorCode.PAYMENT_NOT_FOUND, "Pago no encontrado");
  }
  await prisma.payment.delete({ where: { id: paymentId } });
}
