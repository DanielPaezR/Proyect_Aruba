import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { translateStatus } from "../i18n/statusLabel";
import { isManagerRole } from "../types/auth";
import type { User } from "../types/auth";
import { VEHICLE_STATUSES } from "../types/vehicle";
import type { Vehicle, VehicleStatus } from "../types/vehicle";

interface VehicleFormState {
  plate: string;
  brand: string;
  model: string;
  year: string;
  identificationNumber: string;
  assignedToId: string;
  status: VehicleStatus;
  notes: string;
}

const EMPTY_FORM: VehicleFormState = {
  plate: "",
  brand: "",
  model: "",
  year: String(new Date().getFullYear()),
  identificationNumber: "",
  assignedToId: "",
  status: "ACTIVO",
  notes: "",
};

function vehicleToFormState(vehicle: Vehicle): VehicleFormState {
  return {
    plate: vehicle.plate,
    brand: vehicle.brand,
    model: vehicle.model,
    year: String(vehicle.year),
    identificationNumber: vehicle.identificationNumber ?? "",
    assignedToId: vehicle.assignedToId ?? "",
    status: vehicle.status,
    notes: vehicle.notes ?? "",
  };
}

export function VehiclesPage() {
  const { t } = useTranslation(["vehicles", "common"]);
  const { user } = useAuth();

  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [workers, setWorkers] = useState<User[] | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [form, setForm] = useState<VehicleFormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function loadVehicles() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiClient.get<{ vehicles: Vehicle[] }>("/vehicles");
      setVehicles(response.data.vehicles);
    } catch (error) {
      setLoadError(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadWorkers() {
    try {
      const response = await apiClient.get<{ users: User[] }>("/auth/users");
      setWorkers(response.data.users.filter((u) => u.isActive));
    } catch {
      // Selector opcional: si falla, el form igual funciona sin asignar a nadie.
      setWorkers([]);
    }
  }

  useEffect(() => {
    void loadVehicles();
    void loadWorkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) {
    return null;
  }

  if (!isManagerRole(user.role)) {
    return <Navigate to="/" replace />;
  }

  function openCreateForm() {
    setEditingVehicleId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEditForm(vehicle: Vehicle) {
    setEditingVehicleId(vehicle.id);
    setForm(vehicleToFormState(vehicle));
    setFormError(null);
    setIsFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        plate: form.plate,
        brand: form.brand,
        model: form.model,
        year: Number(form.year),
        identificationNumber: form.identificationNumber || undefined,
        assignedToId: form.assignedToId || null,
        status: form.status,
        notes: form.notes || undefined,
      };
      if (editingVehicleId) {
        await apiClient.patch(`/vehicles/${editingVehicleId}`, payload);
      } else {
        await apiClient.post("/vehicles", payload);
      }
      setIsFormOpen(false);
      await loadVehicles();
    } catch (error) {
      setFormError(translateApiError(t, error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!vehicleToDelete) {
      return;
    }
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await apiClient.delete(`/vehicles/${vehicleToDelete.id}`);
      setVehicleToDelete(null);
      await loadVehicles();
    } catch (error) {
      setDeleteError(translateApiError(t, error));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="vehicles-page">
      <PageHeader title={t("title")}>
        <button type="button" onClick={openCreateForm}>
          {t("createButton")}
        </button>
      </PageHeader>

      {isFormOpen && (
        <form className="inline-form" onSubmit={(event) => void handleSubmit(event)}>
          <h2>{editingVehicleId ? t("editFormTitle") : t("createFormTitle")}</h2>
          <label>
            {t("plateLabel")}
            <input value={form.plate} onChange={(event) => setForm({ ...form, plate: event.target.value })} required minLength={1} />
          </label>
          <label>
            {t("brandLabel")}
            <input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} required minLength={1} />
          </label>
          <label>
            {t("modelLabel")}
            <input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} required minLength={1} />
          </label>
          <label>
            {t("yearLabel")}
            <input
              type="number"
              min="1900"
              max="2100"
              step="1"
              value={form.year}
              onChange={(event) => setForm({ ...form, year: event.target.value })}
              required
            />
          </label>
          <label>
            {t("identificationNumberLabel")}
            <input
              value={form.identificationNumber}
              onChange={(event) => setForm({ ...form, identificationNumber: event.target.value })}
              placeholder={t("identificationNumberPlaceholder")}
            />
          </label>
          <label>
            {t("assignedToLabel")}
            <select value={form.assignedToId} onChange={(event) => setForm({ ...form, assignedToId: event.target.value })}>
              <option value="">{t("unassignedOption")}</option>
              {workers?.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name} — {t(`roles.${worker.role}`, { ns: "common" })}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("statusLabel")}
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as VehicleStatus })}>
              {VEHICLE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {translateStatus(t, "vehicles", "status", value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("notesLabel")}
            <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </label>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("saving") : t("save")}
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
        vehicles &&
        (vehicles.length === 0 ? (
          <p>{t("empty")}</p>
        ) : (
          <ul className="card-list">
            {vehicles.map((vehicle) => (
              <li key={vehicle.id} className="card">
                <Link to={`/vehicles/${vehicle.id}`} className="card-link">
                  <div className="card-header">
                    <span className="card-title">
                      {vehicle.plate} — {vehicle.brand} {vehicle.model}
                    </span>
                    <span className="status-badge">{translateStatus(t, "vehicles", "status", vehicle.status)}</span>
                  </div>
                  <span className="card-meta">
                    {t("yearLabel")}: {vehicle.year}
                  </span>
                  <span className="card-meta">
                    {vehicle.assignedTo
                      ? `${t("assignedToLabel")}: ${vehicle.assignedTo.name}`
                      : t("unassignedOption")}
                  </span>
                  {vehicle.notes && <p className="card-description">{vehicle.notes}</p>}
                </Link>
                <div className="card-actions">
                  <button type="button" onClick={() => openEditForm(vehicle)}>
                    {t("actions.edit", { ns: "common" })}
                  </button>
                  <button type="button" className="danger-button" onClick={() => setVehicleToDelete(vehicle)}>
                    {t("actions.delete", { ns: "common" })}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ))}

      {vehicleToDelete && (
        <ConfirmDialog
          title={t("deleteTitle")}
          message={t("deleteMessage", { plate: vehicleToDelete.plate })}
          confirmLabel={t("actions.delete", { ns: "common" })}
          isConfirming={isDeleting}
          error={deleteError}
          onConfirm={() => void handleDelete()}
          onCancel={() => {
            setVehicleToDelete(null);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}
