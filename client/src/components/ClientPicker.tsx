import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { translateApiError } from "../api/apiError";
import { apiClient } from "../api/client";
import { CreateClientModal } from "./CreateClientModal";
import type { Client } from "../types/client";

interface ClientPickerProps {
  value: string | null;
  onChange: (clientId: string | null, client: Client | null) => void;
}

/** Combobox con busqueda para elegir un Client existente, con opcion de crear
 * uno nuevo sin salir del formulario donde se usa (ver CreateClientModal).
 * Carga su propia lista al montarse, mismo patron "self-contained" que
 * AssignWorkersPanel. */
export function ClientPicker({ value, onChange }: ClientPickerProps) {
  const { t } = useTranslation(["clients", "common"]);

  const [clients, setClients] = useState<Client[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadClients() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const response = await apiClient.get<{ clients: Client[] }>("/clients");
        if (!cancelled) {
          setClients(response.data.clients);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(translateApiError(t, error));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    void loadClients();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza el texto mostrado con el clientId seleccionado (prop value) —
  // reactivo a la fuente de verdad en vez de mutarse desde el handler de
  // seleccion, para no arrastrar un valor viejo en closures asincronos.
  useEffect(() => {
    const match = clients?.find((client) => client.id === value) ?? null;
    setInputValue(match?.name ?? "");
  }, [value, clients]);

  function handleSelect(client: Client) {
    setIsOpen(false);
    onChange(client.id, client);
  }

  function handleClear() {
    setIsOpen(false);
    onChange(null, null);
  }

  function handleCreated(client: Client) {
    setClients((current) => (current ? [...current, client] : [client]));
    setIsCreateModalOpen(false);
    onChange(client.id, client);
  }

  const query = inputValue.trim().toLowerCase();
  const filteredClients =
    clients?.filter(
      (client) => query === "" || client.name.toLowerCase().includes(query) || client.phone.includes(query),
    ) ?? [];

  return (
    <div className="client-picker">
      <input
        type="text"
        value={inputValue}
        onChange={(event) => {
          setInputValue(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        placeholder={t("pickerPlaceholder", { ns: "clients" })}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
      />

      {isLoading && <p className="client-picker-hint">{t("loading", { ns: "common" })}</p>}
      {!isLoading && loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}

      {isOpen && !isLoading && !loadError && (
        <ul className="client-picker-dropdown" role="listbox">
          {value && (
            <li>
              <button
                type="button"
                className="client-picker-clear"
                onMouseDown={(event) => event.preventDefault()}
                onClick={handleClear}
              >
                {t("pickerClear", { ns: "clients" })}
              </button>
            </li>
          )}
          {filteredClients.length === 0 ? (
            <li className="client-picker-empty">{t("pickerEmpty", { ns: "clients" })}</li>
          ) : (
            filteredClients.map((client) => (
              <li key={client.id}>
                <button
                  type="button"
                  className="client-picker-option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(client)}
                >
                  <span>{client.name}</span>
                  <span className="client-picker-option-meta">{client.phone}</span>
                </button>
              </li>
            ))
          )}
          <li>
            <button
              type="button"
              className="client-picker-create"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setIsCreateModalOpen(true)}
            >
              {t("pickerCreateNew", { ns: "clients" })}
            </button>
          </li>
        </ul>
      )}

      {isCreateModalOpen && (
        <CreateClientModal onCreated={handleCreated} onClose={() => setIsCreateModalOpen(false)} />
      )}
    </div>
  );
}
