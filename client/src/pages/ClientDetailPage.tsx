import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { translateStatus } from "../i18n/statusLabel";
import { isManagerRole, isTopManagerRole } from "../types/auth";
import type { ClientDetail } from "../types/client";
import type { ClientPaymentsListResponse } from "../types/payment";
import { formatCurrency } from "../utils/formatCurrency";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

interface ClientEditFormState {
  name: string;
  phone: string;
  email: string;
  notes: string;
}

function clientToFormState(client: ClientDetail): ClientEditFormState {
  return {
    name: client.name,
    phone: client.phone,
    email: client.email ?? "",
    notes: client.notes ?? "",
  };
}

export function ClientDetailPage() {
  const { t } = useTranslation(["clients", "projects", "payments", "common"]);
  const { user } = useAuth();
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<ClientEditFormState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [paymentsResponse, setPaymentsResponse] = useState<ClientPaymentsListResponse | null>(null);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  async function loadPayments(id: string) {
    setIsLoadingPayments(true);
    setPaymentsError(null);
    try {
      const response = await apiClient.get<ClientPaymentsListResponse>(`/clients/${id}/payments`);
      setPaymentsResponse(response.data);
    } catch (error) {
      setPaymentsError(translateApiError(t, error));
    } finally {
      setIsLoadingPayments(false);
    }
  }

  async function loadClient(id: string) {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await apiClient.get<{ client: ClientDetail }>(`/clients/${id}`);
      setClient(response.data.client);
    } catch (error) {
      setErrorMessage(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (clientId) {
      void loadClient(clientId);
      void loadPayments(clientId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (!user || !clientId) {
    return null;
  }

  if (!isManagerRole(user.role)) {
    return <Navigate to="/" replace />;
  }

  function openEdit() {
    if (!client) {
      return;
    }
    setEditError(null);
    setEditForm(clientToFormState(client));
    setIsEditOpen(true);
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editForm || !clientId) {
      return;
    }
    setEditError(null);
    setIsSaving(true);
    try {
      await apiClient.patch(`/clients/${clientId}`, {
        name: editForm.name,
        phone: editForm.phone,
        email: editForm.email || undefined,
        notes: editForm.notes || undefined,
      });
      setIsEditOpen(false);
      await loadClient(clientId);
    } catch (error) {
      setEditError(translateApiError(t, error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!clientId) {
      return;
    }
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await apiClient.delete(`/clients/${clientId}`);
      navigate("/clients");
    } catch (error) {
      setDeleteError(translateApiError(t, error));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="client-detail-page">
      <PageHeader
        title={client?.name ?? t("title", { ns: "clients" })}
        back={{ to: "/clients", label: t("title", { ns: "clients" }) }}
      >
        {client && (
          <div className="card-actions">
            <button type="button" onClick={openEdit}>
              {t("actions.edit", { ns: "common" })}
            </button>
            {isTopManagerRole(user.role) && (
              <button type="button" className="danger-button" onClick={() => setIsDeleteOpen(true)}>
                {t("actions.delete", { ns: "common" })}
              </button>
            )}
          </div>
        )}
      </PageHeader>

      {isLoading && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {!isLoading && errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}

      {!isLoading && !errorMessage && client && (
        <>
          {isEditOpen && editForm && (
            <form className="inline-form" onSubmit={(event) => void handleUpdate(event)}>
              <h2>{t("editFormTitle", { ns: "clients" })}</h2>
              <label>
                {t("nameLabel", { ns: "clients" })}
                <input
                  value={editForm.name}
                  onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                  required
                  minLength={2}
                />
              </label>
              <label>
                {t("phoneLabel", { ns: "clients" })}
                <input
                  value={editForm.phone}
                  onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })}
                  required
                />
              </label>
              <label>
                {t("emailLabel", { ns: "clients" })}
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
                />
              </label>
              <label>
                {t("notesLabel", { ns: "clients" })}
                <textarea value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} />
              </label>
              {editError && (
                <p className="form-error" role="alert">
                  {editError}
                </p>
              )}
              <div className="form-actions">
                <button type="submit" disabled={isSaving}>
                  {isSaving ? t("saving", { ns: "clients" }) : t("editSubmit", { ns: "clients" })}
                </button>
                <button type="button" onClick={() => setIsEditOpen(false)}>
                  {t("actions.cancel", { ns: "common" })}
                </button>
              </div>
            </form>
          )}

          <section>
            <h2 className="section-label">{t("detailsSection", { ns: "clients" })}</h2>
            <dl className="info-grid">
              <div>
                <dt>{t("phoneLabel", { ns: "clients" })}</dt>
                <dd>{client.phone}</dd>
              </div>
              <div>
                <dt>{t("emailLabel", { ns: "clients" })}</dt>
                <dd>{client.email ?? t("notSpecified", { ns: "clients" })}</dd>
              </div>
              <div>
                <dt>{t("notesLabel", { ns: "clients" })}</dt>
                <dd>{client.notes ?? t("notSpecified", { ns: "clients" })}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="section-label">{t("projectsHistorySection", { ns: "clients" })}</h2>
            {client.projects.length === 0 ? (
              <p>{t("noProjects", { ns: "clients" })}</p>
            ) : (
              <ul className="card-list">
                {client.projects.map((project) => (
                  <li key={project.id} className="card">
                    <Link to={`/projects/${project.id}`} className="card-link">
                      <div className="card-header">
                        <span className="card-title">{project.name}</span>
                        <span className="status-badge">
                          {translateStatus(t, "projects", "status", project.status)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="section-label">{t("paymentsHistorySection", { ns: "clients" })}</h2>

            {isLoadingPayments && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

            {!isLoadingPayments && paymentsError && (
              <p className="form-error" role="alert">
                {paymentsError}
              </p>
            )}

            {!isLoadingPayments && !paymentsError && paymentsResponse && (
              <>
                <p className="payments-total">
                  {t("totalReceivedLabel", { ns: "payments" })}:{" "}
                  <strong>{formatCurrency(paymentsResponse.totalReceived)}</strong>
                </p>
                {paymentsResponse.payments.length === 0 ? (
                  <p>{t("empty", { ns: "payments" })}</p>
                ) : (
                  <ul className="card-list">
                    {paymentsResponse.payments.map((payment) => (
                      <li key={payment.id} className="card">
                        <div className="card-header">
                          <span className="card-title">{formatCurrency(payment.amount)}</span>
                          <span className="status-badge">
                            {translateStatus(t, "payments", "method", payment.method)}
                          </span>
                        </div>
                        <span className="card-meta">
                          {t("paymentDateLabel", { ns: "payments" })}: {formatDate(payment.paymentDate)}
                        </span>
                        <span className="card-meta">
                          {t("projectLabel", { ns: "payments" })}:{" "}
                          <Link to={`/projects/${payment.project.id}`}>{payment.project.name}</Link>
                        </span>
                        <span className="card-meta">
                          {t("recordedByLabel", { ns: "payments" })}: {payment.recordedBy.name}
                        </span>
                        {payment.reference && (
                          <span className="card-meta">
                            {t("referenceLabel", { ns: "payments" })}: {payment.reference}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </>
      )}

      {isDeleteOpen && client && (
        <ConfirmDialog
          title={t("deleteTitle", { ns: "clients" })}
          message={t("deleteMessage", { ns: "clients", name: client.name })}
          confirmLabel={t("actions.delete", { ns: "common" })}
          isConfirming={isDeleting}
          error={deleteError}
          onConfirm={() => void handleDelete()}
          onCancel={() => {
            setIsDeleteOpen(false);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}
