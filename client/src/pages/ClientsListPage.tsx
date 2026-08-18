import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { CreateClientModal } from "../components/CreateClientModal";
import { useAuth } from "../context/AuthContext";
import { isManagerRole } from "../types/auth";
import type { Client } from "../types/client";

export function ClientsListPage() {
  const { t } = useTranslation(["clients", "common"]);
  const { user } = useAuth();

  const [clients, setClients] = useState<Client[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  async function loadClients() {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await apiClient.get<{ clients: Client[] }>("/clients");
      setClients(response.data.clients);
    } catch (error) {
      setErrorMessage(translateApiError(t, error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) {
    return null;
  }

  if (!isManagerRole(user.role)) {
    return <Navigate to="/" replace />;
  }

  function handleCreated(client: Client) {
    setClients((current) => (current ? [client, ...current] : [client]));
    setIsCreateModalOpen(false);
  }

  return (
    <div className="clients-page">
      <div className="page-header">
        <h1>{t("title", { ns: "clients" })}</h1>
        <button type="button" onClick={() => setIsCreateModalOpen(true)}>
          {t("createButton", { ns: "clients" })}
        </button>
      </div>

      {isLoading && <p className="page-loading">{t("loading", { ns: "common" })}</p>}

      {!isLoading && errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}

      {!isLoading &&
        !errorMessage &&
        clients &&
        (clients.length === 0 ? (
          <p>{t("empty", { ns: "clients" })}</p>
        ) : (
          <ul className="card-list">
            {clients.map((client) => (
              <li key={client.id} className="card">
                <Link to={`/clients/${client.id}`} className="card-link">
                  <div className="card-header">
                    <span className="card-title">{client.name}</span>
                  </div>
                  <span className="card-meta">{client.phone}</span>
                  {client.email && <span className="card-meta">{client.email}</span>}
                  <span className="card-meta">
                    {t("projectsCount", { ns: "clients", count: client._count?.projects ?? 0 })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ))}

      {isCreateModalOpen && (
        <CreateClientModal onCreated={handleCreated} onClose={() => setIsCreateModalOpen(false)} />
      )}
    </div>
  );
}
