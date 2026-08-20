import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export const THEME_OPTIONS = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_OPTIONS)[number];

const STORAGE_KEY = "theme";

function readStoredTheme(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

/** "Sistema" = sin atributo en <html>, para que decida solo el media query
 * prefers-color-scheme de index.css (incluye reaccionar en vivo a un cambio
 * de tema del SO, sin JS). "Claro"/"Oscuro" fuerzan data-theme explicito,
 * que le gana al media query (ver index.css). */
function applyTheme(theme: ThemePreference) {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

interface ThemeContextValue {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/** Preferencia de tema por dispositivo (no de cuenta): vive solo en
 * localStorage, nunca se manda al backend. El <html> ya trae el data-theme
 * correcto desde antes del primer render (ver script inline en index.html);
 * este provider solo mantiene el estado de React sincronizado para que el
 * selector del drawer refleje el valor actual y pueda cambiarlo. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function setTheme(next: ThemePreference) {
    if (next === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, next);
    }
    setThemeState(next);
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme debe usarse dentro de ThemeProvider");
  }
  return context;
}
