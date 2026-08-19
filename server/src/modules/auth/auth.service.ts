import bcrypt from "bcryptjs";
import type { Locale, Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { deleteImage, uploadImage, USER_PROFILE_PHOTOS_FOLDER } from "../../config/storage";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import { arubaMonthRangeUtc, arubaStartOfMonthUtc, arubaToday } from "../../utils/geo";
import { generateRefreshToken, hashRefreshToken, signAccessToken } from "../../utils/jwt";
import * as timeEntriesService from "../time-entries/time-entries.service";
import type {
  CreateScoreEventInput,
  CreateUserInput,
  LoginInput,
  UpdateHourlyRateInput,
  UpdateProfileInput,
  UpdateUserInput,
} from "./auth.validators";

// Puntaje con el que arranca cada trabajador al inicio del mes; los eventos
// (siempre negativos por ahora, ver createScoreEventSchema) se suman sobre
// esta base para calcular el puntaje del mes — nunca se decrementa un
// contador directo.
const BASE_MONTHLY_SCORE = 100;

const PUBLIC_USER_FIELDS = {
  id: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  hourlyRate: true,
  isActive: true,
  locale: true,
  photoUrl: true,
  createdAt: true,
} as const;

// Listado para SUPERVISOR (p.ej. panel de asignación de trabajadores en
// ProjectDetailPage): sin hourlyRate, que es exclusivo de vistas del JEFE
// (sueldo/puntaje) aunque el propio GET /users ya sea de lectura compartida.
const SUPERVISOR_USER_FIELDS = {
  id: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  isActive: true,
  locale: true,
  photoUrl: true,
} as const;

// Perfil consolidado del trabajador: mismos campos por rol de arriba, mas los
// datos de perfil laboral — overtimeHourlyRate solo para JEFE (mismo criterio
// que hourlyRate, ya incluido en PUBLIC_USER_FIELDS), el resto (hireDate,
// specialties, etc) es visible para ambos.
const JEFE_PROFILE_FIELDS = {
  ...PUBLIC_USER_FIELDS,
  overtimeHourlyRate: true,
  hireDate: true,
  specialties: true,
  workDaysPerWeek: true,
  workScheduleNote: true,
} as const;

const SUPERVISOR_PROFILE_FIELDS = {
  ...SUPERVISOR_USER_FIELDS,
  hireDate: true,
  specialties: true,
  workDaysPerWeek: true,
  workScheduleNote: true,
} as const;

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function refreshTokenExpiryDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + env.jwtRefreshExpiresInDays);
  return date;
}

async function issueTokenPair(user: { id: string; role: import("@prisma/client").Role }) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role });

  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashRefreshToken(refreshToken),
      userId: user.id,
      expiresAt: refreshTokenExpiryDate(),
    },
  });

  return { accessToken, refreshToken };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user || !user.isActive) {
    throw ApiError.unauthorized(ErrorCode.INVALID_CREDENTIALS, "Credenciales inválidas");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw ApiError.unauthorized(ErrorCode.INVALID_CREDENTIALS, "Credenciales inválidas");
  }

  const tokens = await issueTokenPair(user);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      hourlyRate: user.hourlyRate,
      isActive: user.isActive,
      locale: user.locale,
      photoUrl: user.photoUrl,
      createdAt: user.createdAt,
    },
    ...tokens,
  };
}

export async function refresh(refreshTokenRaw: string) {
  const tokenHash = hashRefreshToken(refreshTokenRaw);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date() || !stored.user.isActive) {
    throw ApiError.unauthorized(ErrorCode.INVALID_SESSION, "Sesión inválida, vuelva a iniciar sesión");
  }

  // Rotación: se revoca el token usado y se emite un par nuevo.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  return issueTokenPair(stored.user);
}

export async function logout(refreshTokenRaw: string) {
  const tokenHash = hashRefreshToken(refreshTokenRaw);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PUBLIC_USER_FIELDS,
  });

  if (!user) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }

  return user;
}

/** Solo el JEFE puede dar de alta usuarios (no hay auto-registro). */
export async function createUser(input: CreateUserInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw ApiError.conflict(ErrorCode.EMAIL_TAKEN, "Ya existe un usuario con ese correo");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      phone: input.phone,
      hourlyRate: input.hourlyRate,
    },
    select: PUBLIC_USER_FIELDS,
  });

  return user;
}

export async function listUsers(requesterRole: Role) {
  return prisma.user.findMany({
    select: requesterRole === "JEFE" ? PUBLIC_USER_FIELDS : SUPERVISOR_USER_FIELDS,
    orderBy: { name: "asc" },
  });
}

/**
 * Perfil "todo en uno" del trabajador: datos basicos + laborales, proyectos
 * distintos en los que trabajo (via ActivityAssignment -> Activity ->
 * Project, deduplicados por venir de un Project.findMany en vez de iterar
 * asignaciones), y horas trabajadas del mes actual (mismo calculo que
 * getWorkerDashboard en dashboard.service.ts, pero por mes en vez de semana).
 */
