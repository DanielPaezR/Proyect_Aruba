import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { API_BASE_URL, apiClient } from "../api/client";
import { translateStatus } from "../i18n/statusLabel";
import type { Activity, ActivityStatus } from "../types/activity";
import type { Evidence } from "../types/evidence";

interface MyActivityCardProps {
  activity: Activity;
  onActivityUpdated: (activity: Activity) => void;
}

/** Próximo estado al que el trabajador asignado puede pasar, o null si ya está en un estado final para él. */
function nextStatusFor(status: ActivityStatus): ActivityStatus | null {
  if (status === "PENDIENTE") {
    return "EN_PROGRESO";
  }
  if (status === "EN_PROGRESO") {
    return "COMPLETADA";
  }
  return null;
}

export function MyActivityCard({ activity, onActivityUpdated }: MyActivityCardProps) {
  const { t } = useTranslation(["activities", "common"]);

  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [isUploadFormOpen, setIsUploadFormOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isEvidencesOpen, setIsEvidencesOpen] = useState(false);
  const [evidences, setEvidences] = useState<Evidence[] | null>(null);
  const [isLoadingEvidences, setIsLoadingEvidences] = useState(false);
  const [evidencesError, setEvidencesError] = useState<string | null>(null);

  const nextStatus = nextStatusFor(activity.status);

  async function handleStatusChange() {
    if (!nextStatus) {
      return;
    }
    setStatusError(null);
    setIsChangingStatus(true);
    try {
      const response = await apiClient.patch<{ activity: Activity }>(`/activities/${activity.id}/status`, {
        status: nextStatus,
      });
      onActivityUpdated(response.data.activity);
    } catch (error) {
      setStatusError(translateApiError(t, error));
    } finally {
      setIsChangingStatus(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
  }

  async function loadEvidences() {
    setIsLoadingEvidences(true);
    setEvidencesError(null);
    try {
      const response = await apiClient.get<{ evidences: Evidence[] }>(`/activities/${activity.id}/evidences`);
      setEvidences(response.data.evidences);
    } catch (error) {
      setEvidencesError(translateApiError(t, error));
    } finally {
      setIsLoadingEvidences(false);
    }
  }

  async function handleToggleEvidences() {
    const opening = !isEvidencesOpen;
    setIsEvidencesOpen(opening);
    if (opening && evidences === null) {
      await loadEvidences();
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);

    if (!selectedFile) {
      setUploadError(t("errors.api.IMAGE_REQUIRED", { ns: "common" }));
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", selectedFile);
      if (uploadDescription) {
        formData.append("description", uploadDescription);
      }
      await apiClient.post(`/activities/${activity.id}/evidences`, formData);

      setSelectedFile(null);
      setUploadDescription("");
      setIsUploadFormOpen(false);

      if (isEvidencesOpen) {
        await loadEvidences();
      }
    } catch (error) {
      setUploadError(translateApiError(t, error));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <li className="card">
      <div className="card-header">
        <span className="card-title">{activity.title}</span>
        <span className="status-badge">{translateStatus(t, "common", "activityStatus", activity.status)}</span>
      </div>

      {activity.project && (
        <span className="card-meta">
          {t("mine.project", { ns: "activities" })}: {activity.project.name}
        </span>
      )}

      {activity.description && <p className="card-description">{activity.description}</p>}

      <div className="form-actions">
        {nextStatus && (
          <button type="button" onClick={() => void handleStatusChange()} disabled={isChangingStatus}>
            {nextStatus === "EN_PROGRESO"
              ? t("mine.startButton", { ns: "activities" })
              : t("mine.completeButton", { ns: "activities" })}
          </button>
        )}
        <button type="button" onClick={() => setIsUploadFormOpen((open) => !open)}>
          {t("mine.uploadButton", { ns: "activities" })}
        </button>
        <button type="button" onClick={() => void handleToggleEvidences()}>
          {isEvidencesOpen
            ? t("mine.hideEvidencesButton", { ns: "activities" })
            : t("mine.viewEvidencesButton", { ns: "activities", count: activity._count?.evidences ?? 0 })}
        </button>
      </div>

      {statusError && (
        <p className="form-error" role="alert">
          {statusError}
        </p>
      )}

      {isUploadFormOpen && (
        <form className="inline-form" onSubmit={(event) => void handleUpload(event)}>
          <h2>{t("mine.uploadFormTitle", { ns: "activities" })}</h2>
          <label>
            {t("mine.imageLabel", { ns: "activities" })}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} required />
          </label>
          <label>
            {t("mine.descriptionLabel", { ns: "activities" })}
            <textarea
              value={uploadDescription}
              onChange={(event) => setUploadDescription(event.target.value)}
              maxLength={500}
            />
          </label>
          {uploadError && (
            <p className="form-error" role="alert">
              {uploadError}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" disabled={isUploading}>
              {isUploading
                ? t("mine.uploadSubmitting", { ns: "activities" })
                : t("mine.uploadSubmit", { ns: "activities" })}
            </button>
            <button type="button" onClick={() => setIsUploadFormOpen(false)}>
              {t("actions.cancel", { ns: "common" })}
            </button>
          </div>
        </form>
      )}

      {isEvidencesOpen && (
        <div className="evidence-list">
          {isLoadingEvidences && <p className="page-loading">{t("loading", { ns: "common" })}</p>}
          {!isLoadingEvidences && evidencesError && (
            <p className="form-error" role="alert">
              {evidencesError}
            </p>
          )}
          {!isLoadingEvidences &&
            !evidencesError &&
            evidences &&
            (evidences.length === 0 ? (
              <p>{t("mine.noEvidences", { ns: "activities" })}</p>
            ) : (
              evidences.map((evidence) => (
                <div key={evidence.id} className="evidence-row">
                  <a href={`${API_BASE_URL}${evidence.imageUrl}`} target="_blank" rel="noreferrer">
                    <img
                      src={`${API_BASE_URL}${evidence.imageUrl}`}
                      alt={evidence.description ?? ""}
                      className="evidence-thumb"
                    />
                  </a>
                  <span className="status-badge">{translateStatus(t, "common", "evidenceStatus", evidence.status)}</span>
                </div>
              ))
            ))}
        </div>
      )}
    </li>
  );
}
