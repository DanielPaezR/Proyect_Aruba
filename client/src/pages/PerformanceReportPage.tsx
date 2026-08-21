import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { CheckCircle2, Clock, Coins } from "lucide-react";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { FilterBar } from "../components/FilterBar";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { isTopManagerRole } from "../types/auth";
import type { User } from "../types/auth";
import type { Project } from "../types/project";
import type { PerformanceReport } from "../types/performanceReport";
import { formatCurrency } from "../utils/formatCurrency";

function toStartOfDayIso(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`;
}

function toEndOfDayIso(dateStr: string): string {
  return `${dateStr}T23:59:59.999Z`;
}

function formatRate(rate: number | null, noDataLabel: string): string {
  return rate === null ? noDataLabel : `${rate}%`;
}

export function PerformanceReportPage() {
  const { t } = useTranslation(["reports", "common"]);
  const { user: currentUser } = useAuth();

  const [projects, setProjects] = useState<Project[] | null>(null);
  const [workers, setWorkers] = useState<User[] | null>(null);
  const [filtersError, setFiltersError] = useState<string | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [projectId, setProjectId] = useState("");
  const [userId, setUserId] = useState("");

  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadFilterOptions() {
    setFiltersError(null);
    try {
      const [projectsResponse, usersResponse] = await Promise.all([
        apiClient.get<{ projects: Project[] }>("/projects"),
        apiClient.get<{ users: User[] }>("/auth/users"),
      ]);
      setProjects(projectsResponse.data.projects);
      setWorkers(usersResponse.data.users.filter((u) => u.role === "TRABAJADOR_CAMPO" && u.isActive));
    } catch (error) {
      setFiltersError(translateApiError(t, error));
    }
  }

  async function loadReport() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiClient.get<PerformanceReport>("/reports/performance", {
        params: {
          from: from ? toStartOfDayIso(from) : undefined,
          to: to ? toEndOfDayIso(to) : undefined,
          projectId: projectId || undefined,
          userId: userId || undefined,
        },
      });
      setReport(response.data);
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
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, projectId, userId]);

  if (!currentUser) {
    return null;
  }

  if (!isTopManagerRole(currentUser.role)) {
    return <Navigate to="/" replace />;
  }

  const noDataLabel = t("summary.noData");

  function handleClearFilters() {
    setFrom("");
    setTo("");
    setProjectId("");
    setUserId("");
  }

  return (
    <div className="performance-report-page">
      <PageHeader title={t("title")} />

      {filtersError && (
        <p className="form-error" role="alert">
          {filtersError}
        </p>
      )}

      <FilterBar onClear={handleClearFilters}>
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
      </FilterBar>

      {isLoading && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {!isLoading && loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}

      {!isLoading && !loadError && report && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-card__icon">
                <Coins size={20} aria-hidden="true" />
              </div>
              <span className="stat-card__label">{t("summary.avgCost")}</span>
              <span className={report.avgCostPerCompletedActivity === null ? "stat-card__value stat-card__value--empty" : "stat-card__value"}>
                {report.avgCostPerCompletedActivity === null ? noDataLabel : formatCurrency(report.avgCostPerCompletedActivity)}
              </span>
              {report.completedActivitiesCount > 0 && (
                <span className="card-meta">
                  {t("summary.avgCostHint", { count: report.completedActivitiesCount })}
                </span>
              )}
            </div>

            <div className="stat-card">
              <div className="stat-card__icon stat-card__icon--neutral">
                <Clock size={20} aria-hidden="true" />
              </div>
              <span className="stat-card__label">{t("summary.avgDelay")}</span>
              <span className={report.avgProjectDelayDays === null ? "stat-card__value stat-card__value--empty" : "stat-card__value"}>
                {report.avgProjectDelayDays === null
                  ? noDataLabel
                  : t("summary.avgDelayValue", { days: report.avgProjectDelayDays })}
              </span>
              {report.projectsWithCompletedActivityCount > 0 && (
                <span className="card-meta">
                  {t("summary.avgDelayHint", { count: report.projectsWithCompletedActivityCount })}
                </span>
              )}
            </div>

            <div className="stat-card">
              <div className="stat-card__icon stat-card__icon--alert">
                <CheckCircle2 size={20} aria-hidden="true" />
              </div>
              <span className="stat-card__label">{t("summary.approvalRate")}</span>
              <span
                className={
                  report.evidenceApproval.overall.rate === null ? "stat-card__value stat-card__value--empty" : "stat-card__value"
                }
              >
                {formatRate(report.evidenceApproval.overall.rate, noDataLabel)}
              </span>
              {report.evidenceApproval.overall.rate !== null && (
                <span className="card-meta">
                  {t("summary.approvalRateHint", {
                    approved: report.evidenceApproval.overall.approved,
                    rejected: report.evidenceApproval.overall.rejected,
                  })}
                </span>
              )}
            </div>
          </div>

          <section>
            <h2 className="section-label">{t("breakdown.byProjectTitle")}</h2>
            {report.evidenceApproval.byProject.length === 0 ? (
              <p>{t("breakdown.empty")}</p>
            ) : (
              <div className="report-table-wrapper">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>{t("breakdown.columns.project")}</th>
                      <th>{t("breakdown.columns.approved")}</th>
                      <th>{t("breakdown.columns.rejected")}</th>
                      <th>{t("breakdown.columns.rate")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.evidenceApproval.byProject.map((row) => (
                      <tr key={row.projectId}>
                        <td>{row.projectName}</td>
                        <td>{row.approved}</td>
                        <td>{row.rejected}</td>
                        <td>{formatRate(row.rate, noDataLabel)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="section-label">{t("breakdown.byWorkerApprovalTitle")}</h2>
            {report.evidenceApproval.byWorker.length === 0 ? (
              <p>{t("breakdown.empty")}</p>
            ) : (
              <div className="report-table-wrapper">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>{t("breakdown.columns.worker")}</th>
                      <th>{t("breakdown.columns.approved")}</th>
                      <th>{t("breakdown.columns.rejected")}</th>
                      <th>{t("breakdown.columns.rate")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.evidenceApproval.byWorker.map((row) => (
                      <tr key={row.userId}>
                        <td>{row.userName}</td>
                        <td>{row.approved}</td>
                        <td>{row.rejected}</td>
                        <td>{formatRate(row.rate, noDataLabel)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="section-label">{t("breakdown.productivityTitle")}</h2>
            {report.productivityByWorker.length === 0 ? (
              <p>{t("breakdown.empty")}</p>
            ) : (
              <div className="report-table-wrapper">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>{t("breakdown.columns.worker")}</th>
                      <th>{t("breakdown.columns.completedActivities")}</th>
                      <th>{t("breakdown.columns.hoursWorked")}</th>
                      <th>{t("breakdown.columns.activitiesPerHour")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.productivityByWorker.map((row) => (
                      <tr key={row.userId}>
                        <td>{row.userName}</td>
                        <td>{row.completedActivities}</td>
                        <td>{row.hoursWorked}</td>
                        <td>{row.activitiesPerHour === null ? noDataLabel : row.activitiesPerHour}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
