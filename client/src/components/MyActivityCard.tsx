import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Hammer,
  Images,
  ImageIcon,
  MapPin,
  MessageCircle,
  Play,
  SkipForward,
  Wrench,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { translateStatus } from "../i18n/statusLabel";
import type { Activity, ActivityStatus } from "../types/activity";
import type { Evidence } from "../types/evidence";
import type { ProjectWorkType } from "../types/project";
import { resolveMapsUrl } from "../utils/mapsUrl";
import { ConfirmDialog } from "./ConfirmDialog";
import { MediaFilePreview } from "./MediaFilePreview";
import { MediaLightbox } from "./MediaLightbox";
import type { LightboxMedia } from "./MediaLightbox";
import { MediaThumb } from "./MediaThumb";

function formatScheduledDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Sin imagen de referencia: icono segun el tipo de trabajo del proyecto, para
// que la tarjeta siga teniendo algo "protagonista" arriba en vez de quedar vacia.
const WORK_TYPE_ICONS: Record<ProjectWorkType, LucideIcon> = {
  INSTALACION_NUEVA: Zap,
  REMODELACION: Hammer,
  MANTENIMIENTO: Wrench,
  REPARACION_EMERGENCIA: AlertTriangle,
  INSPECCION: ClipboardCheck,
};

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

// Solo se puede omitir una actividad todavia activa (mismo criterio que el backend).
const SKIPPABLE_STATUSES: ActivityStatus[] = ["PENDIENTE", "EN_PROGRESO"];

function activityStatusBadgeClassName(status: ActivityStatus): string {
  // OMITIDA reusa el mismo tono de "atencion" que otros estados que
  // requieren accion (pago devuelto, factura devuelta) — para no confundirla
  // con CANCELADA, que es neutra.
  return status === "OMITIDA" ? "status-badge status-badge--warning" : "status-badge";
}

