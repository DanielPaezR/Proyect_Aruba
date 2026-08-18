import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { AssignWorkersPanel } from "../components/AssignWorkersPanel";
import { ClientPicker } from "../components/ClientPicker";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ProjectInvoicesSection } from "../components/ProjectInvoicesSection";
import { ProjectPaymentsSection } from "../components/ProjectPaymentsSection";
import { useAuth } from "../context/AuthContext";
import { translateStatus } from "../i18n/statusLabel";
import { isManagerRole } from "../types/auth";
import { PROJECT_PRIORITIES, PROJECT_PROPERTY_TYPES, PROJECT_SECTORS, PROJECT_WORK_TYPES } from "../types/project";
import type { ProjectDetail } from "../types/project";
import type { Activity } from "../types/activity";

interface ProjectEditFormState {
  name: string;
  description: string;
  clientId: string | null;
  address: string;
  sector: string;
  accessNotes: string;
  propertyType: string;
  workType: string;
  priority: string;
  electricalPlansUrl: string;
}

function projectToFormState(project: ProjectDetail): ProjectEditFormState {
  return {
    name: project.name,
    description: project.description ?? "",
    clientId: project.clientId,
    address: project.address ?? "",
    sector: project.sector ?? "",
    accessNotes: project.accessNotes ?? "",
    propertyType: project.propertyType ?? "",
    workType: project.workType ?? "",
    priority: project.priority ?? "MEDIA",
    electricalPlansUrl: project.electricalPlansUrl ?? "",
  };
}

interface ActivityEditFormState {
  title: string;
  description: string;
  referenceImage: File | null;
}

