import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Hammer, Users } from "lucide-react";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useAuth } from "../context/AuthContext";
import { isManagerRole, isTopManagerRole } from "../types/auth";
import { AGENDA_EVENT_TYPES } from "../types/agenda";
import type { AgendaEvent, AgendaEventType, ScheduledActivity } from "../types/agenda";

type Period = "week" | "month";

interface EventFormState {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  type: AgendaEventType;
}

const EMPTY_FORM: EventFormState = {
  title: "",
  description: "",
  startAt: "",
  endAt: "",
  type: "REUNION",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Formato que espera <input type="datetime-local">, en hora local (no UTC). */
function toLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  // Semana de lunes a domingo.
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getRange(period: Period, refDate: Date): { from: Date; to: Date } {
  if (period === "week") {
    const from = startOfWeek(refDate);
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6, 23, 59, 59, 999);
    return { from, to };
  }
  const from = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const to = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

type AgendaEntry =
  | { kind: "event"; sortAt: Date; event: AgendaEvent }
  | { kind: "activity"; sortAt: Date; activity: ScheduledActivity };

export function AgendaPage() {
  const { t } = useTranslation(["agenda", "common"]);
  const { user } = useAuth();

  const [period, setPeriod] = useState<Period>("week");
  const [refDate, setRefDate] = useState(() => new Date());

  const [events, setEvents] = useState<AgendaEvent[] | null>(null);
  const [activities, setActivities] = useState<ScheduledActivity[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [form, setForm] = useState<EventFormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [eventToDelete, setEventToDelete] = useState<AgendaEvent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { from, to } = useMemo(() => getRange(period, refDate), [period, refDate]);

  async function loadAgenda() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const params = { from: from.toISOString(), to: to.toISOString() };
      const [eventsResponse, activitiesResponse] = await Promise.all([
        apiClient.get<{ events: AgendaEvent[] }>("/agenda-events", { params }),
        apiClient.get<{ activities: ScheduledActivity[] }>("/activities/scheduled", { params }),
      ]);
      setEvents(eventsResponse.data.events);
      setActivities(activitiesResponse.data.activities);
    } catch (error) {
      setLoadError(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAgenda();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from.getTime(), to.getTime()]);

  function goToPrevious() {
    setRefDate((current) =>
      period === "week" ? addDays(current, -7) : new Date(current.getFullYear(), current.getMonth() - 1, 1),
    );
  }

  function goToNext() {
    setRefDate((current) =>
      period === "week" ? addDays(current, 7) : new Date(current.getFullYear(), current.getMonth() + 1, 1),
    );
  }

  function goToToday() {
    setRefDate(new Date());
  }

  function canEditEvent(event: AgendaEvent): boolean {
    return Boolean(user && (isTopManagerRole(user.role) || event.createdById === user.id));
  }

  function openCreateForm() {
    setEditingEventId(null);
    setForm({ ...EMPTY_FORM, startAt: toLocalInputValue(new Date()) });
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEditForm(event: AgendaEvent) {
    setEditingEventId(event.id);
    setForm({
      title: event.title,
      description: event.description ?? "",
      startAt: toLocalInputValue(new Date(event.startAt)),
      endAt: event.endAt ? toLocalInputValue(new Date(event.endAt)) : "",
      type: event.type,
    });
    setFormError(null);
    setIsFormOpen(true);
  }

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        startAt: new Date(form.startAt).toISOString(),
        endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
        type: form.type,
      };
      if (editingEventId) {
        await apiClient.patch(`/agenda-events/${editingEventId}`, payload);
      } else {
        await apiClient.post("/agenda-events", payload);
      }
      setIsFormOpen(false);
      await loadAgenda();
    } catch (error) {
      setFormError(translateApiError(t, error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!eventToDelete) {
      return;
    }
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await apiClient.delete(`/agenda-events/${eventToDelete.id}`);
      setEventToDelete(null);
      await loadAgenda();
    } catch (error) {
      setDeleteError(translateApiError(t, error));
    } finally {
      setIsDeleting(false);
    }
  }

  const groupedByDay = useMemo(() => {
    const entries: AgendaEntry[] = [
      ...(events ?? []).map((event) => ({ kind: "event" as const, sortAt: new Date(event.startAt), event })),
      ...(activities ?? []).map((activity) => ({
        kind: "activity" as const,
        sortAt: new Date(activity.scheduledDate),
        activity,
      })),
    ];

    const groups = new Map<string, AgendaEntry[]>();
    for (const entry of entries) {
      const key = dayKey(entry.sortAt);
      const list = groups.get(key) ?? [];
      list.push(entry);
      groups.set(key, list);
    }

    for (const list of groups.values()) {
      list.sort((a, b) => a.sortAt.getTime() - b.sortAt.getTime());
    }

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [events, activities]);

  if (!user) {
    return null;
  }

  if (!isManagerRole(user.role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="agenda-page">
      <div className="page-header">
        <h1>{t("title", { ns: "agenda" })}</h1>
        <button type="button" onClick={openCreateForm}>
          {t("createButton", { ns: "agenda" })}
        </button>
      </div>

      <p className="agenda-shared-note">{t("sharedNote", { ns: "agenda" })}</p>

      <div className="agenda-controls">
        <div className="agenda-period-selector">
          <button
            type="button"
            className={period === "week" ? "active" : undefined}
            onClick={() => setPeriod("week")}
          >
            {t("period.week", { ns: "agenda" })}
          </button>
          <button
            type="button"
            className={period === "month" ? "active" : undefined}
            onClick={() => setPeriod("month")}
          >
            {t("period.month", { ns: "agenda" })}
          </button>
        </div>

        <div className="agenda-nav">
          <button type="button" onClick={goToPrevious} aria-label={t("nav.previous", { ns: "agenda" })}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button type="button" onClick={goToToday}>
            {t("nav.today", { ns: "agenda" })}
          </button>
          <button type="button" onClick={goToNext} aria-label={t("nav.next", { ns: "agenda" })}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>

        <span className="agenda-range-label">
          {from.toLocaleDateString()} — {to.toLocaleDateString()}
        </span>
      </div>

      {isFormOpen && (
        <form className="inline-form" onSubmit={(event) => void handleSubmit(event)}>
          <h2>{editingEventId ? t("editFormTitle", { ns: "agenda" }) : t("createFormTitle", { ns: "agenda" })}</h2>
          <label>
            {t("form.titleLabel", { ns: "agenda" })}
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              required
              minLength={1}
            />
          </label>
          <label>
            {t("form.descriptionLabel", { ns: "agenda" })}
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
          <label>
            {t("form.startAtLabel", { ns: "agenda" })}
            <input
              type="datetime-local"
              value={form.startAt}
              onChange={(event) => setForm({ ...form, startAt: event.target.value })}
              required
            />
          </label>
          <label>
            {t("form.endAtLabel", { ns: "agenda" })}
            <input
              type="datetime-local"
              value={form.endAt}
              onChange={(event) => setForm({ ...form, endAt: event.target.value })}
            />
          </label>
          <label>
            {t("form.typeLabel", { ns: "agenda" })}
            <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as AgendaEventType })}>
              {AGENDA_EVENT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`type.${value}`, { ns: "agenda" })}
                </option>
              ))}
            </select>
          </label>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("form.saving", { ns: "agenda" }) : t("form.save", { ns: "agenda" })}
            </button>
            <button type="button" onClick={() => setIsFormOpen(false)}>
              {t("actions.cancel", { ns: "common" })}
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {!isLoading && loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}

      {!isLoading &&
        !loadError &&
        (groupedByDay.length === 0 ? (
          <p>{t("empty", { ns: "agenda" })}</p>
        ) : (
          <div className="agenda-day-list">
            {groupedByDay.map(([key, entries]) => (
              <div key={key} className="agenda-day-group">
                <h2 className="agenda-day-heading">
                  {new Date(entries[0].sortAt).toLocaleDateString(undefined, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </h2>
                <ul className="card-list">
                  {entries.map((entry) =>
                    entry.kind === "event" ? (
                      <li key={`event-${entry.event.id}`} className="card agenda-entry-card">
                        <div className="card-header">
                          <span className="card-title">
                            <Users size={16} aria-hidden="true" className="agenda-entry-icon" />
                            {entry.event.title}
                          </span>
                          <span className={`agenda-type-badge agenda-type-badge--${entry.event.type}`}>
                            {t(`type.${entry.event.type}`, { ns: "agenda" })}
                          </span>
                        </div>
                        <span className="card-meta">
                          {new Date(entry.event.startAt).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {entry.event.endAt &&
                            ` – ${new Date(entry.event.endAt).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`}
                        </span>
                        <span className="card-meta">
                          {t("createdByLabel", { ns: "agenda" })}: {entry.event.createdBy.name}
                        </span>
                        {entry.event.description && <p className="card-description">{entry.event.description}</p>}

                        {canEditEvent(entry.event) && (
                          <div className="card-actions">
                            <button type="button" onClick={() => openEditForm(entry.event)}>
                              {t("actions.edit", { ns: "common" })}
                            </button>
                            <button type="button" className="danger-button" onClick={() => setEventToDelete(entry.event)}>
                              {t("actions.delete", { ns: "common" })}
                            </button>
                          </div>
                        )}
                      </li>
                    ) : (
                      <li key={`activity-${entry.activity.id}`} className="card agenda-entry-card agenda-entry-card--activity">
                        <div className="card-header">
                          <span className="card-title">
                            <Hammer size={16} aria-hidden="true" className="agenda-entry-icon" />
                            {entry.activity.title}
                          </span>
                          <span className="agenda-type-badge agenda-type-badge--ACTIVITY">
                            {t("activityBadge", { ns: "agenda" })}
                          </span>
                        </div>
                        <span className="card-meta">
                          {new Date(entry.activity.scheduledDate).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="card-meta">
                          <Link to={`/projects/${entry.activity.projectId}`}>{entry.activity.project.name}</Link>
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </div>
        ))}

      {eventToDelete && (
        <ConfirmDialog
          title={t("deleteTitle", { ns: "agenda" })}
          message={t("deleteMessage", { ns: "agenda", title: eventToDelete.title })}
          confirmLabel={t("actions.delete", { ns: "common" })}
          isConfirming={isDeleting}
          error={deleteError}
          onConfirm={() => void handleDelete()}
          onCancel={() => {
            setEventToDelete(null);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}
