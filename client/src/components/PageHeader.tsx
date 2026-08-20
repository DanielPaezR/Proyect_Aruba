import type { ReactNode } from "react";
import { BackButton } from "./BackButton";

interface PageHeaderProps {
  /** Caso comun: texto simple, se envuelve en <h1> automaticamente. */
  title?: ReactNode;
  /** Caso especial (ej. WorkerProfilePage: foto+nombre+badges) — reemplaza
   * el <h1> automatico, el caller ya incluye su propio encabezado. */
  content?: ReactNode;
  /** Si se pasa, muestra <BackButton> antes del titulo — mismas props que
   * BackButton (to/label), ambas opcionales. */
  back?: { to?: string; label?: string };
  /** Botones/filtros a la derecha del titulo. */
  children?: ReactNode;
}

/**
 * Header de seccion fijo (sticky) mientras el contenido de abajo hace
 * scroll — ver .page-title-bar en index.css. Distinto de la clase utilitaria
 * ".page-header" (que sigue existiendo tal cual, reusada para sub-secciones
 * colapsables dentro de una pagina, ej. WorkerProfilePage) para no volver
 * sticky algo que no es el titulo real de la pantalla.
 */
export function PageHeader({ title, content, back, children }: PageHeaderProps) {
  return (
    <div className="page-title-bar">
      <div className="page-title-bar__main">
        {back && <BackButton to={back.to} label={back.label} />}
        {content ?? <h1>{title}</h1>}
      </div>
      {children && <div className="page-title-bar__actions">{children}</div>}
    </div>
  );
}
