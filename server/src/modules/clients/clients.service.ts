import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import type { CreateClientInput, UpdateClientInput } from "./clients.validators";

export async function listClients() {
  return prisma.client.findMany({
    include: { _count: { select: { projects: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getClient(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      projects: {
        select: { id: true, name: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!client) {
    throw ApiError.notFound(ErrorCode.CLIENT_NOT_FOUND, "Cliente no encontrado");
  }

  return client;
}

export async function createClient(input: CreateClientInput) {
  return prisma.client.create({ data: input });
}

export async function updateClient(clientId: string, input: UpdateClientInput) {
  await ensureClientExists(clientId);
  return prisma.client.update({ where: { id: clientId }, data: input });
}

export async function deleteClient(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { _count: { select: { projects: true } } },
  });

  if (!client) {
    throw ApiError.notFound(ErrorCode.CLIENT_NOT_FOUND, "Cliente no encontrado");
  }

  if (client._count.projects > 0) {
    throw ApiError.conflict(
      ErrorCode.CLIENT_HAS_PROJECTS,
      "No se puede eliminar un cliente con proyectos vinculados",
    );
  }

  await prisma.client.delete({ where: { id: clientId } });
}

async function ensureClientExists(clientId: string) {
  const exists = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!exists) {
    throw ApiError.notFound(ErrorCode.CLIENT_NOT_FOUND, "Cliente no encontrado");
  }
}
