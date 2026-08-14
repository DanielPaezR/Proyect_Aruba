import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { isManagerRole } from "../types/auth";
import type { UserDaySummary } from "../types/timeEntry";
import type { WorkerLocation } from "../types/team";
import { formatHoursFromMinutes } from "../utils/formatHours";
import { timeAgo } from "../utils/timeAgo";

// Vite no resuelve las rutas relativas por defecto de Leaflet a los iconos
// dentro de node_modules; hay que apuntarlas a mano o el pin no se ve.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface LocatedWorker extends WorkerLocation {
  lastKnownLatitude: number;
  lastKnownLongitude: number;
  lastLocationAt: string;
}

function hasLocation(worker: WorkerLocation): worker is LocatedWorker {
  return worker.lastKnownLatitude !== null && worker.lastKnownLongitude !== null && worker.lastLocationAt !== null;
}

const CONNECTED_THRESHOLD_MINUTES = 20;

/** "Conectado" = reporto ubicacion en los ultimos 20 minutos. Sin ubicacion
 * nunca reportada (lastLocationAt null) cuenta como desconectado. */
function isConnected(worker: WorkerLocation): boolean {
  if (!worker.lastLocationAt) {
    return false;
  }
  const diffMinutes = (Date.now() - new Date(worker.lastLocationAt).getTime()) / 60000;
  return diffMinutes <= CONNECTED_THRESHOLD_MINUTES;
}

/** Conectados primero; dentro de cada grupo, el reporte mas reciente primero
 * y los que nunca reportaron ubicacion al final. */
function sortWorkersByStatus(workers: WorkerLocation[]): WorkerLocation[] {
  return [...workers].sort((a, b) => {
    const aConnected = isConnected(a);
    const bConnected = isConnected(b);
    if (aConnected !== bConnected) {
      return aConnected ? -1 : 1;
    }
    if (!a.lastLocationAt && !b.lastLocationAt) {
      return 0;
    }
    if (!a.lastLocationAt) {
      return 1;
    }
    if (!b.lastLocationAt) {
      return -1;
    }
    return new Date(b.lastLocationAt).getTime() - new Date(a.lastLocationAt).getTime();
  });
}

