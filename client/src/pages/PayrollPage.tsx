import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useAuth } from "../context/AuthContext";
import { translateStatus } from "../i18n/statusLabel";
import { isTopManagerRole } from "../types/auth";
import type { User } from "../types/auth";
import type { PayrollPreview, PayrollRun, PayrollRunStatus } from "../types/payrollRun";
import { formatCurrency } from "../utils/formatCurrency";
import { formatHoursFromMinutes } from "../utils/formatHours";

function todayDateInputValue(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function firstOfMonthDateInputValue(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
}

interface PreviewParams {
  userId: string;
  periodStart: string;
  periodEnd: string;
}

export function PayrollPage() {
  const { t } = useTranslation(["payroll", "common"]);
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<User[] | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [periodStart, setPeriodStart] = useState(firstOfMonthDateInputValue);
  const [periodEnd, setPeriodEnd] = useState(todayDateInputValue);

  // El preview solo es valido para los parametros con los que se pidio
  // (previewParams) — cualquier cambio en el form lo invalida (ver
  // clearPreview), asi que "Confirmar y generar" nunca puede mandar un
  // periodo/trabajador distinto al que la persona efectivamente vio en pantalla.
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PayrollPreview | null>(null);
  const [previewParams, setPreviewParams] = useState<PreviewParams | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const [filterUserId, setFilterUserId] = useState("");
  const [filterStatus, setFilterStatus] = useState<PayrollRunStatus | "">("");
  const [runs, setRuns] = useState<PayrollRun[] | null>(null);
  const [isLoadingRuns, setIsLoadingRuns] = useState(true);
  const [runsError, setRunsError] = useState<string | null>(null);

  const [runToMarkPaid, setRunToMarkPaid] = useState<PayrollRun | null>(null);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [markPaidError, setMarkPaidError] = useState<string | null>(null);

  async function loadUsers() {
    setUsersError(null);
    try {
      const response = await apiClient.get<{ users: User[] }>("/auth/users");
      setUsers(response.data.users.filter((u) => u.isActive));
    } catch (error) {
      setUsersError(translateApiError(t, error));
    }
  }

  async function loadRuns() {
    setIsLoadingRuns(true);
    setRunsError(null);
    try {
      const response = await apiClient.get<{ payrollRuns: PayrollRun[] }>("/payroll", {
        params: { userId: filterUserId || undefined, status: filterStatus || undefined },
      });
      setRuns(response.data.payrollRuns);
    } catch (error) {
      setRunsError(translateApiError(t, error));
    } finally {
      setIsLoadingRuns(false);
    }
  }

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterUserId, filterStatus]);

  if (!currentUser) {
    return null;
  }

  if (!isTopManagerRole(currentUser.role)) {
    return <Navigate to="/" replace />;
  }

  function formatPeriod(run: PayrollRun): string {
    return t("breakdown.period", {
      start: new Date(run.periodStart).toLocaleDateString(),
      end: new Date(run.periodEnd).toLocaleDateString(),
    });
  }

  function clearPreview() {
    setPreview(null);
    setPreviewParams(null);
    setPreviewError(null);
    setConfirmError(null);
  }

  function handleWorkerChange(value: string) {
    setSelectedUserId(value);
    clearPreview();
  }

  function handlePeriodStartChange(value: string) {
    setPeriodStart(value);
    clearPreview();
  }

  function handlePeriodEndChange(value: string) {
    setPeriodEnd(value);
    clearPreview();
  }

  async function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUserId) {
      return;
    }
    const params: PreviewParams = { userId: selectedUserId, periodStart, periodEnd };
    setPreviewError(null);
    setIsPreviewing(true);
    try {
      const response = await apiClient.get<{ preview: PayrollPreview }>("/payroll/preview", { params });
      setPreview(response.data.preview);
      setPreviewParams(params);
    } catch (error) {
      setPreview(null);
      setPreviewParams(null);
      setPreviewError(translateApiError(t, error));
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleConfirmGenerate() {
    if (!previewParams) {
      return;
    }
    setConfirmError(null);
    setIsConfirming(true);
    try {
      await apiClient.post("/payroll/generate", previewParams);
      clearPreview();
      await loadRuns();
    } catch (error) {
      setConfirmError(translateApiError(t, error));
    } finally {
      setIsConfirming(false);
    }
  }

  async function handleMarkPaid() {
    if (!runToMarkPaid) {
      return;
    }
    setMarkPaidError(null);
    setIsMarkingPaid(true);
    try {
      await apiClient.patch(`/payroll/${runToMarkPaid.id}/mark-paid`);
      setRunToMarkPaid(null);
      await loadRuns();
    } catch (error) {
      setMarkPaidError(translateApiError(t, error));
    } finally {
      setIsMarkingPaid(false);
    }
  }

  return (
    <div className="payroll-page">
      <div className="page-header">
        <h1>{t("title")}</h1>
      </div>

      {usersError && (
        <p className="form-error" role="alert">
          {usersError}
        </p>
      )}

      <section>
        <h2 className="section-label">{t("generateSection")}</h2>
        <form className="inline-form" onSubmit={(event) => void handlePreview(event)}>
          <label>
            {t("workerLabel")}
            <select value={selectedUserId} onChange={(event) => handleWorkerChange(event.target.value)} required>
              <option value="">{t("workerPlaceholder")}</option>
              {users?.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name} — {t(`roles.${worker.role}`, { ns: "common" })}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("periodStartLabel")}
            <input
              type="date"
              value={periodStart}
              onChange={(event) => handlePeriodStartChange(event.target.value)}
              required
            />
          </label>
          <label>
            {t("periodEndLabel")}
            <input
              type="date"
              value={periodEnd}
              onChange={(event) => handlePeriodEndChange(event.target.value)}
              required
            />
          </label>
          {previewError && (
            <p className="form-error" role="alert">
              {previewError}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" disabled={isPreviewing}>
              {isPreviewing ? t("previewing") : t("previewButton")}
            </button>
          </div>
        </form>
      </section>

      {preview && (
        <section className="payroll-breakdown">
          <h2 className="section-label">{t("breakdown.title")}</h2>
          <p className="card-meta">{t("breakdown.forWorker", { name: preview.user.name })}</p>
          <p className="card-meta">
            {t("breakdown.period", {
              start: new Date(preview.periodStart).toLocaleDateString(),
              end: new Date(preview.periodEnd).toLocaleDateString(),
            })}
          </p>
          <dl className="info-grid">
            <div>
              <dt>{t("breakdown.normalHours")}</dt>
              <dd>
                {formatHoursFromMinutes(preview.normalMinutes)} — {formatCurrency(preview.normalPay)}
              </dd>
            </div>
            <div>
              <dt>{t("breakdown.overtimeHours")}</dt>
              <dd>
                {formatHoursFromMinutes(preview.overtimeMinutes)} — {formatCurrency(preview.overtimePay)}
              </dd>
            </div>
            <div>
              <dt>{t("breakdown.advances")}</dt>
              <dd>-{formatCurrency(preview.totalAdvances)}</dd>
            </div>
            <div>
              <dt>{t("breakdown.deductions")}</dt>
              <dd>-{formatCurrency(preview.totalDeductions)}</dd>
            </div>
          </dl>
          <div className="stat-card">
            <span className="stat-card__value">{formatCurrency(preview.netPay)}</span>
            <span className="stat-card__label">{t("breakdown.netPay")}</span>
          </div>

          {confirmError && (
            <p className="form-error" role="alert">
              {confirmError}
            </p>
          )}
          <div className="form-actions">
            <button type="button" onClick={() => void handleConfirmGenerate()} disabled={isConfirming}>
              {isConfirming ? t("confirming") : t("confirmButton")}
            </button>
            <button type="button" onClick={clearPreview} disabled={isConfirming}>
              {t("actions.cancel", { ns: "common" })}
            </button>
          </div>
        </section>
      )}

      <section>
        <h2 className="section-label">{t("listTitle")}</h2>

        <div className="card-actions">
          <label>
            {t("filterWorkerLabel")}
            <select value={filterUserId} onChange={(event) => setFilterUserId(event.target.value)}>
              <option value="">{t("filterAllWorkers")}</option>
              {users?.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("filterStatusLabel")}
            <select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value as PayrollRunStatus | "")}
            >
              <option value="">{t("filterAllStatuses")}</option>
              <option value="BORRADOR">{t("status.BORRADOR")}</option>
              <option value="PAGADA">{t("status.PAGADA")}</option>
            </select>
          </label>
        </div>

        {isLoadingRuns && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

        {!isLoadingRuns && runsError && (
          <p className="form-error" role="alert">
            {runsError}
          </p>
        )}

        {!isLoadingRuns &&
          !runsError &&
          runs &&
          (runs.length === 0 ? (
            <p>{t("listEmpty")}</p>
          ) : (
            <ul className="card-list">
              {runs.map((run) => (
                <li key={run.id} className="card">
                  <div className="card-header">
                    <span className="card-title">{run.user.name}</span>
                    <span className="status-badge">{translateStatus(t, "payroll", "status", run.status)}</span>
                  </div>
                  <span className="card-meta">{formatPeriod(run)}</span>
                  <span className="card-meta">
                    {t("breakdown.normalHours")}: {formatHoursFromMinutes(run.normalMinutes)} ·{" "}
                    {t("breakdown.overtimeHours")}: {formatHoursFromMinutes(run.overtimeMinutes)}
                  </span>
                  <p className="card-description">
                    <strong>
                      {t("breakdown.netPay")}: {formatCurrency(run.netPay)}
                    </strong>
                  </p>
                  {run.status === "BORRADOR" && (
                    <div className="card-actions">
                      <button type="button" onClick={() => setRunToMarkPaid(run)}>
                        {t("markPaidButton")}
                      </button>
                    </div>
                  )}
                  {run.status === "PAGADA" && run.paidAt && (
                    <span className="card-meta">
                      {t("paidOn", { date: new Date(run.paidAt).toLocaleDateString() })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ))}
      </section>

      {runToMarkPaid && (
        <ConfirmDialog
          title={t("markPaidTitle")}
          message={t("markPaidMessage", {
            name: runToMarkPaid.user.name,
            amount: formatCurrency(runToMarkPaid.netPay),
          })}
          confirmLabel={t("markPaidButton")}
          isConfirming={isMarkingPaid}
          error={markPaidError}
          onConfirm={() => void handleMarkPaid()}
          onCancel={() => {
            setRunToMarkPaid(null);
            setMarkPaidError(null);
          }}
        />
      )}
    </div>
  );
}