export async function getWorkerProfile(userId: string, requesterRole: Role) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: requesterRole === "JEFE" ? JEFE_PROFILE_FIELDS : SUPERVISOR_PROFILE_FIELDS,
  });

  if (!user) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }

  const projects = await prisma.project.findMany({
    where: { activities: { some: { assignments: { some: { userId } } } } },
    select: { id: true, name: true, status: true },
    orderBy: { name: "asc" },
  });

  const monthSummary = await timeEntriesService.getSummary({ from: arubaStartOfMonthUtc(), userId });
  const hoursThisMonth = roundToOneDecimal((monthSummary[0]?.totalMinutes ?? 0) / 60);

  return { user, projects, hoursThisMonth };
}

/**
 * Edicion general de usuario (JEFE-only) — hoy solo cubre los campos de
 * perfil laboral agregados para el perfil consolidado (ver updateUserSchema).
 */
export async function updateUser(userId: string, input: UpdateUserInput) {
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.hireDate !== undefined ? { hireDate: input.hireDate } : {}),
      ...(input.overtimeHourlyRate !== undefined ? { overtimeHourlyRate: input.overtimeHourlyRate } : {}),
      ...(input.specialties !== undefined ? { specialties: input.specialties } : {}),
      ...(input.workDaysPerWeek !== undefined ? { workDaysPerWeek: input.workDaysPerWeek } : {}),
      ...(input.workScheduleNote !== undefined ? { workScheduleNote: input.workScheduleNote } : {}),
    },
    select: JEFE_PROFILE_FIELDS,
  });
}

export async function updateLocale(userId: string, locale: Locale) {
  return prisma.user.update({
    where: { id: userId },
    data: { locale },
    select: PUBLIC_USER_FIELDS,
  });
}

/**
 * Autoservicio: cualquier usuario edita su propio telefono y foto. El
 * nombre/email quedan fuera a proposito — eso lo controla el JEFE desde
 * gestión de usuarios, no el propio usuario.
 */
export async function updateProfile(userId: string, input: UpdateProfileInput, photo?: Express.Multer.File) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }

  let photoFields: { photoUrl?: string; photoPublicId?: string } = {};
  if (photo) {
    const uploaded = await uploadImage(photo.buffer, { folder: USER_PROFILE_PHOTOS_FOLDER });
    photoFields = { photoUrl: uploaded.url, photoPublicId: uploaded.publicId };

    if (existing.photoPublicId) {
      // Best-effort, mismo patron que activities/evidences: la fila ya se va
      // a actualizar igual, un fallo limpiando la foto vieja de Cloudinary
      // no debe tumbar la respuesta.
      try {
        await deleteImage(existing.photoPublicId);
      } catch (error) {
        console.error(`No se pudo borrar la foto de perfil anterior (public_id ${existing.photoPublicId}):`, error);
      }
    }
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...photoFields,
    },
    select: PUBLIC_USER_FIELDS,
  });
}

/**
 * Registra un aumento de sueldo por hora: crea la fila de historial
 * (previousRate = el hourlyRate actual antes de este cambio) y actualiza
 * User.hourlyRate, todo en una sola transaccion — no debe quedar el precio
 * actualizado sin su registro en el historial, ni al reves.
 */
export async function updateHourlyRate(userId: string, createdById: string, input: UpdateHourlyRateInput) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }

  const [updatedUser] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { hourlyRate: input.newRate },
      select: PUBLIC_USER_FIELDS,
    }),
    prisma.salaryRaise.create({
      data: {
        userId,
        previousRate: existing.hourlyRate,
        newRate: input.newRate,
        reason: input.reason,
        createdById,
      },
    }),
  ]);

  return updatedUser;
}

export async function getSalaryHistory(userId: string) {
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }

  return prisma.salaryRaise.findMany({
    where: { userId },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createScoreEvent(userId: string, createdById: string, input: CreateScoreEventInput) {
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }

  return prisma.workerScoreEvent.create({
    data: { userId, points: input.points, reason: input.reason, createdById },
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

/**
 * Puntaje de un mes = base fija + suma de los eventos de ese mes. Nunca se
 * lee ni se escribe un "puntaje actual" guardado — se recalcula desde el
 * origen cada vez, mismo patron de agregacion por periodo que getSummary()
 * en time-entries.service.ts.
 */
export async function getMonthlyScore(userId: string, month?: number, year?: number) {
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }

  const today = arubaToday();
  const targetMonth = month ?? today.getUTCMonth() + 1;
  const targetYear = year ?? today.getUTCFullYear();

  const { start, end } = arubaMonthRangeUtc(targetYear, targetMonth);

  const events = await prisma.workerScoreEvent.findMany({
    where: { userId, createdAt: { gte: start, lt: end } },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const pointsSum = events.reduce((sum, event) => sum + event.points, 0);

  return {
    month: targetMonth,
    year: targetYear,
    baseScore: BASE_MONTHLY_SCORE,
    currentScore: BASE_MONTHLY_SCORE + pointsSum,
    events,
  };
}
