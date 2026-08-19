import { MaterialRequestStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import type {
  CreateMaterialRequestInput,
  ListMaterialRequestsQuery,
  ResolveMaterialRequestInput,
} from "./material-requests.validators";

const materialRequestInclude = {
  requestedBy: { select: { id: true, name: true, role: true } },
  resolvedBy: { select: { id: true, name: true } },
  item: { select: { id: true, name: true, unit: true, type: true } },
  project: { select: { id: true, name: true } },
} as const;

// Desde donde se puede pasar a cada estado — PENDIENTE es el unico punto de
// entrada real (una solicitud recien creada), APROBADA puede pasar despues a
// ENTREGADA (entrega en un segundo momento); RECHAZADA/ENTREGADA son
// terminales (ENTREGADA ya desconto stock, resolver de nuevo lo duplicaria).
const ALLOWED_TRANSITIONS: Record<MaterialRequestStatus, MaterialRequestStatus[]> = {
  [MaterialRequestStatus.PENDIENTE]: [
    MaterialRequestStatus.APROBADA,
    MaterialRequestStatus.RECHAZADA,
    MaterialRequestStatus.ENTREGADA,
  ],
  [MaterialRequestStatus.APROBADA]: [MaterialRequestStatus.ENTREGADA],
  [MaterialRequestStatus.RECHAZADA]: [],
  [MaterialRequestStatus.ENTREGADA]: [],
};

async function getRequestOrThrow(requestId: string) {
  const request = await prisma.materialRequest.findUnique({ where: { id: requestId } });
  if (!request) {
    throw ApiError.notFound(ErrorCode.MATERIAL_REQUEST_NOT_FOUND, "Solicitud de material no encontrada");
  }
  return request;
}

export async function listMaterialRequests(filters: ListMaterialRequestsQuery) {
  return prisma.materialRequest.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: materialRequestInclude,
    orderBy: { createdAt: "asc" },
  });
}

/** Historial propio del trabajador/supervisor que pidio — mas reciente primero
 * (a diferencia de la cola de trabajo, que es FIFO ascendente por createdAt). */
export async function listMyMaterialRequests(requesterId: string, filters: ListMaterialRequestsQuery) {
  return prisma.materialRequest.findMany({
    where: {
      requestedById: requesterId,
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: materialRequestInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function createMaterialRequest(requesterId: string, input: CreateMaterialRequestInput) {
  if (input.itemId) {
    const item = await prisma.inventoryItem.findUnique({ where: { id: input.itemId }, select: { id: true } });
    if (!item) {
      throw ApiError.notFound(ErrorCode.INVENTORY_ITEM_NOT_FOUND, "Ítem de inventario no encontrado");
    }
  }

  if (input.projectId) {
    const project = await prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
    if (!project) {
      throw ApiError.notFound(ErrorCode.PROJECT_NOT_FOUND, "Proyecto no encontrado");
    }
  }

  return prisma.materialRequest.create({
    data: {
      requestedById: requesterId,
      itemId: input.itemId,
      itemNameFreeText: input.itemId ? undefined : input.itemNameFreeText,
      projectId: input.projectId,
      quantity: input.quantity,
      reason: input.reason,
    },
    include: materialRequestInclude,
  });
}

/**
 * Al pasar a ENTREGADA con un item real del catalogo, descuenta stock dentro
 * de una transaccion (leer + validar + actualizar) para evitar una condicion
 * de carrera si dos resoluciones llegan casi al mismo tiempo.
 */
export async function resolveMaterialRequest(
  resolverId: string,
  requestId: string,
  input: ResolveMaterialRequestInput,
) {
  const existing = await getRequestOrThrow(requestId);

  if (!ALLOWED_TRANSITIONS[existing.status].includes(input.status)) {
    throw ApiError.forbidden(
      ErrorCode.INVALID_MATERIAL_REQUEST_TRANSITION,
      `No se puede pasar una solicitud ${existing.status} a ${input.status}`,
    );
  }

  const resolutionFields = {
    status: input.status,
    resolutionNote: input.resolutionNote,
    resolvedById: resolverId,
    resolvedAt: new Date(),
  };

  if (input.status !== MaterialRequestStatus.ENTREGADA || !existing.itemId) {
    return prisma.materialRequest.update({
      where: { id: requestId },
      data: resolutionFields,
      include: materialRequestInclude,
    });
  }

  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({ where: { id: existing.itemId! }, select: { stockQuantity: true } });
    // El item pudo haberse borrado entre la creacion de la solicitud y su
    // resolucion — en ese caso no hay stock que descontar, se resuelve igual.
    if (!item) {
      return tx.materialRequest.update({
        where: { id: requestId },
        data: resolutionFields,
        include: materialRequestInclude,
      });
    }

    const remaining = item.stockQuantity - existing.quantity;
    if (remaining < 0) {
      throw ApiError.badRequest(
        ErrorCode.INSUFFICIENT_STOCK,
        `No hay stock suficiente: quedan ${item.stockQuantity}, se pidieron ${existing.quantity}`,
      );
    }

    await tx.inventoryItem.update({ where: { id: existing.itemId! }, data: { stockQuantity: remaining } });

    return tx.materialRequest.update({
      where: { id: requestId },
      data: resolutionFields,
      include: materialRequestInclude,
    });
  });
}
