import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { EvidenceReviewGroup } from "../components/EvidenceReviewGroup";
import { translateStatus } from "../i18n/statusLabel";
import { EVIDENCE_STATUSES } from "../types/evidence";
import type { EvidenceStatus, EvidenceWithActivity } from "../types/evidence";

type StatusFilter = "ALL" | EvidenceStatus;

interface ActivityGroup {
  activity: EvidenceWithActivity["activity"];
  evidences: EvidenceWithActivity[];
}

/** Agrupa la lista plana del backend por actividad, preservando el orden de
 * aparicion (el backend ya ordena por createdAt desc, asi que la actividad
 * con la evidencia mas reciente queda primero). */
function groupByActivity(evidences: EvidenceWithActivity[]): ActivityGroup[] {
  const groups = new Map<string, ActivityGroup>();
  for (const evidence of evidences) {
    let group = groups.get(evidence.activity.id);
    if (!group) {
      group = { activity: evidence.activity, evidences: [] };
      groups.set(evidence.activity.id, group);
    }
    group.evidences.push(evidence);
  }
  return Array.from(groups.values());
}

export function EvidencesReviewPage() {
  const { t } = useTranslation(["evidences", "common"]);

  const [evidences, setEvidences] = useState<EvidenceWithActivity[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDIENTE");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await apiClient.get<{ evidences: EvidenceWithActivity[] }>("/evidences", {
          params: statusFilter === "ALL" ? undefined : { status: statusFilter },
        });
        if (!cancelled) {
          setEvidences(response.data.evidences);
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
  }, [statusFilter, t]);

  function handleReviewed(updated: EvidenceWithActivity) {
    setEvidences((current) => {
      if (!current) {
        return current;
      }
      // PATCH /evidences/:id/review no devuelve "activity" — se conserva la de
      // la tarjeta actual. Si el filtro activo ya no incluye el estado nuevo
      // (ej. filtrando por PENDIENTE y se acaba de aprobar), sale de la lista.
      if (statusFilter !== "ALL" && updated.status !== statusFilter) {
        return current.filter((evidence) => evidence.id !== updated.id);
      }
      return current.map((evidence) => (evidence.id === updated.id ? { ...evidence, ...updated } : evidence));
    });
  }

  return (
    <div className="evidences-page">
      <div className="page-header">
        <h1>{t("title", { ns: "evidences" })}</h1>
        <label className="status-filter">
          {t("statusFilterLabel", { ns: "evidences" })}
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="ALL">{t("statusFilterAll", { ns: "evidences" })}</option>
            {EVIDENCE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {translateStatus(t, "common", "evidenceStatus", status)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {!isLoading && errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}

      {!isLoading &&
        !errorMessage &&
        evidences &&
        (evidences.length === 0 ? (
          <p>{t("empty", { ns: "evidences" })}</p>
        ) : (
          <ul className="card-list">
            {groupByActivity(evidences).map((group) => (
              <EvidenceReviewGroup
                key={group.activity.id}
                activity={group.activity}
                evidences={group.evidences}
                onReviewed={handleReviewed}
              />
            ))}
          </ul>
        ))}
    </div>
  );
}
