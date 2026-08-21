import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useParams } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ExportReportButtons } from "../components/ExportReportButtons";
import { PageHeader } from "../components/PageHeader";
import { WorkerDocumentCard } from "../components/WorkerDocumentCard";
import { useAuth } from "../context/AuthContext";
import { translateStatus } from "../i18n/statusLabel";
import { isManagerRole, isTopManagerRole } from "../types/auth";
import type { SalaryAdjustment, SalaryAdjustmentType } from "../types/salaryAdjustment";
import type { SalaryRaise } from "../types/salaryRaise";
import type { WorkerDocument } from "../types/workerDocument";
import type { MonthlyScore } from "../types/workerScore";
import type { WorkerProfile } from "../types/workerProfile";
import { formatCurrency, formatHourlyRate } from "../utils/formatCurrency";
import { timeAgo } from "../utils/timeAgo";

interface EditFormState {
  name: string;
  email: string;
  phone: string;
  hireDate: string;
  specialties: string;
  workDaysPerWeek: string;
  workScheduleNote: string;
}

function toDateInputValue(iso: string | null): string {
  if (!iso) {
    return "";
  }
  return iso.slice(0, 10);
}

function profileToFormState(profile: WorkerProfile): EditFormState {
  return {
    name: profile.user.name,
    email: profile.user.email,
    phone: profile.user.phone ?? "",
    hireDate: toDateInputValue(profile.user.hireDate),
    specialties: profile.user.specialties.join(", "),
    workDaysPerWeek: profile.user.workDaysPerWeek?.toString() ?? "",
    workScheduleNote: profile.user.workScheduleNote ?? "",
  };
}

