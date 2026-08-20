import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, BadgeCheck, CheckCircle2, Clock, Minus, Trophy, TrendingDown, TrendingUp } from "lucide-react";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { translateStatus } from "../i18n/statusLabel";
import type { ProjectPriority } from "../types/project";

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
  activeProjectsByPriority: Record<ProjectPriority, number>;
  topWorkersThisWeek: TopWorker[];
}

const PRIORITY_LEVELS: ProjectPriority[] = ["URGENTE", "ALTA", "MEDIA", "BAJA"];
const HIGH_PRIORITY_LEVELS = new Set<ProjectPriority>(["URGENTE", "ALTA"]);

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
  const { t } = useTranslation(["dashboard", "common", "projects"]);
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

  const activitiesTrend =
    data.stats.completedActivitiesThisWeek > data.stats.completedActivitiesLastWeek
      ? "up"
      : data.stats.completedActivitiesThisWeek < data.stats.completedActivitiesLastWeek
        ? "down"
        : "flat";
  const ActivitiesTrendIcon = activitiesTrend === "up" ? TrendingUp : activitiesTrend === "down" ? TrendingDown : Minus;

  return (
    <div className="dashboard">
      <PageHeader title={t("supervisor.title", { ns: "dashboard" })} />

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__icon">
            <CheckCircle2 size={20} aria-hidden="true" />
          </div>
          <span className="stat-card__label">{t("supervisor.stats.completedActivities", { ns: "dashboard" })}</span>
          <span className="stat-card__value">{data.stats.completedActivitiesThisWeek}</span>
          <span className={`stat-card__trend stat-card__trend--${activitiesTrend}`}>
            <ActivitiesTrendIcon size={14} aria-hidden="true" />
            {t("supervisor.stats.completedActivitiesTrend", {
              ns: "dashboard",
              count: data.stats.completedActivitiesLastWeek,
            })}
          </span>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--neutral">
            <Clock size={20} aria-hidden="true" />
          </div>
          <span className="stat-card__label">{t("supervisor.stats.teamHours", { ns: "dashboard" })}</span>
          <span className="stat-card__value">
            {t("supervisor.stats.hoursValue", { ns: "dashboard", hours: data.stats.teamHoursThisWeek })}
          </span>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon">
            <BadgeCheck size={20} aria-hidden="true" />
          </div>
          <span className="stat-card__label">{t("supervisor.stats.approvalRate", { ns: "dashboard" })}</span>
          {data.stats.evidenceApprovalRate === null ? (
            <span className="stat-card__value stat-card__value--empty">
              {t("supervisor.stats.noDataYet", { ns: "dashboard" })}
            </span>
          ) : (
            <span className="stat-card__value">{data.stats.evidenceApprovalRate}%</span>
          )}
        </div>

        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--alert">
            <AlertTriangle size={20} aria-hidden="true" />
          </div>
          <span className="stat-card__label">{t("supervisor.stats.activeProjects", { ns: "dashboard" })}</span>
          <div className="priority-breakdown">
            {PRIORITY_LEVELS.map((level) => (
              <div
                key={level}
                className={
                  HIGH_PRIORITY_LEVELS.has(level) ? "priority-cell priority-cell--high" : "priority-cell"
                }
              >
                <span className="priority-cell__count">{data.stats.activeProjectsByPriority[level]}</span>
                <span className="priority-cell__label">{translateStatus(t, "projects", "priority", level)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon">
            <Trophy size={20} aria-hidden="true" />
          </div>
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
        <h2 className="section-label">{t("supervisor.todayActivities", { ns: "dashboard" })}</h2>
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
        <h2 className="section-label">{t("supervisor.pendingEvidences", { ns: "dashboard" })}</h2>
        <p className="metric">{data.pendingEvidencesCount}</p>
      </section>

      <section>
        <h2 className="section-label">{t("supervisor.unassignedActivities", { ns: "dashboard" })}</h2>
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
