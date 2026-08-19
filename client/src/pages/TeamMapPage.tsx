import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { TimeEntryCard } from "../components/TimeEntryCard";
import { WorkerHistoryPanel } from "../components/WorkerHistoryPanel";
import { useAuth } from "../context/AuthContext";
import { isManagerRole } from "../types/auth";
import type { TimeEntry, UserDaySummary } from "../types/timeEntry";
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

export function TeamMapPage() {
  const { t } = useTranslation(["teamMap", "activities", "common"]);
  const { user } = useAuth();

  const [workers, setWorkers] = useState<WorkerLocation[] | null>(null);
  const [locationsError, setLocationsError] = useState<string | null>(null);

  const [summary, setSummary] = useState<UserDaySummary[] | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [historyOpenUserId, setHistoryOpenUserId] = useState<string | null>(null);

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

  // Reemplaza la marcacion editada en el resumen de hoy ya cargado, en vez de
  // recargar todo (mismo patron que handleReviewed en EvidencesReviewPage).
  function handleTodayEntryUpdated(updated: TimeEntry) {
    setSummary((current) =>
      current?.map((userSummary) =>
        userSummary.user.id === updated.userId
          ? { ...userSummary, entries: userSummary.entries.map((e) => (e.id === updated.id ? updated : e)) }
          : userSummary,
      ) ?? null,
    );
  }

  function toggleHistory(userId: string) {
    setHistoryOpenUserId((current) => (current === userId ? null : userId));
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
                      <Link to={`/users/${worker.id}`} className="card-title">
                        {worker.name}
                      </Link>
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
                      <TimeEntryCard key={entry.id} entry={entry} onUpdated={handleTodayEntryUpdated} />
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

                  <div className="card-actions">
                    <button type="button" onClick={() => toggleHistory(userSummary.user.id)}>
                      {historyOpenUserId === userSummary.user.id
                        ? t("hours.hideHistoryButton", { ns: "teamMap" })
                        : t("hours.historyButton", { ns: "teamMap" })}
                    </button>
                  </div>

                  {historyOpenUserId === userSummary.user.id && (
                    <WorkerHistoryPanel userId={userSummary.user.id} />
                  )}
                </li>
              ))}
            </ul>
          ))}
      </section>
    </div>
  );
}