export function ProjectDetailPage() {
  const { t } = useTranslation(["projects", "activities", "clients", "common"]);
  const { user } = useAuth();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [isProjectEditOpen, setIsProjectEditOpen] = useState(false);
  const [projectEditForm, setProjectEditForm] = useState<ProjectEditFormState | null>(null);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [projectEditError, setProjectEditError] = useState<string | null>(null);

  const [isProjectDeleteOpen, setIsProjectDeleteOpen] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [projectDeleteError, setProjectDeleteError] = useState<string | null>(null);

  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [activityEditForm, setActivityEditForm] = useState<ActivityEditFormState | null>(null);
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [activityEditError, setActivityEditError] = useState<string | null>(null);

  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [isDeletingActivity, setIsDeletingActivity] = useState(false);
  const [activityDeleteError, setActivityDeleteError] = useState<string | null>(null);

  const [assigningActivityId, setAssigningActivityId] = useState<string | null>(null);

  async function loadProject(id: string) {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await apiClient.get<{ project: ProjectDetail }>(`/projects/${id}`);
      setProject(response.data.project);
    } catch (error) {
      setErrorMessage(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (projectId) {
      void loadProject(projectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (!user || !projectId) {
    return null;
  }

  const canManage = isManagerRole(user.role);
  const canDeleteProject = user.role === "JEFE";

  function handleReferenceImageChange(event: ChangeEvent<HTMLInputElement>) {
    setReferenceImage(event.target.files?.[0] ?? null);
  }

  async function handleCreateActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId) {
      return;
    }
    setFormError(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      if (description) {
        formData.append("description", description);
      }
      if (referenceImage) {
        formData.append("referenceImage", referenceImage);
      }
      await apiClient.post(`/projects/${projectId}/activities`, formData);
      setTitle("");
      setDescription("");
      setReferenceImage(null);
      setIsFormOpen(false);
      await loadProject(projectId);
    } catch (error) {
      setFormError(translateApiError(t, error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function openProjectEdit() {
    if (!project) {
      return;
    }
    setProjectEditError(null);
    setProjectEditForm(projectToFormState(project));
    setIsProjectEditOpen(true);
  }

  async function handleUpdateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectEditForm || !projectId) {
      return;
    }
    setProjectEditError(null);
    setIsSavingProject(true);
    try {
      await apiClient.patch(`/projects/${projectId}`, {
        name: projectEditForm.name,
        description: projectEditForm.description || undefined,
        clientId: projectEditForm.clientId,
        address: projectEditForm.address,
        sector: projectEditForm.sector || undefined,
        accessNotes: projectEditForm.accessNotes || undefined,
        propertyType: projectEditForm.propertyType,
        workType: projectEditForm.workType,
        priority: projectEditForm.priority,
        electricalPlansUrl: projectEditForm.electricalPlansUrl || undefined,
      });
      setIsProjectEditOpen(false);
      await loadProject(projectId);
    } catch (error) {
      setProjectEditError(translateApiError(t, error));
    } finally {
      setIsSavingProject(false);
    }
  }

  async function handleDeleteProject() {
    if (!projectId) {
      return;
    }
    setProjectDeleteError(null);
    setIsDeletingProject(true);
    try {
      await apiClient.delete(`/projects/${projectId}`);
      navigate("/projects");
    } catch (error) {
      setProjectDeleteError(translateApiError(t, error));
    } finally {
      setIsDeletingProject(false);
    }
  }

  function openActivityEdit(activity: Activity) {
    setActivityEditError(null);
    setActivityEditForm({
      title: activity.title,
      description: activity.description ?? "",
      referenceImage: null,
    });
    setEditingActivityId(activity.id);
  }

  function handleActivityEditImageChange(event: ChangeEvent<HTMLInputElement>) {
    setActivityEditForm((current) =>
      current ? { ...current, referenceImage: event.target.files?.[0] ?? null } : current,
    );
  }

  async function handleUpdateActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activityEditForm || !editingActivityId || !projectId) {
      return;
    }
    setActivityEditError(null);
    setIsSavingActivity(true);
    try {
      const formData = new FormData();
      formData.append("title", activityEditForm.title);
      if (activityEditForm.description) {
        formData.append("description", activityEditForm.description);
      }
      if (activityEditForm.referenceImage) {
        formData.append("referenceImage", activityEditForm.referenceImage);
      }
      await apiClient.patch(`/activities/${editingActivityId}`, formData);
      setEditingActivityId(null);
      setActivityEditForm(null);
      await loadProject(projectId);
    } catch (error) {
      setActivityEditError(translateApiError(t, error));
    } finally {
      setIsSavingActivity(false);
    }
  }

  async function handleDeleteActivity() {
    if (!activityToDelete || !projectId) {
      return;
    }
    setActivityDeleteError(null);
    setIsDeletingActivity(true);
    try {
      await apiClient.delete(`/activities/${activityToDelete.id}`);
      setActivityToDelete(null);
      await loadProject(projectId);
    } catch (error) {
      setActivityDeleteError(translateApiError(t, error));
    } finally {
      setIsDeletingActivity(false);
    }
  }

  return (
    <div className="project-detail-page">
      <p className="breadcrumb">
        <Link to="/projects">{t("title", { ns: "projects" })}</Link>
      </p>

      {isLoading && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {!isLoading && errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}

      {!isLoading && !errorMessage && project && (
        <>
          <div className="page-header">
            <div>
              <h1>{project.name}</h1>
              <span className="status-badge">{translateStatus(t, "projects", "status", project.status)}</span>
            </div>
            <div className="card-actions">
              {canManage && (
                <button type="button" onClick={openProjectEdit}>
                  {t("actions.edit", { ns: "common" })}
                </button>
              )}
              {canDeleteProject && (
                <button type="button" className="danger-button" onClick={() => setIsProjectDeleteOpen(true)}>
                  {t("actions.delete", { ns: "common" })}
                </button>
              )}
            </div>
          </div>

          {project.description && <p className="card-description">{project.description}</p>}

          {isProjectEditOpen && projectEditForm && (
            <form className="inline-form" onSubmit={(event) => void handleUpdateProject(event)}>
              <h2>{t("edit.formTitle", { ns: "projects" })}</h2>

              <label>
                {t("create.name", { ns: "projects" })}
                <input
                  value={projectEditForm.name}
                  onChange={(event) => setProjectEditForm({ ...projectEditForm, name: event.target.value })}
                  required
                  minLength={2}
                />
              </label>
              <label>
                {t("create.description", { ns: "projects" })}
                <textarea
                  value={projectEditForm.description}
                  onChange={(event) => setProjectEditForm({ ...projectEditForm, description: event.target.value })}
                />
              </label>

              <fieldset>
                <legend>{t("create.sections.client", { ns: "projects" })}</legend>
                <label>
                  {t("create.client", { ns: "projects" })}
                  <ClientPicker
                    value={projectEditForm.clientId}
                    onChange={(id) => setProjectEditForm({ ...projectEditForm, clientId: id })}
                  />
                </label>
              </fieldset>

              <fieldset>
                <legend>{t("create.sections.location", { ns: "projects" })}</legend>
                <label>
                  {t("create.address", { ns: "projects" })}
                  <input
                    value={projectEditForm.address}
                    onChange={(event) => setProjectEditForm({ ...projectEditForm, address: event.target.value })}
                    required
                  />
                </label>
                <label>
                  {t("create.sector", { ns: "projects" })}
                  <select
                    value={projectEditForm.sector}
                    onChange={(event) => setProjectEditForm({ ...projectEditForm, sector: event.target.value })}
                  >
                    <option value="">{t("create.sectorPlaceholder", { ns: "projects" })}</option>
                    {PROJECT_SECTORS.map((value) => (
                      <option key={value} value={value}>
                        {translateStatus(t, "projects", "sector", value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("create.accessNotes", { ns: "projects" })}
                  <textarea
                    value={projectEditForm.accessNotes}
                    onChange={(event) => setProjectEditForm({ ...projectEditForm, accessNotes: event.target.value })}
                  />
                </label>
              </fieldset>

              <fieldset>
                <legend>{t("create.sections.work", { ns: "projects" })}</legend>
                <label>
                  {t("create.propertyType", { ns: "projects" })}
                  <select
                    value={projectEditForm.propertyType}
                    onChange={(event) =>
                      setProjectEditForm({ ...projectEditForm, propertyType: event.target.value })
                    }
                    required
                  >
                    <option value="">{t("create.propertyTypePlaceholder", { ns: "projects" })}</option>
                    {PROJECT_PROPERTY_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {translateStatus(t, "projects", "propertyType", value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("create.workType", { ns: "projects" })}
                  <select
                    value={projectEditForm.workType}
                    onChange={(event) => setProjectEditForm({ ...projectEditForm, workType: event.target.value })}
                    required
                  >
                    <option value="">{t("create.workTypePlaceholder", { ns: "projects" })}</option>
                    {PROJECT_WORK_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {translateStatus(t, "projects", "workType", value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("create.priority", { ns: "projects" })}
                  <select
                    value={projectEditForm.priority}
                    onChange={(event) => setProjectEditForm({ ...projectEditForm, priority: event.target.value })}
                  >
                    {PROJECT_PRIORITIES.map((value) => (
                      <option key={value} value={value}>
                        {translateStatus(t, "projects", "priority", value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("create.electricalPlansUrl", { ns: "projects" })}
                  <input
                    type="url"
                    value={projectEditForm.electricalPlansUrl}
                    onChange={(event) =>
                      setProjectEditForm({ ...projectEditForm, electricalPlansUrl: event.target.value })
                    }
                    placeholder="https://..."
                  />
                </label>
              </fieldset>

              {projectEditError && (
                <p className="form-error" role="alert">
                  {projectEditError}
                </p>
              )}
              <div className="form-actions">
                <button type="submit" disabled={isSavingProject}>
                  {isSavingProject ? t("edit.saving", { ns: "projects" }) : t("edit.submit", { ns: "projects" })}
                </button>
                <button type="button" onClick={() => setIsProjectEditOpen(false)}>
                  {t("actions.cancel", { ns: "common" })}
                </button>
              </div>
            </form>
          )}

          <section>
            <h2 className="section-label">{t("detail.clientSection", { ns: "projects" })}</h2>
            {project.client ? (
              <>
                <dl className="info-grid">
                  <div>
                    <dt>{t("create.client", { ns: "projects" })}</dt>
                    <dd>{project.client.name}</dd>
                  </div>
                  <div>
                    <dt>{t("phoneLabel", { ns: "clients" })}</dt>
                    <dd>{project.client.phone}</dd>
                  </div>
                  <div>
                    <dt>{t("emailLabel", { ns: "clients" })}</dt>
                    <dd>{project.client.email ?? t("notSpecified", { ns: "clients" })}</dd>
                  </div>
                </dl>
                <Link to={`/clients/${project.client.id}`} className="button-link">
                  {t("detail.viewClientButton", { ns: "projects" })}
                </Link>
              </>
            ) : (
              <p>{t("detail.notSpecified", { ns: "projects" })}</p>
            )}
          </section>

          <section>
            <h2 className="section-label">{t("detail.locationSection", { ns: "projects" })}</h2>
            <dl className="info-grid">
              <div>
                <dt>{t("create.address", { ns: "projects" })}</dt>
                <dd>{project.address ?? t("detail.notSpecified", { ns: "projects" })}</dd>
              </div>
              <div>
                <dt>{t("create.sector", { ns: "projects" })}</dt>
                <dd>
                  {project.sector
                    ? translateStatus(t, "projects", "sector", project.sector)
                    : t("detail.notSpecified", { ns: "projects" })}
                </dd>
              </div>
              <div>
                <dt>{t("create.accessNotes", { ns: "projects" })}</dt>
                <dd>{project.accessNotes ?? t("detail.notSpecified", { ns: "projects" })}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="section-label">{t("detail.workSection", { ns: "projects" })}</h2>
            <dl className="info-grid">
              <div>
                <dt>{t("create.propertyType", { ns: "projects" })}</dt>
                <dd>
                  {project.propertyType
                    ? translateStatus(t, "projects", "propertyType", project.propertyType)
                    : t("detail.notSpecified", { ns: "projects" })}
                </dd>
              </div>
              <div>
                <dt>{t("create.workType", { ns: "projects" })}</dt>
                <dd>
                  {project.workType
                    ? translateStatus(t, "projects", "workType", project.workType)
                    : t("detail.notSpecified", { ns: "projects" })}
                </dd>
              </div>
              <div>
                <dt>{t("create.priority", { ns: "projects" })}</dt>
                <dd>
                  {project.priority ? (
                    <span
                      className={
                        project.priority === "ALTA" || project.priority === "URGENTE"
                          ? "status-badge status-badge--priority-high"
                          : "status-badge"
                      }
                    >
                      {translateStatus(t, "projects", "priority", project.priority)}
                    </span>
                  ) : (
                    t("detail.notSpecified", { ns: "projects" })
                  )}
                </dd>
              </div>
            </dl>
            {project.electricalPlansUrl && (
              <a href={project.electricalPlansUrl} target="_blank" rel="noreferrer" className="button-link">
                {t("detail.viewPlansButton", { ns: "projects" })}
              </a>
            )}
          </section>

          <div className="page-header">
            <h2>{t("listTitle", { ns: "activities" })}</h2>
            {canManage && (
              <button type="button" onClick={() => setIsFormOpen((open) => !open)}>
                {t("createButton", { ns: "activities" })}
              </button>
            )}
          </div>

          {canManage && isFormOpen && (
            <form className="inline-form" onSubmit={(event) => void handleCreateActivity(event)}>
              <h2>{t("createFormTitle", { ns: "activities" })}</h2>
              <label>
                {t("titleLabel", { ns: "activities" })}
                <input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} />
              </label>
              <label>
                {t("descriptionLabel", { ns: "activities" })}
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
              </label>
              <label>
                {t("referenceImageLabel", { ns: "activities" })}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleReferenceImageChange} />
              </label>
              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}
              <div className="form-actions">
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t("submitting", { ns: "activities" }) : t("submit", { ns: "activities" })}
                </button>
                <button type="button" onClick={() => setIsFormOpen(false)}>
                  {t("actions.cancel", { ns: "common" })}
                </button>
              </div>
            </form>
          )}

          {project.activities.length === 0 ? (
            <p>{t("empty", { ns: "activities" })}</p>
          ) : (
            <ul className="card-list">
              {project.activities.map((activity) => (
                <li key={activity.id} className="card">
                  <div className="card-header">
                    <span className="card-title">{activity.title}</span>
                    <span className="status-badge">
                      {translateStatus(t, "common", "activityStatus", activity.status)}
                    </span>
                  </div>
                  {activity.description && <p className="card-description">{activity.description}</p>}
                  {activity.referenceImageUrl && (
                    <a href={activity.referenceImageUrl} target="_blank" rel="noreferrer">
                      <img
                        src={activity.referenceImageUrl}
                        alt={t("referenceImageAlt", { ns: "activities" })}
                        className="evidence-thumb"
                      />
                    </a>
                  )}
                  <span className="card-meta">
                    {activity.assignments.length === 0
                      ? t("unassigned", { ns: "activities" })
                      : `${t("assignedTo", { ns: "activities" })}: ${activity.assignments
                          .map((assignment) => assignment.user.name)
                          .join(", ")}`}
                  </span>
                  <span className="card-meta">
                    {t("evidencesCount", { ns: "activities", count: activity._count?.evidences ?? 0 })}
                  </span>

                  {canManage && (
                    <div className="card-actions">
                      <button type="button" onClick={() => openActivityEdit(activity)}>
                        {t("actions.edit", { ns: "common" })}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssigningActivityId((current) => (current === activity.id ? null : activity.id))}
                      >
                        {t("assign.button", { ns: "activities" })}
                      </button>
                      <button type="button" className="danger-button" onClick={() => setActivityToDelete(activity)}>
                        {t("actions.delete", { ns: "common" })}
                      </button>
                    </div>
                  )}

                  {assigningActivityId === activity.id && (
                    <AssignWorkersPanel
                      activityId={activity.id}
                      currentAssignments={activity.assignments}
                      onSaved={async () => {
                        if (projectId) {
                          await loadProject(projectId);
                        }
                      }}
                      onClose={() => setAssigningActivityId(null)}
                    />
                  )}

                  {editingActivityId === activity.id && activityEditForm && (
                    <form className="inline-form" onSubmit={(event) => void handleUpdateActivity(event)}>
                      <h2>{t("edit.formTitle", { ns: "activities" })}</h2>
                      <label>
                        {t("titleLabel", { ns: "activities" })}
                        <input
                          value={activityEditForm.title}
                          onChange={(event) =>
                            setActivityEditForm({ ...activityEditForm, title: event.target.value })
                          }
                          required
                          minLength={2}
                        />
                      </label>
                      <label>
                        {t("descriptionLabel", { ns: "activities" })}
                        <textarea
                          value={activityEditForm.description}
                          onChange={(event) =>
                            setActivityEditForm({ ...activityEditForm, description: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        {t("referenceImageLabel", { ns: "activities" })}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleActivityEditImageChange}
                        />
                      </label>
                      {activityEditError && (
                        <p className="form-error" role="alert">
                          {activityEditError}
                        </p>
                      )}
                      <div className="form-actions">
                        <button type="submit" disabled={isSavingActivity}>
                          {isSavingActivity
                            ? t("edit.saving", { ns: "activities" })
                            : t("edit.submit", { ns: "activities" })}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingActivityId(null);
                            setActivityEditForm(null);
                          }}
                        >
                          {t("actions.cancel", { ns: "common" })}
                        </button>
                      </div>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canManage && <ProjectInvoicesSection projectId={projectId} />}

          {canManage && (
            <ProjectPaymentsSection
              projectId={projectId}
              hasClient={Boolean(project.clientId)}
              onClientLinked={async () => {
                await loadProject(projectId);
              }}
            />
          )}
        </>
      )}

      {isProjectDeleteOpen && project && (
        <ConfirmDialog
          title={t("delete.title", { ns: "projects" })}
          message={t("delete.message", { ns: "projects", name: project.name })}
          confirmLabel={t("actions.delete", { ns: "common" })}
          isConfirming={isDeletingProject}
          error={projectDeleteError}
          onConfirm={() => void handleDeleteProject()}
          onCancel={() => {
            setIsProjectDeleteOpen(false);
            setProjectDeleteError(null);
          }}
        />
      )}

      {activityToDelete && (
        <ConfirmDialog
          title={t("deleteTitle", { ns: "activities" })}
          message={t("deleteMessage", { ns: "activities", title: activityToDelete.title })}
          confirmLabel={t("actions.delete", { ns: "common" })}
          isConfirming={isDeletingActivity}
          error={activityDeleteError}
          onConfirm={() => void handleDeleteActivity()}
          onCancel={() => {
            setActivityToDelete(null);
            setActivityDeleteError(null);
          }}
        />
      )}
    </div>
  );
}
