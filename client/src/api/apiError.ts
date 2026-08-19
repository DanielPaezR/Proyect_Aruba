import axios from "axios";
import type { TFunction } from "i18next";

export interface ApiErrorBody {
  errorCode?: string;
  message?: string;
}

export function getApiErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorBody | undefined;
    return data?.errorCode;
  }
  return undefined;
}

/**
 * Traduce un errorCode (el mismo vocabulario que usa el backend por HTTP y
 * por los ack de Socket.IO) a un mensaje en el idioma activo. Todos los
 * códigos viven en common.json bajo errors.api.<CODE>; si un código nuevo
 * todavía no tiene traducción, cae al mensaje genérico.
 */
export function translateErrorCode(t: TFunction, errorCode: string | undefined): string {
  const fallback = t("errors.generic", { ns: "common" });
  if (!errorCode) {
    return fallback;
  }
  return t(`errors.api.${errorCode}`, { ns: "common", defaultValue: fallback });
}

/** Traduce el errorCode de una respuesta HTTP fallida (ver translateErrorCode). */
export function translateApiError(t: TFunction, error: unknown): string {
  return translateErrorCode(t, getApiErrorCode(error));
}
