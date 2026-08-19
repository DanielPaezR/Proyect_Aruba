import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useGeofenceCheck } from "../hooks/useGeofenceCheck";
import { isInventoryRole, isManagerRole, isTimeTrackingRole, isTopManagerRole } from "../types/auth";
import { LanguageSwitcher } from "./LanguageSwitcher";

function navLinkClassName({ isActive }: { isActive: boolean }) {
  return isActive ? "active" : undefined;
}

export function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useGeofenceCheck();

  function closeDrawer() {
    setIsDrawerOpen(false);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-start">
          {user && (
            <button
              type="button"
              className="hamburger-button"
              onClick={() => setIsDrawerOpen(true)}
              aria-label={t("nav.openMenu", { ns: "common" })}
            >
              <Menu size={22} aria-hidden="true" />
            </button>
          )}
          <div className="brand">
            <img src="/logo-header-transparent.png" alt="" className="brand-logo-img" />
            <span className="app-name">{t("app.name", { ns: "common" })}</span>
          </div>
        </div>
      </header>

      {user && isDrawerOpen && (
        <div className="drawer-overlay" role="presentation" onClick={closeDrawer}>
          <nav
            className="drawer-panel"
            aria-label={t("nav.menuLabel", { ns: "common" })}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-header">
              <span className="app-name">{t("app.name", { ns: "common" })}</span>
              <button type="button" onClick={closeDrawer} aria-label={t("actions.close", { ns: "common" })}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="drawer-links" onClick={closeDrawer}>
              {isManagerRole(user.role) && (
                <NavLink to="/dashboard" className={navLinkClassName}>
                  {t("nav.dashboard", { ns: "common" })}
                </NavLink>
              )}
              {user.role === "TRABAJADOR_CAMPO" && (
                <NavLink to="/my-activities" className={navLinkClassName}>
                  {t("nav.myActivities", { ns: "common" })}
                </NavLink>
              )}
              {isTimeTrackingRole(user.role) && (
                <NavLink to="/my-hours" className={navLinkClassName}>
                  {t("nav.myHours", { ns: "common" })}
                </NavLink>
              )}
              {user.role === "TRABAJADOR_CAMPO" && (
                <NavLink to="/my-tools" className={navLinkClassName}>
                  {t("nav.myTools", { ns: "common" })}
                </NavLink>
              )}
              {user.role === "TRABAJADOR_CAMPO" && (
                <NavLink to="/request-materials" className={navLinkClassName}>
                  {t("nav.requestMaterials", { ns: "common" })}
                </NavLink>
              )}
              <NavLink to="/projects" className={navLinkClassName}>
                {t("nav.projects", { ns: "common" })}
              </NavLink>
              {isManagerRole(user.role) && (
                <NavLink to="/clients" className={navLinkClassName}>
                  {t("nav.clients", { ns: "common" })}
                </NavLink>
              )}
              {isManagerRole(user.role) && (
                <NavLink to="/evidences" className={navLinkClassName}>
                  {t("nav.evidences", { ns: "common" })}
                </NavLink>
              )}
              {isManagerRole(user.role) && (
                <NavLink to="/team-map" className={navLinkClassName}>
                  {t("nav.teamMap", { ns: "common" })}
                </NavLink>
              )}
              {isManagerRole(user.role) && (
                <NavLink to="/agenda" className={navLinkClassName}>
                  {t("nav.agenda", { ns: "common" })}
                </NavLink>
              )}
              {isInventoryRole(user.role) && (
                <NavLink to="/inventory" className={navLinkClassName}>
                  {t("nav.inventory", { ns: "common" })}
                </NavLink>
              )}
              {isInventoryRole(user.role) && (
                <NavLink to="/material-requests" className={navLinkClassName}>
                  {t("nav.materialRequests", { ns: "common" })}
                </NavLink>
              )}
              {isInventoryRole(user.role) && (
                <NavLink to="/tool-assignments" className={navLinkClassName}>
                  {t("nav.toolAssignments", { ns: "common" })}
                </NavLink>
              )}
              {isInventoryRole(user.role) && (
                <NavLink to="/tool-incidents" className={navLinkClassName}>
                  {t("nav.toolIncidents", { ns: "common" })}
                </NavLink>
              )}
              {isTopManagerRole(user.role) && (
                <NavLink to="/invoices" className={navLinkClassName}>
                  {t("nav.invoices", { ns: "common" })}
                </NavLink>
              )}
              {isTopManagerRole(user.role) && (
                <NavLink to="/users" className={navLinkClassName}>
                  {t("nav.users", { ns: "common" })}
                </NavLink>
              )}
              {isTopManagerRole(user.role) && (
                <NavLink to="/settings" className={navLinkClassName}>
                  {t("nav.settings", { ns: "common" })}
                </NavLink>
              )}
            </div>

            <div className="drawer-footer">
              <NavLink to="/profile" className="drawer-profile-link" onClick={closeDrawer}>
                {user.name} · {t(`roles.${user.role}`, { ns: "common" })}
              </NavLink>
              <div className="drawer-footer-actions">
                <LanguageSwitcher />
                <button type="button" className="drawer-logout-button" onClick={() => void logout()}>
                  {t("actions.logout", { ns: "common" })}
                </button>
              </div>
            </div>
          </nav>
        </div>
      )}

      <main className="app-content">
        <Outlet />
        <footer className="app-footer">
          <span className="app-footer-name">{t("app.name", { ns: "common" })}</span>
          <span>{t("footer.address", { ns: "common" })}</span>
        </footer>
      </main>
    </div>
  );
}
