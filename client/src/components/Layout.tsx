import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="app-name">{t("app.name", { ns: "common" })}</span>
        <div className="topbar-actions">
          <LanguageSwitcher />
          {user && (
            <div className="user-menu">
              <span className="user-name">
                {user.name} · {t(`roles.${user.role}`, { ns: "common" })}
              </span>
              <button type="button" onClick={() => void logout()}>
                {t("actions.logout", { ns: "common" })}
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
