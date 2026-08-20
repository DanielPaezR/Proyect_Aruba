import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Coffee, Wallet, Zap } from "lucide-react";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { formatCurrency } from "../utils/formatCurrency";
import { formatHoursFromMinutes } from "../utils/formatHours";
import type { PunchType, TodayTimeStatus } from "../types/timeEntry";

const BUTTON_CLASS: Record<PunchType, string> = {
  ENTRADA: "punch-button punch-button--in",
  ALMUERZO_INICIO: "punch-button punch-button--lunch",
  ALMUERZO_FIN: "punch-button punch-button--in",
  SALIDA: "punch-button punch-button--out",
};

export function MyHoursPage() {
  const { t } = useTranslation(["hours", "common"]);

  const [status, setStatus] = useState<TodayTimeStatus | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPunching, setIsPunching] = useState<PunchType | null>(null);
  const [punchError, setPunchError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const response = await apiClient.get<TodayTimeStatus>("/time-entries/today/mine");
      setStatus(response.data);
      setLoadError(null);
    } catch (error) {
      setStatus(null);
      setLoadError(translateApiError(t, error));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function handlePunch(type: PunchType) {
    setPunchError(null);
    setIsPunching(type);
    try {
      await apiClient.post("/time-entries", { type });
      await loadStatus();
    } catch (error) {
      setPunchError(translateApiError(t, error));
    } finally {
      setIsPunching(null);
    }
  }

  return (
    <div className="my-hours-page">
      <PageHeader title={t("title", { ns: "hours" })} />

      {status === undefined && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {status === null && loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}

      {status && (
        <>
          <div className="punch-panel">
            <div className="punch-buttons">
              {status.validNextTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={BUTTON_CLASS[type]}
                  onClick={() => void handlePunch(type)}
                  disabled={isPunching !== null}
                >
                  {isPunching === type ? t("punch.submitting", { ns: "hours" }) : t(`punch.${type}`, { ns: "hours" })}
                </button>
              ))}
            </div>
            {punchError && (
              <p className="form-error" role="alert">
                {punchError}
              </p>
            )}
          </div>

          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-card__icon stat-card__icon--neutral">
                <Clock size={20} aria-hidden="true" />
              </div>
              <span className="stat-card__label">{t("stats.workedToday", { ns: "hours" })}</span>
              <span className="stat-card__value">{formatHoursFromMinutes(status.workedMinutes)}</span>
            </div>
            <div className="stat-card">
              <div className="stat-card__icon stat-card__icon--alert">
                <Zap size={20} aria-hidden="true" />
              </div>
              <span className="stat-card__label">{t("stats.overtimeToday", { ns: "hours" })}</span>
              <span className="stat-card__value">{formatHoursFromMinutes(status.overtimeMinutes)}</span>
            </div>
            <div className="stat-card">
              <div className="stat-card__icon stat-card__icon--neutral">
                <Coffee size={20} aria-hidden="true" />
              </div>
              <span className="stat-card__label">{t("stats.lunchToday", { ns: "hours" })}</span>
              <span className="stat-card__value">{formatHoursFromMinutes(status.lunchMinutes)}</span>
            </div>
            {status.earningsEstimate !== null && (
              <div className="stat-card">
                <div className="stat-card__icon">
                  <Wallet size={20} aria-hidden="true" />
                </div>
                <span className="stat-card__label">{t("stats.earningsToday", { ns: "hours" })}</span>
                <span className="stat-card__value">{formatCurrency(status.earningsEstimate)}</span>
              </div>
            )}
          </div>

          {status.earningsEstimate !== null && <p className="hours-estimate-note">{t("stats.estimateNote", { ns: "hours" })}</p>}
        </>
      )}
    </div>
  );
}
