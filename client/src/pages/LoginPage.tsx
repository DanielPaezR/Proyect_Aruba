import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import loginBackground from "../assets/login-background.jpg";
import logoUrl from "../assets/logo-header-transparent.png";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { t } = useTranslation(["auth", "common"]);
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoading && user) {
    // "/" (no "/dashboard" fijo) para que HomeRedirect mande a cada rol a su
    // landing correcta — un TRABAJADOR_CAMPO no tiene acceso al dashboard.
    const state = location.state as { from?: { pathname?: string } } | null;
    const redirectTo = state?.from?.pathname ?? "/";
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      // Igual que arriba: "/" deja que HomeRedirect decida segun el rol.
      navigate("/", { replace: true });
    } catch (error) {
      setErrorMessage(translateApiError(t, error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      {/* Capas independientes (foto / overlay / logo / texto), no una sola
          imagen compuesta: cuando llegue la foto final del cliente, alcanza
          con reemplazar src/assets/login-background.jpg. */}
      <div className="login-brand-panel" style={{ backgroundImage: `url(${loginBackground})` }}>
        <div className="login-brand-panel-overlay" />
        <div className="login-brand-panel-content">
          <img src={logoUrl} alt="DECS" className="login-logo" />
          <p className="login-brand-name">{t("login.brandTagline", { ns: "auth" })}</p>
        </div>
      </div>

      <div className="login-form-panel">
        <div className="login-form-panel-topbar">
          <LanguageSwitcher />
        </div>

        <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
          <h1>{t("login.title", { ns: "auth" })}</h1>
          <p className="login-subtitle">{t("login.subtitle", { ns: "auth" })}</p>

          <label>
            {t("login.email", { ns: "auth" })}
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label>
            {t("login.password", { ns: "auth" })}
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("login.submitting", { ns: "auth" }) : t("login.submit", { ns: "auth" })}
          </button>
        </form>
      </div>
    </div>
  );
}
