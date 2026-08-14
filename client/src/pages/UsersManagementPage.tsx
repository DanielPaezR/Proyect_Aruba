import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ROLES } from "../types/auth";
import type { User, UserRole } from "../types/auth";
import type { SalaryRaise } from "../types/salaryRaise";
import type { MonthlyScore } from "../types/workerScore";
import { formatHourlyRate } from "../utils/formatCurrency";
import { timeAgo } from "../utils/timeAgo";

export function UsersManagementPage() {
  const { t } = useTranslation(["users", "common", "teamMap"]);
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

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<SalaryRaise[] | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [isRaiseFormOpen, setIsRaiseFormOpen] = useState(false);
  const [newRate, setNewRate] = useState("");
  const [raiseReason, setRaiseReason] = useState("");
  const [isSubmittingRaise, setIsSubmittingRaise] = useState(false);
  const [raiseError, setRaiseError] = useState<string | null>(null);

  const [scoreExpandedUserId, setScoreExpandedUserId] = useState<string | null>(null);
  const [monthlyScore, setMonthlyScore] = useState<MonthlyScore | null>(null);
  const [isLoadingScore, setIsLoadingScore] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);

  const [isScoreFormOpen, setIsScoreFormOpen] = useState(false);
  const [discountPoints, setDiscountPoints] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);
  const [scoreFormError, setScoreFormError] = useState<string | null>(null);

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

  async function loadSalaryHistory(userId: string) {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const response = await apiClient.get<{ history: SalaryRaise[] }>(`/auth/users/${userId}/salary-history`);
      setSalaryHistory(response.data.history);
    } catch (error) {
      setHistoryError(translateApiError(t, error));
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function toggleSalaryPanel(userId: string) {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(userId);
    setSalaryHistory(null);
    setIsRaiseFormOpen(false);
    setNewRate("");
    setRaiseReason("");
    setRaiseError(null);
    await loadSalaryHistory(userId);
  }

  async function handleRegisterRaise(event: FormEvent<HTMLFormElement>, userId: string) {
    event.preventDefault();
    setRaiseError(null);
    setIsSubmittingRaise(true);
    try {
      await apiClient.patch(`/auth/users/${userId}/hourly-rate`, {
        newRate: Number(newRate),
        reason: raiseReason || undefined,
      });
      setNewRate("");
      setRaiseReason("");
      setIsRaiseFormOpen(false);
      await Promise.all([loadUsers(), loadSalaryHistory(userId)]);
    } catch (error) {
      setRaiseError(translateApiError(t, error));
    } finally {
      setIsSubmittingRaise(false);
    }
  }

  function formatTimeAgo(isoTimestamp: string): string {
    const ago = timeAgo(isoTimestamp);
    return ago.count === 0
      ? t("map.justNow", { ns: "teamMap" })
      : t(`map.${ago.unit}Ago`, { ns: "teamMap", count: ago.count });
  }

  async function loadMonthlyScore(userId: string) {
    setIsLoadingScore(true);
    setScoreError(null);
    try {
      const response = await apiClient.get<MonthlyScore>(`/auth/users/${userId}/score`);
      setMonthlyScore(response.data);
    } catch (error) {
      setScoreError(translateApiError(t, error));
    } finally {
      setIsLoadingScore(false);
    }
  }

  async function toggleScorePanel(userId: string) {
    if (scoreExpandedUserId === userId) {
      setScoreExpandedUserId(null);
      return;
    }
    setScoreExpandedUserId(userId);
    setMonthlyScore(null);
    setIsScoreFormOpen(false);
    setDiscountPoints("");
    setDiscountReason("");
    setScoreFormError(null);
    await loadMonthlyScore(userId);
  }

  async function handleAddDiscount(event: FormEvent<HTMLFormElement>, userId: string) {
    event.preventDefault();
    setScoreFormError(null);
    setIsSubmittingScore(true);
    try {
      // El form solo registra descuentos: el JEFE escribe cuantos puntos
      // quitar (positivo) y aca se manda como negativo al backend.
      await apiClient.post(`/auth/users/${userId}/score-events`, {
        points: -Math.abs(Number(discountPoints)),
        reason: discountReason,
      });
      setDiscountPoints("");
      setDiscountReason("");
      setIsScoreFormOpen(false);
      await loadMonthlyScore(userId);
    } catch (error) {
      setScoreFormError(translateApiError(t, error));
    } finally {
      setIsSubmittingScore(false);
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

                  <div className="card-actions">
                    <button type="button" onClick={() => void toggleSalaryPanel(listedUser.id)}>
                      {expandedUserId === listedUser.id
                        ? t("salary.hideButton", { ns: "users" })
                        : t("salary.showButton", { ns: "users" })}
                    </button>
                  </div>

                  {expandedUserId === listedUser.id && (
                    <div className="salary-panel">
                      <p className="card-meta">
                        {t("salary.currentRate", { ns: "users" })}:{" "}
                        {formattedRate ?? t("list.hourlyRateNotSpecified", { ns: "users" })}
                      </p>

                      <div className="card-actions">
                        <button type="button" onClick={() => setIsRaiseFormOpen((open) => !open)}>
                          {t("salary.registerButton", { ns: "users" })}
                        </button>
                      </div>

                      {isRaiseFormOpen && (
                        <form
                          className="inline-form"
                          onSubmit={(event) => void handleRegisterRaise(event, listedUser.id)}
                        >
                          <h2>{t("salary.formTitle", { ns: "users" })}</h2>
                          <label>
                            {t("salary.newRateLabel", { ns: "users" })}
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={newRate}
                              onChange={(event) => setNewRate(event.target.value)}
                              required
                            />
                          </label>
                          <label>
                            {t("salary.reasonLabel", { ns: "users" })}
                            <textarea
                              value={raiseReason}
                              onChange={(event) => setRaiseReason(event.target.value)}
                              maxLength={500}
                            />
                          </label>
                          {raiseError && (
                            <p className="form-error" role="alert">
                              {raiseError}
                            </p>
                          )}
                          <div className="form-actions">
                            <button type="submit" disabled={isSubmittingRaise}>
                              {isSubmittingRaise
                                ? t("salary.saving", { ns: "users" })
                                : t("salary.submit", { ns: "users" })}
                            </button>
                            <button type="button" onClick={() => setIsRaiseFormOpen(false)}>
                              {t("actions.cancel", { ns: "common" })}
                            </button>
                          </div>
                        </form>
                      )}

                      <h3>{t("salary.historyTitle", { ns: "users" })}</h3>

                      {isLoadingHistory && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

                      {!isLoadingHistory && historyError && (
                        <p className="form-error" role="alert">
                          {historyError}
                        </p>
                      )}

                      {!isLoadingHistory &&
                        !historyError &&
                        salaryHistory &&
                        (salaryHistory.length === 0 ? (
                          <p>{t("salary.historyEmpty", { ns: "users" })}</p>
                        ) : (
                          <ul className="card-list">
                            {salaryHistory.map((raise) => (
                              <li key={raise.id} className="card">
                                <div className="card-header">
                                  <span className="card-title">
                                    {t("salary.rateChange", {
                                      ns: "users",
                                      previous: formatHourlyRate(raise.previousRate) ?? "—",
                                      next: formatHourlyRate(raise.newRate),
                                    })}
                                  </span>
                                  <span className="card-meta">{formatTimeAgo(raise.createdAt)}</span>
                                </div>
                                {raise.reason && <p className="card-description">{raise.reason}</p>}
                                <span className="card-meta">
                                  {t("salary.registeredBy", { ns: "users", name: raise.createdBy.name })}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ))}
                    </div>
                  )}

                  <div className="card-actions">
                    <button type="button" onClick={() => void toggleScorePanel(listedUser.id)}>
                      {scoreExpandedUserId === listedUser.id
                        ? t("score.hideButton", { ns: "users" })
                        : t("score.showButton", { ns: "users" })}
                    </button>
                  </div>

                  {scoreExpandedUserId === listedUser.id && (
                    <div className="salary-panel">
                      {isLoadingScore && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

                      {!isLoadingScore && scoreError && (
                        <p className="form-error" role="alert">
                          {scoreError}
                        </p>
                      )}

                      {!isLoadingScore && !scoreError && monthlyScore && (
                        <>
                          <p className="card-meta">
                            {t("score.currentScore", {
                              ns: "users",
                              month: String(monthlyScore.month).padStart(2, "0"),
                              year: monthlyScore.year,
                              score: monthlyScore.currentScore,
                              base: monthlyScore.baseScore,
                            })}
                          </p>

                          <div className="card-actions">
                            <button type="button" onClick={() => setIsScoreFormOpen((open) => !open)}>
                              {t("score.registerButton", { ns: "users" })}
                            </button>
                          </div>

                          {isScoreFormOpen && (
                            <form
                              className="inline-form"
                              onSubmit={(event) => void handleAddDiscount(event, listedUser.id)}
                            >
                              <h2>{t("score.formTitle", { ns: "users" })}</h2>
                              <label>
                                {t("score.pointsLabel", { ns: "users" })}
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={discountPoints}
                                  onChange={(event) => setDiscountPoints(event.target.value)}
                                  required
                                />
                              </label>
                              <label>
                                {t("score.reasonLabel", { ns: "users" })}
                                <textarea
                                  value={discountReason}
                                  onChange={(event) => setDiscountReason(event.target.value)}
                                  maxLength={500}
                                  required
                                  minLength={1}
                                />
                              </label>
                              {scoreFormError && (
                                <p className="form-error" role="alert">
                                  {scoreFormError}
                                </p>
                              )}
                              <div className="form-actions">
                                <button type="submit" disabled={isSubmittingScore}>
                                  {isSubmittingScore
                                    ? t("score.saving", { ns: "users" })
                                    : t("score.submit", { ns: "users" })}
                                </button>
                                <button type="button" onClick={() => setIsScoreFormOpen(false)}>
                                  {t("actions.cancel", { ns: "common" })}
                                </button>
                              </div>
                            </form>
                          )}

                          <h3>{t("score.historyTitle", { ns: "users" })}</h3>

                          {monthlyScore.events.length === 0 ? (
                            <p>{t("score.historyEmpty", { ns: "users" })}</p>
                          ) : (
                            <ul className="card-list">
                              {monthlyScore.events.map((eventItem) => (
                                <li key={eventItem.id} className="card">
                                  <div className="card-header">
                                    <span className="card-title">
                                      {eventItem.points > 0 ? `+${eventItem.points}` : eventItem.points}
                                    </span>
                                    <span className="card-meta">{formatTimeAgo(eventItem.createdAt)}</span>
                                  </div>
                                  <p className="card-description">{eventItem.reason}</p>
                                  <span className="card-meta">
                                    {t("salary.registeredBy", { ns: "users", name: eventItem.createdBy.name })}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}
