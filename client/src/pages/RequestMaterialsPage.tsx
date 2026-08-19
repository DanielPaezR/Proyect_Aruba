import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { translateStatus } from "../i18n/statusLabel";
import type { Activity } from "../types/activity";
import type { InventoryItem, MaterialRequest } from "../types/inventory";

const FREE_TEXT_OPTION = "__free_text__";
const GENERAL_PROJECT_OPTION = "__general__";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function RequestMaterialsPage() {
  const { t } = useTranslation(["requestMaterials", "common"]);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [freeTextName, setFreeTextName] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(GENERAL_PROJECT_OPTION);
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [myRequests, setMyRequests] = useState<MaterialRequest[] | null>(null);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadItems() {
    try {
      const response = await apiClient.get<{ items: InventoryItem[] }>("/inventory");
      setItems(response.data.items);
    } catch {
      // El picker queda vacio (siempre queda la opcion de texto libre); el
      // formulario sigue siendo usable igual.
    }
  }

  /** Proyectos donde el trabajador tiene alguna actividad asignada, deducidos
   * de GET /activities/mine (no hay un endpoint dedicado de "mis proyectos") —
   * mas la opcion "General" para solicitudes no atadas a un proyecto. */
  async function loadProjects() {
    try {
      const response = await apiClient.get<{ activities: Activity[] }>("/activities/mine");
      const seen = new Map<string, string>();
      for (const activity of response.data.activities) {
        if (activity.project) {
          seen.set(activity.project.id, activity.project.name);
        }
      }
      setProjects(Array.from(seen, ([id, name]) => ({ id, name })));
    } catch {
      // El selector queda solo con la opcion "General"; el formulario sigue usable.
    }
  }

  async function loadMyRequests() {
    setIsLoadingRequests(true);
    setLoadError(null);
    try {
      const response = await apiClient.get<{ requests: MaterialRequest[] }>("/material-requests/mine");
      setMyRequests(response.data.requests);
    } catch (error) {
      setLoadError(translateApiError(t, error));
    } finally {
      setIsLoadingRequests(false);
    }
  }

  useEffect(() => {
    void loadItems();
    void loadProjects();
    void loadMyRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);
    setIsSubmitting(true);
    try {
      const isFreeText = selectedItemId === FREE_TEXT_OPTION || selectedItemId === "";
      await apiClient.post("/material-requests", {
        itemId: isFreeText ? undefined : selectedItemId,
        itemNameFreeText: isFreeText ? freeTextName : undefined,
        projectId: selectedProjectId === GENERAL_PROJECT_OPTION ? undefined : selectedProjectId,
        quantity: Number(quantity),
        reason,
      });
      setSelectedItemId("");
      setFreeTextName("");
      setSelectedProjectId(GENERAL_PROJECT_OPTION);
      setQuantity("1");
      setReason("");
      setSubmitSuccess(true);
      await loadMyRequests();
    } catch (error) {
      setSubmitError(translateApiError(t, error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const isFreeTextMode = selectedItemId === FREE_TEXT_OPTION || selectedItemId === "";

  return (
    <div className="request-materials-page">
      <div className="page-header">
        <h1>{t("title", { ns: "requestMaterials" })}</h1>
      </div>

      <form className="inline-form" onSubmit={(event) => void handleSubmit(event)}>
        <h2>{t("formTitle", { ns: "requestMaterials" })}</h2>
        <label>
          {t("itemLabel", { ns: "requestMaterials" })}
          <select value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)}>
            <option value={FREE_TEXT_OPTION}>{t("itemNotInCatalog", { ns: "requestMaterials" })}</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        {isFreeTextMode && (
          <label>
            {t("freeTextLabel", { ns: "requestMaterials" })}
            <input
              value={freeTextName}
              onChange={(event) => setFreeTextName(event.target.value)}
              required
              minLength={1}
            />
          </label>
        )}

        <label>
          {t("projectLabel", { ns: "requestMaterials" })}
          <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
            <option value={GENERAL_PROJECT_OPTION}>{t("projectGeneralOption", { ns: "requestMaterials" })}</option>
          </select>
        </label>

        <label>
          {t("quantityLabel", { ns: "requestMaterials" })}
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            required
          />
        </label>

        <label>
          {t("reasonLabel", { ns: "requestMaterials" })}
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} required minLength={1} />
        </label>

        {submitError && (
          <p className="form-error" role="alert">
            {submitError}
          </p>
        )}
        {submitSuccess && <p className="card-description">{t("submitSuccess", { ns: "requestMaterials" })}</p>}

        <div className="form-actions">
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("submitting", { ns: "requestMaterials" }) : t("submit", { ns: "requestMaterials" })}
          </button>
        </div>
      </form>

      <h2 className="section-label">{t("myRequestsTitle", { ns: "requestMaterials" })}</h2>

      {isLoadingRequests && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {!isLoadingRequests && loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}

      {!isLoadingRequests &&
        !loadError &&
        myRequests &&
        (myRequests.length === 0 ? (
          <p>{t("myRequestsEmpty", { ns: "requestMaterials" })}</p>
        ) : (
          <ul className="card-list">
            {myRequests.map((request) => (
              <li key={request.id} className="card">
                <div className="card-header">
                  <span className="card-title">{request.item?.name ?? request.itemNameFreeText}</span>
                  <span className="status-badge">
                    {translateStatus(t, "common", "materialRequestStatus", request.status)}
                  </span>
                </div>
                <span className="card-meta">
                  {t("quantityLabel", { ns: "requestMaterials" })}: {request.quantity}
                  {request.item ? ` ${request.item.unit}` : ""}
                </span>
                <span className="card-meta">
                  {t("projectLabel", { ns: "requestMaterials" })}:{" "}
                  {request.project?.name ?? t("projectGeneralOption", { ns: "requestMaterials" })}
                </span>
                <span className="card-meta">{formatDate(request.createdAt)}</span>
                <p className="card-description">{request.reason}</p>
                {request.resolutionNote && (
                  <p className="card-description">
                    {t("resolutionNoteLabel", { ns: "requestMaterials" })}: {request.resolutionNote}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
