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

// "phone" vacío borra el telefono (se guarda como null); si no se manda el
// campo, el telefono actual no se toca. El email y el nombre no son
// autoeditables aca — eso lo controla el JEFE desde gestión de usuarios.
export const updateProfileSchema = z.object({
  phone: z.string().optional(),
});

export const updateHourlyRateSchema = z.object({
  newRate: z.number().positive(),
  reason: z.string().optional(),
});

// points nunca 0 — un evento sin efecto no aporta nada al historial. reason
// es obligatorio: nunca un descuento (ni un bono) sin motivo.
export const createScoreEventSchema = z.object({
  points: z.number().int().refine((value) => value !== 0, "Los puntos no pueden ser cero"),
  reason: z.string().min(1, "El motivo es obligatorio"),
});

export const getMonthlyScoreQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateLocaleInput = z.infer<typeof updateLocaleSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateHourlyRateInput = z.infer<typeof updateHourlyRateSchema>;
export type CreateScoreEventInput = z.infer<typeof createScoreEventSchema>;
export type GetMonthlyScoreQuery = z.infer<typeof getMonthlyScoreQuerySchema>;
