import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { isInventoryRole } from "../types/auth";
import type { User } from "../types/auth";
import type { InventoryItem, ToolAssignment } from "../types/inventory";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ToolAssignmentsPage() {
  const { t } = useTranslation(["toolAssignments", "common"]);
  const { user } = useAuth();

  const [assignments, setAssignments] = useState<ToolAssignment[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  const [tools, setTools] = useState<InventoryItem[]>([]);
  const [workers, setWorkers] = useState<User[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [itemId, setItemId] = useState("");
  const [userId, setUserId] = useState("");
  const [condition, setCondition] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [returningId, setReturningId] = useState<string | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);

  async function loadAssignments() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiClient.get<{ assignments: ToolAssignment[] }>("/tool-assignments", {
        params: showActiveOnly ? { active: true } : undefined,
      });
      setAssignments(response.data.assignments);
    } catch (error) {
      setLoadError(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadFormOptions() {
    try {
      const [itemsResponse, usersResponse] = await Promise.all([
        apiClient.get<{ items: InventoryItem[] }>("/inventory", { params: { type: "HERRAMIENTA" } }),
        apiClient.get<{ users: User[] }>("/auth/users"),
      ]);
      setTools(itemsResponse.data.items);
      setWorkers(usersResponse.data.users.filter((u) => u.role === "TRABAJADOR_CAMPO" && u.isActive));
    } catch {
      // Los selects quedan vacios; el error real (si lo hay) ya se muestra via loadError.
    }
  }

  useEffect(() => {
    void loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showActiveOnly]);

  useEffect(() => {
    void loadFormOptions();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post("/tool-assignments", { itemId, userId, condition: condition || undefined });
      setItemId("");
      setUserId("");
      setCondition("");
      setIsFormOpen(false);
      await loadAssignments();
    } catch (error) {
      setFormError(translateApiError(t, error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReturn(assignmentId: string) {
    setReturnError(null);
    setReturningId(assignmentId);
    try {
      await apiClient.patch(`/tool-assignments/${assignmentId}/return`);
      await loadAssignments();
    } catch (error) {
      setReturnError(translateApiError(t, error));
    } finally {
      setReturningId(null);
    }
  }

  if (!user) {
    return null;
  }

  // Solo Mercaderista/Jefe (ver tool-assignments.routes.ts).
  if (!isInventoryRole(user.role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="tool-assignments-page">
      <div className="page-header">
        <h1>{t("title", { ns: "toolAssignments" })}</h1>
        <button type="button" onClick={() => setIsFormOpen((open) => !open)}>
          {t("createButton", { ns: "toolAssignments" })}
        </button>
      </div>

      <label className="status-filter">
        <input type="checkbox" checked={showActiveOnly} onChange={(event) => setShowActiveOnly(event.target.checked)} />
        {t("activeOnlyLabel", { ns: "toolAssignments" })}
      </label>

      {isFormOpen && (
        <form className="inline-form" onSubmit={(event) => void handleSubmit(event)}>
          <h2>{t("createFormTitle", { ns: "toolAssignments" })}</h2>
          <label>
            {t("itemLabel", { ns: "toolAssignments" })}
            <select value={itemId} onChange={(event) => setItemId(event.target.value)} required>
              <option value="">{t("itemPlaceholder", { ns: "toolAssignments" })}</option>
              {tools.map((tool) => (
                <option key={tool.id} value={tool.id}>
                  {tool.name} ({t("stockAvailable", { ns: "toolAssignments", count: tool.stockQuantity })})
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("workerLabel", { ns: "toolAssignments" })}
            <select value={userId} onChange={(event) => setUserId(event.target.value)} required>
              <option value="">{t("workerPlaceholder", { ns: "toolAssignments" })}</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("conditionLabel", { ns: "toolAssignments" })}
            <textarea value={condition} onChange={(event) => setCondition(event.target.value)} />
          </label>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("saving", { ns: "toolAssignments" }) : t("save", { ns: "toolAssignments" })}
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

      {returnError && (
        <p className="form-error" role="alert">
          {returnError}
        </p>
      )}

      {!isLoading &&
        !loadError &&
        assignments &&
        (assignments.length === 0 ? (
          <p>{t("empty", { ns: "toolAssignments" })}</p>
        ) : (
          <ul className="card-list">
            {assignments.map((assignment) => (
              <li key={assignment.id} className="card">
                <div className="card-header">
                  <span className="card-title">{assignment.item.name}</span>
                  <span className={assignment.returnedAt ? "status-badge status-badge--muted" : "status-badge"}>
                    {assignment.returnedAt
                      ? t("statusReturned", { ns: "toolAssignments" })
                      : t("statusActive", { ns: "toolAssignments" })}
                  </span>
                </div>
                <span className="card-meta">
                  {t("workerLabel", { ns: "toolAssignments" })}: {assignment.user.name}
                </span>
                <span className="card-meta">
                  {t("assignedAtLabel", { ns: "toolAssignments" })}: {formatDateTime(assignment.assignedAt)}
                </span>
                {assignment.returnedAt && (
                  <span className="card-meta">
                    {t("returnedAtLabel", { ns: "toolAssignments" })}: {formatDateTime(assignment.returnedAt)}
                  </span>
                )}
                {assignment.condition && <p className="card-description">{assignment.condition}</p>}

                {!assignment.returnedAt && (
                  <div className="card-actions">
                    <button
                      type="button"
                      onClick={() => void handleReturn(assignment.id)}
                      disabled={returningId === assignment.id}
                    >
                      {returningId === assignment.id
                        ? t("returning", { ns: "toolAssignments" })
                        : t("returnButton", { ns: "toolAssignments" })}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
