import { z } from "zod";
import { VehicleIncidentType, VehicleStatus } from "@prisma/client";

export const createVehicleSchema = z.object({
  plate: z.string().trim().min(1),
  brand: z.string().trim().min(1),
  model: z.string().trim().min(1),
  year: z.number().int().min(1900).max(2100),
  identificationNumber: z.string().trim().min(1).optional(),
  // Nullable ademas de optional: se puede crear/dejar un vehiculo sin
  // asignar (uso compartido de oficina), o desasignarlo despues.
  assignedToId: z.string().min(1).nullable().optional(),
  status: z.nativeEnum(VehicleStatus).optional(),
  notes: z.string().trim().optional(),
});

export const updateVehicleSchema = createVehicleSchema.partial();

export const createFuelLogSchema = z.object({
  date: z.coerce.date(),
  cost: z.number().positive(),
  liters: z.number().positive().optional(),
  odometerReading: z.number().int().min(0).optional(),
});

// Mismo criterio que listToolIncidentReportsQuerySchema: no hay columna
// "status" real (solo resolvedAt nullable), este filtro se traduce al
// chequeo real en el service.
export const listVehicleIncidentsQuerySchema = z.object({
  status: z.enum(["PENDIENTE", "RESUELTO"]).optional(),
  vehicleId: z.string().optional(),
});

// multipart/form-data (va con imageUpload.single("photo") en la ruta) — los
// campos que no son archivo llegan como string en req.body, por eso "cost"
// usa coerce en vez de z.number() como el resto de los schemas JSON.
export const createVehicleIncidentSchema = z.object({
  type: z.nativeEnum(VehicleIncidentType),
  description: z.string().trim().min(1),
  cost: z.coerce.number().positive().optional(),
});

export const resolveVehicleIncidentSchema = z.object({
  resolutionNote: z.string().trim().optional(),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type CreateFuelLogInput = z.infer<typeof createFuelLogSchema>;
export type ListVehicleIncidentsQuery = z.infer<typeof listVehicleIncidentsQuerySchema>;
export type CreateVehicleIncidentInput = z.infer<typeof createVehicleIncidentSchema>;
export type ResolveVehicleIncidentInput = z.infer<typeof resolveVehicleIncidentSchema>;
