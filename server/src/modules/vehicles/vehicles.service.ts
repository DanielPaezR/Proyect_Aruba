import { Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { uploadImage, VEHICLE_INCIDENT_PHOTOS_FOLDER } from "../../config/storage";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import type {
  CreateFuelLogInput,
  CreateVehicleIncidentInput,
  CreateVehicleInput,
  ListVehicleIncidentsQuery,
  ResolveVehicleIncidentInput,
  UpdateVehicleInput,
} from "./vehicles.validators";

type AuthUser = { id: string; role: Role };

// Gestion completa de la flota (CRUD, cola de revision de incidentes) —
// mismo criterio que projects: gestion operativa, Mercaderista queda fuera
// a proposito (a diferencia de INVENTORY_ROLES, que si lo incluye para
// herramientas/materiales).
const MANAGERS: Role[] = [Role.ADMINISTRADOR, Role.GERENTE, Role.SUPERVISOR];

const vehicleInclude = {
  assignedTo: { select: { id: true, name: true } },
} as const;

const fuelLogInclude = {
  recordedBy: { select: { id: true, name: true } },
} as const;

const vehicleIncidentInclude = {
  reportedBy: { select: { id: true, name: true } },
  vehicle: { select: { id: true, plate: true, brand: true, model: true } },
} as const;

async function getVehicleOrThrow(vehicleId: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) {
    throw ApiError.notFound(ErrorCode.VEHICLE_NOT_FOUND, "Vehículo no encontrado");
  }
  return vehicle;
}

async function ensurePlateAvailable(plate: string, excludeVehicleId?: string) {
  const existing = await prisma.vehicle.findUnique({ where: { plate }, select: { id: true } });
  if (existing && existing.id !== excludeVehicleId) {
    throw ApiError.conflict(ErrorCode.VEHICLE_PLATE_TAKEN, "Ya existe un vehículo con esa placa");
  }
}

/** Dueño del vehiculo (assignedToId === self), o gestion — mismo criterio
 * que ToolIncidentReport.createToolIncidentReport, sin Mercaderista (ver
 * MANAGERS de este archivo). */
function ensureVehicleAccess(user: AuthUser, vehicle: { assignedToId: string | null }) {
  const isHolder = vehicle.assignedToId === user.id;
  if (!isHolder && !MANAGERS.includes(user.role)) {
    throw ApiError.forbidden(ErrorCode.VEHICLE_NOT_ASSIGNED_TO_YOU, "Este vehículo no está a tu cargo");
  }
}

export async function listVehicles() {
  return prisma.vehicle.findMany({ include: vehicleInclude, orderBy: { plate: "asc" } });
}

export async function listMyVehicles(userId: string) {
  return prisma.vehicle.findMany({
    where: { assignedToId: userId },
    include: vehicleInclude,
    orderBy: { plate: "asc" },
  });
}

export async function createVehicle(input: CreateVehicleInput) {
  await ensurePlateAvailable(input.plate);
  return prisma.vehicle.create({ data: input, include: vehicleInclude });
}

export async function updateVehicle(vehicleId: string, input: UpdateVehicleInput) {
  await getVehicleOrThrow(vehicleId);
  if (input.plate) {
    await ensurePlateAvailable(input.plate, vehicleId);
  }
  return prisma.vehicle.update({ where: { id: vehicleId }, data: input, include: vehicleInclude });
}

/** No se puede borrar un vehiculo con tanqueadas o incidentes registrados —
 * ambos tienen la FK en Restrict (ver schema.prisma) para no perder el
 * historial; este chequeo previo da un error claro en vez de dejar que la
 * violacion de FK termine en un 500 sin traducir (mismo criterio que
 * deleteInventoryItem). */
export async function deleteVehicle(vehicleId: string) {
  await getVehicleOrThrow(vehicleId);

  const [anyFuelLog, anyIncident] = await Promise.all([
    prisma.fuelLog.findFirst({ where: { vehicleId }, select: { id: true } }),
    prisma.vehicleIncidentReport.findFirst({ where: { vehicleId }, select: { id: true } }),
  ]);
  if (anyFuelLog || anyIncident) {
    throw ApiError.conflict(
      ErrorCode.VEHICLE_HAS_RECORDS,
      "No se puede eliminar: este vehículo tiene tanqueadas o incidentes registrados",
    );
  }

  await prisma.vehicle.delete({ where: { id: vehicleId } });
}

export async function createFuelLog(user: AuthUser, vehicleId: string, input: CreateFuelLogInput) {
  const vehicle = await getVehicleOrThrow(vehicleId);
  ensureVehicleAccess(user, vehicle);

  return prisma.fuelLog.create({
    data: {
      vehicleId,
      date: input.date,
      cost: input.cost,
      liters: input.liters,
      odometerReading: input.odometerReading,
      recordedById: user.id,
    },
    include: fuelLogInclude,
  });
}

export async function listFuelLogs(user: AuthUser, vehicleId: string) {
  const vehicle = await getVehicleOrThrow(vehicleId);
  ensureVehicleAccess(user, vehicle);

  return prisma.fuelLog.findMany({
    where: { vehicleId },
    include: fuelLogInclude,
    orderBy: { date: "desc" },
  });
}

export async function createVehicleIncident(
  user: AuthUser,
  vehicleId: string,
  input: CreateVehicleIncidentInput,
  file?: Express.Multer.File,
) {
  const vehicle = await getVehicleOrThrow(vehicleId);
  ensureVehicleAccess(user, vehicle);

  let photoFields: { photoUrl?: string; photoPublicId?: string } = {};
  if (file) {
    const uploaded = await uploadImage(file.buffer, { folder: VEHICLE_INCIDENT_PHOTOS_FOLDER });
    photoFields = { photoUrl: uploaded.url, photoPublicId: uploaded.publicId };
  }

  return prisma.vehicleIncidentReport.create({
    data: {
      vehicleId,
      type: input.type,
      description: input.description,
      cost: input.cost,
      reportedById: user.id,
      ...photoFields,
    },
    include: vehicleIncidentInclude,
  });
}

export async function listVehicleIncidents(filters: ListVehicleIncidentsQuery) {
  return prisma.vehicleIncidentReport.findMany({
    where: {
      ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
      ...(filters.status === "PENDIENTE" ? { resolvedAt: null } : {}),
      ...(filters.status === "RESUELTO" ? { resolvedAt: { not: null } } : {}),
    },
    include: vehicleIncidentInclude,
    orderBy: { reportedAt: "asc" },
  });
}

export async function resolveVehicleIncident(incidentId: string, input: ResolveVehicleIncidentInput) {
  const existing = await prisma.vehicleIncidentReport.findUnique({ where: { id: incidentId } });
  if (!existing) {
    throw ApiError.notFound(ErrorCode.VEHICLE_INCIDENT_NOT_FOUND, "Reporte no encontrado");
  }
  if (existing.resolvedAt) {
    throw ApiError.forbidden(ErrorCode.VEHICLE_INCIDENT_ALREADY_RESOLVED, "Este reporte ya fue resuelto");
  }

  return prisma.vehicleIncidentReport.update({
    where: { id: incidentId },
    data: { resolvedAt: new Date(), resolutionNote: input.resolutionNote },
    include: vehicleIncidentInclude,
  });
}

