import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { translateStatus } from "../i18n/statusLabel";
import type { InvoiceWithProject } from "../types/invoice";
import { inferDocumentMediaType } from "../utils/mediaType";
import { MediaLightbox } from "./MediaLightbox";
import type { LightboxMedia } from "./MediaLightbox";

function statusBadgeClassName(status: InvoiceWithProject["status"]): string {
  if (status === "APROBADA") {
    return "status-badge status-badge--success";
  }
  if (status === "DEVUELTA") {
    return "status-badge status-badge--warning";
  }
  return "status-badge";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

interface InvoiceQueueItemProps {
  invoice: InvoiceWithProject;
  onReviewed: (invoice: InvoiceWithProject) => void;
}

/** Una factura dentro de la cola de revision del Jefe — link al PDF, estado,
 * y acciones de aprobar/devolver (devolver exige un comentario, no es un
 * simple confirm() del navegador). */
export function InvoiceQueueItem({ invoice, onReviewed }: InvoiceQueueItemProps) {
  const { t } = useTranslation(["invoices", "common"]);

  const [isApproving, setIsApproving] = useState(false);
  const [isReturnFormOpen, setIsReturnFormOpen] = useState(false);
  const [returnComment, setReturnComment] = useState("");
  const [isReturning, setIsReturning] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<LightboxMedia | null>(null);

  async function handleApprove() {
    setReviewError(null);
    setIsApproving(true);
    try {
      const response = await apiClient.patch<{ invoice: InvoiceWithProject }>(`/invoices/${invoice.id}/approve`);
      onReviewed({ ...response.data.invoice, project: invoice.project });
    } catch (error) {
      setReviewError(translateApiError(t, error));
    } finally {
      setIsApproving(false);
    }
  }

  async function handleReturn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReviewError(null);
    setIsReturning(true);
    try {
      const response = await apiClient.patch<{ invoice: InvoiceWithProject }>(`/invoices/${invoice.id}/return`, {
        comment: returnComment,
      });
      setReturnComment("");
      setIsReturnFormOpen(false);
      onReviewed({ ...response.data.invoice, project: invoice.project });
    } catch (error) {
      setReviewError(translateApiError(t, error));
    } finally {
      setIsReturning(false);
    }
  }

  return (
    <li className="card">
      <div className="card-header">
        <span className="card-title">{invoice.project.name}</span>
        <span className={statusBadgeClassName(invoice.status)}>
          {translateStatus(t, "invoices", "status", invoice.status)}
        </span>
      </div>
      <span className="card-meta">
        {t("uploadedBy", { ns: "invoices" })}: {invoice.uploadedBy.name} ·{" "}
        {t("uploadedOn", { ns: "invoices", date: formatDate(invoice.createdAt) })}
      </span>
      <button
        type="button"
        onClick={() =>
          setLightboxMedia({
            url: invoice.fileUrl,
            mediaType: inferDocumentMediaType(invoice),
            alt: t("viewButton", { ns: "invoices" }),
          })
        }
      >
        {t("viewButton", { ns: "invoices" })}
      </button>

      {invoice.status === "PENDIENTE_REVISION" ? (
        <>
          <div className="form-actions">
            <button type="button" className="button-primary" onClick={() => void handleApprove()} disabled={isApproving}>
              {t("approveButton", { ns: "invoices" })}
            </button>
            <button type="button" onClick={() => setIsReturnFormOpen((open) => !open)}>
              {t("returnButton", { ns: "invoices" })}
            </button>
          </div>

          {reviewError && (
            <p className="form-error" role="alert">
              {reviewError}
            </p>
          )}

          {isReturnFormOpen && (
            <form className="inline-form" onSubmit={(event) => void handleReturn(event)}>
              <h2>{t("returnFormTitle", { ns: "invoices" })}</h2>
              <label>
                {t("returnCommentLabel", { ns: "invoices" })}
                <textarea
                  value={returnComment}
                  onChange={(event) => setReturnComment(event.target.value)}
                  maxLength={500}
                  required
                  minLength={1}
                />
              </label>
              <div className="form-actions">
                <button type="submit" disabled={isReturning}>
                  {t("confirmReturn", { ns: "invoices" })}
                </button>
                <button type="button" onClick={() => setIsReturnFormOpen(false)}>
                  {t("actions.cancel", { ns: "common" })}
                </button>
              </div>
            </form>
          )}
        </>
      ) : (
        <span className="card-meta">
          {t("reviewedBy", { ns: "invoices" })}: {invoice.reviewedBy?.name ?? "—"}
          {invoice.reviewComment ? ` · ${invoice.reviewComment}` : ""}
        </span>
      )}

      <MediaLightbox media={lightboxMedia} onClose={() => setLightboxMedia(null)} />
    </li>
  );
}
