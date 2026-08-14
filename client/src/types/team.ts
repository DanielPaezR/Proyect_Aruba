export interface WorkerLocation {
  id: string;
  name: string;
  lastKnownLatitude: number | null;
  lastKnownLongitude: number | null;
  lastLocationAt: string | null;
}
