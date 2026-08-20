import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import type { WorkerDocument } from "../types/workerDocument";

export function ProfilePage() {
  const { t } = useTranslation(["profile", "common"]);
  const { user, updateProfile, updateMe } = useAuth();

  const [phone, setPhone] = useState(user?.phone ?? "");
  const [specialties, setSpecialties] = useState(user?.specialties.join(", ") ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [documents, setDocuments] = useState<WorkerDocument[] | null>(null);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [docLabel, setDocLabel] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<WorkerDocument | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);
  const [deleteDocError, setDeleteDocError] = useState<string | null>(null);

  async function loadDocuments(userId: string) {
    setIsLoadingDocuments(true);
    setDocumentsError(null);
    try {
      const response = await apiClient.get<{ documents: WorkerDocument[] }>(`/auth/users/${userId}/documents`);
      setDocuments(response.data.documents);
    } catch (error) {
      setDocumentsError(translateApiError(t, error));
    } finally {
      setIsLoadingDocuments(false);
    }
  }

  useEffect(() => {
    if (user) {
      void loadDocuments(user.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) {
    return null;
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);
    setIsSaving(true);
    try {
      if (photo) {
        await updateProfile({ photo });
      }
      await updateMe({
        phone,
        specialties: specialties
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      });
      setPhoto(null);
      setPhotoPreview(null);
      setSaveSuccess(true);
    } catch (error) {
      setSaveError(translateApiError(t, error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!docFile || !user) {
      return;
    }
    setUploadError(null);
    setIsUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append("label", docLabel);
      formData.append("file", docFile);
      await apiClient.post(`/auth/users/${user.id}/documents`, formData);
      setDocLabel("");
      setDocFile(null);
      await loadDocuments(user.id);
    } catch (error) {
      setUploadError(translateApiError(t, error));
    } finally {
      setIsUploadingDoc(false);
    }
  }

  async function handleDeleteDocument() {
    if (!docToDelete || !user) {
      return;
    }
    setDeleteDocError(null);
    setIsDeletingDoc(true);
    try {
      await apiClient.delete(`/auth/users/${user.id}/documents/${docToDelete.id}`);
      setDocToDelete(null);
      await loadDocuments(user.id);
    } catch (error) {
      setDeleteDocError(translateApiError(t, error));
    } finally {
      setIsDeletingDoc(false);
    }
  }

  const displayedPhoto = photoPreview ?? user.photoUrl;

  return (
    <div className="profile-page">
      <PageHeader title={t("title", { ns: "profile" })} />

      <form className="inline-form" onSubmit={(event) => void handleSave(event)}>
        <div className="profile-photo-row">
          {displayedPhoto ? (
            <img src={displayedPhoto} alt="" className="profile-photo-preview" />
          ) : (
            <div className="profile-photo-placeholder">{user.name.charAt(0).toUpperCase()}</div>
          )}
          <label>
            {t("photoLabel", { ns: "profile" })}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} />
          </label>
        </div>

        <dl className="info-grid">
          <div>
            <dt>{t("nameLabel", { ns: "profile" })}</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>{t("emailLabel", { ns: "profile" })}</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>{t("roleLabel", { ns: "profile" })}</dt>
            <dd>{t(`roles.${user.role}`, { ns: "common" })}</dd>
          </div>
        </dl>
        <p className="form-hint">{t("readOnlyHint", { ns: "profile" })}</p>

        <label>
          {t("phoneLabel", { ns: "profile" })}
          <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>

        <label>
          {t("specialtiesLabel", { ns: "profile" })}
          <input
            value={specialties}
            onChange={(event) => setSpecialties(event.target.value)}
            placeholder={t("specialtiesPlaceholder", { ns: "profile" })}
          />
        </label>

        {saveError && (
          <p className="form-error" role="alert">
            {saveError}
          </p>
        )}
        {saveSuccess && !saveError && <p className="form-success">{t("saved", { ns: "profile" })}</p>}

        <div className="form-actions">
          <button type="submit" disabled={isSaving}>
            {isSaving ? t("saving", { ns: "profile" }) : t("save", { ns: "profile" })}
          </button>
        </div>
      </form>

      <section>
        <h2 className="section-label">{t("documentsSection", { ns: "profile" })}</h2>

        <form className="inline-form" onSubmit={(event) => void handleUploadDocument(event)}>
          <label>
            {t("documentLabelLabel", { ns: "profile" })}
            <input
              value={docLabel}
              onChange={(event) => setDocLabel(event.target.value)}
              placeholder={t("documentLabelPlaceholder", { ns: "profile" })}
              required
              minLength={1}
            />
          </label>
          <label>
            {t("documentFileLabel", { ns: "profile" })}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(event) => setDocFile(event.target.files?.[0] ?? null)}
              required
            />
          </label>
          {uploadError && (
            <p className="form-error" role="alert">
              {uploadError}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" disabled={isUploadingDoc}>
              {isUploadingDoc ? t("documentUploading", { ns: "profile" }) : t("documentUploadButton", { ns: "profile" })}
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
            <p>{t("documentsEmpty", { ns: "profile" })}</p>
          ) : (
            <ul className="card-list">
              {documents.map((document) => (
                <li key={document.id} className="card">
                  <div className="card-header">
                    <a href={document.fileUrl} target="_blank" rel="noreferrer" className="card-title">
                      {document.label}
                    </a>
                  </div>
                  <span className="card-meta">
                    {t("documentUploadedBy", { ns: "profile", name: document.uploadedBy.name })}
                  </span>
                  {document.uploadedById === user.id && (
                    <div className="card-actions">
                      <button type="button" className="danger-button" onClick={() => setDocToDelete(document)}>
                        {t("actions.delete", { ns: "common" })}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ))}
      </section>

      {docToDelete && (
        <ConfirmDialog
          title={t("documentDeleteTitle", { ns: "profile" })}
          message={t("documentDeleteMessage", { ns: "profile", label: docToDelete.label })}
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
