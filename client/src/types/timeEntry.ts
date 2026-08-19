export const PUNCH_TYPES = ["ENTRADA", "ALMUERZO_INICIO", "ALMUERZO_FIN", "SALIDA"] as const;
export type PunchType = (typeof PUNCH_TYPES)[number];

export const TIME_ENTRY_SOURCES = ["MANUAL", "AUTO_GEOFENCE"] as const;
export type TimeEntrySource = (typeof TIME_ENTRY_SOURCES)[number];

export interface TimeEntry {
  id: string;
  userId: string;
  activityId: string | null;
  type: PunchType;
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  source: TimeEntrySource;
  originalTimestamp: string | null;
  editedById: string | null;
  editedBy: { id: string; name: string } | null;
  editedAt: string | null;
  editReason: string | null;
  createdAt: string;
  user: { id: string; name: string };
  activity: { id: string; title: string; projectId: string } | null;
}

export interface ProximityLogReference {
  id: string;
  detectedAt: string;
  distanceMeters: number;
}

export interface UserDaySummary {
  user: { id: string; name: string };
  entries: TimeEntry[];
  /** Neto: ya descuenta el tiempo de almuerzo de cada sesion. */
  totalMinutes: number;
  normalMinutes: number;
  overtimeMinutes: number;
  lunchMinutes: number;
  hasOpenEntry: boolean;
  hasOpenLunch: boolean;
  /** Referencia informativa ("estuvo cerca de la oficina a esta hora"), no una marcacion real. */
  unmatchedProximityLogs: ProximityLogReference[];
}

/** Forma de GET /time-entries/today/mine — estado en vivo del dia de hoy. */
export interface TodayTimeStatus {
  lastPunchType: PunchType | null;
  validNextTypes: PunchType[];
  workedMinutes: number;
  normalMinutes: number;
  overtimeMinutes: number;
  lunchMinutes: number;
  earningsEstimate: number | null;
}
