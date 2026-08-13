export const PUNCH_TYPES = ["ENTRADA", "SALIDA"] as const;
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
  editedAt: string | null;
  editReason: string | null;
  createdAt: string;
  user: { id: string; name: string };
  activity: { id: string; title: string; projectId: string } | null;
}
