import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { translateStatus } from "../i18n/statusLabel";
import { isManagerRole } from "../types/auth";
import type { User } from "../types/auth";
import { EMERGENCY_PRIORITIES, EMERGENCY_STATUSES } from "../types/emergency";
import type { Emergency, EmergencyStatus } from "../types/emergency";
import type { Project } from "../types/project";
import { isValidGoogleMapsUrl } from "../utils/mapsUrl";

function priorityBadgeClassName(priority: string): string {
  return priority === "ALTA" || priority === "URGENTE" ? "status-badge status-badge--priority-high" : "status-badge";
}

export function EmergenciesPage() {
  const { t } = useTranslation(["emergencies", "common"]);
  const { user } = useAuth();

  const [emergencies, setEmergencies] = useState<Emergency[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<EmergencyStatus | "">("");

  const [availableWorkers, setAvailableWorkers] = useState<User[] | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationMapsUrl, setLocationMapsUrl] = useState("");
  const [priority, setPriority] = useState("ALTA");
  const [projectId, setProjectId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [assigningEmergencyId, setAssigningEmergencyId] = useState<string | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [emergencyToResolve, setEmergencyToResolve] = useState<Emergency | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);

  async function loadEmergencies() {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await apiClient.get<{ emergencies: Emergency[] }>("/emergencies", {
        params: statusFilter ? { status: statusFilter } : undefined,
      });
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
  }, [statusFilter]);

  useEffect(() => {
    async function loadPickerData() {
      try {
        const [usersResponse, projectsResponse] = await Promise.all([
          apiClient.get<{ users: User[] }>("/auth/users"),
          apiClient.get<{ projects: Project[] }>("/projects"),
        ]);
        setAvailableWorkers(usersResponse.data.users.filter((u) => u.role === "TRABAJADOR_CAMPO" && u.isActive));
        setProjects(projectsResponse.data.projects);
      } catch {
        // Secundario: si falla, el selector de proyecto/trabajador queda
        // vacio pero el resto de la pagina (listar, resolver) sigue funcionando.
      }
    }
    void loadPickerData();
  }, []);

  if (!user) {
    return null;
  }

  // El backend solo permite Administrador/Gerente/Supervisor (ver
  // emergencies.routes.ts); si un Trabajador de Campo o Mercaderista llega
  // aca por URL directa, lo mandamos de vuelta.
  if (!isManagerRole(user.role)) {
    return <Navigate to="/" replace />;
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setLocationMapsUrl("");
    setPriority("ALTA");
    setProjectId("");
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locationMapsUrl && !isValidGoogleMapsUrl(locationMapsUrl)) {
      setFormError(t("create.mapsUrlInvalid", { ns: "emergencies" }));
      return;
    }
    setFormError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post("/emergencies", {
        title,
        description,
        locationMapsUrl: locationMapsUrl || undefined,
        priority,
        projectId: projectId || undefined,
      });
      resetForm();
      setIsFormOpen(false);
      await loadEmergencies();
    } catch (error) {
      setFormError(translateApiError(t, error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assigningEmergencyId || !selectedWorkerId) {
      return;
    }
    setAssignError(null);
    setIsAssigning(true);
    try {
      await apiClient.post(`/emergencies/${assigningEmergencyId}/assignments`, { userId: selectedWorkerId });
      setAssigningEmergencyId(null);
      setSelectedWorkerId("");
      await loadEmergencies();
    } catch (error) {
      setAssignError(translateApiError(t, error));
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleMarkInProgress(emergencyId: string) {
    setStatusUpdateError(null);
    setUpdatingStatusId(emergencyId);
    try {
      await apiClient.patch(`/emergencies/${emergencyId}`, { status: "EN_PROGRESO" });
      await loadEmergencies();
    } catch (error) {
      setStatusUpdateError(translateApiError(t, error));
    } finally {
      setUpdatingStatusId(null);
    }
  }

  async function handleResolve() {
    if (!emergencyToResolve) {
      return;
    }
    setResolveError(null);
    setIsResolving(true);
    try {
      await apiClient.patch(`/emergencies/${emergencyToResolve.id}/resolve`, {
        resolutionNote: resolutionNote || undefined,
      });
      setEmergencyToResolve(null);
      setResolutionNote("");
      await loadEmergencies();
    } catch (error) {
      setResolveError(translateApiError(t, error));
    } finally {
      setIsResolving(false);
    }
  }

  return (
    <div className="emergencies-page">
      <PageHeader title={t("title", { ns: "emergencies" })}>
        <button type="button" onClick={() => setIsFormOpen((open) => !open)}>
          {t("create.button", { ns: "emergencies" })}
        </button>
      </PageHeader>

      <div className="list-filters">
        <label className="status-filter">
          {t("statusFilterLabel", { ns: "emergencies" })}
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as EmergencyStatus | "")}
          >
            <option value="">{t("statusFilterAll", { ns: "emergencies" })}</option>
            {EMERGENCY_STATUSES.map((value) => (
              <option key={value} value={value}>
                {translateStatus(t, "emergencies", "status", value)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isFormOpen && (
        <form className="inline-form" onSubmit={(event) => void handleCreate(event)}>
          <h2>{t("create.formTitle", { ns: "emergencies" })}</h2>
          <label>
            {t("create.titleLabel", { ns: "emergencies" })}
            <input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} />
          </label>
          <label>
            {t("create.descriptionLabel", { ns: "emergencies" })}
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
              minLength={1}
            />
          </label>
          <label>
            {t("create.locationMapsUrlLabel", { ns: "emergencies" })}
            <input
              type="url"
              value={locationMapsUrl}
              onChange={(event) => setLocationMapsUrl(event.target.value)}
              placeholder={t("create.locationMapsUrlPlaceholder", { ns: "emergencies" })}
            />
          </label>
          <label>
            {t("create.priorityLabel", { ns: "emergencies" })}
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
              {EMERGENCY_PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {translateStatus(t, "emergencies", "priority", value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("create.projectLabel", { ns: "emergencies" })}
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">{t("create.projectPlaceholder", { ns: "emergencies" })}</option>
              {(projects ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>

          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("create.submitting", { ns: "emergencies" }) : t("create.submit", { ns: "emergencies" })}
            </button>
            <button type="button" onClick={() => setIsFormOpen(false)}>
              {t("actions.cancel", { ns: "common" })}
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {!isLoading && errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}

      {statusUpdateError && (
        <p className="form-error" role="alert">
          {statusUpdateError}
        </p>
      )}

      {!isLoading &&
        !errorMessage &&
        emergencies &&
        (emergencies.length === 0 ? (
          <p>{t("empty", { ns: "emergencies" })}</p>
        ) : (
          <ul className="card-list">
            {emergencies.map((emergency) => (
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

                {emergency.assignments.length > 0 && (
                  <span className="card-meta">
                    {t("assignedTo", {
                      ns: "emergencies",
                      names: emergency.assignments.map((assignment) => assignment.user.name).join(", "),
                    })}
                  </span>
                )}

                {emergency.status === "RESUELTA" && (
                  <p className="card-description">
                    {t("resolvedLabel", { ns: "emergencies" })}
                    {emergency.resolutionNote ? `: ${emergency.resolutionNote}` : ""}
                  </p>
                )}

                {emergency.status !== "RESUELTA" && (
                  <div className="card-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setAssigningEmergencyId(emergency.id);
                        setSelectedWorkerId("");
                        setAssignError(null);
                      }}
                    >
                      {t("assign.button", { ns: "emergencies" })}
                    </button>
                    {emergency.status === "ASIGNADA" && (
                      <button
                        type="button"
                        onClick={() => void handleMarkInProgress(emergency.id)}
                        disabled={updatingStatusId === emergency.id}
                      >
                        {t("markInProgressButton", { ns: "emergencies" })}
                      </button>
                    )}
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => {
                        setEmergencyToResolve(emergency);
                        setResolutionNote("");
                        setResolveError(null);
                      }}
                    >
                      {t("resolveButton", { ns: "emergencies" })}
                    </button>
                  </div>
                )}

                {assigningEmergencyId === emergency.id && (
                  <form className="inline-form" onSubmit={(event) => void handleAssign(event)}>
                    <label>
                      {t("assign.workerLabel", { ns: "emergencies" })}
                      <select
                        value={selectedWorkerId}
                        onChange={(event) => setSelectedWorkerId(event.target.value)}
                        required
                      >
                        <option value="">{t("assign.workerPlaceholder", { ns: "emergencies" })}</option>
                        {(availableWorkers ?? [])
                          .filter((worker) => !emergency.assignments.some((a) => a.userId === worker.id))
                          .map((worker) => (
                            <option key={worker.id} value={worker.id}>
                              {worker.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    {assignError && (
                      <p className="form-error" role="alert">
                        {assignError}
                      </p>
                    )}
                    <div className="form-actions">
                      <button type="submit" disabled={isAssigning}>
                        {isAssigning ? t("assign.saving", { ns: "emergencies" }) : t("assign.save", { ns: "emergencies" })}
                      </button>
                      <button type="button" onClick={() => setAssigningEmergencyId(null)}>
                        {t("actions.cancel", { ns: "common" })}
                      </button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ))}

      {emergencyToResolve && (
        <ConfirmDialog
          title={t("resolveDialog.title", { ns: "emergencies" })}
          message={t("resolveDialog.message", { ns: "emergencies", title: emergencyToResolve.title })}
          confirmLabel={t("resolveDialog.submit", { ns: "emergencies" })}
          isConfirming={isResolving}
          error={resolveError}
          onConfirm={() => void handleResolve()}
          onCancel={() => {
            setEmergencyToResolve(null);
            setResolveError(null);
          }}
        >
          <label>
            {t("resolveDialog.noteLabel", { ns: "emergencies" })}
            <textarea value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} />
          </label>
        </ConfirmDialog>
      )}
    </div>
  );
}
