import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { translateStatus } from "../i18n/statusLabel";
import { isManagerRole } from "../types/auth";
import { PROJECT_PRIORITIES, PROJECT_PROPERTY_TYPES, PROJECT_SECTORS, PROJECT_WORK_TYPES } from "../types/project";
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
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [address, setAddress] = useState("");
  const [sector, setSector] = useState("");
  const [accessNotes, setAccessNotes] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [workType, setWorkType] = useState("");
  const [priority, setPriority] = useState("MEDIA");
  const [electricalPlansUrl, setElectricalPlansUrl] = useState("");
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

  function resetForm() {
    setName("");
    setDescription("");
    setOwnerName("");
    setOwnerPhone("");
    setOwnerEmail("");
    setAddress("");
    setSector("");
    setAccessNotes("");
    setPropertyType("");
    setWorkType("");
    setPriority("MEDIA");
    setElectricalPlansUrl("");
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post("/projects", {
        name,
        description: description || undefined,
        ownerName,
        ownerPhone,
        ownerEmail: ownerEmail || undefined,
        address,
        sector: sector || undefined,
        accessNotes: accessNotes || undefined,
        propertyType,
        workType,
        priority,
        electricalPlansUrl: electricalPlansUrl || undefined,
      });
      resetForm();
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

          <fieldset>
            <legend>{t("create.sections.owner", { ns: "projects" })}</legend>
            <label>
              {t("create.ownerName", { ns: "projects" })}
              <input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} required minLength={2} />
            </label>
            <label>
              {t("create.ownerPhone", { ns: "projects" })}
              <input value={ownerPhone} onChange={(event) => setOwnerPhone(event.target.value)} required />
            </label>
            <label>
              {t("create.ownerEmail", { ns: "projects" })}
              <input type="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} />
            </label>
          </fieldset>

          <fieldset>
            <legend>{t("create.sections.location", { ns: "projects" })}</legend>
            <label>
              {t("create.address", { ns: "projects" })}
              <input value={address} onChange={(event) => setAddress(event.target.value)} required />
            </label>
            <label>
              {t("create.sector", { ns: "projects" })}
              <select value={sector} onChange={(event) => setSector(event.target.value)}>
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
                value={accessNotes}
                onChange={(event) => setAccessNotes(event.target.value)}
                placeholder={t("create.accessNotesPlaceholder", { ns: "projects" })}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>{t("create.sections.work", { ns: "projects" })}</legend>
            <label>
              {t("create.propertyType", { ns: "projects" })}
              <select value={propertyType} onChange={(event) => setPropertyType(event.target.value)} required>
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
              <select value={workType} onChange={(event) => setWorkType(event.target.value)} required>
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
              <select value={priority} onChange={(event) => setPriority(event.target.value)}>
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
                value={electricalPlansUrl}
                onChange={(event) => setElectricalPlansUrl(event.target.value)}
                placeholder="https://..."
              />
            </label>
          </fieldset>

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
          <ul className="card-list">
            {projects.map((project) => (
              <li key={project.id} className="card">
                <Link to={`/projects/${project.id}`} className="card-link">
                  <div className="card-header">
                    <span className="card-title">{project.name}</span>
                    <span className="status-badge">{translateStatus(t, "projects", "status", project.status)}</span>
                  </div>
                  {project.description && <p className="card-description">{project.description}</p>}
                  <span className="card-meta">
                    {t("activitiesCount", { ns: "projects", count: project._count?.activities ?? 0 })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
