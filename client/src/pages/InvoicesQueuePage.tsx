import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { InvoiceQueueItem } from "../components/InvoiceQueueItem";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { translateStatus } from "../i18n/statusLabel";
import { isTopManagerRole } from "../types/auth";
import { INVOICE_STATUSES } from "../types/invoice";
import type { InvoiceStatus, InvoiceWithProject } from "../types/invoice";

type StatusFilter = "ALL" | InvoiceStatus;

export function InvoicesQueuePage() {
  const { t } = useTranslation(["invoices", "common"]);
  const { user } = useAuth();

  const [invoices, setInvoices] = useState<InvoiceWithProject[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDIENTE_REVISION");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await apiClient.get<{ invoices: InvoiceWithProject[] }>("/invoices", {
          params: statusFilter === "ALL" ? undefined : { status: statusFilter },
        });
        if (!cancelled) {
          setInvoices(response.data.invoices);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(translateApiError(t, error));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [statusFilter, t]);

  if (!user) {
    return null;
  }

  if (!isTopManagerRole(user.role)) {
    return <Navigate to="/" replace />;
  }

  function handleReviewed(updated: InvoiceWithProject) {
    setInvoices((current) => {
      if (!current) {
        return current;
      }
      if (statusFilter !== "ALL" && updated.status !== statusFilter) {
        return current.filter((invoice) => invoice.id !== updated.id);
      }
      return current.map((invoice) => (invoice.id === updated.id ? updated : invoice));
    });
  }

  return (
    <div className="invoices-queue-page">
      <PageHeader title={t("queueTitle", { ns: "invoices" })}>
        <label className="status-filter">
          {t("statusFilterLabel", { ns: "invoices" })}
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="ALL">{t("statusFilterAll", { ns: "invoices" })}</option>
            {INVOICE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {translateStatus(t, "invoices", "status", status)}
              </option>
            ))}
          </select>
        </label>
      </PageHeader>

      {isLoading && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {!isLoading && errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}

      {!isLoading &&
        !errorMessage &&
        invoices &&
        (invoices.length === 0 ? (
          <p>{t("queueEmpty", { ns: "invoices" })}</p>
        ) : (
          <ul className="card-list">
            {invoices.map((invoice) => (
              <InvoiceQueueItem key={invoice.id} invoice={invoice} onReviewed={handleReviewed} />
            ))}
          </ul>
        ))}
    </div>
  );
}
