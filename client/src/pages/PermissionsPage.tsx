import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { User, UserRole } from "../types/auth";
import { FEATURES } from "../types/permissions";
import type { FeaturePermissions } from "../types/permissions";

// La gestion de permisos aplica a estos 3 roles — Trabajador de Campo nunca
// pasa por esta capa (ver requireFeature.middleware.ts) y Gerente siempre
// tiene acceso total sin excepcion, no tiene sentido mostrarle toggles.
const MANAGEABLE_ROLES: UserRole[] = ["ADMINISTRADOR", "SUPERVISOR", "MERCADERISTA"];

interface PermissionRow {
  user: User;
  permissions: FeaturePermissions | null;
  savingFeature: string | null;
  rowError: string | null;
}

export function PermissionsPage() {
  const { t } = useTranslation(["permissions", "common"]);
  const { user: currentUser } = useAuth();

  const [rows, setRows] = useState<PermissionRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadRows() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const usersResponse = await apiClient.get<{ users: User[] }>("/auth/users");
      const targets = usersResponse.data.users.filter((u) => MANAGEABLE_ROLES.includes(u.role));
      const permsResponses = await Promise.all(
        targets.map((u) => apiClient.get<{ permissions: FeaturePermissions }>(`/permissions/${u.id}`)),
      );
      setRows(
        targets.map((u, index) => ({
          user: u,
          permissions: permsResponses[index].data.permissions,
          savingFeature: null,
          rowError: null,
        })),
      );
    } catch (error) {
      setLoadError(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!currentUser) {
    return null;
  }

  // El endpoint solo lo puede usar el Gerente (ver permissions.routes.ts);
  // si otro rol llega aca por URL directa, lo mandamos de vuelta.
  if (currentUser.role !== "GERENTE") {
    return <Navigate to="/" replace />;
  }

  async function handleToggle(userId: string, feature: (typeof FEATURES)[number], granted: boolean) {
    setRows(
      (current) =>
        current?.map((row) => (row.user.id === userId ? { ...row, savingFeature: feature, rowError: null } : row)) ??
        null,
    );
    try {
      const response = await apiClient.patch<{ permissions: FeaturePermissions }>(`/permissions/${userId}`, {
        feature,
        granted,
      });
      setRows(
        (current) =>
          current?.map((row) =>
            row.user.id === userId ? { ...row, permissions: response.data.permissions, savingFeature: null } : row,
          ) ?? null,
      );
    } catch (error) {
      setRows(
        (current) =>
          current?.map((row) =>
            row.user.id === userId ? { ...row, rowError: translateApiError(t, error), savingFeature: null } : row,
          ) ?? null,
      );
    }
  }

  return (
    <div className="permissions-page">
      <div className="page-header">
        <h1>{t("title", { ns: "permissions" })}</h1>
      </div>
      <p className="form-hint">{t("hint", { ns: "permissions" })}</p>

      {isLoading && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {!isLoading && loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}

      {!isLoading &&
        !loadError &&
        rows &&
        (rows.length === 0 ? (
          <p>{t("empty", { ns: "permissions" })}</p>
        ) : (
          <ul className="card-list">
            {rows.map((row) => (
              <li key={row.user.id} className="card">
                <div className="card-header">
                  <span className="card-title">{row.user.name}</span>
                  <span className="status-badge">{t(`roles.${row.user.role}`, { ns: "common" })}</span>
                </div>
                <span className="card-meta">{row.user.email}</span>

                {row.permissions && (
                  <div className="feature-toggle-grid">
                    {FEATURES.map((feature) => (
                      <label key={feature} className="feature-toggle">
                        <input
                          type="checkbox"
                          checked={row.permissions![feature]}
                          disabled={row.savingFeature !== null}
                          onChange={(event) => void handleToggle(row.user.id, feature, event.target.checked)}
                        />
                        {t(`features.${feature}`, { ns: "permissions" })}
                      </label>
                    ))}
                  </div>
                )}

                {row.rowError && (
                  <p className="form-error" role="alert">
                    {row.rowError}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
