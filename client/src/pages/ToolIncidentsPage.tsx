import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { translateStatus } from "../i18n/statusLabel";
import { isInventoryRole } from "../types/auth";
import type { ToolIncidentReport } from "../types/inventory";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

type StatusFilter = "" | "PENDIENTE" | "RESUELTO";

export function ToolIncidentsPage() {
  const { t } = useTranslation(["toolIncidents", "common"]);
  const { user } = useAuth();

  const [reports, setReports] = useState<ToolIncidentReport[] | null>(null);
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
      const response = await apiClient.get<{ reports: ToolIncidentReport[] }>("/tool-incident-reports", {
        params: statusFilter ? { status: statusFilter } : undefined,
      });
      setReports(response.data.reports);
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
      await apiClient.patch(`/tool-incident-reports/${resolvingId}/resolve`, {
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

  // Cola de gestion: solo Mercaderista/Jefe (ver tool-incident-reports.routes.ts).
  if (!isInventoryRole(user.role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="tool-incidents-page">
      <PageHeader title={t("title", { ns: "toolIncidents" })} />

      <label className="status-filter">
        {t("statusFilterLabel", { ns: "toolIncidents" })}
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
          <option value="">{t("statusFilterAll", { ns: "toolIncidents" })}</option>
          <option value="PENDIENTE">{t("statusPending", { ns: "toolIncidents" })}</option>
          <option value="RESUELTO">{t("statusResolved", { ns: "toolIncidents" })}</option>
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
          <p>{t("empty", { ns: "toolIncidents" })}</p>
        ) : (
          <ul className="card-list">
            {reports.map((report) => (
              <li key={report.id} className="card">
                <div className="card-header">
                  <span className="card-title">{report.toolAssignment.item.name}</span>
                  <span className="status-badge status-badge--warning">
                    {translateStatus(t, "toolIncidents", "incidentType", report.type)}
                  </span>
                </div>
                <span className="card-meta">
                  {t("workerLabel", { ns: "toolIncidents" })}: {report.toolAssignment.user.name}
                </span>
                <span className="card-meta">
                  {t("reportedByLabel", { ns: "toolIncidents" })}: {report.reportedBy.name}
                </span>
                <span className="card-meta">{formatDateTime(report.reportedAt)}</span>
                <p className="card-description">{report.description}</p>

                {report.resolvedAt ? (
                  <p className="card-description">
                    {t("resolvedLabel", { ns: "toolIncidents" })}: {formatDateTime(report.resolvedAt)}
                    {report.resolutionNote ? ` — ${report.resolutionNote}` : ""}
                  </p>
                ) : (
                  <div className="card-actions">
                    <button type="button" onClick={() => openResolve(report.id)}>
                      {t("resolveButton", { ns: "toolIncidents" })}
                    </button>
                  </div>
                )}

                {resolvingId === report.id && (
                  <form className="inline-form" onSubmit={(event) => void handleResolve(event)}>
                    <h2>{t("resolveFormTitle", { ns: "toolIncidents" })}</h2>
                    <label>
                      {t("resolutionNoteLabel", { ns: "toolIncidents" })}
                      <textarea value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} />
                    </label>
                    {resolveError && (
                      <p className="form-error" role="alert">
                        {resolveError}
                      </p>
                    )}
                    <div className="form-actions">
                      <button type="submit" disabled={isResolving}>
                        {isResolving
                          ? t("resolveSubmitting", { ns: "toolIncidents" })
                          : t("resolveSubmit", { ns: "toolIncidents" })}
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
