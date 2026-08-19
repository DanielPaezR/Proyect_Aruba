import { MaterialRequestStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import type { CreateInventoryItemInput, ListInventoryQuery, UpdateInventoryItemInput } from "./inventory.validators";

async function getItemOrThrow(itemId: string) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) {
    throw ApiError.notFound(ErrorCode.INVENTORY_ITEM_NOT_FOUND, "Ítem de inventario no encontrado");
  }
  return item;
}

export async function listInventory(filters: ListInventoryQuery) {
  return prisma.inventoryItem.findMany({
    where: {
      ...(filters.type ? { type: filters.type } : {}),
    },
    orderBy: { name: "asc" },
  });
}

export async function createInventoryItem(input: CreateInventoryItemInput) {
  return prisma.inventoryItem.create({ data: input });
}

export async function updateInventoryItem(itemId: string, input: UpdateInventoryItemInput) {
  await getItemOrThrow(itemId);
  return prisma.inventoryItem.update({ where: { id: itemId }, data: input });
}

/** No se puede borrar un ítem con herramientas activas (returnedAt null) o
 * pedidos de material todavía pendientes — ambos dependen de esa fila para
 * seguir teniendo sentido como registro.
 *
 * Nota: tambien se bloquea si hay ToolAssignment YA DEVUELTAS — no solo las
 * activas. La FK de ToolAssignment.item es Restrict a proposito (para no
 * perder el historial de quien tuvo una herramienta), y Postgres no permite
 * un Restrict condicional ("solo si returnedAt es null"); permitir borrar acá
 * y dejar que el error de foreign key lo bloquee mas abajo terminaria en un
 * 500 sin traducir, no en el "error claro" pedido. Mas estricto que el
 * pedido original, pero es la unica forma de garantizar un error legible en
 * vez de un crash. */
export async function deleteInventoryItem(itemId: string) {
  await getItemOrThrow(itemId);

  const anyAssignment = await prisma.toolAssignment.findFirst({
    where: { itemId },
    select: { id: true, returnedAt: true },
  });
  if (anyAssignment) {
    throw ApiError.conflict(
      ErrorCode.INVENTORY_ITEM_HAS_ACTIVE_ASSIGNMENTS,
      anyAssignment.returnedAt === null
        ? "No se puede eliminar: hay herramientas de este ítem asignadas sin devolver"
        : "No se puede eliminar: este ítem tiene historial de herramientas asignadas",
    );
  }

  const pendingRequest = await prisma.materialRequest.findFirst({
    where: { itemId, status: MaterialRequestStatus.PENDIENTE },
    select: { id: true },
  });
  if (pendingRequest) {
    throw ApiError.conflict(
      ErrorCode.INVENTORY_ITEM_HAS_PENDING_REQUESTS,
      "No se puede eliminar: hay solicitudes de material pendientes para este ítem",
    );
  }

  await prisma.inventoryItem.delete({ where: { id: itemId } });
}
