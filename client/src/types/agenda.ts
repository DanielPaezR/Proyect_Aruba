export const AGENDA_EVENT_TYPES = ["REUNION", "PENDIENTE", "OTRO"] as const;
export type AgendaEventType = (typeof AGENDA_EVENT_TYPES)[number];

export interface AgendaEvent {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  type: AgendaEventType;
  createdById: string;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  // Vacio = evento privado, solo lo ve el creador (mas Administrador/Gerente,
  // que ven todo sin excepcion). Ver agenda-events.service.ts.
  participants: { id: string; name: string; photoUrl: string | null }[];
}

/** Forma reducida de Activity que devuelve GET /activities/scheduled — solo
 * lo que hace falta para mostrarla en la vista combinada de /agenda. */
export interface ScheduledActivity {
  id: string;
  title: string;
  scheduledDate: string;
  projectId: string;
  project: { id: string; name: string };
}
