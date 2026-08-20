export const VEHICLE_STATUSES = ["ACTIVO", "MANTENIMIENTO", "INACTIVO"] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  identificationNumber: string | null;
  assignedToId: string | null;
  assignedTo: { id: string; name: string } | null;
  status: VehicleStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FuelLog {
  id: string;
  vehicleId: string;
  date: string;
  // Decimal serializado por Prisma/Express como string.
  cost: string;
  liters: string | null;
  odometerReading: number | null;
  recordedById: string;
  recordedBy: { id: string; name: string };
  createdAt: string;
}

export const VEHICLE_INCIDENT_TYPES = ["DANIO", "MANTENIMIENTO", "REPARACION"] as const;
export type VehicleIncidentType = (typeof VEHICLE_INCIDENT_TYPES)[number];

export interface VehicleIncidentReport {
  id: string;
  vehicleId: string;
  vehicle: { id: string; plate: string; brand: string; model: string };
  type: VehicleIncidentType;
  description: string;
  cost: string | null;
  photoUrl: string | null;
  photoPublicId: string | null;
  reportedById: string;
  reportedBy: { id: string; name: string };
  reportedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
}
