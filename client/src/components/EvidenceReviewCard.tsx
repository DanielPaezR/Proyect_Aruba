import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { API_BASE_URL, apiClient } from "../api/client";
import { translateStatus } from "../i18n/statusLabel";
import type { EvidenceWithActivity } from "../types/evidence";

interface EvidenceReviewCardProps {
  evidence: EvidenceWithActivity;
  onReviewed: (evidence: EvidenceWithActivity) => void;
}

export function EvidenceReviewCard({ evidence, onReviewed }: EvidenceReviewCardProps) {
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
    <li className="card">
      <div className="card-header">
        <span className="card-title">{evidence.activity.title}</span>
        <span className="status-badge">{translateStatus(t, "common", "evidenceStatus", evidence.status)}</span>
      </div>

      <span className="card-meta">
        {evidence.activity.project.name} · {t("uploadedBy", { ns: "evidences" })}: {evidence.uploadedBy.name}
      </span>

      {evidence.description && <p className="card-description">{evidence.description}</p>}

      <div className="evidence-list">
        <a href={`${API_BASE_URL}${evidence.imageUrl}`} target="_blank" rel="noreferrer">
          <img
            src={`${API_BASE_URL}${evidence.imageUrl}`}
            alt={evidence.description ?? ""}
            className="evidence-thumb"
          />
        </a>
      </div>

      {evidence.status === "PENDIENTE" ? (
        <>
          <div className="form-actions">
            <button type="button" onClick={() => void handleApprove()} disabled={isApproving}>
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
    </li>
  );
}
