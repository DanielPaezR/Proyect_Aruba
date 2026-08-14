import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { apiClient } from "../api/client";
import { onUnauthorized, setAccessToken } from "../api/tokenStore";
import type { User, UserLocale } from "../types/auth";
import { subscribeToPushIfPossible } from "../utils/pushSubscription";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateLocale: (locale: UserLocale) => Promise<void>;
  updateProfile: (input: { phone?: string; photo?: File }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    onUnauthorized(() => setUser(null));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const { data } = await apiClient.post<{ accessToken: string }>("/auth/refresh");
        setAccessToken(data.accessToken);
        const me = await apiClient.get<{ user: User }>("/auth/me");
        if (!cancelled) {
          setUser(me.data.user);
          void i18n.changeLanguage(me.data.user.locale.toLowerCase());
        }
      } catch {
        setAccessToken(null);
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [i18n]);

  async function login(email: string, password: string) {
    const { data } = await apiClient.post<{ user: User; accessToken: string }>("/auth/login", {
      email,
      password,
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
    void i18n.changeLanguage(data.user.locale.toLowerCase());

    // No intrusivo: no bloquea el login si el permiso se niega o el
    // navegador no soporta push. Solo aplica a TRABAJADOR_CAMPO, que es
    // quien necesita el recordatorio de marcado.
    if (data.user.role === "TRABAJADOR_CAMPO") {
      void subscribeToPushIfPossible();
    }
  }

  async function logout() {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }

  async function updateLocale(locale: UserLocale) {
    const { data } = await apiClient.patch<{ user: User }>("/auth/me/locale", { locale });
    setUser(data.user);
    void i18n.changeLanguage(locale.toLowerCase());
  }

  async function updateProfile(input: { phone?: string; photo?: File }) {
    const formData = new FormData();
    if (input.phone !== undefined) {
      formData.append("phone", input.phone);
    }
    if (input.photo) {
      formData.append("photo", input.photo);
    }
    const { data } = await apiClient.patch<{ user: User }>("/auth/me/profile", formData);
    setUser(data.user);
  }

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, logout, updateLocale, updateProfile }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return ctx;
}
