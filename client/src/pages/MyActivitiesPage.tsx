import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { MyActivityCard } from "../components/MyActivityCard";
import type { Activity } from "../types/activity";
import type { UserDaySummary } from "../types/timeEntry";
import { formatHoursFromMinutes } from "../utils/formatHours";

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

  // undefined = todavia no se cargo; null = cargado pero sin marcaciones hoy (o error).
  const [todaySummary, setTodaySummary] = useState<UserDaySummary | null | undefined>(undefined);

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

    async function loadTimeEntries() {
      try {
        // Sin filtros: el backend usa el dia de hoy en Aruba por default.
        const response = await apiClient.get<{ summary: UserDaySummary[] }>("/time-entries/summary/mine");
        if (!cancelled) {
          setTodaySummary(response.data.summary[0] ?? null);
        }
      } catch {
        // Seccion secundaria de la pagina: si falla, las actividades siguen
        // usables igual, no vale la pena mostrar un error aparte para esto.
        if (!cancelled) {
          setTodaySummary(null);
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
    void loadTimeEntries();
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

      {todaySummary !== undefined && (
        <section className="my-time-entries">
          <h2>{t("mine.timeEntriesTitle", { ns: "activities" })}</h2>
          {!todaySummary || todaySummary.entries.length === 0 ? (
            <p>{t("mine.timeEntriesEmpty", { ns: "activities" })}</p>
          ) : (
            <>
              <p className="card-meta">
                {t("mine.totalLabel", { ns: "activities" })}: {formatHoursFromMinutes(todaySummary.totalMinutes)}
                {todaySummary.hasOpenEntry && ` · ${t("mine.openLabel", { ns: "activities" })}`}
              </p>
              <ul className="card-list">
                {todaySummary.entries.map((entry) => (
                  <li key={entry.id} className="card">
                    <div className="card-header">
                      <span className="card-title">
                        {t(`mine.entryType.${entry.type}`, { ns: "activities" })}
                      </span>
                      <span
                        className={
                          entry.source === "AUTO_GEOFENCE" ? "status-badge status-badge--auto" : "status-badge"
                        }
                      >
                        {entry.source === "AUTO_GEOFENCE"
                          ? t("mine.autoBadge", { ns: "activities" })
                          : t("mine.manualBadge", { ns: "activities" })}
                      </span>
                    </div>
                    <span className="card-meta">
                      {new Date(entry.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
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
