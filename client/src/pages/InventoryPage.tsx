import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useAuth } from "../context/AuthContext";
import { translateStatus } from "../i18n/statusLabel";
import { isInventoryRole } from "../types/auth";
import { INVENTORY_ITEM_TYPES } from "../types/inventory";
import type { InventoryItem, InventoryItemType } from "../types/inventory";

interface ItemFormState {
  name: string;
  type: InventoryItemType;
  unit: string;
  stockQuantity: string;
  lowStockThreshold: string;
  notes: string;
}

const EMPTY_FORM: ItemFormState = {
  name: "",
  type: "MATERIAL",
  unit: "",
  stockQuantity: "0",
  lowStockThreshold: "",
  notes: "",
};

function itemToFormState(item: InventoryItem): ItemFormState {
  return {
    name: item.name,
    type: item.type,
    unit: item.unit,
    stockQuantity: String(item.stockQuantity),
    lowStockThreshold: item.lowStockThreshold === null ? "" : String(item.lowStockThreshold),
    notes: item.notes ?? "",
  };
}

function isLowStock(item: InventoryItem): boolean {
  return item.lowStockThreshold !== null && item.stockQuantity <= item.lowStockThreshold;
}

export function InventoryPage() {
  const { t } = useTranslation(["inventory", "common"]);
  const { user } = useAuth();
  const canManage = Boolean(user && isInventoryRole(user.role));

  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<InventoryItemType | "">("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function loadItems() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiClient.get<{ items: InventoryItem[] }>("/inventory", {
        params: typeFilter ? { type: typeFilter } : undefined,
      });
      setItems(response.data.items);
    } catch (error) {
      setLoadError(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  function openCreateForm() {
    setEditingItemId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEditForm(item: InventoryItem) {
    setEditingItemId(item.id);
    setForm(itemToFormState(item));
    setFormError(null);
    setIsFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name,
        type: form.type,
        unit: form.unit,
        stockQuantity: Number(form.stockQuantity),
        lowStockThreshold: form.lowStockThreshold === "" ? null : Number(form.lowStockThreshold),
        notes: form.notes || undefined,
      };
      if (editingItemId) {
        await apiClient.patch(`/inventory/${editingItemId}`, payload);
      } else {
        await apiClient.post("/inventory", payload);
      }
      setIsFormOpen(false);
      await loadItems();
    } catch (error) {
      setFormError(translateApiError(t, error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!itemToDelete) {
      return;
    }
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await apiClient.delete(`/inventory/${itemToDelete.id}`);
      setItemToDelete(null);
      await loadItems();
    } catch (error) {
      setDeleteError(translateApiError(t, error));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="inventory-page">
      <div className="page-header">
        <h1>{t("title", { ns: "inventory" })}</h1>
        {canManage && <button type="button" onClick={openCreateForm}>{t("createButton", { ns: "inventory" })}</button>}
      </div>

      <label className="status-filter">
        {t("typeFilterLabel", { ns: "inventory" })}
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as InventoryItemType | "")}>
          <option value="">{t("typeFilterAll", { ns: "inventory" })}</option>
          {INVENTORY_ITEM_TYPES.map((value) => (
            <option key={value} value={value}>
              {translateStatus(t, "inventory", "itemType", value)}
            </option>
          ))}
        </select>
      </label>

      {canManage && isFormOpen && (
        <form className="inline-form" onSubmit={(event) => void handleSubmit(event)}>
          <h2>{editingItemId ? t("editFormTitle", { ns: "inventory" }) : t("createFormTitle", { ns: "inventory" })}</h2>
          <label>
            {t("nameLabel", { ns: "inventory" })}
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required minLength={1} />
          </label>
          <label>
            {t("typeLabel", { ns: "inventory" })}
            <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as InventoryItemType })}>
              {INVENTORY_ITEM_TYPES.map((value) => (
                <option key={value} value={value}>
                  {translateStatus(t, "inventory", "itemType", value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("unitLabel", { ns: "inventory" })}
            <input
              value={form.unit}
              onChange={(event) => setForm({ ...form, unit: event.target.value })}
              placeholder={t("unitPlaceholder", { ns: "inventory" })}
              required
            />
          </label>
          <label>
            {t("stockQuantityLabel", { ns: "inventory" })}
            <input
              type="number"
              min="0"
              step="1"
              value={form.stockQuantity}
              onChange={(event) => setForm({ ...form, stockQuantity: event.target.value })}
              required
            />
          </label>
          <label>
            {t("lowStockThresholdLabel", { ns: "inventory" })}
            <input
              type="number"
              min="0"
              step="1"
              value={form.lowStockThreshold}
              onChange={(event) => setForm({ ...form, lowStockThreshold: event.target.value })}
              placeholder={t("lowStockThresholdPlaceholder", { ns: "inventory" })}
            />
          </label>
          <label>
            {t("notesLabel", { ns: "inventory" })}
            <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </label>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("saving", { ns: "inventory" }) : t("save", { ns: "inventory" })}
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
        items &&
        (items.length === 0 ? (
          <p>{t("empty", { ns: "inventory" })}</p>
        ) : (
          <ul className="card-list">
            {items.map((item) => (
              <li key={item.id} className="card">
                <div className="card-header">
                  <span className="card-title">{item.name}</span>
                  <span className="status-badge">{translateStatus(t, "inventory", "itemType", item.type)}</span>
                </div>
                <span className="card-meta">
                  {t("stockLabel", { ns: "inventory" })}: {item.stockQuantity} {item.unit}
                </span>
                {isLowStock(item) && (
                  <span className="status-badge status-badge--warning">{t("lowStockBadge", { ns: "inventory" })}</span>
                )}
                {item.notes && <p className="card-description">{item.notes}</p>}

                {canManage && (
                  <div className="card-actions">
                    <button type="button" onClick={() => openEditForm(item)}>
                      {t("actions.edit", { ns: "common" })}
                    </button>
                    <button type="button" className="danger-button" onClick={() => setItemToDelete(item)}>
                      {t("actions.delete", { ns: "common" })}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ))}

      {itemToDelete && (
        <ConfirmDialog
          title={t("deleteTitle", { ns: "inventory" })}
          message={t("deleteMessage", { ns: "inventory", name: itemToDelete.name })}
          confirmLabel={t("actions.delete", { ns: "common" })}
          isConfirming={isDeleting}
          error={deleteError}
          onConfirm={() => void handleDelete()}
          onCancel={() => {
            setItemToDelete(null);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}
