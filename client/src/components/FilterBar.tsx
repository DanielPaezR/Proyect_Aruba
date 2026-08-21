import type { ReactNode } from "react";
import { Filter } from "lucide-react";
import { useTranslation } from "react-i18next";

interface FilterBarProps {
  /** Resetea todos los campos del caller a su valor por defecto de una vez. */
  onClear: () => void;
  /** Cada campo es el mismo <label>...</label> que ya se usaba suelto en
   * .card-actions — FilterBar solo cambia el contenedor, no la forma de
   * cada campo individual. */
  children: ReactNode;
}

/** Panel de filtros reutilizable (FinancialHistoryPage, y cualquier pantalla
 * futura con varios campos de filtro) — estilo propio, no .card-actions
 * (esa clase es para botones de accion, no para un panel de filtros).
 * Grid responsivo: una columna en movil, varias en desktop via
 * repeat(auto-fit, minmax(...)), mismo criterio que .stat-grid. */
export function FilterBar({ onClear, children }: FilterBarProps) {
  const { t } = useTranslation("common");

  return (
    <div className="filter-bar">
      <div className="filter-bar__header">
        <span className="filter-bar__title">
          <Filter size={16} aria-hidden="true" />
          {t("filters.title")}
        </span>
        <button type="button" className="filter-bar__clear" onClick={onClear}>
          {t("filters.clearButton")}
        </button>
      </div>
      <div className="filter-bar__grid">{children}</div>
    </div>
  );
}
