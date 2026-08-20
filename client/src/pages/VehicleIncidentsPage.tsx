import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { translateStatus } from "../i18n/statusLabel";
import { isManagerRole } from "../types/auth";
import type { VehicleIncidentReport } from "../types/vehicle";
import { formatCurrency } from "../utils/formatCurrency";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type StatusFilter = "" | "PENDIENTE" | "RESUELTO";

export function VehicleIncidentsPage() {
  const { t } = useTranslation(["vehicleIncidents", "vehicles", "common"]);
  const { user } = useAuth();

  const [reports, setReports] = useState<VehicleIncidentReport[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDIENTE");

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  async function loadReports() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiClient.get<{ incidents: VehicleIncidentReport[] }>("/vehicles/incidents", {
        params: statusFilter ? { status: statusFilter } : undefined,
      });
      setReports(response.data.incidents);
    } catch (error) {
      setLoadError(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  function openResolve(reportId: string) {
    setResolvingId(reportId);
    setResolutionNote("");
    setResolveError(null);
  }

  async function handleResolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resolvingId) {
      return;
    }
    setResolveError(null);
    setIsResolving(true);
    try {
      await apiClient.patch(`/vehicles/incidents/${resolvingId}/resolve`, {
        resolutionNote: resolutionNote || undefined,
      });
      setResolvingId(null);
      await loadReports();
    } catch (error) {
      setResolveError(translateApiError(t, error));
    } finally {
      setIsResolving(false);
    }
  }

  if (!user) {
    return null;
  }

  // Cola de gestion: ADMINISTRADOR/GERENTE/SUPERVISOR (mismo criterio que
  // vehicles.routes.ts — sin Mercaderista, a diferencia de la cola de
  // herramientas que si lo incluye).
  if (!isManagerRole(user.role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="vehicle-incidents-page">
      <PageHeader title={t("title")} />

      <label className="status-filter">
        {t("statusFilterLabel")}
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
          <option value="">{t("statusFilterAll")}</option>
          <option value="PENDIENTE">{t("statusPending", { ns: "vehicles" })}</option>
          <option value="RESUELTO">{t("statusResolved", { ns: "vehicles" })}</option>
        </select>
      </label>

      {isLoading && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {!isLoading && loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}

      {!isLoading &&
        !loadError &&
        reports &&
        (reports.length === 0 ? (
          <p>{t("empty")}</p>
        ) : (
          <ul className="card-list">
            {reports.map((report) => (
              <li key={report.id} className="card">
                <div className="card-header">
                  <span className="card-title">
                    {report.vehicle.plate} — {report.vehicle.brand} {report.vehicle.model}
                  </span>
                  <span className="status-badge status-badge--warning">
                    {translateStatus(t, "vehicles", "incidentType", report.type)}
                  </span>
                </div>
                <span className="card-meta">
                  {t("reportedByLabel", { ns: "vehicles" })}: {report.reportedBy.name}
                </span>
                <span className="card-meta">{formatDateTime(report.reportedAt)}</span>
                <p className="card-description">{report.description}</p>
                {report.cost && (
                  <span className="card-meta">
                    {t("costLabel", { ns: "vehicles" })}: {formatCurrency(report.cost)}
                  </span>
                )}
                {report.photoUrl && (
                  <a href={report.photoUrl} target="_blank" rel="noreferrer">
                    <img src={report.photoUrl} alt={t("incidentPhotoAlt", { ns: "vehicles" })} className="evidence-thumb" />
                  </a>
                )}

                {report.resolvedAt ? (
                  <p className="card-description">
                    {t("resolvedLabel", { ns: "vehicles" })}: {formatDateTime(report.resolvedAt)}
                    {report.resolutionNote ? ` — ${report.resolutionNote}` : ""}
                  </p>
                ) : (
                  <div className="card-actions">
                    <button type="button" onClick={() => openResolve(report.id)}>
                      {t("resolveButton")}
                    </button>
                  </div>
                )}

                {resolvingId === report.id && (
                  <form className="inline-form" onSubmit={(event) => void handleResolve(event)}>
                    <h2>{t("resolveFormTitle")}</h2>
                    <label>
                      {t("resolutionNoteLabel")}
                      <textarea value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} />
                    </label>
                    {resolveError && (
                      <p className="form-error" role="alert">
                        {resolveError}
                      </p>
                    )}
                    <div className="form-actions">
                      <button type="submit" disabled={isResolving}>
                        {isResolving ? t("resolveSubmitting") : t("resolveSubmit")}
                      </button>
                      <button type="button" onClick={() => setResolvingId(null)}>
                        {t("actions.cancel", { ns: "common" })}
                      </button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
