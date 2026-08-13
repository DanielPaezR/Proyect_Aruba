import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { translateStatus } from "../i18n/statusLabel";

interface ActivitySummary {
  id: string;
  title: string;
  status: string;
  scheduledDate: string | null;
  project: { id: string; name: string };
}

interface TopWorker {
  name: string;
  hours: number;
}

interface SupervisorStats {
  completedActivitiesThisWeek: number;
  completedActivitiesLastWeek: number;
  teamHoursThisWeek: number;
  evidenceApprovalRate: number | null;
  activeProjectsHighPriority: number;
  activeProjectsLowPriority: number;
  topWorkersThisWeek: TopWorker[];
}

interface SupervisorDashboardData {
  date: string;
  activitiesToday: {
    total: number;
    byStatus: Record<string, ActivitySummary[]>;
  };
  pendingEvidencesCount: number;
  unassignedActivities: ActivitySummary[];
  stats: SupervisorStats;
}

const STATUS_ORDER = ["PENDIENTE", "EN_PROGRESO", "COMPLETADA", "CANCELADA"];

export function SupervisorDashboardPage() {
  const { t } = useTranslation(["dashboard", "common"]);
  const [data, setData] = useState<SupervisorDashboardData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await apiClient.get<SupervisorDashboardData>("/dashboard/supervisor");
        if (!cancelled) {
          setData(response.data);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(translateApiError(t, error));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (isLoading) {
    return <p className="page-loading">{t("loading", { ns: "common" })}</p>;
  }

  if (errorMessage) {
    return (
      <p className="form-error" role="alert">
        {errorMessage}
      </p>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="dashboard">
      <h1>{t("supervisor.title", { ns: "dashboard" })}</h1>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-card__value">{data.stats.completedActivitiesThisWeek}</span>
          <span className="stat-card__label">{t("supervisor.stats.completedActivities", { ns: "dashboard" })}</span>
          <span className="stat-card__trend">
            {t("supervisor.stats.completedActivitiesTrend", {
              ns: "dashboard",
              count: data.stats.completedActivitiesLastWeek,
            })}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-card__value">
            {t("supervisor.stats.hoursValue", { ns: "dashboard", hours: data.stats.teamHoursThisWeek })}
          </span>
          <span className="stat-card__label">{t("supervisor.stats.teamHours", { ns: "dashboard" })}</span>
        </div>

        <div className="stat-card">
          {data.stats.evidenceApprovalRate === null ? (
            <span className="stat-card__value stat-card__value--empty">
              {t("supervisor.stats.noDataYet", { ns: "dashboard" })}
            </span>
          ) : (
            <span className="stat-card__value">{data.stats.evidenceApprovalRate}%</span>
          )}
          <span className="stat-card__label">{t("supervisor.stats.approvalRate", { ns: "dashboard" })}</span>
        </div>

        <div className="stat-card">
          <span className="stat-card__value">
            {t("supervisor.stats.activeProjectsValue", {
              ns: "dashboard",
              high: data.stats.activeProjectsHighPriority,
              low: data.stats.activeProjectsLowPriority,
            })}
          </span>
          <span className="stat-card__label">{t("supervisor.stats.activeProjects", { ns: "dashboard" })}</span>
        </div>

        <div className="stat-card">
          <span className="stat-card__label">{t("supervisor.stats.topWorkers", { ns: "dashboard" })}</span>
          {data.stats.topWorkersThisWeek.length === 0 ? (
            <span className="stat-card__value stat-card__value--empty">
              {t("supervisor.stats.noDataYet", { ns: "dashboard" })}
            </span>
          ) : (
            <ul className="stat-card__list">
              {data.stats.topWorkersThisWeek.map((worker) => (
                <li key={worker.name}>
                  {worker.name} — {t("supervisor.stats.hoursValue", { ns: "dashboard", hours: worker.hours })}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <section>
        <h2>{t("supervisor.todayActivities", { ns: "dashboard" })}</h2>
        {data.activitiesToday.total === 0 ? (
          <p>{t("supervisor.empty", { ns: "dashboard" })}</p>
        ) : (
          <div className="status-columns">
            {STATUS_ORDER.map((status) => (
              <div key={status} className="status-column">
                <h3>{translateStatus(t, "common", "activityStatus", status)}</h3>
                <ul>
                  {(data.activitiesToday.byStatus[status] ?? []).map((activity) => (
                    <li key={activity.id}>
                      {activity.title} — {activity.project.name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>{t("supervisor.pendingEvidences", { ns: "dashboard" })}</h2>
        <p className="metric">{data.pendingEvidencesCount}</p>
      </section>

      <section>
        <h2>{t("supervisor.unassignedActivities", { ns: "dashboard" })}</h2>
        {data.unassignedActivities.length === 0 ? (
          <p>{t("supervisor.noUnassigned", { ns: "dashboard" })}</p>
        ) : (
          <ul>
            {data.unassignedActivities.map((activity) => (
              <li key={activity.id}>
                {activity.title} — {activity.project.name}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
