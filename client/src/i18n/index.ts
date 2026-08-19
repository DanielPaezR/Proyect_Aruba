import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import esCommon from "../locales/es/common.json";
import esAuth from "../locales/es/auth.json";
import esChat from "../locales/es/chat.json";
import esDashboard from "../locales/es/dashboard.json";
import esClients from "../locales/es/clients.json";
import esProjects from "../locales/es/projects.json";
import esActivities from "../locales/es/activities.json";
import esEvidences from "../locales/es/evidences.json";
import esInvoices from "../locales/es/invoices.json";
import esPayments from "../locales/es/payments.json";
import esUsers from "../locales/es/users.json";
import esSettings from "../locales/es/settings.json";
import esTeamMap from "../locales/es/teamMap.json";
import esProfile from "../locales/es/profile.json";
import enCommon from "../locales/en/common.json";
import enAuth from "../locales/en/auth.json";
import enChat from "../locales/en/chat.json";
import enDashboard from "../locales/en/dashboard.json";
import enClients from "../locales/en/clients.json";
import enProjects from "../locales/en/projects.json";
import enActivities from "../locales/en/activities.json";
import enEvidences from "../locales/en/evidences.json";
import enInvoices from "../locales/en/invoices.json";
import enPayments from "../locales/en/payments.json";
import enUsers from "../locales/en/users.json";
import enSettings from "../locales/en/settings.json";
import enTeamMap from "../locales/en/teamMap.json";
import enProfile from "../locales/en/profile.json";
import papCommon from "../locales/pap/common.json";
import papAuth from "../locales/pap/auth.json";
import papChat from "../locales/pap/chat.json";
import papDashboard from "../locales/pap/dashboard.json";
import papClients from "../locales/pap/clients.json";
import papProjects from "../locales/pap/projects.json";
import papActivities from "../locales/pap/activities.json";
import papEvidences from "../locales/pap/evidences.json";
import papInvoices from "../locales/pap/invoices.json";
import papPayments from "../locales/pap/payments.json";
import papUsers from "../locales/pap/users.json";
import papSettings from "../locales/pap/settings.json";
import papTeamMap from "../locales/pap/teamMap.json";
import papProfile from "../locales/pap/profile.json";

export const SUPPORTED_LANGUAGES = ["es", "en", "pap"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Clave de localStorage donde se cachea el idioma antes de tener sesión iniciada. */
export const LOCALE_STORAGE_KEY = "locale";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: {
        common: esCommon,
        chat: esChat,
        auth: esAuth,
        dashboard: esDashboard,
        clients: esClients,
        projects: esProjects,
        activities: esActivities,
        evidences: esEvidences,
        invoices: esInvoices,
        payments: esPayments,
        users: esUsers,
        settings: esSettings,
        teamMap: esTeamMap,
        profile: esProfile,
      },
      en: {
        common: enCommon,
        chat: enChat,
        auth: enAuth,
        dashboard: enDashboard,
        clients: enClients,
        projects: enProjects,
        activities: enActivities,
        evidences: enEvidences,
        invoices: enInvoices,
        payments: enPayments,
        users: enUsers,
        settings: enSettings,
        teamMap: enTeamMap,
        profile: enProfile,
      },
      pap: {
        common: papCommon,
        chat: papChat,
        auth: papAuth,
        dashboard: papDashboard,
        clients: papClients,
        projects: papProjects,
        activities: papActivities,
        evidences: papEvidences,
        invoices: papInvoices,
        payments: papPayments,
        users: papUsers,
        settings: papSettings,
        teamMap: papTeamMap,
        profile: papProfile,
      },
    },
    fallbackLng: "es",
    supportedLngs: SUPPORTED_LANGUAGES,
    ns: [
      "chat",
      "common",
      "auth",
      "dashboard",
      "clients",
      "projects",
      "payments",
      "activities",
      "evidences",
      "invoices",
      "users",
      "settings",
      "teamMap",
      "profile",
    ],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: ["localStorage"],
    },
  });

export default i18n;
