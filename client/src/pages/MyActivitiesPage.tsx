import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { MyActivityCard } from "../components/MyActivityCard";
import type { Activity } from "../types/activity";
import type { TimeEntry } from "../types/timeEntry";

function startOfTodayIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

export function MyActivitiesPage() {
  const { t } = useTranslation(["activities", "common"]);

  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [timeEntries, setTimeEntries] = useState<TimeEntry[] | null>(null);

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
        const response = await apiClient.get<{ timeEntries: TimeEntry[] }>("/time-entries/mine", {
          params: { from: startOfTodayIso() },
        });
        if (!cancelled) {
          setTimeEntries(response.data.timeEntries);
        }
      } catch {
        // Seccion secundaria de la pagina: si falla, las actividades siguen
        // usables igual, no vale la pena mostrar un error aparte para esto.
        if (!cancelled) {
          setTimeEntries(null);
        }
      }
    }

    void load();
    void loadTimeEntries();
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

      {timeEntries && (
        <section className="my-time-entries">
          <h2>{t("mine.timeEntriesTitle", { ns: "activities" })}</h2>
          {timeEntries.length === 0 ? (
            <p>{t("mine.timeEntriesEmpty", { ns: "activities" })}</p>
          ) : (
            <ul className="card-list">
              {timeEntries.map((entry) => (
                <li key={entry.id} className="card">
                  <div className="card-header">
                    <span className="card-title">
                      {t(`mine.entryType.${entry.type}`, { ns: "activities" })}
                    </span>
                    <span className={entry.source === "AUTO_GEOFENCE" ? "status-badge status-badge--auto" : "status-badge"}>
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
