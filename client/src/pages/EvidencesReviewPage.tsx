import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { ProjectEvidenceGroup } from "../components/ProjectEvidenceGroup";
import type { ActivityGroup } from "../components/ProjectEvidenceGroup";
import { translateStatus } from "../i18n/statusLabel";
import { EVIDENCE_STATUSES } from "../types/evidence";
import type { EvidenceStatus, EvidenceWithActivity } from "../types/evidence";

type StatusFilter = "ALL" | EvidenceStatus;

interface ProjectGroup {
  project: { id: string; name: string };
  activityGroups: ActivityGroup[];
}

/** Agrupa la lista plana del backend primero por proyecto y despues por
 * actividad dentro de cada proyecto, preservando el orden de aparicion (el
 * backend ya ordena por createdAt desc, asi que el proyecto/actividad con la
 * evidencia mas reciente queda primero). */
function groupByProjectThenActivity(evidences: EvidenceWithActivity[]): ProjectGroup[] {
  const projectGroups = new Map<string, ProjectGroup>();

  for (const evidence of evidences) {
    const projectId = evidence.activity.project.id;
    let projectGroup = projectGroups.get(projectId);
    if (!projectGroup) {
      projectGroup = { project: evidence.activity.project, activityGroups: [] };
      projectGroups.set(projectId, projectGroup);
    }

    let activityGroup = projectGroup.activityGroups.find((group) => group.activity.id === evidence.activity.id);
    if (!activityGroup) {
      activityGroup = { activity: evidence.activity, evidences: [] };
      projectGroup.activityGroups.push(activityGroup);
    }
    activityGroup.evidences.push(evidence);
  }

  return Array.from(projectGroups.values());
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
      <PageHeader title={t("title", { ns: "evidences" })}>
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
      </PageHeader>

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
            {groupByProjectThenActivity(evidences).map((group) => (
              <ProjectEvidenceGroup
                key={group.project.id}
                project={group.project}
                activityGroups={group.activityGroups}
                onReviewed={handleReviewed}
              />
            ))}
          </ul>
        ))}
    </div>
  );
}
