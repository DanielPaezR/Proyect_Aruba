import { InventoryItemType, Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import type { CreateToolAssignmentInput, ListToolAssignmentsQuery } from "./tool-assignments.validators";

const toolAssignmentInclude = {
  item: { select: { id: true, name: true, unit: true, type: true } },
  user: { select: { id: true, name: true } },
} as const;

async function getAssignmentOrThrow(assignmentId: string) {
  const assignment = await prisma.toolAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) {
    throw ApiError.notFound(ErrorCode.TOOL_ASSIGNMENT_NOT_FOUND, "Asignación de herramienta no encontrada");
  }
  return assignment;
}

export async function listToolAssignments(filters: ListToolAssignmentsQuery) {
  return prisma.toolAssignment.findMany({
    where: {
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.active === undefined ? {} : { returnedAt: filters.active ? null : { not: null } }),
    },
    include: toolAssignmentInclude,
    orderBy: { assignedAt: "desc" },
  });
}

export async function createToolAssignment(input: CreateToolAssignmentInput) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: input.itemId } });
  if (!item) {
    throw ApiError.notFound(ErrorCode.INVENTORY_ITEM_NOT_FOUND, "Ítem de inventario no encontrado");
  }
  if (item.type !== InventoryItemType.HERRAMIENTA) {
    throw ApiError.badRequest(ErrorCode.ITEM_NOT_A_TOOL, "Solo se pueden asignar ítems de tipo herramienta");
  }

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) {
    throw ApiError.badRequest(ErrorCode.USER_NOT_FOUND, "El usuario a asignar no existe");
  }
  if (user.role !== Role.TRABAJADOR_CAMPO) {
    throw ApiError.badRequest(ErrorCode.USER_NOT_FIELD_WORKER, `El usuario ${user.name} no es un Trabajador de Campo`);
  }

  return prisma.toolAssignment.create({
    data: { itemId: input.itemId, userId: input.userId, condition: input.condition },
    include: toolAssignmentInclude,
  });
}

export async function returnToolAssignment(assignmentId: string) {
  const existing = await getAssignmentOrThrow(assignmentId);
  if (existing.returnedAt) {
    throw ApiError.forbidden(ErrorCode.TOOL_ASSIGNMENT_ALREADY_RETURNED, "Esta herramienta ya fue devuelta");
  }

  return prisma.toolAssignment.update({
    where: { id: assignmentId },
    data: { returnedAt: new Date() },
    include: toolAssignmentInclude,
  });
}
