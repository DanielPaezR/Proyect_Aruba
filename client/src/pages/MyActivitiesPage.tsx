import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { MyActivityCard } from "../components/MyActivityCard";
import type { Activity } from "../types/activity";

export function MyActivitiesPage() {
  const { t } = useTranslation(["activities", "common"]);

  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

    void load();
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
