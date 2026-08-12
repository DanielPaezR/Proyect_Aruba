import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { isManagerRole } from "../types/auth";
import type { Project } from "../types/project";

export function ProjectsListPage() {
  const { t } = useTranslation(["projects", "common"]);
  const { user } = useAuth();

  const [projects, setProjects] = useState<Project[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadProjects() {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await apiClient.get<{ projects: Project[] }>("/projects");
      setProjects(response.data.projects);
    } catch (error) {
      setErrorMessage(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) {
    return null;
  }

  const canManage = isManagerRole(user.role);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post("/projects", { name, description: description || undefined });
      setName("");
      setDescription("");
      setIsFormOpen(false);
      await loadProjects();
    } catch (error) {
      setFormError(translateApiError(t, error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="projects-page">
      <div className="page-header">
        <h1>{t("title", { ns: "projects" })}</h1>
        {canManage && (
          <button type="button" onClick={() => setIsFormOpen((open) => !open)}>
            {t("create.button", { ns: "projects" })}
          </button>
        )}
      </div>

      {canManage && isFormOpen && (
        <form className="inline-form" onSubmit={(event) => void handleCreate(event)}>
          <h2>{t("create.formTitle", { ns: "projects" })}</h2>
          <label>
            {t("create.name", { ns: "projects" })}
            <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
          </label>
          <label>
            {t("create.description", { ns: "projects" })}
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("create.submitting", { ns: "projects" }) : t("create.submit", { ns: "projects" })}
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

      {!isLoading &&
        !errorMessage &&
        projects &&
        (projects.length === 0 ? (
          <p>{t("empty", { ns: "projects" })}</p>
        ) : (
          <ul className="projects-list">
            {projects.map((project) => (
              <li key={project.id} className="project-card">
                <div className="project-card-main">
                  <span className="project-name">{project.name}</span>
                  <span className="status-badge">{t(`status.${project.status}`, { ns: "projects" })}</span>
                </div>
                {project.description && <p className="project-description">{project.description}</p>}
                <span className="project-meta">
                  {t("activitiesCount", { ns: "projects", count: project._count?.activities ?? 0 })}
                </span>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
