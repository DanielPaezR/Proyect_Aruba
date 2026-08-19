import { z } from "zod";
import { ProjectPriority, ProjectPropertyType, ProjectSector, ProjectStatus, ProjectWorkType } from "@prisma/client";

// Validacion basica de formato, no verifica que el link resuelva a un lugar
// real: debe ser https y apuntar a Google Maps (dominio completo o el
// acortador maps.app.goo.gl que usa "Compartir" desde la app de Maps).
const mapsUrlSchema = z
  .string()
  .refine(
    (value) =>
      value.startsWith("https://") && (value.includes("google.com/maps") || value.includes("maps.app.goo.gl")),
    "El link debe empezar con https:// y ser un link de Google Maps (google.com/maps o maps.app.goo.gl)",
  )
  .nullable()
  .optional();

export const createProjectSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),

  // Opcional mientras conviven el Client real y el owner en texto libre de
  // abajo (ver prisma/migrate-owners-to-clients.ts). Nullable ademas de
  // opcional: clientId es nullable a nivel de DB, hace falta poder mandar
  // null explicito para desvincular un proyecto de su cliente.
  clientId: z.string().nullable().optional(),

  // Información operativa del sitio de trabajo. ownerName/ownerPhone/ownerEmail
  // ahora son opcionales (antes required): el cliente los reemplaza como forma
  // primaria de capturar el dueño, ver clientId arriba — se mantienen solo
  // como respaldo/legado, ya no se les exige nada al crear.
  ownerName: z.string().min(2).optional(),
  ownerPhone: z.string().min(1).optional(),
  ownerEmail: z.string().email().optional(),
  address: z.string().min(1),
  mapsUrl: mapsUrlSchema,
  sector: z.nativeEnum(ProjectSector).optional(),
  accessNotes: z.string().optional(),
  propertyType: z.nativeEnum(ProjectPropertyType),
  workType: z.nativeEnum(ProjectWorkType),
  priority: z.nativeEnum(ProjectPriority).optional(),
  electricalPlansUrl: z.string().url().optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const listProjectsQuerySchema = z.object({
  status: z.nativeEnum(ProjectStatus).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
