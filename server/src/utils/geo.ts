const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Distancia entre dos coordenadas (formula de Haversine), en metros. */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Aruba no tiene horario de verano (siempre UTC-4), pero el servidor puede
 * correr en cualquier zona horaria (Railway usa UTC) — por eso se calcula la
 * hora local explicitamente con Intl en vez de asumir el reloj del sistema.
 */
const ARUBA_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Aruba",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parseMinutesSinceMidnight(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Minutos desde medianoche, hora de Aruba, para el instante dado (default: ahora). */
export function currentArubaMinutes(at: Date = new Date()): number {
  const parts = ARUBA_TIME_FORMATTER.formatToParts(at);
  const hour = Number(parts.find((part) => part.type === "hour")!.value);
  const minute = Number(parts.find((part) => part.type === "minute")!.value);
  return hour * 60 + minute;
}

/** true si "nowMinutes" cae dentro de [start, end] (formato "HH:mm"), inclusive. */
export function isWithinWindow(nowMinutes: number, start: string, end: string): boolean {
  return nowMinutes >= parseMinutesSinceMidnight(start) && nowMinutes <= parseMinutesSinceMidnight(end);
}

const ARUBA_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Aruba",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Dia calendario actual en Aruba, como Date a medianoche UTC (para columnas `@db.Date`). */
export function arubaToday(at: Date = new Date()): Date {
  return new Date(`${ARUBA_DATE_FORMATTER.format(at)}T00:00:00.000Z`);
}

/** "YYYY-MM-DD" del dia calendario en Aruba para un instante dado. */
export function arubaDateKey(at: Date = new Date()): string {
  return ARUBA_DATE_FORMATTER.format(at);
}

/**
 * Instante UTC que corresponde a la medianoche de hoy en Aruba. Aruba esta
 * fija en UTC-4 (sin horario de verano), asi que sumar 4 horas al dia
 * calendario es exacto — no hace falta una libreria de zonas horarias para
 * este caso particular.
 */
export function arubaStartOfTodayUtc(at: Date = new Date()): Date {
  return new Date(arubaToday(at).getTime() + 4 * 60 * 60 * 1000);
}

/**
 * Rango [start, end) en UTC para un dia calendario de Aruba dado como
 * "YYYY-MM-DD" (mismo criterio de +4h que arubaStartOfTodayUtc). "end" es el
 * inicio del dia siguiente, exclusivo.
 */
export function arubaDayRangeUtc(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T04:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Instante UTC de la medianoche del lunes de esta semana, hora de Aruba. */
export function arubaStartOfWeekUtc(at: Date = new Date()): Date {
  const today = arubaToday(at);
  const dayOfWeek = today.getUTCDay(); // 0=domingo..6=sabado
  const daysSinceMonday = (dayOfWeek + 6) % 7; // lunes=0, martes=1, ..., domingo=6
  const monday = new Date(today.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
  return new Date(monday.getTime() + 4 * 60 * 60 * 1000);
}

/** Instante UTC de la medianoche del dia 1 de este mes, hora de Aruba. */
export function arubaStartOfMonthUtc(at: Date = new Date()): Date {
  const today = arubaToday(at);
  const firstOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return new Date(firstOfMonth.getTime() + 4 * 60 * 60 * 1000);
}
