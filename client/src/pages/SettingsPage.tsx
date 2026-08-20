import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { isTopManagerRole } from "../types/auth";
import type { CompanySettings } from "../types/settings";

export function SettingsPage() {
  const { t } = useTranslation(["settings", "common"]);
  const { user } = useAuth();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [officeLatitude, setOfficeLatitude] = useState("");
  const [officeLongitude, setOfficeLongitude] = useState("");
  const [officeRadiusMeters, setOfficeRadiusMeters] = useState("125");
  const [morningWindowStart, setMorningWindowStart] = useState("06:30");
  const [morningWindowEnd, setMorningWindowEnd] = useState("07:30");
  const [afternoonWindowStart, setAfternoonWindowStart] = useState("16:30");
  const [afternoonWindowEnd, setAfternoonWindowEnd] = useState("18:00");

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [isLocating, setIsLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  async function loadSettings() {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await apiClient.get<{ settings: CompanySettings }>("/settings");
      const data = response.data.settings;
      setOfficeLatitude(data.officeLatitude !== null ? String(data.officeLatitude) : "");
      setOfficeLongitude(data.officeLongitude !== null ? String(data.officeLongitude) : "");
      setOfficeRadiusMeters(String(data.officeRadiusMeters));
      setMorningWindowStart(data.morningWindowStart);
      setMorningWindowEnd(data.morningWindowEnd);
      setAfternoonWindowStart(data.afternoonWindowStart);
      setAfternoonWindowEnd(data.afternoonWindowEnd);
    } catch (error) {
      setErrorMessage(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) {
    return null;
  }

  if (!isTopManagerRole(user.role)) {
    return <Navigate to="/" replace />;
  }

  function handleUseCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setLocateError(t("form.geolocationUnsupported", { ns: "settings" }));
      return;
    }
    setLocateError(null);
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOfficeLatitude(String(position.coords.latitude));
        setOfficeLongitude(String(position.coords.longitude));
        setIsLocating(false);
      },
      () => {
        setLocateError(t("form.geolocationDenied", { ns: "settings" }));
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);
    setIsSaving(true);
    try {
      const response = await apiClient.patch<{ settings: CompanySettings }>("/settings", {
        officeLatitude: officeLatitude === "" ? undefined : Number(officeLatitude),
        officeLongitude: officeLongitude === "" ? undefined : Number(officeLongitude),
        officeRadiusMeters: Number(officeRadiusMeters),
        morningWindowStart,
        morningWindowEnd,
        afternoonWindowStart,
        afternoonWindowEnd,
      });
      const data = response.data.settings;
      setOfficeLatitude(data.officeLatitude !== null ? String(data.officeLatitude) : "");
      setOfficeLongitude(data.officeLongitude !== null ? String(data.officeLongitude) : "");
      setSaveSuccess(true);
    } catch (error) {
      setSaveError(translateApiError(t, error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="settings-page">
      <PageHeader title={t("title", { ns: "settings" })} />

      {isLoading && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {!isLoading && errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}

      {!isLoading && !errorMessage && (
        <form className="inline-form" onSubmit={(event) => void handleSave(event)}>
          <fieldset>
            <legend>{t("form.locationSection", { ns: "settings" })}</legend>
            <p className="form-hint">{t("form.locationHint", { ns: "settings" })}</p>

            <button type="button" onClick={handleUseCurrentLocation} disabled={isLocating}>
              {isLocating ? t("form.locating", { ns: "settings" }) : t("form.useCurrentLocation", { ns: "settings" })}
            </button>
            {locateError && (
              <p className="form-error" role="alert">
                {locateError}
              </p>
            )}

            <label>
              {t("form.officeLatitude", { ns: "settings" })}
              <input
                type="number"
                step="any"
                min={-90}
                max={90}
                value={officeLatitude}
                onChange={(event) => setOfficeLatitude(event.target.value)}
                required
              />
            </label>
            <label>
              {t("form.officeLongitude", { ns: "settings" })}
              <input
                type="number"
                step="any"
                min={-180}
                max={180}
                value={officeLongitude}
                onChange={(event) => setOfficeLongitude(event.target.value)}
                required
              />
            </label>
            <label>
              {t("form.officeRadiusMeters", { ns: "settings" })}
              <input
                type="number"
                step={1}
                min={1}
                value={officeRadiusMeters}
                onChange={(event) => setOfficeRadiusMeters(event.target.value)}
                required
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>{t("form.windowsSection", { ns: "settings" })}</legend>
            <label>
              {t("form.morningWindowStart", { ns: "settings" })}
              <input
                type="time"
                value={morningWindowStart}
                onChange={(event) => setMorningWindowStart(event.target.value)}
                required
              />
            </label>
            <label>
              {t("form.morningWindowEnd", { ns: "settings" })}
              <input
                type="time"
                value={morningWindowEnd}
                onChange={(event) => setMorningWindowEnd(event.target.value)}
                required
              />
            </label>
            <label>
              {t("form.afternoonWindowStart", { ns: "settings" })}
              <input
                type="time"
                value={afternoonWindowStart}
                onChange={(event) => setAfternoonWindowStart(event.target.value)}
                required
              />
            </label>
            <label>
              {t("form.afternoonWindowEnd", { ns: "settings" })}
              <input
                type="time"
                value={afternoonWindowEnd}
                onChange={(event) => setAfternoonWindowEnd(event.target.value)}
                required
              />
            </label>
          </fieldset>

          {saveError && (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          )}
          {saveSuccess && !saveError && <p className="form-success">{t("form.saved", { ns: "settings" })}</p>}

          <div className="form-actions">
            <button type="submit" disabled={isSaving}>
              {isSaving ? t("form.saving", { ns: "settings" }) : t("form.save", { ns: "settings" })}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
