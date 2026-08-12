import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "../i18n";
import type { UserLocale } from "../types/auth";

function toLocale(language: SupportedLanguage): UserLocale {
  return language.toUpperCase() as UserLocale;
}

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const { user, updateLocale } = useAuth();

  async function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as SupportedLanguage;
    if (user) {
      // Con sesión iniciada, el idioma se persiste en el backend.
      await updateLocale(toLocale(next));
    } else {
      // Sin sesión, solo cambia localmente (queda cacheado en localStorage).
      await i18n.changeLanguage(next);
    }
  }

  return (
    <label className="language-switcher">
      <span className="sr-only">{t("language.label", { ns: "common" })}</span>
      <select value={i18n.resolvedLanguage ?? i18n.language} onChange={(event) => void handleChange(event)}>
        {SUPPORTED_LANGUAGES.map((lng) => (
          <option key={lng} value={lng}>
            {t(`language.${lng}`, { ns: "common" })}
          </option>
        ))}
      </select>
    </label>
  );
}
