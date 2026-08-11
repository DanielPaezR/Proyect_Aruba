import { z } from "zod";
import { Role } from "@prisma/client";

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
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