export function WorkerProfilePage() {
  const { t } = useTranslation(["users", "common", "teamMap", "projects"]);
  const { user: currentUser } = useAuth();
  const { userId } = useParams<{ userId: string }>();

  const isTopManager = Boolean(currentUser && isTopManagerRole(currentUser.role));

  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [isSalaryOpen, setIsSalaryOpen] = useState(false);
  const [salaryHistory, setSalaryHistory] = useState<SalaryRaise[] | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isRaiseFormOpen, setIsRaiseFormOpen] = useState(false);
  const [newRate, setNewRate] = useState("");
  const [newOvertimeRate, setNewOvertimeRate] = useState("");
  const [raiseReason, setRaiseReason] = useState("");
  const [isSubmittingRaise, setIsSubmittingRaise] = useState(false);
  const [raiseError, setRaiseError] = useState<string | null>(null);

  const [salaryAdjustments, setSalaryAdjustments] = useState<SalaryAdjustment[] | null>(null);
  const [isLoadingAdjustments, setIsLoadingAdjustments] = useState(false);
  const [adjustmentsError, setAdjustmentsError] = useState<string | null>(null);
  const [isAdjustmentFormOpen, setIsAdjustmentFormOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<SalaryAdjustmentType>("ADELANTO");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentEffectiveDate, setAdjustmentEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);
  const [adjustmentToDelete, setAdjustmentToDelete] = useState<SalaryAdjustment | null>(null);
  const [isDeletingAdjustment, setIsDeletingAdjustment] = useState(false);
  const [deleteAdjustmentError, setDeleteAdjustmentError] = useState<string | null>(null);

  const [isScoreOpen, setIsScoreOpen] = useState(false);
  const [monthlyScore, setMonthlyScore] = useState<MonthlyScore | null>(null);
  const [isLoadingScore, setIsLoadingScore] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [isScoreFormOpen, setIsScoreFormOpen] = useState(false);
  const [discountPoints, setDiscountPoints] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);
  const [scoreFormError, setScoreFormError] = useState<string | null>(null);

  const [isDeactivateConfirmOpen, setIsDeactivateConfirmOpen] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [isReactivating, setIsReactivating] = useState(false);
  const [reactivateError, setReactivateError] = useState<string | null>(null);

  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [documents, setDocuments] = useState<WorkerDocument[] | null>(null);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [docLabel, setDocLabel] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadDocError, setUploadDocError] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<WorkerDocument | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);
  const [deleteDocError, setDeleteDocError] = useState<string | null>(null);

  async function loadProfile(id: string) {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await apiClient.get<WorkerProfile>(`/auth/users/${id}/profile`);
      setProfile(response.data);
    } catch (error) {
      setErrorMessage(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadDocuments(id: string) {
    setIsLoadingDocuments(true);
    setDocumentsError(null);
    try {
      const response = await apiClient.get<{ documents: WorkerDocument[] }>(`/auth/users/${id}/documents`);
      setDocuments(response.data.documents);
    } catch (error) {
      setDocumentsError(translateApiError(t, error));
    } finally {
      setIsLoadingDocuments(false);
    }
  }

  useEffect(() => {
    if (userId) {
      void loadProfile(userId);
      void loadDocuments(userId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function formatTimeAgo(isoTimestamp: string): string {
    const ago = timeAgo(isoTimestamp);
    return ago.count === 0
      ? t("map.justNow", { ns: "teamMap" })
      : t(`map.${ago.unit}Ago`, { ns: "teamMap", count: ago.count });
  }

  function openEdit() {
    if (!profile) {
      return;
    }
    setEditError(null);
    setEditForm(profileToFormState(profile));
    setIsEditOpen(true);
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editForm || !userId) {
      return;
    }
    setEditError(null);
    setIsSaving(true);
    try {
      await apiClient.patch(`/auth/users/${userId}`, {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        hireDate: editForm.hireDate ? new Date(editForm.hireDate).toISOString() : null,
        specialties: editForm.specialties
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        workDaysPerWeek: editForm.workDaysPerWeek ? Number(editForm.workDaysPerWeek) : null,
        workScheduleNote: editForm.workScheduleNote || null,
      });
      setIsEditOpen(false);
      await loadProfile(userId);
    } catch (error) {
      setEditError(translateApiError(t, error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!userId) {
      return;
    }
    setDeactivateError(null);
    setIsDeactivating(true);
    try {
      await apiClient.patch(`/auth/users/${userId}/deactivate`);
      setIsDeactivateConfirmOpen(false);
      await loadProfile(userId);
    } catch (error) {
      setDeactivateError(translateApiError(t, error));
    } finally {
      setIsDeactivating(false);
    }
  }

  async function handleReactivate() {
    if (!userId) {
      return;
    }
    setReactivateError(null);
    setIsReactivating(true);
    try {
      await apiClient.patch(`/auth/users/${userId}/reactivate`);
      await loadProfile(userId);
    } catch (error) {
      setReactivateError(translateApiError(t, error));
    } finally {
      setIsReactivating(false);
    }
  }

  async function handleResetPassword() {
    if (!userId) {
      return;
    }
    if (resetPasswordValue.length < 8) {
      setResetPasswordError(t("profile.resetPasswordTooShort", { ns: "users" }));
      return;
    }
    setResetPasswordError(null);
    setIsResettingPassword(true);
    try {
      await apiClient.patch(`/auth/users/${userId}/reset-password`, { newPassword: resetPasswordValue });
      setIsResetPasswordOpen(false);
      setResetPasswordValue("");
    } catch (error) {
      setResetPasswordError(translateApiError(t, error));
    } finally {
      setIsResettingPassword(false);
    }
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !userId) {
      return;
    }
    setPhotoError(null);
    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      await apiClient.patch(`/auth/users/${userId}/photo`, formData);
      await loadProfile(userId);
    } catch (error) {
      setPhotoError(translateApiError(t, error));
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleUploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!docFile || !userId) {
      return;
    }
    setUploadDocError(null);
    setIsUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append("label", docLabel);
      formData.append("file", docFile);
      await apiClient.post(`/auth/users/${userId}/documents`, formData);
      setDocLabel("");
      setDocFile(null);
      await loadDocuments(userId);
    } catch (error) {
      setUploadDocError(translateApiError(t, error));
    } finally {
      setIsUploadingDoc(false);
    }
  }

  async function handleDeleteDocument() {
    if (!docToDelete || !userId) {
      return;
    }
    setDeleteDocError(null);
    setIsDeletingDoc(true);
    try {
      await apiClient.delete(`/auth/users/${userId}/documents/${docToDelete.id}`);
      setDocToDelete(null);
      await loadDocuments(userId);
    } catch (error) {
      setDeleteDocError(translateApiError(t, error));
    } finally {
      setIsDeletingDoc(false);
    }
  }

  async function loadSalaryHistory(id: string) {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const response = await apiClient.get<{ history: SalaryRaise[] }>(`/auth/users/${id}/salary-history`);
      setSalaryHistory(response.data.history);
    } catch (error) {
      setHistoryError(translateApiError(t, error));
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function loadSalaryAdjustments(id: string) {
    setIsLoadingAdjustments(true);
    setAdjustmentsError(null);
    try {
      const response = await apiClient.get<{ adjustments: SalaryAdjustment[] }>(`/auth/users/${id}/salary-adjustments`);
      setSalaryAdjustments(response.data.adjustments);
    } catch (error) {
      setAdjustmentsError(translateApiError(t, error));
    } finally {
      setIsLoadingAdjustments(false);
    }
  }

  async function toggleSalary() {
    if (!userId) {
      return;
    }
    const opening = !isSalaryOpen;
    setIsSalaryOpen(opening);
    if (opening && salaryHistory === null) {
      await loadSalaryHistory(userId);
    }
    if (opening && salaryAdjustments === null) {
      await loadSalaryAdjustments(userId);
    }
  }

  async function handleAddAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      return;
    }
    setAdjustmentError(null);
    setIsSubmittingAdjustment(true);
    try {
      await apiClient.post(`/auth/users/${userId}/salary-adjustments`, {
        type: adjustmentType,
        amount: Number(adjustmentAmount),
        reason: adjustmentReason,
        effectiveDate: new Date(adjustmentEffectiveDate).toISOString(),
      });
      setAdjustmentType("ADELANTO");
      setAdjustmentAmount("");
      setAdjustmentEffectiveDate(new Date().toISOString().slice(0, 10));
      setAdjustmentReason("");
      setIsAdjustmentFormOpen(false);
      await loadSalaryAdjustments(userId);
    } catch (error) {
      setAdjustmentError(translateApiError(t, error));
    } finally {
      setIsSubmittingAdjustment(false);
    }
  }

  async function handleDeleteAdjustment() {
    if (!adjustmentToDelete || !userId) {
      return;
    }
    setDeleteAdjustmentError(null);
    setIsDeletingAdjustment(true);
    try {
      await apiClient.delete(`/auth/users/${userId}/salary-adjustments/${adjustmentToDelete.id}`);
      setAdjustmentToDelete(null);
      await loadSalaryAdjustments(userId);
    } catch (error) {
      setDeleteAdjustmentError(translateApiError(t, error));
    } finally {
      setIsDeletingAdjustment(false);
    }
  }

  async function handleRegisterRaise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      return;
    }
    setRaiseError(null);
    setIsSubmittingRaise(true);
    try {
      await apiClient.patch(`/auth/users/${userId}/hourly-rate`, {
        newRate: Number(newRate),
        newOvertimeRate: newOvertimeRate ? Number(newOvertimeRate) : undefined,
        reason: raiseReason || undefined,
      });
      setNewRate("");
      setNewOvertimeRate("");
      setRaiseReason("");
      setIsRaiseFormOpen(false);
      await Promise.all([loadProfile(userId), loadSalaryHistory(userId)]);
    } catch (error) {
      setRaiseError(translateApiError(t, error));
    } finally {
      setIsSubmittingRaise(false);
    }
  }

  async function loadMonthlyScore(id: string) {
    setIsLoadingScore(true);
    setScoreError(null);
    try {
      const response = await apiClient.get<MonthlyScore>(`/auth/users/${id}/score`);
      setMonthlyScore(response.data);
    } catch (error) {
      setScoreError(translateApiError(t, error));
    } finally {
      setIsLoadingScore(false);
    }
  }

  async function toggleScore() {
    if (!userId) {
      return;
    }
    const opening = !isScoreOpen;
    setIsScoreOpen(opening);
    if (opening && monthlyScore === null) {
      await loadMonthlyScore(userId);
    }
  }

  async function handleAddDiscount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      return;
    }
    setScoreFormError(null);
    setIsSubmittingScore(true);
    try {
      await apiClient.post(`/auth/users/${userId}/score-events`, {
        points: -Math.abs(Number(discountPoints)),
        reason: discountReason,
      });
      setDiscountPoints("");
      setDiscountReason("");
      setIsScoreFormOpen(false);
      await loadMonthlyScore(userId);
    } catch (error) {
      setScoreFormError(translateApiError(t, error));
    } finally {
      setIsSubmittingScore(false);
    }
  }

  if (!currentUser || !userId) {
    return null;
  }

  if (!isManagerRole(currentUser.role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="worker-profile-page">
      <PageHeader
        back={{ to: "/users", label: t("title", { ns: "users" }) }}
        content={
          profile ? (
            <div className="worker-profile-identity">
              {profile.user.photoUrl ? (
                <img src={profile.user.photoUrl} alt="" className="profile-photo-preview" />
              ) : (
                <div className="profile-photo-placeholder">{profile.user.name.charAt(0).toUpperCase()}</div>
              )}
              <div>
                <h1>{profile.user.name}</h1>
                <span className="status-badge">{t(`roles.${profile.user.role}`, { ns: "common" })}</span>{" "}
                <span className={profile.user.isActive ? "status-badge" : "status-badge status-badge--muted"}>
                  {profile.user.isActive ? t("list.active", { ns: "users" }) : t("list.inactive", { ns: "users" })}
                </span>
              </div>
            </div>
          ) : (
            <h1>{t("title", { ns: "users" })}</h1>
          )
        }
      >
        {profile && isTopManager && (
          <div className="card-actions">
            <label>
              {isUploadingPhoto ? t("profile.uploadingPhoto", { ns: "users" }) : t("profile.changePhotoButton", { ns: "users" })}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => void handlePhotoChange(event)}
                disabled={isUploadingPhoto}
                hidden
              />
            </label>
            <button type="button" onClick={openEdit}>
              {t("actions.edit", { ns: "common" })}
            </button>
            <ExportReportButtons type="worker" id={userId} />
            <button type="button" onClick={() => setIsResetPasswordOpen(true)}>
              {t("profile.resetPasswordButton", { ns: "users" })}
            </button>
            {profile.user.isActive ? (
              <button type="button" className="danger-button" onClick={() => setIsDeactivateConfirmOpen(true)}>
                {t("profile.deactivateButton", { ns: "users" })}
              </button>
            ) : (
              <button type="button" onClick={() => void handleReactivate()} disabled={isReactivating}>
                {isReactivating
                  ? t("profile.reactivating", { ns: "users" })
                  : t("profile.reactivateButton", { ns: "users" })}
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

      {!isLoading && !errorMessage && profile && (
        <>
          {isTopManager && photoError && (
            <p className="form-error" role="alert">
              {photoError}
            </p>
          )}
          {isTopManager && reactivateError && (
            <p className="form-error" role="alert">
              {reactivateError}
            </p>
          )}

          {isTopManager && isEditOpen && editForm && (
            <form className="inline-form" onSubmit={(event) => void handleUpdate(event)}>
              <h2>{t("profile.editFormTitle", { ns: "users" })}</h2>
              <label>
                {t("create.name", { ns: "users" })}
                <input
                  value={editForm.name}
                  onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                  required
                  minLength={2}
                />
              </label>
              <label>
                {t("create.email", { ns: "users" })}
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
                  required
                />
              </label>
              <label>
                {t("create.phone", { ns: "users" })}
                <input
                  value={editForm.phone}
                  onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })}
                />
              </label>
              <label>
                {t("profile.hireDateLabel", { ns: "users" })}
                <input
                  type="date"
                  value={editForm.hireDate}
                  onChange={(event) => setEditForm({ ...editForm, hireDate: event.target.value })}
                />
              </label>
              <label>
                {t("profile.specialtiesLabel", { ns: "users" })}
                <input
                  value={editForm.specialties}
                  onChange={(event) => setEditForm({ ...editForm, specialties: event.target.value })}
                  placeholder={t("profile.specialtiesPlaceholder", { ns: "users" })}
                />
              </label>
              <label>
                {t("profile.workDaysPerWeekLabel", { ns: "users" })}
                <input
                  type="number"
                  min="1"
                  max="7"
                  step="1"
                  value={editForm.workDaysPerWeek}
                  onChange={(event) => setEditForm({ ...editForm, workDaysPerWeek: event.target.value })}
                />
              </label>
              <label>
                {t("profile.workScheduleNoteLabel", { ns: "users" })}
                <textarea
                  value={editForm.workScheduleNote}
                  onChange={(event) => setEditForm({ ...editForm, workScheduleNote: event.target.value })}
                  placeholder={t("profile.workScheduleNotePlaceholder", { ns: "users" })}
                />
              </label>
              {editError && (
                <p className="form-error" role="alert">
                  {editError}
                </p>
              )}
              <div className="form-actions">
                <button type="submit" disabled={isSaving}>
                  {isSaving ? t("profile.saving", { ns: "users" }) : t("profile.saveSubmit", { ns: "users" })}
                </button>
                <button type="button" onClick={() => setIsEditOpen(false)}>
                  {t("actions.cancel", { ns: "common" })}
                </button>
              </div>
            </form>
          )}

          <section>
            <h2 className="section-label">{t("profile.generalSection", { ns: "users" })}</h2>
            <dl className="info-grid">
              <div>
                <dt>{t("create.email", { ns: "users" })}</dt>
                <dd>{profile.user.email}</dd>
              </div>
              <div>
                <dt>{t("create.phone", { ns: "users" })}</dt>
                <dd>{profile.user.phone ?? t("profile.notSpecified", { ns: "users" })}</dd>
              </div>
              <div>
                <dt>{t("profile.hireDateLabel", { ns: "users" })}</dt>
                <dd>
                  {profile.user.hireDate
                    ? new Date(profile.user.hireDate).toLocaleDateString()
                    : t("profile.notSpecified", { ns: "users" })}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="section-label">{t("profile.specialtiesSection", { ns: "users" })}</h2>
            {profile.user.specialties.length === 0 ? (
              <p>{t("profile.notSpecified", { ns: "users" })}</p>
            ) : (
              <ul className="tag-list">
                {profile.user.specialties.map((specialty) => (
                  <li key={specialty} className="tag">
                    {specialty}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="section-label">{t("profile.scheduleSection", { ns: "users" })}</h2>
            <dl className="info-grid">
              <div>
                <dt>{t("profile.workDaysPerWeekLabel", { ns: "users" })}</dt>
                <dd>{profile.user.workDaysPerWeek ?? t("profile.notSpecified", { ns: "users" })}</dd>
              </div>
              <div>
                <dt>{t("profile.workScheduleNoteLabel", { ns: "users" })}</dt>
                <dd>{profile.user.workScheduleNote ?? t("profile.notSpecified", { ns: "users" })}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="section-label">{t("profile.projectsSection", { ns: "users" })}</h2>
            {profile.projects.length === 0 ? (
              <p>{t("profile.noProjects", { ns: "users" })}</p>
            ) : (
              <ul className="card-list">
                {profile.projects.map((project) => (
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
            <h2 className="section-label">{t("profile.paySection", { ns: "users" })}</h2>
            <dl className="info-grid">
              {profile.user.hourlyRate !== undefined && (
                <div>
                  <dt>{t("create.hourlyRate", { ns: "users" })}</dt>
                  <dd>{formatHourlyRate(profile.user.hourlyRate) ?? t("list.hourlyRateNotSpecified", { ns: "users" })}</dd>
                </div>
              )}
              {profile.user.overtimeHourlyRate !== undefined && (
                <div>
                  <dt>{t("profile.overtimeRateLabel", { ns: "users" })}</dt>
                  <dd>
                    {formatHourlyRate(profile.user.overtimeHourlyRate) ??
                      t("list.hourlyRateNotSpecified", { ns: "users" })}
                  </dd>
                </div>
              )}
              <div>
                <dt>{t("profile.hoursThisMonthLabel", { ns: "users" })}</dt>
                <dd>{t("profile.hoursValue", { ns: "users", hours: profile.hoursThisMonth })}</dd>
              </div>
            </dl>
          </section>

          {isTopManager && (
            <section>
              <div className="page-header">
                <h2 className="section-label">{t("salary.historyTitle", { ns: "users" })}</h2>
                <button type="button" onClick={() => void toggleSalary()}>
                  {isSalaryOpen ? t("salary.hideButton", { ns: "users" }) : t("salary.showButton", { ns: "users" })}
                </button>
              </div>

              {isSalaryOpen && (
                <div className="salary-panel">
                  <div className="card-actions">
                    <button type="button" onClick={() => setIsRaiseFormOpen((open) => !open)}>
                      {t("salary.registerButton", { ns: "users" })}
                    </button>
                  </div>

                  {isRaiseFormOpen && (
                    <form className="inline-form" onSubmit={(event) => void handleRegisterRaise(event)}>
                      <h2>{t("salary.formTitle", { ns: "users" })}</h2>
                      <label>
                        {t("salary.newRateLabel", { ns: "users" })}
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={newRate}
                          onChange={(event) => setNewRate(event.target.value)}
                          required
                        />
                      </label>
                      <label>
                        {t("salary.newOvertimeRateLabel", { ns: "users" })}
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={newOvertimeRate}
                          onChange={(event) => setNewOvertimeRate(event.target.value)}
                          placeholder={t("salary.newOvertimeRatePlaceholder", { ns: "users" })}
                        />
                      </label>
                      <label>
                        {t("salary.reasonLabel", { ns: "users" })}
                        <textarea
                          value={raiseReason}
                          onChange={(event) => setRaiseReason(event.target.value)}
                          maxLength={500}
                        />
                      </label>
                      {raiseError && (
                        <p className="form-error" role="alert">
                          {raiseError}
                        </p>
                      )}
                      <div className="form-actions">
                        <button type="submit" disabled={isSubmittingRaise}>
                          {isSubmittingRaise ? t("salary.saving", { ns: "users" }) : t("salary.submit", { ns: "users" })}
                        </button>
                        <button type="button" onClick={() => setIsRaiseFormOpen(false)}>
                          {t("actions.cancel", { ns: "common" })}
                        </button>
                      </div>
                    </form>
                  )}

                  {isLoadingHistory && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

                  {!isLoadingHistory && historyError && (
                    <p className="form-error" role="alert">
                      {historyError}
                    </p>
                  )}

                  {!isLoadingHistory &&
                    !historyError &&
                    salaryHistory &&
                    (salaryHistory.length === 0 ? (
                      <p>{t("salary.historyEmpty", { ns: "users" })}</p>
                    ) : (
                      <ul className="card-list">
                        {salaryHistory.map((raise) => (
                          <li key={raise.id} className="card">
                            <div className="card-header">
                              <span className="card-title">
                                {t("salary.rateChange", {
                                  ns: "users",
                                  previous: formatHourlyRate(raise.previousRate) ?? "—",
                                  next: formatHourlyRate(raise.newRate),
                                })}
                              </span>
                              <span className="card-meta">{formatTimeAgo(raise.createdAt)}</span>
                            </div>
                            {raise.newOvertimeRate && (
                              <p className="card-meta">
                                {t("salary.overtimeRateChange", {
                                  ns: "users",
                                  previous: formatHourlyRate(raise.previousOvertimeRate) ?? "—",
                                  next: formatHourlyRate(raise.newOvertimeRate),
                                })}
                              </p>
                            )}
                            {raise.reason && <p className="card-description">{raise.reason}</p>}
                            <span className="card-meta">
                              {t("salary.registeredBy", { ns: "users", name: raise.createdBy.name })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ))}

                  <div className="page-header">
                    <h3>{t("adjustments.historyTitle", { ns: "users" })}</h3>
                    <button type="button" onClick={() => setIsAdjustmentFormOpen((open) => !open)}>
                      {t("adjustments.registerButton", { ns: "users" })}
                    </button>
                  </div>

                  {isAdjustmentFormOpen && (
                    <form className="inline-form" onSubmit={(event) => void handleAddAdjustment(event)}>
                      <h2>{t("adjustments.formTitle", { ns: "users" })}</h2>
                      <label>
                        {t("adjustments.typeLabel", { ns: "users" })}
                        <select
                          value={adjustmentType}
                          onChange={(event) => setAdjustmentType(event.target.value as SalaryAdjustmentType)}
                        >
                          <option value="ADELANTO">{t("adjustments.type.ADELANTO", { ns: "users" })}</option>
                          <option value="DESCUENTO">{t("adjustments.type.DESCUENTO", { ns: "users" })}</option>
                        </select>
                      </label>
                      <label>
                        {t("adjustments.amountLabel", { ns: "users" })}
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={adjustmentAmount}
                          onChange={(event) => setAdjustmentAmount(event.target.value)}
                          required
                        />
                      </label>
                      <label>
                        {t("adjustments.effectiveDateLabel", { ns: "users" })}
                        <input
                          type="date"
                          value={adjustmentEffectiveDate}
                          onChange={(event) => setAdjustmentEffectiveDate(event.target.value)}
                          required
                        />
                      </label>
                      <label>
                        {t("adjustments.reasonLabel", { ns: "users" })}
                        <textarea
                          value={adjustmentReason}
                          onChange={(event) => setAdjustmentReason(event.target.value)}
                          maxLength={500}
                          required
                          minLength={1}
                        />
                      </label>
                      {adjustmentError && (
                        <p className="form-error" role="alert">
                          {adjustmentError}
                        </p>
                      )}
                      <div className="form-actions">
                        <button type="submit" disabled={isSubmittingAdjustment}>
                          {isSubmittingAdjustment
                            ? t("adjustments.saving", { ns: "users" })
                            : t("adjustments.submit", { ns: "users" })}
                        </button>
                        <button type="button" onClick={() => setIsAdjustmentFormOpen(false)}>
                          {t("actions.cancel", { ns: "common" })}
                        </button>
                      </div>
                    </form>
                  )}

                  {isLoadingAdjustments && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

                  {!isLoadingAdjustments && adjustmentsError && (
                    <p className="form-error" role="alert">
                      {adjustmentsError}
                    </p>
                  )}

                  {!isLoadingAdjustments &&
                    !adjustmentsError &&
                    salaryAdjustments &&
                    (salaryAdjustments.length === 0 ? (
                      <p>{t("adjustments.historyEmpty", { ns: "users" })}</p>
                    ) : (
                      <ul className="card-list">
                        {salaryAdjustments.map((adjustment) => (
                          <li key={adjustment.id} className="card">
                            <div className="card-header">
                              <span className="card-title">
                                {t(`adjustments.type.${adjustment.type}`, { ns: "users" })} —{" "}
                                {formatCurrency(adjustment.amount)}
                              </span>
                              <span className="card-meta">
                                {new Date(adjustment.effectiveDate).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="card-description">{adjustment.reason}</p>
                            <span className="card-meta">
                              {t("salary.registeredBy", { ns: "users", name: adjustment.createdBy.name })}
                            </span>
                            <div className="card-actions">
                              <button
                                type="button"
                                className="danger-button"
                                onClick={() => setAdjustmentToDelete(adjustment)}
                              >
                                {t("actions.delete", { ns: "common" })}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ))}
                </div>
              )}
            </section>
          )}

          {isTopManager && (
            <section>
              <div className="page-header">
                <h2 className="section-label">{t("score.historyTitle", { ns: "users" })}</h2>
                <button type="button" onClick={() => void toggleScore()}>
                  {isScoreOpen ? t("score.hideButton", { ns: "users" }) : t("score.showButton", { ns: "users" })}
                </button>
              </div>

              {isScoreOpen && (
                <div className="salary-panel">
                  {isLoadingScore && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

                  {!isLoadingScore && scoreError && (
                    <p className="form-error" role="alert">
                      {scoreError}
                    </p>
                  )}

                  {!isLoadingScore && !scoreError && monthlyScore && (
                    <>
                      <p className="card-meta">
                        {t("score.currentScore", {
                          ns: "users",
                          month: String(monthlyScore.month).padStart(2, "0"),
                          year: monthlyScore.year,
                          score: monthlyScore.currentScore,
                          base: monthlyScore.baseScore,
                        })}
                      </p>

                      <div className="card-actions">
                        <button type="button" onClick={() => setIsScoreFormOpen((open) => !open)}>
                          {t("score.registerButton", { ns: "users" })}
                        </button>
                      </div>

                      {isScoreFormOpen && (
                        <form className="inline-form" onSubmit={(event) => void handleAddDiscount(event)}>
                          <h2>{t("score.formTitle", { ns: "users" })}</h2>
                          <label>
                            {t("score.pointsLabel", { ns: "users" })}
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={discountPoints}
                              onChange={(event) => setDiscountPoints(event.target.value)}
                              required
                            />
                          </label>
                          <label>
                            {t("score.reasonLabel", { ns: "users" })}
                            <textarea
                              value={discountReason}
                              onChange={(event) => setDiscountReason(event.target.value)}
                              maxLength={500}
                              required
                              minLength={1}
                            />
                          </label>
                          {scoreFormError && (
                            <p className="form-error" role="alert">
                              {scoreFormError}
                            </p>
                          )}
                          <div className="form-actions">
                            <button type="submit" disabled={isSubmittingScore}>
                              {isSubmittingScore ? t("score.saving", { ns: "users" }) : t("score.submit", { ns: "users" })}
                            </button>
                            <button type="button" onClick={() => setIsScoreFormOpen(false)}>
                              {t("actions.cancel", { ns: "common" })}
                            </button>
                          </div>
                        </form>
                      )}

                      <h3>{t("score.historyTitle", { ns: "users" })}</h3>

                      {monthlyScore.events.length === 0 ? (
                        <p>{t("score.historyEmpty", { ns: "users" })}</p>
                      ) : (
                        <ul className="card-list">
                          {monthlyScore.events.map((eventItem) => (
                            <li key={eventItem.id} className="card">
                              <div className="card-header">
                                <span className="card-title">
                                  {eventItem.points > 0 ? `+${eventItem.points}` : eventItem.points}
                                </span>
                                <span className="card-meta">{formatTimeAgo(eventItem.createdAt)}</span>
                              </div>
                              <p className="card-description">{eventItem.reason}</p>
                              <span className="card-meta">
                                {t("salary.registeredBy", { ns: "users", name: eventItem.createdBy.name })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          )}

          <section>
            <h2 className="section-label">{t("profile.documentsSection", { ns: "users" })}</h2>

            <form className="inline-form" onSubmit={(event) => void handleUploadDocument(event)}>
              <label>
                {t("profile.documentLabelLabel", { ns: "users" })}
                <input
                  value={docLabel}
                  onChange={(event) => setDocLabel(event.target.value)}
                  placeholder={t("profile.documentLabelPlaceholder", { ns: "users" })}
                  required
                  minLength={1}
                />
              </label>
              <label>
                {t("profile.documentFileLabel", { ns: "users" })}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(event) => setDocFile(event.target.files?.[0] ?? null)}
                  required
                />
              </label>
              {uploadDocError && (
                <p className="form-error" role="alert">
                  {uploadDocError}
                </p>
              )}
              <div className="form-actions">
                <button type="submit" disabled={isUploadingDoc}>
                  {isUploadingDoc
                    ? t("profile.documentUploading", { ns: "users" })
                    : t("profile.documentUploadButton", { ns: "users" })}
                </button>
              </div>
            </form>

            {isLoadingDocuments && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

            {!isLoadingDocuments && documentsError && (
              <p className="form-error" role="alert">
                {documentsError}
              </p>
            )}

            {!isLoadingDocuments &&
              !documentsError &&
              documents &&
              (documents.length === 0 ? (
                <p>{t("profile.documentsEmpty", { ns: "users" })}</p>
              ) : (
                <ul className="card-list">
                  {documents.map((document) => (
                    <WorkerDocumentCard
                      key={document.id}
                      document={document}
                      uploadedByText={t("profile.documentUploadedBy", { ns: "users", name: document.uploadedBy.name })}
                      canDelete={isTopManager || document.uploadedById === currentUser.id}
                      deleteLabel={t("actions.delete", { ns: "common" })}
                      onDelete={() => setDocToDelete(document)}
                    />
                  ))}
                </ul>
              ))}
          </section>
        </>
      )}

      {isDeactivateConfirmOpen && (
        <ConfirmDialog
          title={t("profile.deactivateTitle", { ns: "users" })}
          message={t("profile.deactivateMessage", { ns: "users", name: profile?.user.name ?? "" })}
          confirmLabel={t("profile.deactivateButton", { ns: "users" })}
          isConfirming={isDeactivating}
          error={deactivateError}
          onConfirm={() => void handleDeactivate()}
          onCancel={() => {
            setIsDeactivateConfirmOpen(false);
            setDeactivateError(null);
          }}
        />
      )}

      {isResetPasswordOpen && (
        <ConfirmDialog
          title={t("profile.resetPasswordTitle", { ns: "users" })}
          message={t("profile.resetPasswordMessage", { ns: "users", name: profile?.user.name ?? "" })}
          confirmLabel={
            isResettingPassword
              ? t("profile.resetPasswordSubmitting", { ns: "users" })
              : t("profile.resetPasswordSubmit", { ns: "users" })
          }
          isConfirming={isResettingPassword}
          error={resetPasswordError}
          onConfirm={() => void handleResetPassword()}
          onCancel={() => {
            setIsResetPasswordOpen(false);
            setResetPasswordValue("");
            setResetPasswordError(null);
          }}
        >
          <label>
            {t("profile.resetPasswordNewLabel", { ns: "users" })}
            <input
              type="password"
              value={resetPasswordValue}
              onChange={(event) => setResetPasswordValue(event.target.value)}
              minLength={8}
              required
              autoFocus
            />
          </label>
        </ConfirmDialog>
      )}

      {adjustmentToDelete && (
        <ConfirmDialog
          title={t("adjustments.deleteTitle", { ns: "users" })}
          message={t("adjustments.deleteMessage", {
            ns: "users",
            type: t(`adjustments.type.${adjustmentToDelete.type}`, { ns: "users" }),
            amount: formatCurrency(adjustmentToDelete.amount),
          })}
          confirmLabel={t("actions.delete", { ns: "common" })}
          isConfirming={isDeletingAdjustment}
          error={deleteAdjustmentError}
          onConfirm={() => void handleDeleteAdjustment()}
          onCancel={() => {
            setAdjustmentToDelete(null);
            setDeleteAdjustmentError(null);
          }}
        />
      )}

      {docToDelete && (
        <ConfirmDialog
          title={t("profile.documentDeleteTitle", { ns: "users" })}
          message={t("profile.documentDeleteMessage", { ns: "users", label: docToDelete.label })}
          confirmLabel={t("actions.delete", { ns: "common" })}
          isConfirming={isDeletingDoc}
          error={deleteDocError}
          onConfirm={() => void handleDeleteDocument()}
          onCancel={() => {
            setDocToDelete(null);
            setDeleteDocError(null);
          }}
        />
      )}
    </div>
  );
}
