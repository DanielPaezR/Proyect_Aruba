import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { translateStatus } from "../i18n/statusLabel";
import { isManagerRole } from "../types/auth";
import type { FuelLog, Vehicle, VehicleIncidentReport } from "../types/vehicle";
import { formatCurrency } from "../utils/formatCurrency";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VehicleDetailPage() {
  const { t } = useTranslation(["vehicles", "common"]);
  const { user } = useAuth();
  const { vehicleId } = useParams<{ vehicleId: string }>();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fuelLogs, setFuelLogs] = useState<FuelLog[] | null>(null);
  const [isLoadingFuelLogs, setIsLoadingFuelLogs] = useState(true);
  const [fuelLogsError, setFuelLogsError] = useState<string | null>(null);

  const [incidents, setIncidents] = useState<VehicleIncidentReport[] | null>(null);
  const [isLoadingIncidents, setIsLoadingIncidents] = useState(true);
  const [incidentsError, setIncidentsError] = useState<string | null>(null);

  async function loadVehicle(id: string) {
    setIsLoading(true);
    setLoadError(null);
    try {
      // No hay GET de un solo vehiculo en el backend (mismo criterio que
      // inventory.routes.ts, que tampoco lo tiene) — se busca dentro de la
      // lista completa, que ya trae assignedTo incluido.
      const response = await apiClient.get<{ vehicles: Vehicle[] }>("/vehicles");
      const found = response.data.vehicles.find((v) => v.id === id) ?? null;
      setVehicle(found);
    } catch (error) {
      setLoadError(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadFuelLogs(id: string) {
    setIsLoadingFuelLogs(true);
    setFuelLogsError(null);
    try {
      const response = await apiClient.get<{ fuelLogs: FuelLog[] }>(`/vehicles/${id}/fuel-logs`);
      setFuelLogs(response.data.fuelLogs);
    } catch (error) {
      setFuelLogsError(translateApiError(t, error));
    } finally {
      setIsLoadingFuelLogs(false);
    }
  }

  async function loadIncidents(id: string) {
    setIsLoadingIncidents(true);
    setIncidentsError(null);
    try {
      const response = await apiClient.get<{ incidents: VehicleIncidentReport[] }>("/vehicles/incidents", {
        params: { vehicleId: id },
      });
      setIncidents(response.data.incidents);
    } catch (error) {
      setIncidentsError(translateApiError(t, error));
    } finally {
      setIsLoadingIncidents(false);
    }
  }

  useEffect(() => {
    if (vehicleId) {
      void loadVehicle(vehicleId);
      void loadFuelLogs(vehicleId);
      void loadIncidents(vehicleId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  if (!user || !vehicleId) {
    return null;
  }

  if (!isManagerRole(user.role)) {
    return <Navigate to="/" replace />;
  }

  const totalFuelCost = fuelLogs?.reduce((sum, log) => sum + Number(log.cost), 0) ?? 0;

  return (
    <div className="vehicle-detail-page">
      <PageHeader
        title={vehicle ? `${vehicle.plate} — ${vehicle.brand} ${vehicle.model}` : t("title")}
        back={{ to: "/vehicles", label: t("title") }}
      >
        {vehicle && <span className="status-badge">{translateStatus(t, "vehicles", "status", vehicle.status)}</span>}
      </PageHeader>

      {isLoading && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {!isLoading && loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}

      {!isLoading && !loadError && !vehicle && <p>{t("notFound")}</p>}

      {!isLoading && !loadError && vehicle && (
        <>
          <section>
            <h2 className="section-label">{t("detailsSection")}</h2>
            <dl className="info-grid">
              <div>
                <dt>{t("yearLabel")}</dt>
                <dd>{vehicle.year}</dd>
              </div>
              <div>
                <dt>{t("identificationNumberLabel")}</dt>
                <dd>{vehicle.identificationNumber ?? t("notSpecified")}</dd>
              </div>
              <div>
                <dt>{t("assignedToLabel")}</dt>
                <dd>{vehicle.assignedTo ? vehicle.assignedTo.name : t("unassignedOption")}</dd>
              </div>
              <div>
                <dt>{t("notesLabel")}</dt>
                <dd>{vehicle.notes ?? t("notSpecified")}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="section-label">{t("fuelLogsSection")}</h2>

            {isLoadingFuelLogs && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

            {!isLoadingFuelLogs && fuelLogsError && (
              <p className="form-error" role="alert">
                {fuelLogsError}
              </p>
            )}

            {!isLoadingFuelLogs && !fuelLogsError && fuelLogs && (
              <>
                <p className="payments-total">
                  {t("totalFuelCostLabel")}: <strong>{formatCurrency(totalFuelCost)}</strong>
                </p>
                {fuelLogs.length === 0 ? (
                  <p>{t("fuelLogsEmpty")}</p>
                ) : (
                  <ul className="card-list">
                    {fuelLogs.map((log) => (
                      <li key={log.id} className="card">
                        <div className="card-header">
                          <span className="card-title">{formatCurrency(log.cost)}</span>
                          <span className="card-meta">{formatDate(log.date)}</span>
                        </div>
                        {log.liters && (
                          <span className="card-meta">
                            {t("litersLabel")}: {log.liters}
                          </span>
                        )}
                        {log.odometerReading !== null && (
                          <span className="card-meta">
                            {t("odometerLabel")}: {log.odometerReading}
                          </span>
                        )}
                        <span className="card-meta">
                          {t("recordedByLabel")}: {log.recordedBy.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>

          <section>
            <h2 className="section-label">{t("incidentsSection")}</h2>

            {isLoadingIncidents && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

            {!isLoadingIncidents && incidentsError && (
              <p className="form-error" role="alert">
                {incidentsError}
              </p>
            )}

            {!isLoadingIncidents &&
              !incidentsError &&
              incidents &&
              (incidents.length === 0 ? (
                <p>{t("incidentsEmpty")}</p>
              ) : (
                <ul className="card-list">
                  {incidents.map((incident) => (
                    <li key={incident.id} className="card">
                      <div className="card-header">
                        <span className="card-title">{translateStatus(t, "vehicles", "incidentType", incident.type)}</span>
                        <span className={`status-badge ${incident.resolvedAt ? "status-badge--success" : "status-badge--warning"}`}>
                          {incident.resolvedAt ? t("statusResolved") : t("statusPending")}
                        </span>
                      </div>
                      <span className="card-meta">{formatDateTime(incident.reportedAt)}</span>
                      <span className="card-meta">
                        {t("reportedByLabel")}: {incident.reportedBy.name}
                      </span>
                      <p className="card-description">{incident.description}</p>
                      {incident.cost && (
                        <span className="card-meta">
                          {t("costLabel")}: {formatCurrency(incident.cost)}
                        </span>
                      )}
                      {incident.photoUrl && (
                        <a href={incident.photoUrl} target="_blank" rel="noreferrer">
                          <img src={incident.photoUrl} alt={t("incidentPhotoAlt")} className="evidence-thumb" />
                        </a>
                      )}
                      {incident.resolvedAt && (
                        <p className="card-description">
                          {t("resolvedLabel")}: {formatDateTime(incident.resolvedAt)}
                          {incident.resolutionNote ? ` — ${incident.resolutionNote}` : ""}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ))}
          </section>
        </>
      )}
    </div>
  );
}
