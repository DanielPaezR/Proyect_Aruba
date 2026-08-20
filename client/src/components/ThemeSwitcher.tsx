import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { THEME_OPTIONS, useTheme } from "../context/ThemeContext";

export function ThemeSwitcher() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    setTheme(event.target.value as (typeof THEME_OPTIONS)[number]);
  }

  return (
    <label className="theme-switcher">
      <span className="sr-only">{t("theme.label", { ns: "common" })}</span>
      <select value={theme} onChange={handleChange}>
        {THEME_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {t(`theme.${option}`, { ns: "common" })}
          </option>
        ))}
      </select>
    </label>
  );
}
