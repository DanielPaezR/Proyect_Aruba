import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";

interface ActivitySummary {
  id: string;
  title: string;
  status: string;
  scheduledDate: string | null;
  project: { id: string; name: string };
}

interface SupervisorDashboardData {
  date: string;
  activitiesToday: {
    total: number;
    byStatus: Record<string, ActivitySummary[]>;
  };
  pendingEvidencesCount: number;
  unassignedActivities: ActivitySummary[];
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

      <section>
        <h2>{t("supervisor.todayActivities", { ns: "dashboard" })}</h2>
        {data.activitiesToday.total === 0 ? (
          <p>{t("supervisor.empty", { ns: "dashboard" })}</p>
        ) : (
          <div className="status-columns">
            {STATUS_ORDER.map((status) => (
              <div key={status} className="status-column">
                <h3>{t(`supervisor.status.${status}`, { ns: "dashboard" })}</h3>
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
