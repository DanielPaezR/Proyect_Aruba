import { z } from "zod";
import { AgendaEventType } from "@prisma/client";

export const listAgendaEventsQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const createAgendaEventSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    startAt: z.coerce.date(),
    // Nullable ademas de opcional: el cliente manda null explicito cuando el
    // usuario deja "fecha de fin" vacia, no solo omite la clave.
    endAt: z.coerce.date().nullable().optional(),
    type: z.nativeEnum(AgendaEventType),
    // Vacio o ausente = evento privado (solo lo ve el creador).
    participantIds: z.array(z.string()).optional(),
  })
  .refine((data) => !data.endAt || data.endAt >= data.startAt, {
    message: "endAt no puede ser anterior a startAt",
    path: ["endAt"],
  });

export const updateAgendaEventSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().nullable().optional(),
    type: z.nativeEnum(AgendaEventType).optional(),
    // Vacio o ausente = evento privado (reemplaza la lista completa de
    // participantes, igual que en creacion — no es un "agregar a la lista").
    participantIds: z.array(z.string()).optional(),
  })
  .refine((data) => !data.endAt || !data.startAt || data.endAt >= data.startAt, {
    message: "endAt no puede ser anterior a startAt",
    path: ["endAt"],
  });

export type ListAgendaEventsQuery = z.infer<typeof listAgendaEventsQuerySchema>;
export type CreateAgendaEventInput = z.infer<typeof createAgendaEventSchema>;
export type UpdateAgendaEventInput = z.infer<typeof updateAgendaEventSchema>;
