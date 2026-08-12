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
 * Traduce el errorCode devuelto por el backend a un mensaje en el idioma
 * activo. Todos los códigos viven en common.json bajo errors.api.<CODE>;
 * si un código nuevo todavía no tiene traducción, cae al mensaje genérico.
 */
export function translateApiError(t: TFunction, error: unknown): string {
  const fallback = t("errors.generic", { ns: "common" });
  const errorCode = getApiErrorCode(error);
  if (!errorCode) {
    return fallback;
  }
  return t(`errors.api.${errorCode}`, { ns: "common", defaultValue: fallback });
}
