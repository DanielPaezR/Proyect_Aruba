import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ROLES } from "../types/auth";
import type { User, UserRole } from "../types/auth";
import { formatHourlyRate } from "../utils/formatCurrency";

export function UsersManagementPage() {
  const { t } = useTranslation(["users", "common"]);
  const { user } = useAuth();

  const [users, setUsers] = useState<User[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("TRABAJADOR_CAMPO");
  const [phone, setPhone] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadUsers() {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await apiClient.get<{ users: User[] }>("/auth/users");
      setUsers(response.data.users);
    } catch (error) {
      setErrorMessage(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) {
    return null;
  }

  // El endpoint solo lo puede usar el JEFE (ver auth.routes.ts); si un
  // SUPERVISOR llega aca por URL directa, lo mandamos de vuelta.
  if (user.role !== "JEFE") {
    return <Navigate to="/" replace />;
  }

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setRole("TRABAJADOR_CAMPO");
    setPhone("");
    setHourlyRate("");
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post("/auth/users", {
        name,
        email,
        password,
        role,
        phone: phone || undefined,
        hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
      });
      resetForm();
      setIsFormOpen(false);
      await loadUsers();
    } catch (error) {
      setFormError(translateApiError(t, error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>{t("title", { ns: "users" })}</h1>
        <button type="button" onClick={() => setIsFormOpen((open) => !open)}>
          {t("create.button", { ns: "users" })}
        </button>
      </div>

      {isFormOpen && (
        <form className="inline-form" onSubmit={(event) => void handleCreate(event)}>
          <h2>{t("create.formTitle", { ns: "users" })}</h2>

          <label>
            {t("create.name", { ns: "users" })}
            <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
          </label>
          <label>
            {t("create.email", { ns: "users" })}
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            {t("create.password", { ns: "users" })}
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
          </label>
          <label>
            {t("create.role", { ns: "users" })}
            <select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {t(`roles.${value}`, { ns: "common" })}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("create.phone", { ns: "users" })}
            <input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <label>
            {t("create.hourlyRate", { ns: "users" })}
            <input
              type="number"
              min="0"
              step="0.01"
              value={hourlyRate}
              onChange={(event) => setHourlyRate(event.target.value)}
              placeholder={t("create.hourlyRatePlaceholder", { ns: "users" })}
            />
          </label>

          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("create.submitting", { ns: "users" }) : t("create.submit", { ns: "users" })}
            </button>
            <button type="button" onClick={() => setIsFormOpen(false)}>
              {t("actions.cancel", { ns: "common" })}
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {!isLoading && errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}

      {!isLoading &&
        !errorMessage &&
        users &&
        (users.length === 0 ? (
          <p>{t("empty", { ns: "users" })}</p>
        ) : (
          <ul className="card-list">
            {users.map((listedUser) => {
              const formattedRate = formatHourlyRate(listedUser.hourlyRate);
              return (
                <li key={listedUser.id} className="card">
                  <div className="card-header">
                    <span className="card-title">{listedUser.name}</span>
                    <span className="status-badge">
                      {listedUser.isActive ? t("list.active", { ns: "users" }) : t("list.inactive", { ns: "users" })}
                    </span>
                  </div>
                  <p className="card-description">{listedUser.email}</p>
                  <span className="card-meta">
                    {t(`roles.${listedUser.role}`, { ns: "common" })}
                    {listedUser.phone && ` · ${listedUser.phone}`}
                    {" · "}
                    {formattedRate ?? t("list.hourlyRateNotSpecified", { ns: "users" })}
                  </span>
                </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}
