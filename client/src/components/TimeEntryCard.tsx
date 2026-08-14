import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import type { TimeEntry } from "../types/timeEntry";

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface TimeEntryCardProps {
  entry: TimeEntry;
  onUpdated: (entry: TimeEntry) => void;
}

/** Una marcacion (ENTRADA/SALIDA) con su boton de edicion — usado tanto en
 * "Horas de hoy" como en el historial completo, para no duplicar el form de
 * edicion auditada (hora nueva + motivo) en dos lugares. */
export function TimeEntryCard({ entry, onUpdated }: TimeEntryCardProps) {
  const { t } = useTranslation(["teamMap", "activities", "common"]);

  const [isEditing, setIsEditing] = useState(false);
  const [timestamp, setTimestamp] = useState("");
  const [editReason, setEditReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function openEdit() {
    setSaveError(null);
    setTimestamp(toDatetimeLocalValue(entry.timestamp));
    setEditReason("");
    setIsEditing(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setIsSaving(true);
    try {
      const response = await apiClient.patch<{ timeEntry: TimeEntry }>(`/time-entries/${entry.id}`, {
        timestamp: new Date(timestamp).toISOString(),
        editReason: editReason || undefined,
      });
      onUpdated(response.data.timeEntry);
      setIsEditing(false);
    } catch (error) {
      setSaveError(translateApiError(t, error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="team-hours-entry">
        <span>
          {t(`mine.entryType.${entry.type}`, { ns: "activities" })} —{" "}
          {new Date(entry.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </span>
        <span className={entry.source === "AUTO_GEOFENCE" ? "status-badge status-badge--auto" : "status-badge"}>
          {entry.source === "AUTO_GEOFENCE"
            ? t("mine.autoBadge", { ns: "activities" })
            : t("mine.manualBadge", { ns: "activities" })}
        </span>
        {entry.editedBy && (
          <span className="status-badge">
            {entry.editReason
              ? t("hours.editedBadge", { ns: "teamMap", name: entry.editedBy.name, reason: entry.editReason })
              : t("hours.editedBadgeNoReason", { ns: "teamMap", name: entry.editedBy.name })}
          </span>
        )}
        <button type="button" onClick={openEdit}>
          {t("hours.editButton", { ns: "teamMap" })}
        </button>
      </div>

      {isEditing && (
        <form className="inline-form" onSubmit={(event) => void handleSave(event)}>
          <h2>{t("hours.editFormTitle", { ns: "teamMap" })}</h2>
          <label>
            {t("hours.newTimestamp", { ns: "teamMap" })}
            <input
              type="datetime-local"
              value={timestamp}
              onChange={(event) => setTimestamp(event.target.value)}
              required
            />
          </label>
          <label>
            {t("hours.reasonLabel", { ns: "teamMap" })}
            <input type="text" value={editReason} onChange={(event) => setEditReason(event.target.value)} />
          </label>
          {saveError && (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" disabled={isSaving}>
              {isSaving ? t("hours.saving", { ns: "teamMap" }) : t("hours.save", { ns: "teamMap" })}
            </button>
            <button type="button" onClick={() => setIsEditing(false)}>
              {t("actions.cancel", { ns: "common" })}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
