/** Formato basico: https:// + google.com/maps o maps.app.goo.gl (el acortador
 * que usa "Compartir" desde la app de Google Maps). Mismo criterio que el
 * backend (projects.validators.ts) — se valida en ambos lados. */
export function isValidGoogleMapsUrl(value: string): boolean {
  return value.startsWith("https://") && (value.includes("google.com/maps") || value.includes("maps.app.goo.gl"));
}

/** URL para el boton "Como llegar": el link guardado del proyecto si existe,
 * si no cae a una busqueda por texto de la direccion (comportamiento previo,
 * para proyectos viejos sin mapsUrl). Null si no hay ninguno de los dos. */
export function resolveMapsUrl(mapsUrl: string | null | undefined, address: string | null | undefined): string | null {
  if (mapsUrl) {
    return mapsUrl;
  }
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
  return null;
}
