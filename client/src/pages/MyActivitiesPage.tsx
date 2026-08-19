import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { MyActivityCard } from "../components/MyActivityCard";
import type { Activity } from "../types/activity";

interface WorkerStats {
  hoursThisWeek: number;
  completedActivitiesThisMonth: number;
  pendingEvidencesCount: number;
  punchStreak: number;
}

export function MyActivitiesPage() {
  const { t } = useTranslation(["activities", "common"]);

  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // undefined = todavia no se cargo; null = error al cargar (seccion secundaria).
  const [workerStats, setWorkerStats] = useState<WorkerStats | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await apiClient.get<{ activities: Activity[] }>("/activities/mine");
        if (!cancelled) {
          setActivities(response.data.activities);
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

    async function loadWorkerStats() {
      try {
        const response = await apiClient.get<WorkerStats>("/dashboard/worker");
        if (!cancelled) {
          setWorkerStats(response.data);
        }
      } catch {
        // Seccion secundaria de la pagina: si falla, las actividades siguen
        // usables igual, no vale la pena mostrar un error aparte para esto.
        if (!cancelled) {
          setWorkerStats(null);
        }
      }
    }

    void load();
    void loadWorkerStats();
    return () => {
      cancelled = true;
    };
  }, [t]);

  function handleActivityUpdated(updated: Activity) {
    // PATCH /activities/:id/status no devuelve "project" (a diferencia de GET
    // /activities/mine) — se conserva el de la tarjeta actual en vez de perderlo.
    setActivities(
      (current) => current?.map((activity) => (activity.id === updated.id ? { ...activity, ...updated } : activity)) ?? null,
    );
  }

  return (
    <div className="my-activities-page">
      <div className="page-header">
        <h1>{t("mine.title", { ns: "activities" })}</h1>
      </div>

      {workerStats && (
        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-card__value">
              {t("mine.stats.hoursValue", { ns: "activities", hours: workerStats.hoursThisWeek })}
            </span>
            <span className="stat-card__label">{t("mine.stats.hoursThisWeek", { ns: "activities" })}</span>
          </div>

          <div className="stat-card">
            <span className="stat-card__value">{workerStats.completedActivitiesThisMonth}</span>
            <span className="stat-card__label">{t("mine.stats.completedThisMonth", { ns: "activities" })}</span>
          </div>

          <div className="stat-card">
            <span className="stat-card__value">{workerStats.pendingEvidencesCount}</span>
            <span className="stat-card__label">{t("mine.stats.pendingEvidences", { ns: "activities" })}</span>
          </div>

          <div className="stat-card">
            {workerStats.punchStreak === 0 ? (
              <span className="stat-card__value stat-card__value--empty">
                {t("mine.stats.streakEmpty", { ns: "activities" })}
              </span>
            ) : (
              <span className="stat-card__value">
                {t("mine.stats.streakValue", { ns: "activities", count: workerStats.punchStreak })}
              </span>
            )}
            <span className="stat-card__label">{t("mine.stats.streak", { ns: "activities" })}</span>
          </div>
        </div>
      )}

      {isLoading && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {!isLoading && errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}

      {!isLoading &&
        !errorMessage &&
        activities &&
        (activities.length === 0 ? (
          <p>{t("mine.empty", { ns: "activities" })}</p>
        ) : (
          <ul className="card-list">
            {activities.map((activity) => (
              <MyActivityCard key={activity.id} activity={activity} onActivityUpdated={handleActivityUpdated} />
            ))}
          </ul>
        ))}
    </div>
  );
}
