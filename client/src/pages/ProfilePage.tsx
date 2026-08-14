import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { useAuth } from "../context/AuthContext";

export function ProfilePage() {
  const { t } = useTranslation(["profile", "common"]);
  const { user, updateProfile } = useAuth();

  const [phone, setPhone] = useState(user?.phone ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
      await updateProfile({ phone, photo: photo ?? undefined });
      setPhoto(null);
      setPhotoPreview(null);
      setSaveSuccess(true);
    } catch (error) {
      setSaveError(translateApiError(t, error));
    } finally {
      setIsSaving(false);
    }
  }

  const displayedPhoto = photoPreview ?? user.photoUrl;

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>{t("title", { ns: "profile" })}</h1>
      </div>

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
    </div>
  );
}
