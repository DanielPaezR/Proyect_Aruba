import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Client } from "../types/client";
import type { FinancialHistoryEntry, FinancialHistoryResponse, FinancialMovementType } from "../types/financialHistory";
import type { Project } from "../types/project";
import { isTopManagerRole } from "../types/auth";
import type { User } from "../types/auth";
import { formatCurrency } from "../utils/formatCurrency";

function toStartOfDayIso(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`;
}

function toEndOfDayIso(dateStr: string): string {
  return `${dateStr}T23:59:59.999Z`;
}

export function FinancialHistoryPage() {
  const { t } = useTranslation(["financialHistory", "common"]);
  const { user: currentUser } = useAuth();

  const [projects, setProjects] = useState<Project[] | null>(null);
  const [clients, setClients] = useState<Client[] | null>(null);
  const [workers, setWorkers] = useState<User[] | null>(null);
  const [filtersError, setFiltersError] = useState<string | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [projectId, setProjectId] = useState("");
  const [clientId, setClientId] = useState("");
  const [userId, setUserId] = useState("");
  const [type, setType] = useState<FinancialMovementType | "">("");

  const [history, setHistory] = useState<FinancialHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadFilterOptions() {
    setFiltersError(null);
    try {
      const [projectsResponse, clientsResponse, usersResponse] = await Promise.all([
        apiClient.get<{ projects: Project[] }>("/projects"),
        apiClient.get<{ clients: Client[] }>("/clients"),
        apiClient.get<{ users: User[] }>("/auth/users"),
      ]);
      setProjects(projectsResponse.data.projects);
      setClients(clientsResponse.data.clients);
      setWorkers(usersResponse.data.users.filter((u) => u.isActive));
    } catch (error) {
      setFiltersError(translateApiError(t, error));
    }
  }

  async function loadHistory() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiClient.get<FinancialHistoryResponse>("/financial-history", {
        params: {
          from: from ? toStartOfDayIso(from) : undefined,
          to: to ? toEndOfDayIso(to) : undefined,
          projectId: projectId || undefined,
          clientId: clientId || undefined,
          userId: userId || undefined,
          type: type || undefined,
        },
      });
      setHistory(response.data);
    } catch (error) {
      setLoadError(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadFilterOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, projectId, clientId, userId, type]);

  if (!currentUser) {
    return null;
  }

  if (!isTopManagerRole(currentUser.role)) {
    return <Navigate to="/" replace />;
  }

  function describeEntry(entry: FinancialHistoryEntry): string {
    if (entry.type === "INGRESO") {
      return t("entry.income", {
        project: entry.projectName,
        client: entry.clientName ?? t("entry.noClient"),
      });
    }
    return t("entry.expense", {
      worker: entry.workerName,
      start: entry.periodStart ? new Date(entry.periodStart).toLocaleDateString() : "",
      end: entry.periodEnd ? new Date(entry.periodEnd).toLocaleDateString() : "",
    });
  }

  const balance = history?.balance ?? 0;

  return (
    <div className="financial-history-page">
      <div className="page-header">
        <h1>{t("title")}</h1>
      </div>

      {filtersError && (
        <p className="form-error" role="alert">
          {filtersError}
        </p>
      )}

      <section>
        <div className="card-actions">
          <label>
            {t("filters.fromLabel")}
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            {t("filters.toLabel")}
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <label>
            {t("filters.projectLabel")}
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">{t("filters.allProjects")}</option>
              {projects?.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("filters.clientLabel")}
            <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
              <option value="">{t("filters.allClients")}</option>
              {clients?.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("filters.workerLabel")}
            <select value={userId} onChange={(event) => setUserId(event.target.value)}>
              <option value="">{t("filters.allWorkers")}</option>
              {workers?.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("filters.typeLabel")}
            <select value={type} onChange={(event) => setType(event.target.value as FinancialMovementType | "")}>
              <option value="">{t("filters.allTypes")}</option>
              <option value="INGRESO">{t("filters.typeIncome")}</option>
              <option value="EGRESO">{t("filters.typeExpense")}</option>
            </select>
          </label>
        </div>
      </section>

      {history && (
        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-card__value">{formatCurrency(history.totalIngresos)}</span>
            <span className="stat-card__label">{t("summary.income")}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__value">{formatCurrency(history.totalEgresos)}</span>
            <span className="stat-card__label">{t("summary.expense")}</span>
          </div>
          <div className={`stat-card ${balance >= 0 ? "stat-card--positive" : "stat-card--negative"}`}>
            <span className="stat-card__value">{formatCurrency(history.balance)}</span>
            <span className="stat-card__label">{t("summary.balance")}</span>
          </div>
        </div>
      )}

      <section>
        {isLoading && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

        {!isLoading && loadError && (
          <p className="form-error" role="alert">
            {loadError}
          </p>
        )}

        {!isLoading &&
          !loadError &&
          history &&
          (history.entries.length === 0 ? (
            <p>{t("listEmpty")}</p>
          ) : (
            <ul className="card-list">
              {history.entries.map((entry) => (
                <li key={`${entry.type}-${entry.id}`} className="card">
                  <div className="card-header">
                    <span className="card-title">{describeEntry(entry)}</span>
                    <span className={`status-badge ${entry.type === "INGRESO" ? "status-badge--success" : "status-badge--warning"}`}>
                      {t(`type.${entry.type}`)}
                    </span>
                  </div>
                  <span className="card-meta">{new Date(entry.date).toLocaleDateString()}</span>
                  <p className="card-description">
                    <strong>{formatCurrency(entry.amount)}</strong>
                  </p>
                  <span className="card-meta">{t("entry.movementBy", { name: entry.recordedBy.name })}</span>
                </li>
              ))}
            </ul>
          ))}
      </section>
    </div>
  );
}
