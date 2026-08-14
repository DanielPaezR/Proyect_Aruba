import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import type { User } from "../types/auth";
import type { ActivityAssignment } from "../types/activity";

interface AssignWorkersPanelProps {
  activityId: string;
  currentAssignments: ActivityAssignment[];
  /** Refresca los datos del proyecto en el padre (siempre, haya o no error). */
  onSaved: () => Promise<void>;
  /** Cierra el panel — solo se llama cuando el guardado termino sin errores. */
  onClose: () => void;
}

/**
 * Selector de trabajadores con checkboxes para una actividad. No hay
 * endpoint de "reemplazar todo" — al guardar se compara el set elegido
 * contra el actual y se manda un POST por cada nuevo y un DELETE por cada
 * quitado (en paralelo).
 */
export function AssignWorkersPanel({ activityId, currentAssignments, onSaved, onClose }: AssignWorkersPanelProps) {
  const { t } = useTranslation(["activities", "common"]);

  const [workers, setWorkers] = useState<User[] | null>(null);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    () => new Set(currentAssignments.map((assignment) => assignment.userId)),
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkers() {
      setIsLoadingWorkers(true);
      setLoadError(null);
      try {
        const response = await apiClient.get<{ users: User[] }>("/auth/users");
        if (!cancelled) {
          setWorkers(response.data.users.filter((u) => u.role === "TRABAJADOR_CAMPO" && u.isActive));
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(translateApiError(t, error));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingWorkers(false);
        }
      }
    }

    void loadWorkers();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleWorker(userId: string) {
    setSelectedUserIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setIsSaving(true);

    const currentUserIds = new Set(currentAssignments.map((assignment) => assignment.userId));
    const toAdd = [...selectedUserIds].filter((id) => !currentUserIds.has(id));
    const toRemove = [...currentUserIds].filter((id) => !selectedUserIds.has(id));

    try {
      await Promise.all([
        ...toAdd.map((userId) => apiClient.post(`/activities/${activityId}/assignments`, { userId })),
        ...toRemove.map((userId) => apiClient.delete(`/activities/${activityId}/assignments/${userId}`)),
      ]);
      await onSaved();
      onClose();
    } catch (error) {
      setSaveError(translateApiError(t, error));
      // Refresca igual: algunas de las llamadas en paralelo pueden haber
      // aplicado antes de que otra fallara — el panel se queda abierto para
      // que el manager vea el estado real y pueda reintentar solo lo que falto.
      await onSaved();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={(event) => void handleSave(event)}>
      <h2>{t("assign.title", { ns: "activities" })}</h2>

      {isLoadingWorkers && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {!isLoadingWorkers && loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}

      {!isLoadingWorkers &&
        !loadError &&
        workers &&
        (workers.length === 0 ? (
          <p>{t("assign.noWorkers", { ns: "activities" })}</p>
        ) : (
          <ul className="assign-workers-list">
            {workers.map((worker) => (
              <li key={worker.id}>
                <label className="assign-workers-option">
                  <input
                    type="checkbox"
                    checked={selectedUserIds.has(worker.id)}
                    onChange={() => toggleWorker(worker.id)}
                  />
                  {worker.name}
                </label>
              </li>
            ))}
          </ul>
        ))}

      {saveError && (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" disabled={isSaving || isLoadingWorkers}>
          {isSaving ? t("assign.saving", { ns: "activities" }) : t("assign.save", { ns: "activities" })}
        </button>
        <button type="button" onClick={onClose} disabled={isSaving}>
          {t("actions.cancel", { ns: "common" })}
        </button>
      </div>
    </form>
  );
}
