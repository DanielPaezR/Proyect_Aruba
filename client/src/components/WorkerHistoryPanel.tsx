import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { TimeEntryCard } from "./TimeEntryCard";
import type { TimeEntry } from "../types/timeEntry";

function localDateKey(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysAgoDateInputValue(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDateKey(d.toISOString());
}

/**
 * Aruba esta fija en UTC-4 (sin horario de verano) — mismo criterio que
 * arubaDayRangeUtc en el backend (server/src/utils/geo.ts), para que el
 * rango de dias calendario elegido en el date picker se traduzca a los
 * mismos limites UTC que usa el servidor.
 */
function arubaDayStartUtcIso(dateStr: string): string {
  return `${dateStr}T04:00:00.000Z`;
}

function arubaDayEndUtcIso(dateStr: string): string {
  const start = new Date(`${dateStr}T04:00:00.000Z`);
  const nextDayStart = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return new Date(nextDayStart.getTime() - 1).toISOString();
}

interface DayGroup {
  dateKey: string;
  entries: TimeEntry[];
}

/** Agrupa por dia (mas reciente primero); dentro de cada dia, orden
 * cronologico ascendente (ENTRADA antes que SALIDA), ya que el backend
 * devuelve todo en orden descendente global. */
function groupByDay(entries: TimeEntry[]): DayGroup[] {
  const groups = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const key = localDateKey(entry.timestamp);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }
  return Array.from(groups.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([dateKey, dayEntries]) => ({
      dateKey,
      entries: [...dayEntries].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      ),
    }));
}

function formatDayHeading(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

interface WorkerHistoryPanelProps {
  userId: string;
}

/** Historico completo de marcaciones de un trabajador (no solo hoy), con
 * selector de rango de fechas — por defecto ultimos 7 dias. Reusa
 * TimeEntryCard para cada marcacion, mismo form de edicion auditada que
 * "Horas de hoy". */
export function WorkerHistoryPanel({ userId }: WorkerHistoryPanelProps) {
  const { t } = useTranslation(["teamMap", "common"]);

  const [from, setFrom] = useState(() => daysAgoDateInputValue(6));
  const [to, setTo] = useState(() => daysAgoDateInputValue(0));
  const [entries, setEntries] = useState<TimeEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadHistory(fromValue: string, toValue: string) {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{ timeEntries: TimeEntry[] }>("/time-entries", {
        params: { userId, from: arubaDayStartUtcIso(fromValue), to: arubaDayEndUtcIso(toValue) },
      });
      setEntries(response.data.timeEntries);
    } catch (err) {
      setError(translateApiError(t, err));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadHistory(from, to);
  }

  function handleEntryUpdated(updated: TimeEntry) {
    setEntries((current) => current?.map((entry) => (entry.id === updated.id ? updated : entry)) ?? null);
  }

  const dayGroups = entries ? groupByDay(entries) : [];

  return (
    <div className="worker-history-panel">
      <form className="worker-history-range" onSubmit={handleSearch}>
        <label>
          {t("hours.historyFromLabel", { ns: "teamMap" })}
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} required />
        </label>
        <label>
          {t("hours.historyToLabel", { ns: "teamMap" })}
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} required />
        </label>
        <button type="submit" disabled={isLoading}>
          {t("hours.historySearch", { ns: "teamMap" })}
        </button>
      </form>

      {isLoading && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {!isLoading && error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {!isLoading &&
        !error &&
        entries &&
        (dayGroups.length === 0 ? (
          <p>{t("hours.historyEmpty", { ns: "teamMap" })}</p>
        ) : (
          <div className="worker-history-days">
            {dayGroups.map((group) => (
              <div key={group.dateKey} className="worker-history-day">
                <h3>{formatDayHeading(group.dateKey)}</h3>
                <div className="team-hours-entries">
                  {group.entries.map((entry) => (
                    <TimeEntryCard key={entry.id} entry={entry} onUpdated={handleEntryUpdated} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
