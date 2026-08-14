import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { translateStatus } from "../i18n/statusLabel";
import type { EvidenceWithActivity } from "../types/evidence";

interface EvidenceReviewItemProps {
  evidence: EvidenceWithActivity;
  onReviewed: (evidence: EvidenceWithActivity) => void;
}

/** Una evidencia dentro de una tarjeta de actividad agrupada (ver
 * EvidenceReviewGroup) — miniatura + estado + acciones de aprobar/rechazar. */
export function EvidenceReviewItem({ evidence, onReviewed }: EvidenceReviewItemProps) {
  const { t } = useTranslation(["evidences", "common"]);

  const [isApproving, setIsApproving] = useState(false);
  const [isRejectFormOpen, setIsRejectFormOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function handleApprove() {
    setReviewError(null);
    setIsApproving(true);
    try {
      const response = await apiClient.patch<{ evidence: EvidenceWithActivity }>(
        `/evidences/${evidence.id}/review`,
        { status: "APROBADA" },
      );
      onReviewed(response.data.evidence);
    } catch (error) {
      setReviewError(translateApiError(t, error));
    } finally {
      setIsApproving(false);
    }
  }

  async function handleReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReviewError(null);
    setIsRejecting(true);
    try {
      const response = await apiClient.patch<{ evidence: EvidenceWithActivity }>(
        `/evidences/${evidence.id}/review`,
        { status: "RECHAZADA", reviewComment: rejectComment || undefined },
      );
      setRejectComment("");
      setIsRejectFormOpen(false);
      onReviewed(response.data.evidence);
    } catch (error) {
      setReviewError(translateApiError(t, error));
    } finally {
      setIsRejecting(false);
    }
  }

  return (
    <div className="evidence-review-item">
      <a href={evidence.imageUrl} target="_blank" rel="noreferrer">
        <img src={evidence.imageUrl} alt={evidence.description ?? ""} className="evidence-thumb" />
      </a>

      <div className="evidence-review-item-content">
        <div className="card-header">
          <span className="status-badge">{translateStatus(t, "common", "evidenceStatus", evidence.status)}</span>
          <span className="card-meta">
            {t("uploadedBy", { ns: "evidences" })}: {evidence.uploadedBy.name}
          </span>
        </div>

        {evidence.description && <p className="card-description">{evidence.description}</p>}

        {evidence.status === "PENDIENTE" ? (
          <>
            <div className="form-actions">
              <button type="button" className="button-primary" onClick={() => void handleApprove()} disabled={isApproving}>
                {t("approveButton", { ns: "evidences" })}
              </button>
              <button type="button" onClick={() => setIsRejectFormOpen((open) => !open)}>
                {t("rejectButton", { ns: "evidences" })}
              </button>
            </div>

            {reviewError && (
              <p className="form-error" role="alert">
                {reviewError}
              </p>
            )}

            {isRejectFormOpen && (
              <form className="inline-form" onSubmit={(event) => void handleReject(event)}>
                <h2>{t("rejectFormTitle", { ns: "evidences" })}</h2>
                <label>
                  {t("rejectCommentLabel", { ns: "evidences" })}
                  <textarea
                    value={rejectComment}
                    onChange={(event) => setRejectComment(event.target.value)}
                    maxLength={500}
                  />
                </label>
                <div className="form-actions">
                  <button type="submit" disabled={isRejecting}>
                    {t("confirmReject", { ns: "evidences" })}
                  </button>
                  <button type="button" onClick={() => setIsRejectFormOpen(false)}>
                    {t("actions.cancel", { ns: "common" })}
                  </button>
                </div>
              </form>
            )}
          </>
        ) : (
          <span className="card-meta">
            {t("reviewedBy", { ns: "evidences" })}: {evidence.reviewedBy?.name ?? "—"}
            {evidence.reviewComment ? ` · ${evidence.reviewComment}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