function TeamMap({ workers }: { workers: WorkerLocation[] }) {
  const { t } = useTranslation(["teamMap"]);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const locatedWorkers = workers.filter(hasLocation);

  useEffect(() => {
    if (!mapContainerRef.current || locatedWorkers.length === 0) {
      return;
    }

    const map = L.map(mapContainerRef.current);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const markers = locatedWorkers.map((worker) => {
      const ago = timeAgo(worker.lastLocationAt);
      const marker = L.marker([worker.lastKnownLatitude, worker.lastKnownLongitude]).addTo(map);
      marker.bindPopup(
        `<strong>${worker.name}</strong><br />${t("map.updatedLabel")}: ${
          ago.count === 0 ? t("map.justNow") : t(`map.${ago.unit}Ago`, { count: ago.count })
        }`,
      );
      return marker;
    });

    if (markers.length === 1) {
      map.setView(markers[0].getLatLng(), 15);
    } else {
      map.fitBounds(L.featureGroup(markers).getBounds().pad(0.2));
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locatedWorkers]);

  if (locatedWorkers.length === 0) {
    return <p>{t("map.empty")}</p>;
  }

  return <div ref={mapContainerRef} className="team-map" />;
}

interface EditFormState {
  entryId: string;
  timestamp: string;
  editReason: string;
}

export function TeamMapPage() {
  const { t } = useTranslation(["teamMap", "activities", "common"]);
  const { user } = useAuth();

  const [workers, setWorkers] = useState<WorkerLocation[] | null>(null);
  const [locationsError, setLocationsError] = useState<string | null>(null);

  const [summary, setSummary] = useState<UserDaySummary[] | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function loadAll() {
    setIsLoading(true);
    setLocationsError(null);
    setSummaryError(null);
    try {
      const [locationsResponse, summaryResponse] = await Promise.all([
        apiClient.get<{ workers: WorkerLocation[] }>("/users/locations"),
        apiClient.get<{ summary: UserDaySummary[] }>("/time-entries/summary"),
      ]);
      setWorkers(locationsResponse.data.workers);
      setSummary(summaryResponse.data.summary);
    } catch (error) {
      setLocationsError(translateApiError(t, error));
      setSummaryError(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) {
    return null;
  }
  if (!isManagerRole(user.role)) {
    return <Navigate to="/" replace />;
  }

  function openEditForm(entryId: string, currentTimestamp: string) {
    setSaveError(null);
    setEditForm({ entryId, timestamp: toDatetimeLocalValue(currentTimestamp), editReason: "" });
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editForm) {
      return;
    }
    setSaveError(null);
    setIsSaving(true);
    try {
      await apiClient.patch(`/time-entries/${editForm.entryId}`, {
        timestamp: new Date(editForm.timestamp).toISOString(),
        editReason: editForm.editReason || undefined,
      });
      setEditForm(null);
      await loadAll();
    } catch (error) {
      setSaveError(translateApiError(t, error));
    } finally {
      setIsSaving(false);
    }
  }

  function formatTimeAgoLabel(isoTimestamp: string): string {
    const ago = timeAgo(isoTimestamp);
    return ago.count === 0
      ? t("map.justNow", { ns: "teamMap" })
      : t(`map.${ago.unit}Ago`, { ns: "teamMap", count: ago.count });
  }

  return (
    <div className="team-map-page">
      <div className="page-header">
        <h1>{t("title", { ns: "teamMap" })}</h1>
      </div>

      <p className="form-hint">{t("disclaimer", { ns: "teamMap" })}</p>

      {isLoading && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {!isLoading && locationsError && (
        <p className="form-error" role="alert">
          {locationsError}
        </p>
      )}
      {!isLoading && !locationsError && workers && <TeamMap workers={workers} />}

      <section className="team-worker-status">
        <h2 className="section-label">{t("workerStatus.title", { ns: "teamMap" })}</h2>

        {!isLoading &&
          !locationsError &&
          workers &&
          (workers.length === 0 ? (
            <p>{t("workerStatus.empty", { ns: "teamMap" })}</p>
          ) : (
            <ul className="card-list">
              {sortWorkersByStatus(workers).map((worker) => {
                const connected = isConnected(worker);
                return (
                  <li key={worker.id} className="card">
                    <div className="card-header">
                      <span className="card-title">{worker.name}</span>
                      <span className={connected ? "status-badge" : "status-badge status-badge--muted"}>
                        {connected
                          ? t("workerStatus.connected", { ns: "teamMap" })
                          : t("workerStatus.disconnected", { ns: "teamMap" })}
                      </span>
                    </div>
                    <span className="card-meta">
                      {worker.lastLocationAt
                        ? t("workerStatus.sinceLabel", {
                            ns: "teamMap",
                            time: formatTimeAgoLabel(worker.lastLocationAt),
                          })
                        : t("workerStatus.noLocation", { ns: "teamMap" })}
                    </span>
                  </li>
                );
              })}
            </ul>
          ))}
      </section>

      <section className="team-hours">
        <h2 className="section-label">{t("hours.title", { ns: "teamMap" })}</h2>

        {!isLoading && summaryError && (
          <p className="form-error" role="alert">
            {summaryError}
          </p>
        )}

        {!isLoading &&
          !summaryError &&
          summary &&
          (summary.length === 0 ? (
            <p>{t("hours.empty", { ns: "teamMap" })}</p>
          ) : (
            <ul className="card-list">
              {summary.map((userSummary) => (
                <li key={userSummary.user.id} className="card">
                  <div className="card-header">
                    <span className="card-title">{userSummary.user.name}</span>
                    <span className="card-meta">
                      {t("hours.totalLabel", { ns: "teamMap" })}: {formatHoursFromMinutes(userSummary.totalMinutes)}
                      {userSummary.hasOpenEntry && ` · ${t("hours.openLabel", { ns: "teamMap" })}`}
                    </span>
                  </div>

                  <div className="team-hours-entries">
                    {userSummary.entries.map((entry) => (
                      <div key={entry.id} className="team-hours-entry">
                        <span>
                          {t(`mine.entryType.${entry.type}`, { ns: "activities" })} —{" "}
                          {new Date(entry.timestamp).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span
                          className={
                            entry.source === "AUTO_GEOFENCE" ? "status-badge status-badge--auto" : "status-badge"
                          }
                        >
                          {entry.source === "AUTO_GEOFENCE"
                            ? t("mine.autoBadge", { ns: "activities" })
                            : t("mine.manualBadge", { ns: "activities" })}
                        </span>
                        {entry.editedBy && (
                          <span className="status-badge">
                            {entry.editReason
                              ? t("hours.editedBadge", {
                                  ns: "teamMap",
                                  name: entry.editedBy.name,
                                  reason: entry.editReason,
                                })
                              : t("hours.editedBadgeNoReason", { ns: "teamMap", name: entry.editedBy.name })}
                          </span>
                        )}
                        <button type="button" onClick={() => openEditForm(entry.id, entry.timestamp)}>
                          {t("hours.editButton", { ns: "teamMap" })}
                        </button>
                      </div>
                    ))}
                  </div>

                  {userSummary.unmatchedProximityLogs.length > 0 && (
                    <ul className="proximity-reference-list">
                      {userSummary.unmatchedProximityLogs.map((log) => (
                        <li key={log.id} className="proximity-reference">
                          {t("hours.proximityReference", {
                            ns: "teamMap",
                            time: new Date(log.detectedAt).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            }),
                          })}
                        </li>
                      ))}
                    </ul>
                  )}

                  {editForm && userSummary.entries.some((e) => e.id === editForm.entryId) && (
                    <form className="inline-form" onSubmit={(event) => void handleSaveEdit(event)}>
                      <h2>{t("hours.editFormTitle", { ns: "teamMap" })}</h2>
                      <label>
                        {t("hours.newTimestamp", { ns: "teamMap" })}
                        <input
                          type="datetime-local"
                          value={editForm.timestamp}
                          onChange={(event) => setEditForm({ ...editForm, timestamp: event.target.value })}
                          required
                        />
                      </label>
                      <label>
                        {t("hours.reasonLabel", { ns: "teamMap" })}
                        <input
                          type="text"
                          value={editForm.editReason}
                          onChange={(event) => setEditForm({ ...editForm, editReason: event.target.value })}
                        />
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
                        <button type="button" onClick={() => setEditForm(null)}>
                          {t("actions.cancel", { ns: "common" })}
                        </button>
                      </div>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          ))}
      </section>
    </div>
  );
}