export function MyActivityCard({ activity, onActivityUpdated }: MyActivityCardProps) {
  const { t } = useTranslation(["activities", "common"]);
  const { user } = useAuth();

  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [isSkipFormOpen, setIsSkipFormOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [isSkipping, setIsSkipping] = useState(false);
  const [skipError, setSkipError] = useState<string | null>(null);

  const [evidenceToRemove, setEvidenceToRemove] = useState<Evidence | null>(null);
  const [isRemovingEvidence, setIsRemovingEvidence] = useState(false);
  const [removeEvidenceError, setRemoveEvidenceError] = useState<string | null>(null);

  const [isUploadFormOpen, setIsUploadFormOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isEvidencesOpen, setIsEvidencesOpen] = useState(false);
  const [evidences, setEvidences] = useState<Evidence[] | null>(null);
  const [isLoadingEvidences, setIsLoadingEvidences] = useState(false);
  const [evidencesError, setEvidencesError] = useState<string | null>(null);

  const [lightboxMedia, setLightboxMedia] = useState<LightboxMedia | null>(null);

  const nextStatus = nextStatusFor(activity.status);
  const isSkippable = SKIPPABLE_STATUSES.includes(activity.status);
  const ReferencePlaceholderIcon = activity.project?.workType ? WORK_TYPE_ICONS[activity.project.workType] : ImageIcon;
  const directionsUrl = resolveMapsUrl(activity.project?.mapsUrl, activity.project?.address);

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

  async function handleSkip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSkipError(null);
    setIsSkipping(true);
    try {
      const response = await apiClient.patch<{ activity: Activity }>(`/activities/${activity.id}/skip`, {
        reason: skipReason,
      });
      setSkipReason("");
      setIsSkipFormOpen(false);
      onActivityUpdated(response.data.activity);
    } catch (error) {
      setSkipError(translateApiError(t, error));
    } finally {
      setIsSkipping(false);
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

      // El padre (MyActivitiesPage) solo carga activity._count una vez —
      // sin esto, el contador de "Ver evidencias" quedaba desactualizado
      // hasta recargar la pagina, lo que podia llevar a subidas dobles por
      // falta de confirmacion visual. No hace falta un roundtrip extra: es
      // un conteo simple, se suma 1 en el propio cliente.
      onActivityUpdated({
        ...activity,
        _count: { evidences: (activity._count?.evidences ?? 0) + 1 },
      });
    } catch (error) {
      setUploadError(translateApiError(t, error));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleRemoveEvidence() {
    if (!evidenceToRemove) {
      return;
    }
    setRemoveEvidenceError(null);
    setIsRemovingEvidence(true);
    try {
      await apiClient.delete(`/evidences/${evidenceToRemove.id}`);
      setEvidences((current) => current?.filter((evidence) => evidence.id !== evidenceToRemove.id) ?? null);
      // Mismo ajuste que handleUpload, restando en vez de sumar.
      onActivityUpdated({
        ...activity,
        _count: { evidences: Math.max(0, (activity._count?.evidences ?? 0) - 1) },
      });
      setEvidenceToRemove(null);
    } catch (error) {
      setRemoveEvidenceError(translateApiError(t, error));
    } finally {
      setIsRemovingEvidence(false);
    }
  }

  return (
    <li className="card">
      <div className="activity-reference">
        {activity.referenceImageUrl ? (
          <MediaThumb
            url={activity.referenceImageUrl}
            mediaType={activity.referenceMediaType}
            alt={t("referenceImageAlt", { ns: "activities" })}
            className="activity-reference-image"
            onClick={() =>
              setLightboxMedia({
                url: activity.referenceImageUrl as string,
                mediaType: activity.referenceMediaType,
                alt: t("referenceImageAlt", { ns: "activities" }),
              })
            }
          />
        ) : (
          <div className="activity-reference-placeholder">
            <ReferencePlaceholderIcon size={40} aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="card-header">
        <span className="card-title">{activity.title}</span>
        <span className={activityStatusBadgeClassName(activity.status)}>
          {translateStatus(t, "common", "activityStatus", activity.status)}
        </span>
      </div>

      {activity.project && (
        <span className="card-meta">
          {t("mine.project", { ns: "activities" })}: {activity.project.name}
        </span>
      )}

      {activity.scheduledDate && (
        <span className="card-meta">
          {t("scheduledDateMeta", { ns: "activities", date: formatScheduledDate(activity.scheduledDate) })}
        </span>
      )}

      {activity.status === "OMITIDA" && activity.skipReason && (
        <p className="card-description">
          {t("skipReasonLabel", { ns: "activities" })}: {activity.skipReason}
        </p>
      )}

      {activity.description && <p className="card-description">{activity.description}</p>}

      <div className="activity-actions">
        {directionsUrl && (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="activity-action-button activity-action-button--secondary"
          >
            <MapPin size={18} aria-hidden="true" />
            <span>{t("mine.directionsButton", { ns: "activities" })}</span>
          </a>
        )}
        <Link
          to={`/projects/${activity.projectId}/chat`}
          state={{ projectName: activity.project?.name }}
          className="activity-action-button activity-action-button--secondary"
        >
          <MessageCircle size={18} aria-hidden="true" />
          <span>{t("mine.chatButton", { ns: "activities" })}</span>
        </Link>
        {nextStatus && (
          <button
            type="button"
            className="activity-action-button activity-action-button--primary"
            onClick={() => void handleStatusChange()}
            disabled={isChangingStatus}
          >
            {nextStatus === "EN_PROGRESO" ? (
              <Play size={18} aria-hidden="true" />
            ) : (
              <CheckCircle2 size={18} aria-hidden="true" />
            )}
            <span>
              {nextStatus === "EN_PROGRESO"
                ? t("mine.startButton", { ns: "activities" })
                : t("mine.completeButton", { ns: "activities" })}
            </span>
          </button>
        )}
        <button
          type="button"
          className="activity-action-button activity-action-button--secondary"
          onClick={() => setIsUploadFormOpen((open) => !open)}
        >
          <Camera size={18} aria-hidden="true" />
          <span>{t("mine.uploadButton", { ns: "activities" })}</span>
        </button>
        <button
          type="button"
          className="activity-action-button activity-action-button--secondary"
          onClick={() => void handleToggleEvidences()}
        >
          <Images size={18} aria-hidden="true" />
          <span>
            {isEvidencesOpen
              ? t("mine.hideEvidencesButton", { ns: "activities" })
              : t("mine.viewEvidencesButton", { ns: "activities", count: activity._count?.evidences ?? 0 })}
          </span>
        </button>
        {isSkippable && (
          <button
            type="button"
            className="activity-action-button activity-action-button--secondary"
            onClick={() => setIsSkipFormOpen((open) => !open)}
          >
            <SkipForward size={18} aria-hidden="true" />
            <span>{t("mine.skipButton", { ns: "activities" })}</span>
          </button>
        )}
      </div>

      {statusError && (
        <p className="form-error" role="alert">
          {statusError}
        </p>
      )}

      {isSkipFormOpen && (
        <form className="inline-form" onSubmit={(event) => void handleSkip(event)}>
          <h2>{t("mine.skipFormTitle", { ns: "activities" })}</h2>
          <label>
            {t("mine.skipReasonInputLabel", { ns: "activities" })}
            <textarea
              value={skipReason}
              onChange={(event) => setSkipReason(event.target.value)}
              maxLength={500}
              required
              minLength={1}
            />
          </label>
          {skipError && (
            <p className="form-error" role="alert">
              {skipError}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" disabled={isSkipping}>
              {isSkipping ? t("mine.skipSubmitting", { ns: "activities" }) : t("mine.skipSubmit", { ns: "activities" })}
            </button>
            <button type="button" onClick={() => setIsSkipFormOpen(false)}>
              {t("actions.cancel", { ns: "common" })}
            </button>
          </div>
        </form>
      )}

      {isUploadFormOpen && (
        <form className="inline-form" onSubmit={(event) => void handleUpload(event)}>
          <h2>{t("mine.uploadFormTitle", { ns: "activities" })}</h2>
          <label>
            {t("mine.imageLabel", { ns: "activities" })}
            <input type="file" accept="image/*,video/*" onChange={handleFileChange} required />
          </label>
          {selectedFile && <MediaFilePreview file={selectedFile} />}
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
                  <MediaThumb
                    url={evidence.imageUrl}
                    mediaType={evidence.mediaType}
                    alt={evidence.description ?? ""}
                    onClick={() =>
                      setLightboxMedia({
                        url: evidence.imageUrl,
                        mediaType: evidence.mediaType,
                        alt: evidence.description ?? "",
                      })
                    }
                  />
                  <span className="status-badge">{translateStatus(t, "common", "evidenceStatus", evidence.status)}</span>
                  {evidence.uploadedById === user?.id && evidence.status === "PENDIENTE" && (
                    <button type="button" className="evidence-remove-button" onClick={() => setEvidenceToRemove(evidence)}>
                      {t("mine.removeEvidenceButton", { ns: "activities" })}
                    </button>
                  )}
                </div>
              ))
            ))}
        </div>
      )}

      <MediaLightbox media={lightboxMedia} onClose={() => setLightboxMedia(null)} />

      {evidenceToRemove && (
        <ConfirmDialog
          title={t("mine.removeEvidenceTitle", { ns: "activities" })}
          message={t("mine.removeEvidenceConfirm", { ns: "activities" })}
          confirmLabel={t("mine.removeEvidenceButton", { ns: "activities" })}
          isConfirming={isRemovingEvidence}
          error={removeEvidenceError}
          onConfirm={() => void handleRemoveEvidence()}
          onCancel={() => {
            setEvidenceToRemove(null);
            setRemoveEvidenceError(null);
          }}
        />
      )}
    </li>
  );
}
