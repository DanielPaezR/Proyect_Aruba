import type { TFunction } from "i18next";
import i18n from "./index";

/**
 * Traduce un valor de estado tipo enum (ActivityStatus, ProjectStatus,
 * EvidenceStatus...) bajo la clave `${keyPrefix}.${status}` de un namespace.
 *
 * Por que no un simple t(): si el backend agrega un valor nuevo al enum sin
 * que se actualice alguno de los 3 JSON de locale, i18next no falla — o bien
 * resuelve en silencio via fallbackLng (un usuario en ingles veria texto en
 * español sin darse cuenta) o, si falta en todos los idiomas, muestra el
 * key path crudo. Ninguno de los dos casos llama la atención en desarrollo.
 *
 * Este helper lo hace ruidoso: en dev, si el idioma ACTIVO (sin fallback)
 * no tiene la clave, deja un console.warn señalando exactamente que archivo
 * falta actualizar. En producción ese chequeo ni siquiera queda en el bundle
 * (import.meta.env.DEV se elimina en build), y el usuario ve el valor crudo
 * del backend como ultimo recurso en vez de una clave rota o texto vacío.
 */
export function translateStatus(t: TFunction, ns: string, keyPrefix: string, status: string): string {
  const key = `${keyPrefix}.${status}`;

  if (import.meta.env.DEV) {
    const activeLanguage = i18n.resolvedLanguage ?? i18n.language;
    const hasOwnTranslation = i18n.getResource(activeLanguage, ns, key) !== undefined;
    if (!hasOwnTranslation) {
      console.warn(
        `[i18n] Falta "${key}" en locales/${activeLanguage}/${ns}.json para el estado "${status}". ` +
          `Si se agrego un valor nuevo al enum del backend, hay que agregarlo a locales/{es,en,pap}/${ns}.json.`,
      );
    }
  }

  return t(key, { ns, defaultValue: status });
}
