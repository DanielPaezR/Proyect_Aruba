import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { translateStatus } from "../i18n/statusLabel";
import { TOOL_INCIDENT_TYPES } from "../types/inventory";
import type { ToolAssignment, ToolIncidentType } from "../types/inventory";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function MyToolsPage() {
  const { t } = useTranslation(["myTools", "common"]);

  const [assignments, setAssignments] = useState<ToolAssignment[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [reportingId, setReportingId] = useState<string | null>(null);
  const [incidentType, setIncidentType] = useState<ToolIncidentType>("DANIO");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  async function loadAssignments() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiClient.get<{ assignments: ToolAssignment[] }>("/tool-assignments/mine");
      setAssignments(response.data.assignments);
    } catch (error) {
      setLoadError(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openReportForm(assignmentId: string) {
    setReportingId(assignmentId);
    setIncidentType("DANIO");
    setDescription("");
    setSubmitError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reportingId) {
      return;
    }
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post("/tool-incident-reports", {
        toolAssignmentId: reportingId,
        type: incidentType,
        description,
      });
      setReportedIds((current) => new Set(current).add(reportingId));
      setReportingId(null);
    } catch (error) {
      setSubmitError(translateApiError(t, error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="my-tools-page">
      <PageHeader title={t("title", { ns: "myTools" })} />

      {isLoading && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {!isLoading && loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}

      {!isLoading &&
        !loadError &&
        assignments &&
        (assignments.length === 0 ? (
          <p>{t("empty", { ns: "myTools" })}</p>
        ) : (
          <ul className="card-list">
            {assignments.map((assignment) => (
              <li key={assignment.id} className="card">
                <div className="card-header">
                  <span className="card-title">{assignment.item.name}</span>
                </div>
                <span className="card-meta">
                  {t("assignedAtLabel", { ns: "myTools" })}: {formatDate(assignment.assignedAt)}
                </span>
                {assignment.condition && <p className="card-description">{assignment.condition}</p>}

                {reportedIds.has(assignment.id) && (
                  <p className="card-description">{t("reportSent", { ns: "myTools" })}</p>
                )}

                <div className="card-actions">
                  <button type="button" onClick={() => openReportForm(assignment.id)}>
                    {t("reportButton", { ns: "myTools" })}
                  </button>
                </div>

                {reportingId === assignment.id && (
                  <form className="inline-form" onSubmit={(event) => void handleSubmit(event)}>
                    <h2>{t("reportFormTitle", { ns: "myTools" })}</h2>
                    <label>
                      {t("incidentTypeLabel", { ns: "myTools" })}
                      <select value={incidentType} onChange={(event) => setIncidentType(event.target.value as ToolIncidentType)}>
                        {TOOL_INCIDENT_TYPES.map((value) => (
                          <option key={value} value={value}>
                            {translateStatus(t, "toolIncidents", "incidentType", value)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t("descriptionLabel", { ns: "myTools" })}
                      <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        required
                        minLength={1}
                      />
                    </label>
                    {submitError && (
                      <p className="form-error" role="alert">
                        {submitError}
                      </p>
                    )}
                    <div className="form-actions">
                      <button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? t("submitting", { ns: "myTools" }) : t("submit", { ns: "myTools" })}
                      </button>
                      <button type="button" onClick={() => setReportingId(null)}>
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
