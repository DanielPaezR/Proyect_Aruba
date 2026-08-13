export type TimeAgoUnit = "minutes" | "hours" | "days";

export interface TimeAgoValue {
  unit: TimeAgoUnit;
  count: number;
}

/**
 * No usa Intl.RelativeTimeFormat: no reconoce "pap" (papiamento) como locale
 * y cae silenciosamente a otro idioma sin avisar. Devuelve unidad+cantidad
 * para que el llamador traduzca con i18next (mismo patron que activitiesCount
 * en projects.json), garantizando texto real en los 3 idiomas.
 */
export function timeAgo(isoTimestamp: string): TimeAgoValue {
  const diffMs = Date.now() - new Date(isoTimestamp).getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return { unit: "minutes", count: diffMinutes };
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return { unit: "hours", count: diffHours };
  }
  return { unit: "days", count: Math.round(diffHours / 24) };
}
