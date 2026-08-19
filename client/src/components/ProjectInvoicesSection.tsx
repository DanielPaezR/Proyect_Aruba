import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { translateStatus } from "../i18n/statusLabel";
import { isTopManagerRole } from "../types/auth";
import type { Invoice } from "../types/invoice";

function statusBadgeClassName(status: Invoice["status"]): string {
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

interface ProjectInvoicesSectionProps {
  projectId: string;
}

export function ProjectInvoicesSection({ projectId }: ProjectInvoicesSectionProps) {
  const { t } = useTranslation(["invoices", "common"]);
  const { user } = useAuth();
  // Restriccion de dinero: Supervisor conserva solo lectura (ver el
  // historial y el PDF), nunca sube ni resube una factura.
  const canManageInvoices = Boolean(user && isTopManagerRole(user.role));

  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isUploadFormOpen, setIsUploadFormOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [resubmittingInvoiceId, setResubmittingInvoiceId] = useState<string | null>(null);
  const [resubmitFile, setResubmitFile] = useState<File | null>(null);
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState<string | null>(null);

  async function loadInvoices() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiClient.get<{ invoices: Invoice[] }>(`/projects/${projectId}/invoices`);
      setInvoices(response.data.invoices);
    } catch (error) {
      setLoadError(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadFile) {
      setUploadError(t("errors.api.FILE_REQUIRED", { ns: "common" }));
      return;
    }
    setUploadError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      await apiClient.post(`/projects/${projectId}/invoices`, formData);
      setUploadFile(null);
      setIsUploadFormOpen(false);
      await loadInvoices();
    } catch (error) {
      setUploadError(translateApiError(t, error));
    } finally {
      setIsUploading(false);
    }
  }

  function openResubmit(invoiceId: string) {
    setResubmitError(null);
    setResubmitFile(null);
    setResubmittingInvoiceId(invoiceId);
  }

  async function handleResubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resubmittingInvoiceId) {
      return;
    }
    if (!resubmitFile) {
      setResubmitError(t("errors.api.FILE_REQUIRED", { ns: "common" }));
      return;
    }
    setResubmitError(null);
    setIsResubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", resubmitFile);
      await apiClient.patch(`/invoices/${resubmittingInvoiceId}/resubmit`, formData);
      setResubmittingInvoiceId(null);
      setResubmitFile(null);
      await loadInvoices();
    } catch (error) {
      setResubmitError(translateApiError(t, error));
    } finally {
      setIsResubmitting(false);
    }
  }

  return (
    <section className="project-invoices-section">
      <div className="page-header">
        <h2 className="section-label">{t("sectionTitle", { ns: "invoices" })}</h2>
        {canManageInvoices && (
          <button type="button" onClick={() => setIsUploadFormOpen((open) => !open)}>
            {t("uploadButton", { ns: "invoices" })}
          </button>
        )}
      </div>

      {canManageInvoices && isUploadFormOpen && (
        <form className="inline-form" onSubmit={(event) => void handleUpload(event)}>
          <h2>{t("uploadFormTitle", { ns: "invoices" })}</h2>
          <label>
            {t("fileLabel", { ns: "invoices" })}
            <input
              type="file"
              accept="application/pdf"
              onChange={(event: ChangeEvent<HTMLInputElement>) => setUploadFile(event.target.files?.[0] ?? null)}
              required
            />
          </label>
          {uploadError && (
            <p className="form-error" role="alert">
              {uploadError}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" disabled={isUploading}>
              {isUploading ? t("uploadSubmitting", { ns: "invoices" }) : t("uploadSubmit", { ns: "invoices" })}
            </button>
            <button type="button" onClick={() => setIsUploadFormOpen(false)}>
              {t("actions.cancel", { ns: "common" })}
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {!isLoading && loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}

      {!isLoading &&
        !loadError &&
        invoices &&
        (invoices.length === 0 ? (
          <p>{t("empty", { ns: "invoices" })}</p>
        ) : (
          <ul className="card-list">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="card">
                <div className="card-header">
                  <span className="card-title">
                    {t("uploadedOn", { ns: "invoices", date: formatDate(invoice.createdAt) })}
                  </span>
                  <span className={statusBadgeClassName(invoice.status)}>
                    {translateStatus(t, "invoices", "status", invoice.status)}
                  </span>
                </div>
                <span className="card-meta">
                  {t("uploadedBy", { ns: "invoices" })}: {invoice.uploadedBy.name}
                </span>
                <a href={invoice.fileUrl} target="_blank" rel="noreferrer" className="button-link">
                  {t("viewButton", { ns: "invoices" })}
                </a>

                {invoice.status === "DEVUELTA" && (
                  <>
                    <p className="card-description">
                      {t("reviewCommentLabel", { ns: "invoices" })}: {invoice.reviewComment}
                    </p>
                    {canManageInvoices && (
                      <div className="card-actions">
                        <button type="button" onClick={() => openResubmit(invoice.id)}>
                          {t("resubmitButton", { ns: "invoices" })}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {canManageInvoices && resubmittingInvoiceId === invoice.id && (
                  <form className="inline-form" onSubmit={(event) => void handleResubmit(event)}>
                    <h2>{t("resubmitFormTitle", { ns: "invoices" })}</h2>
                    <label>
                      {t("fileLabel", { ns: "invoices" })}
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setResubmitFile(event.target.files?.[0] ?? null)
                        }
                        required
                      />
                    </label>
                    {resubmitError && (
                      <p className="form-error" role="alert">
                        {resubmitError}
                      </p>
                    )}
                    <div className="form-actions">
                      <button type="submit" disabled={isResubmitting}>
                        {isResubmitting
                          ? t("uploadSubmitting", { ns: "invoices" })
                          : t("uploadSubmit", { ns: "invoices" })}
                      </button>
                      <button type="button" onClick={() => setResubmittingInvoiceId(null)}>
                        {t("actions.cancel", { ns: "common" })}
                      </button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
