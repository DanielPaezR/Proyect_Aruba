import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { translateStatus } from "../i18n/statusLabel";
import { isManagerRole } from "../types/auth";
import type { ProjectDetail } from "../types/project";

export function ProjectDetailPage() {
  const { t } = useTranslation(["projects", "activities", "common"]);
  const { user } = useAuth();
  const { projectId } = useParams<{ projectId: string }>();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
            {canManage && (
              <button type="button" onClick={() => setIsFormOpen((open) => !open)}>
                {t("createButton", { ns: "activities" })}
              </button>
            )}
          </div>

          {project.description && <p className="card-description">{project.description}</p>}

          <section>
            <h2>{t("detail.ownerSection", { ns: "projects" })}</h2>
            <dl className="info-grid">
              <div>
                <dt>{t("create.ownerName", { ns: "projects" })}</dt>
                <dd>{project.ownerName ?? t("detail.notSpecified", { ns: "projects" })}</dd>
              </div>
              <div>
                <dt>{t("create.ownerPhone", { ns: "projects" })}</dt>
                <dd>{project.ownerPhone ?? t("detail.notSpecified", { ns: "projects" })}</dd>
              </div>
              <div>
                <dt>{t("create.ownerEmail", { ns: "projects" })}</dt>
                <dd>{project.ownerEmail ?? t("detail.notSpecified", { ns: "projects" })}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2>{t("detail.locationSection", { ns: "projects" })}</h2>
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
            <h2>{t("detail.workSection", { ns: "projects" })}</h2>
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

          <h2>{t("listTitle", { ns: "activities" })}</h2>

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
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
