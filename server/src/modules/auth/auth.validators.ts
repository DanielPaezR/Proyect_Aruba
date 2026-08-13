import { z } from "zod";
import { Locale, Role } from "@prisma/client";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  role: z.nativeEnum(Role),
  phone: z.string().optional(),
  hourlyRate: z.number().positive().optional(),
});

export const updateLocaleSchema = z.object({
  locale: z.nativeEnum(Locale),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateLocaleInput = z.infer<typeof updateLocaleSchema>;
