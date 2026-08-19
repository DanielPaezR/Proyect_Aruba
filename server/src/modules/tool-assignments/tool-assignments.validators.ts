import { z } from "zod";

export const listToolAssignmentsQuerySchema = z.object({
  userId: z.string().optional(),
  // true = todavia la tiene (returnedAt null), false = ya devuelta.
  // z.coerce.boolean() NO sirve aca: Boolean("false") es true en JS, asi que
  // ?active=false terminaria pidiendo las activas igual — hay que comparar
  // el string a mano.
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
});

export const createToolAssignmentSchema = z.object({
  itemId: z.string().min(1),
  userId: z.string().min(1),
  condition: z.string().trim().optional(),
});

export type ListToolAssignmentsQuery = z.infer<typeof listToolAssignmentsQuerySchema>;
export type CreateToolAssignmentInput = z.infer<typeof createToolAssignmentSchema>;
