import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { translateStatus } from "../i18n/statusLabel";
import { isTimeTrackingRole } from "../types/auth";
import type { Emergency, EmergencyPriority } from "../types/emergency";
import { resolveMapsUrl } from "../utils/mapsUrl";

function priorityBadgeClassName(priority: string): string {
  return priority === "ALTA" || priority === "URGENTE" ? "status-badge status-badge--priority-high" : "status-badge";
}

// URGENTE primero, MEDIA al final — mismo orden que el usuario espera ver
// para decidir a que responder primero.
const PRIORITY_RANK: Record<EmergencyPriority, number> = { URGENTE: 0, ALTA: 1, MEDIA: 2 };

export function MyEmergenciesPage() {
  const { t } = useTranslation(["emergencies", "common"]);
  const { user } = useAuth();

  const [emergencies, setEmergencies] = useState<Emergency[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadEmergencies() {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await apiClient.get<{ emergencies: Emergency[] }>("/emergencies/mine");
      setEmergencies(response.data.emergencies);
    } catch (error) {
      setErrorMessage(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadEmergencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) {
    return null;
  }

  // Mismo criterio que "Horas" (isTimeTrackingRole): Administrador/Gerente
  // usan la vista de gestion (/emergencies), no esta.
  if (!isTimeTrackingRole(user.role)) {
    return <Navigate to="/" replace />;
  }

  const sortedEmergencies = [...(emergencies ?? [])].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  );

  return (
    <div className="my-emergencies-page">
      <PageHeader title={t("mine.title", { ns: "emergencies" })} />

      {isLoading && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {!isLoading && errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}

      {!isLoading &&
        !errorMessage &&
        emergencies &&
        (sortedEmergencies.length === 0 ? (
          <p>{t("mine.empty", { ns: "emergencies" })}</p>
        ) : (
          <ul className="card-list">
            {sortedEmergencies.map((emergency) => {
              const directionsUrl = resolveMapsUrl(emergency.locationMapsUrl, null);
              return (
                <li key={emergency.id} className="card">
                  <div className="card-header">
                    <span className="card-title">{emergency.title}</span>
                    <span className={priorityBadgeClassName(emergency.priority)}>
                      {translateStatus(t, "emergencies", "priority", emergency.priority)}
                    </span>
                  </div>
                  <span className="card-meta">
                    {translateStatus(t, "emergencies", "status", emergency.status)}
                    {emergency.project && ` · ${emergency.project.name}`}
                    {" · "}
                    {t("reportedBy", { ns: "emergencies", name: emergency.reportedBy.name })}
                  </span>
                  <p className="card-description">{emergency.description}</p>

                  {emergency.status === "RESUELTA" && (
                    <p className="card-description">
                      {t("resolvedLabel", { ns: "emergencies" })}
                      {emergency.resolutionNote ? `: ${emergency.resolutionNote}` : ""}
                    </p>
                  )}

                  {directionsUrl && (
                    <div className="activity-actions">
                      <a
                        href={directionsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="activity-action-button activity-action-button--secondary"
                      >
                        <MapPin size={18} aria-hidden="true" />
                        <span>{t("mine.directionsButton", { ns: "emergencies" })}</span>
                      </a>
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
