import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { translateStatus } from "../i18n/statusLabel";
import { VEHICLE_INCIDENT_TYPES } from "../types/vehicle";
import type { Vehicle, VehicleIncidentType } from "../types/vehicle";

function todayDateInputValue(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function MyVehiclePage() {
  const { t } = useTranslation(["myVehicle", "common"]);

  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fuelFormVehicleId, setFuelFormVehicleId] = useState<string | null>(null);
  const [fuelDate, setFuelDate] = useState(todayDateInputValue);
  const [fuelCost, setFuelCost] = useState("");
  const [fuelLiters, setFuelLiters] = useState("");
  const [fuelOdometer, setFuelOdometer] = useState("");
  const [isSubmittingFuel, setIsSubmittingFuel] = useState(false);
  const [fuelError, setFuelError] = useState<string | null>(null);
  const [fuelSuccessId, setFuelSuccessId] = useState<string | null>(null);

  const [incidentFormVehicleId, setIncidentFormVehicleId] = useState<string | null>(null);
  const [incidentType, setIncidentType] = useState<VehicleIncidentType>("DANIO");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [incidentCost, setIncidentCost] = useState("");
  const [incidentPhoto, setIncidentPhoto] = useState<File | null>(null);
  const [isSubmittingIncident, setIsSubmittingIncident] = useState(false);
  const [incidentError, setIncidentError] = useState<string | null>(null);
  const [incidentSuccessId, setIncidentSuccessId] = useState<string | null>(null);

  async function loadVehicles() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiClient.get<{ vehicles: Vehicle[] }>("/vehicles/mine");
      setVehicles(response.data.vehicles);
    } catch (error) {
      setLoadError(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openFuelForm(vehicleId: string) {
    setFuelFormVehicleId(vehicleId);
    setFuelDate(todayDateInputValue());
    setFuelCost("");
    setFuelLiters("");
    setFuelOdometer("");
    setFuelError(null);
    setFuelSuccessId(null);
  }

  function openIncidentForm(vehicleId: string) {
    setIncidentFormVehicleId(vehicleId);
    setIncidentType("DANIO");
    setIncidentDescription("");
    setIncidentCost("");
    setIncidentPhoto(null);
    setIncidentError(null);
    setIncidentSuccessId(null);
  }

  async function handleFuelSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fuelFormVehicleId) {
      return;
    }
    setFuelError(null);
    setIsSubmittingFuel(true);
    try {
      await apiClient.post(`/vehicles/${fuelFormVehicleId}/fuel-logs`, {
        date: new Date(fuelDate).toISOString(),
        cost: Number(fuelCost),
        liters: fuelLiters ? Number(fuelLiters) : undefined,
        odometerReading: fuelOdometer ? Number(fuelOdometer) : undefined,
      });
      setFuelSuccessId(fuelFormVehicleId);
      setFuelFormVehicleId(null);
    } catch (error) {
      setFuelError(translateApiError(t, error));
    } finally {
      setIsSubmittingFuel(false);
    }
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    setIncidentPhoto(event.target.files?.[0] ?? null);
  }

  async function handleIncidentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!incidentFormVehicleId) {
      return;
    }
    setIncidentError(null);
    setIsSubmittingIncident(true);
    try {
      const formData = new FormData();
      formData.append("type", incidentType);
      formData.append("description", incidentDescription);
      if (incidentCost) {
        formData.append("cost", incidentCost);
      }
      if (incidentPhoto) {
        formData.append("photo", incidentPhoto);
      }
      await apiClient.post(`/vehicles/${incidentFormVehicleId}/incidents`, formData);
      setIncidentSuccessId(incidentFormVehicleId);
      setIncidentFormVehicleId(null);
    } catch (error) {
      setIncidentError(translateApiError(t, error));
    } finally {
      setIsSubmittingIncident(false);
    }
  }

  return (
    <div className="my-vehicle-page">
      <PageHeader title={t("title")} />

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
                <div className="card-header">
                  <span className="card-title">
                    {vehicle.plate} — {vehicle.brand} {vehicle.model}
                  </span>
                </div>
                {vehicle.notes && <p className="card-description">{vehicle.notes}</p>}

                {fuelSuccessId === vehicle.id && <p className="card-description">{t("fuelLogSent")}</p>}
                {incidentSuccessId === vehicle.id && <p className="card-description">{t("incidentSent")}</p>}

                <div className="card-actions">
                  <button type="button" onClick={() => openFuelForm(vehicle.id)}>
                    {t("logFuelButton")}
                  </button>
                  <button type="button" onClick={() => openIncidentForm(vehicle.id)}>
                    {t("reportButton")}
                  </button>
                </div>

                {fuelFormVehicleId === vehicle.id && (
                  <form className="inline-form" onSubmit={(event) => void handleFuelSubmit(event)}>
                    <h2>{t("fuelFormTitle")}</h2>
                    <label>
                      {t("fuelDateLabel")}
                      <input type="date" value={fuelDate} onChange={(event) => setFuelDate(event.target.value)} required />
                    </label>
                    <label>
                      {t("fuelCostLabel")}
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={fuelCost}
                        onChange={(event) => setFuelCost(event.target.value)}
                        required
                      />
                    </label>
                    <label>
                      {t("fuelLitersLabel")}
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={fuelLiters}
                        onChange={(event) => setFuelLiters(event.target.value)}
                      />
                    </label>
                    <label>
                      {t("odometerLabel")}
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={fuelOdometer}
                        onChange={(event) => setFuelOdometer(event.target.value)}
                      />
                    </label>
                    {fuelError && (
                      <p className="form-error" role="alert">
                        {fuelError}
                      </p>
                    )}
                    <div className="form-actions">
                      <button type="submit" disabled={isSubmittingFuel}>
                        {isSubmittingFuel ? t("submitting") : t("submit")}
                      </button>
                      <button type="button" onClick={() => setFuelFormVehicleId(null)}>
                        {t("actions.cancel", { ns: "common" })}
                      </button>
                    </div>
                  </form>
                )}

                {incidentFormVehicleId === vehicle.id && (
                  <form className="inline-form" onSubmit={(event) => void handleIncidentSubmit(event)}>
                    <h2>{t("reportFormTitle")}</h2>
                    <label>
                      {t("incidentTypeLabel")}
                      <select value={incidentType} onChange={(event) => setIncidentType(event.target.value as VehicleIncidentType)}>
                        {VEHICLE_INCIDENT_TYPES.map((value) => (
                          <option key={value} value={value}>
                            {translateStatus(t, "vehicles", "incidentType", value)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t("descriptionLabel")}
                      <textarea
                        value={incidentDescription}
                        onChange={(event) => setIncidentDescription(event.target.value)}
                        required
                        minLength={1}
                      />
                    </label>
                    <label>
                      {t("incidentCostLabel")}
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={incidentCost}
                        onChange={(event) => setIncidentCost(event.target.value)}
                        placeholder={t("incidentCostPlaceholder")}
                      />
                    </label>
                    <label>
                      {t("photoLabel")}
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} />
                    </label>
                    {incidentError && (
                      <p className="form-error" role="alert">
                        {incidentError}
                      </p>
                    )}
                    <div className="form-actions">
                      <button type="submit" disabled={isSubmittingIncident}>
                        {isSubmittingIncident ? t("submitting") : t("submit")}
                      </button>
                      <button type="button" onClick={() => setIncidentFormVehicleId(null)}>
                        {t("actions.cancel", { ns: "common" })}
                      </button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
