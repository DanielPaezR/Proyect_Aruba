import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { translateStatus } from "../i18n/statusLabel";
import { formatCurrency } from "../utils/formatCurrency";
import { useAuth } from "../context/AuthContext";
import { ClientPicker } from "./ClientPicker";
import { ConfirmDialog } from "./ConfirmDialog";
import { PAYMENT_METHODS } from "../types/payment";
import type { Payment, PaymentsListResponse } from "../types/payment";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function todayDateInputValue(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

interface ProjectPaymentsSectionProps {
  projectId: string;
  hasClient: boolean;
  onClientLinked: () => Promise<void>;
}

export function ProjectPaymentsSection({ projectId, hasClient, onClientLinked }: ProjectPaymentsSectionProps) {
  const { t } = useTranslation(["payments", "common"]);
  const { user } = useAuth();

  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [totalReceived, setTotalReceived] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayDateInputValue());
  const [method, setMethod] = useState<string>("EFECTIVO");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [linkClientId, setLinkClientId] = useState<string | null>(null);
  const [isLinkingClient, setIsLinkingClient] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function loadPayments() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiClient.get<PaymentsListResponse>(`/projects/${projectId}/payments`);
      setPayments(response.data.payments);
      setTotalReceived(response.data.totalReceived);
    } catch (error) {
      setLoadError(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function resetForm() {
    setAmount("");
    setPaymentDate(todayDateInputValue());
    setMethod("EFECTIVO");
    setReference("");
    setNotes("");
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post(`/projects/${projectId}/payments`, {
        amount: Number(amount),
        paymentDate: new Date(paymentDate).toISOString(),
        method,
        reference: reference || undefined,
        notes: notes || undefined,
      });
      resetForm();
      setIsFormOpen(false);
      await loadPayments();
    } catch (error) {
      setFormError(translateApiError(t, error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLinkClient() {
    if (!linkClientId) {
      return;
    }
    setLinkError(null);
    setIsLinkingClient(true);
    try {
      await apiClient.patch(`/projects/${projectId}`, { clientId: linkClientId });
      await onClientLinked();
    } catch (error) {
      setLinkError(translateApiError(t, error));
    } finally {
      setIsLinkingClient(false);
    }
  }

  async function handleDelete() {
    if (!paymentToDelete) {
      return;
    }
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await apiClient.delete(`/payments/${paymentToDelete.id}`);
      setPaymentToDelete(null);
      await loadPayments();
    } catch (error) {
      setDeleteError(translateApiError(t, error));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="project-payments-section">
      <div className="page-header">
        <h2 className="section-label">{t("sectionTitle", { ns: "payments" })}</h2>
        {hasClient && (
          <button type="button" onClick={() => setIsFormOpen((open) => !open)}>
            {t("addButton", { ns: "payments" })}
          </button>
        )}
      </div>

      {!isLoading && !loadError && (
        <p className="payments-total">
          {t("totalReceivedLabel", { ns: "payments" })}: <strong>{formatCurrency(totalReceived)}</strong>
        </p>
      )}

      {!hasClient && (
        <div className="inline-form">
          <p>{t("noClientMessage", { ns: "payments" })}</p>
          <label>
            {t("linkClientLabel", { ns: "payments" })}
            <ClientPicker value={linkClientId} onChange={(id) => setLinkClientId(id)} />
          </label>
          {linkError && (
            <p className="form-error" role="alert">
              {linkError}
            </p>
          )}
          <div className="form-actions">
            <button type="button" onClick={() => void handleLinkClient()} disabled={!linkClientId || isLinkingClient}>
              {isLinkingClient ? t("linkingClient", { ns: "payments" }) : t("linkClientButton", { ns: "payments" })}
            </button>
          </div>
        </div>
      )}

      {hasClient && isFormOpen && (
        <form className="inline-form" onSubmit={(event) => void handleCreate(event)}>
          <h2>{t("addFormTitle", { ns: "payments" })}</h2>
          <label>
            {t("amountLabel", { ns: "payments" })}
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>
          <label>
            {t("paymentDateLabel", { ns: "payments" })}
            <input
              type="date"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
              required
            />
          </label>
          <label>
            {t("methodLabel", { ns: "payments" })}
            <select value={method} onChange={(event) => setMethod(event.target.value)} required>
              {PAYMENT_METHODS.map((value) => (
                <option key={value} value={value}>
                  {translateStatus(t, "payments", "method", value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("referenceLabel", { ns: "payments" })}
            <input value={reference} onChange={(event) => setReference(event.target.value)} />
          </label>
          <label>
            {t("notesLabel", { ns: "payments" })}
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("addSubmitting", { ns: "payments" }) : t("addSubmit", { ns: "payments" })}
            </button>
            <button type="button" onClick={() => setIsFormOpen(false)}>
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
        payments &&
        (payments.length === 0 ? (
          <p>{t("empty", { ns: "payments" })}</p>
        ) : (
          <ul className="card-list">
            {payments.map((payment) => (
              <li key={payment.id} className="card">
                <div className="card-header">
                  <span className="card-title">{formatCurrency(payment.amount)}</span>
                  <span className="status-badge">{translateStatus(t, "payments", "method", payment.method)}</span>
                </div>
                <span className="card-meta">
                  {t("paymentDateLabel", { ns: "payments" })}: {formatDate(payment.paymentDate)}
                </span>
                <span className="card-meta">
                  {t("recordedByLabel", { ns: "payments" })}: {payment.recordedBy.name}
                </span>
                {payment.reference && (
                  <span className="card-meta">
                    {t("referenceLabel", { ns: "payments" })}: {payment.reference}
                  </span>
                )}
                {payment.notes && <p className="card-description">{payment.notes}</p>}

                {user?.role === "JEFE" && (
                  <div className="card-actions">
                    <button type="button" className="danger-button" onClick={() => setPaymentToDelete(payment)}>
                      {t("actions.delete", { ns: "common" })}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ))}

      {paymentToDelete && (
        <ConfirmDialog
          title={t("deleteTitle", { ns: "payments" })}
          message={t("deleteMessage", { ns: "payments", amount: formatCurrency(paymentToDelete.amount) })}
          confirmLabel={t("actions.delete", { ns: "common" })}
          isConfirming={isDeleting}
          error={deleteError}
          onConfirm={() => void handleDelete()}
          onCancel={() => {
            setPaymentToDelete(null);
            setDeleteError(null);
          }}
        />
      )}
    </section>
  );
}
