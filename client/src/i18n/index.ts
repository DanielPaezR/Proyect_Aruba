import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import esCommon from "../locales/es/common.json";
import esAuth from "../locales/es/auth.json";
import esDashboard from "../locales/es/dashboard.json";
import enCommon from "../locales/en/common.json";
import enAuth from "../locales/en/auth.json";
import enDashboard from "../locales/en/dashboard.json";
import papCommon from "../locales/pap/common.json";
import papAuth from "../locales/pap/auth.json";
import papDashboard from "../locales/pap/dashboard.json";

export const SUPPORTED_LANGUAGES = ["es", "en", "pap"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Clave de localStorage donde se cachea el idioma antes de tener sesión iniciada. */
export const LOCALE_STORAGE_KEY = "locale";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { common: esCommon, auth: esAuth, dashboard: esDashboard },
      en: { common: enCommon, auth: enAuth, dashboard: enDashboard },
      pap: { common: papCommon, auth: papAuth, dashboard: papDashboard },
    },
    fallbackLng: "es",
    supportedLngs: SUPPORTED_LANGUAGES,
    ns: ["common", "auth", "dashboard"],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: ["localStorage"],
    },
  });

export default i18n;
