/** UserDaySummary.totalMinutes -> "1.5h", etc. Unica fuente para no repetir
 * el mismo (totalMinutes / 60).toFixed(1) en cada pantalla que muestra horas. */
export function formatHoursFromMinutes(totalMinutes: number): string {
  return `${(totalMinutes / 60).toFixed(1)}h`;
}
