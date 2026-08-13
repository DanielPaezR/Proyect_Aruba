import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { translateApiError } from "../api/apiError";
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
    const state = location.state as { from?: { pathname?: string } } | null;
    const redirectTo = state?.from?.pathname ?? "/dashboard";
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErrorMessage(translateApiError(t, error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-brand">
        <img src="/logo_cropped.png" alt="DECS" className="login-logo" />
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
  );
}
