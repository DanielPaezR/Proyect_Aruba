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
import { MATERIAL_REQUEST_STATUSES } from "../types/inventory";
import type { MaterialRequest, MaterialRequestStatus } from "../types/inventory";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Mismas transiciones permitidas que el backend (ver material-requests.service.ts).
const NEXT_ACTIONS: Record<MaterialRequestStatus, MaterialRequestStatus[]> = {
  PENDIENTE: ["APROBADA", "RECHAZADA", "ENTREGADA"],
  APROBADA: ["ENTREGADA"],
  RECHAZADA: [],
  ENTREGADA: [],
};

export function MaterialRequestsPage() {
  const { t } = useTranslation(["materialRequests", "common"]);
  const { user } = useAuth();

  const [requests, setRequests] = useState<MaterialRequest[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<MaterialRequestStatus | "">("PENDIENTE");

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolvingTarget, setResolvingTarget] = useState<MaterialRequestStatus | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  async function loadRequests() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiClient.get<{ requests: MaterialRequest[] }>("/material-requests", {
        params: statusFilter ? { status: statusFilter } : undefined,
      });
      setRequests(response.data.requests);
    } catch (error) {
      setLoadError(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  function openResolve(requestId: string, target: MaterialRequestStatus) {
    setResolvingId(requestId);
    setResolvingTarget(target);
    setResolutionNote("");
    setResolveError(null);
  }

  async function handleResolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resolvingId || !resolvingTarget) {
      return;
    }
    setResolveError(null);
    setIsResolving(true);
    try {
      await apiClient.patch(`/material-requests/${resolvingId}/resolve`, {
        status: resolvingTarget,
        resolutionNote: resolutionNote || undefined,
      });
      setResolvingId(null);
      setResolvingTarget(null);
      await loadRequests();
    } catch (error) {
      setResolveError(translateApiError(t, error));
    } finally {
      setIsResolving(false);
    }
  }

  if (!user) {
    return null;
  }

  // Cola de gestion: solo Mercaderista/Jefe (ver material-requests.routes.ts).
  if (!isInventoryRole(user.role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="material-requests-page">
      <PageHeader title={t("title", { ns: "materialRequests" })} />

      <label className="status-filter">
        {t("statusFilterLabel", { ns: "materialRequests" })}
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as MaterialRequestStatus | "")}
        >
          <option value="">{t("statusFilterAll", { ns: "materialRequests" })}</option>
          {MATERIAL_REQUEST_STATUSES.map((value) => (
            <option key={value} value={value}>
              {translateStatus(t, "common", "materialRequestStatus", value)}
            </option>
          ))}
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
        requests &&
        (requests.length === 0 ? (
          <p>{t("empty", { ns: "materialRequests" })}</p>
        ) : (
          <ul className="card-list">
            {requests.map((request) => (
              <li key={request.id} className="card">
                <div className="card-header">
                  <span className="card-title">{request.item?.name ?? request.itemNameFreeText}</span>
                  <span className="status-badge">
                    {translateStatus(t, "common", "materialRequestStatus", request.status)}
                  </span>
                </div>
                <span className="card-meta">
                  {t("quantityLabel", { ns: "materialRequests" })}: {request.quantity}
                  {request.item ? ` ${request.item.unit}` : ""}
                </span>
                <span className="card-meta">
                  {t("projectLabel", { ns: "materialRequests" })}:{" "}
                  {request.project?.name ?? t("projectGeneralOption", { ns: "materialRequests" })}
                </span>
                <span className="card-meta">
                  {t("requestedByLabel", { ns: "materialRequests" })}: {request.requestedBy.name}
                </span>
                <span className="card-meta">{formatDate(request.createdAt)}</span>
                <p className="card-description">{request.reason}</p>

                {request.resolvedBy && (
                  <p className="card-description">
                    {t("resolvedByLabel", { ns: "materialRequests" })}: {request.resolvedBy.name}
                    {request.resolutionNote ? ` — ${request.resolutionNote}` : ""}
                  </p>
                )}

                {NEXT_ACTIONS[request.status].length > 0 && (
                  <div className="card-actions">
                    {NEXT_ACTIONS[request.status].map((target) => (
                      <button key={target} type="button" onClick={() => openResolve(request.id, target)}>
                        {t(`resolveAction.${target}`, { ns: "materialRequests" })}
                      </button>
                    ))}
                  </div>
                )}

                {resolvingId === request.id && resolvingTarget && (
                  <form className="inline-form" onSubmit={(event) => void handleResolve(event)}>
                    <h2>{t(`resolveAction.${resolvingTarget}`, { ns: "materialRequests" })}</h2>
                    <label>
                      {t("resolutionNoteLabel", { ns: "materialRequests" })}
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
                          ? t("resolveSubmitting", { ns: "materialRequests" })
                          : t("resolveSubmit", { ns: "materialRequests" })}
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
