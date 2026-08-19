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

// Edicion general de usuario (ADMINISTRADOR/GERENTE-only): datos basicos + perfil laboral.
// hourlyRate NO esta aca: sigue exclusivamente en PATCH /hourly-rate, que
// lleva su propio historial auditado (SalaryRaise) — no hay dos caminos
// distintos para tocar el mismo campo auditado. overtimeHourlyRate si esta
// aca porque, a diferencia de hourlyRate, no tiene historial dedicado.
export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  hireDate: z.coerce.date().nullable().optional(),
  overtimeHourlyRate: z.number().positive().nullable().optional(),
  specialties: z.array(z.string()).optional(),
  workDaysPerWeek: z.number().int().min(1).max(7).nullable().optional(),
  workScheduleNote: z.string().nullable().optional(),
});

// Autoservicio (cualquier usuario autenticado): los unicos campos que el
// propio trabajador puede tocar sin pasar por Administrador/Gerente.
// name/email/hireDate/workSchedule* quedan exclusivos de updateUserSchema
// (ADMINISTRADOR/GERENTE-only) — no se duplican aca a proposito.
export const updateMeSchema = z.object({
  phone: z.string().optional(),
  specialties: z.array(z.string()).optional(),
});

export const updateLocaleSchema = z.object({
  locale: z.nativeEnum(Locale),
});

// "phone" vacío borra el telefono (se guarda como null); si no se manda el
// campo, el telefono actual no se toca. El email y el nombre no son
// autoeditables aca — eso lo controla Administrador/Gerente desde gestión de usuarios.
export const updateProfileSchema = z.object({
  phone: z.string().optional(),
});

// Unico lugar donde se cambian hourlyRate/overtimeHourlyRate — un solo
// SalaryRaise puede registrar ambos a la vez con un solo motivo.
// newOvertimeRate es opcional: un aumento puede tocar solo la tarifa normal.
export const updateHourlyRateSchema = z.object({
  newRate: z.number().positive(),
  newOvertimeRate: z.number().positive().optional(),
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

// "label" identifica el documento (ej. "Cedula", "Certificado de manejo"),
// no hay una lista cerrada de tipos — el Administrador/Gerente/trabajador lo escribe libre.
export const uploadWorkerDocumentSchema = z.object({
  label: z.string().min(1).max(100),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type UpdateLocaleInput = z.infer<typeof updateLocaleSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateHourlyRateInput = z.infer<typeof updateHourlyRateSchema>;
export type CreateScoreEventInput = z.infer<typeof createScoreEventSchema>;
export type GetMonthlyScoreQuery = z.infer<typeof getMonthlyScoreQuerySchema>;
export type UploadWorkerDocumentInput = z.infer<typeof uploadWorkerDocumentSchema>;
