const AWG_FORMATTER = new Intl.NumberFormat("nl-AW", {
  style: "currency",
  currency: "AWG",
});

/** hourlyRate llega del backend como string decimal (ej. "18.50") o null. */
export function formatHourlyRate(hourlyRate: string | null): string | null {
  if (hourlyRate === null) {
    return null;
  }
  return AWG_FORMATTER.format(Number(hourlyRate));
}
