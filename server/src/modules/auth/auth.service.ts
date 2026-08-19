import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import type { Locale } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import {
  deleteDocumentFile,
  deleteImage,
  uploadDocumentFile,
  uploadImage,
  USER_PROFILE_PHOTOS_FOLDER,
} from "../../config/storage";
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
  UpdateMeInput,
  UpdateProfileInput,
  UpdateUserInput,
  UploadWorkerDocumentInput,
} from "./auth.validators";

type AuthUser = { id: string; role: Role };

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
  // Igual de sensible que hourlyRate (mismo criterio que en
  // JEFE_PROFILE_FIELDS/SUPERVISOR_PROFILE_FIELDS), pero hace falta en el
  // propio GET /me: el trabajador necesita ver su propia tarifa extra para
  // el estimado de ganancia en vivo (ver time-entries.service.ts
  // getTodayStatus) — no es informacion sensible respecto de si mismo.
  overtimeHourlyRate: true,
  isActive: true,
  locale: true,
  photoUrl: true,
  // No es sensible como hourlyRate: visible para cualquiera que ya vea al
  // usuario (incluido el propio en GET /me, que es lo que necesita
  // ProfilePage para mostrar/editar sus especialidades).
  specialties: true,
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

  if (!user) {
    throw ApiError.unauthorized(ErrorCode.INVALID_CREDENTIALS, "Credenciales inválidas");
  }

  // Chequeo separado de "no existe"/"contraseña incorrecta": una cuenta
  // desactivada necesita un mensaje claro ("contacta al Jefe"), no el mismo
  // generico de credenciales invalidas que confundiria al trabajador.
  if (!user.isActive) {
    throw ApiError.unauthorized(ErrorCode.USER_ACCOUNT_DEACTIVATED, "Esta cuenta fue desactivada");
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
      overtimeHourlyRate: user.overtimeHourlyRate,
      isActive: user.isActive,
      locale: user.locale,
      photoUrl: user.photoUrl,
      specialties: user.specialties,
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
 * Edicion general de usuario (JEFE-only): datos basicos + perfil laboral
 * (ver updateUserSchema). hourlyRate queda fuera, ver comentario ahi.
 */
export async function updateUser(userId: string, input: UpdateUserInput) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }

  if (input.email !== undefined && input.email !== existing.email) {
    const emailTaken = await prisma.user.findUnique({ where: { email: input.email } });
    if (emailTaken) {
      throw ApiError.conflict(ErrorCode.EMAIL_TAKEN, "Ya existe un usuario con ese correo");
    }
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.hireDate !== undefined ? { hireDate: input.hireDate } : {}),
      ...(input.overtimeHourlyRate !== undefined ? { overtimeHourlyRate: input.overtimeHourlyRate } : {}),
      ...(input.specialties !== undefined ? { specialties: input.specialties } : {}),
      ...(input.workDaysPerWeek !== undefined ? { workDaysPerWeek: input.workDaysPerWeek } : {}),
      ...(input.workScheduleNote !== undefined ? { workScheduleNote: input.workScheduleNote } : {}),
    },
    select: JEFE_PROFILE_FIELDS,
  });
}

/**
 * Desactivar (JEFE-only): nunca borra nada, solo isActive=false — el
 * historial financiero/laboral (TimeEntry, Payment, SalaryRaise...) sigue
 * intacto, y login() ya bloquea a los usuarios inactivos con un mensaje
 * propio (ver ErrorCode.USER_ACCOUNT_DEACTIVATED).
 */
export async function deactivateUser(userId: string, requesterId: string) {
  if (userId === requesterId) {
    // Si el unico Jefe se desactiva a si mismo, nadie mas puede reactivarlo
    // (reactivar tambien es JEFE-only) — un candado sin llave.
    throw ApiError.badRequest(ErrorCode.CANNOT_DEACTIVATE_SELF, "No puedes desactivar tu propia cuenta");
  }

  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true } });
  if (!existing) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }
  if (!existing.isActive) {
    throw ApiError.conflict(ErrorCode.USER_ALREADY_INACTIVE, "El usuario ya está inactivo");
  }

  return prisma.user.update({ where: { id: userId }, data: { isActive: false }, select: JEFE_PROFILE_FIELDS });
}

/** Reactivar (JEFE-only): por si Don Daniel se equivoca, o alguien vuelve a trabajar. */
export async function reactivateUser(userId: string) {
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true } });
  if (!existing) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }
  if (existing.isActive) {
    throw ApiError.conflict(ErrorCode.USER_ALREADY_ACTIVE, "El usuario ya está activo");
  }

  return prisma.user.update({ where: { id: userId }, data: { isActive: true }, select: JEFE_PROFILE_FIELDS });
}

/** Equivalente a updateProfile (foto propia) pero para que un Jefe/Supervisor
 * suba/reemplace la foto de CUALQUIER trabajador — mismo patron Cloudinary.
 * requesterRole decide el select de vuelta: un Supervisor no debe ver el
 * hourlyRate/overtimeHourlyRate de otro trabajador solo por subirle una foto
 * (mismo criterio que listUsers). */
export async function updateUserPhoto(userId: string, photo: Express.Multer.File, requesterRole: Role) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }

  const uploaded = await uploadImage(photo.buffer, { folder: USER_PROFILE_PHOTOS_FOLDER });

  if (existing.photoPublicId) {
    try {
      await deleteImage(existing.photoPublicId);
    } catch (error) {
      console.error(`No se pudo borrar la foto de perfil anterior (public_id ${existing.photoPublicId}):`, error);
    }
  }

  return prisma.user.update({
    where: { id: userId },
    data: { photoUrl: uploaded.url, photoPublicId: uploaded.publicId },
    select: requesterRole === Role.JEFE ? PUBLIC_USER_FIELDS : SUPERVISOR_USER_FIELDS,
  });
}

/**
 * Autoservicio (cualquier usuario, para si mismo): telefono y especialidades.
 * Separado de updateProfile (telefono + foto, multipart) porque este es
 * JSON plano — mezclar un array con un upload de archivo es mas incomodo
 * que tener dos endpoints chicos. name/email/hireDate/workSchedule* quedan
 * exclusivos de updateUser (JEFE-only).
 */
export async function updateOwnBasicInfo(userId: string, input: UpdateMeInput) {
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.specialties !== undefined ? { specialties: input.specialties } : {}),
    },
    select: PUBLIC_USER_FIELDS,
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
 * actualizado sin su registro en el historial, ni al reves. Unico lugar
 * donde se toca hourlyRate/overtimeHourlyRate — newOvertimeRate es opcional,
 * un aumento puede tocar solo la tarifa normal.
 */
export async function updateHourlyRate(userId: string, createdById: string, input: UpdateHourlyRateInput) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }

  const [updatedUser] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        hourlyRate: input.newRate,
        ...(input.newOvertimeRate !== undefined ? { overtimeHourlyRate: input.newOvertimeRate } : {}),
      },
      select: PUBLIC_USER_FIELDS,
    }),
    prisma.salaryRaise.create({
      data: {
        userId,
        previousRate: existing.hourlyRate,
        newRate: input.newRate,
        previousOvertimeRate: input.newOvertimeRate !== undefined ? existing.overtimeHourlyRate : undefined,
        newOvertimeRate: input.newOvertimeRate,
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

const workerDocumentInclude = {
  uploadedBy: { select: { id: true, name: true } },
} as const;

/** Documentos del trabajador: nunca otro TRABAJADOR_CAMPO, ni siquiera de
 * solo lectura — el propio dueño, o Jefe/Supervisor viendo/gestionando a
 * cualquiera. Chequeo real aca, no solo en el cliente. */
function ensureDocumentAccess(requester: AuthUser, targetUserId: string) {
  const isSelf = requester.id === targetUserId;
  const isManager = requester.role === Role.JEFE || requester.role === Role.SUPERVISOR;
  if (!isSelf && !isManager) {
    throw ApiError.forbidden();
  }
}

export async function uploadWorkerDocument(
  requester: AuthUser,
  targetUserId: string,
  input: UploadWorkerDocumentInput,
  file: Express.Multer.File,
) {
  ensureDocumentAccess(requester, targetUserId);

  const targetExists = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
  if (!targetExists) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }

  const uploaded = await uploadDocumentFile(file.buffer);

  return prisma.workerDocument.create({
    data: {
      userId: targetUserId,
      label: input.label,
      fileUrl: uploaded.url,
      filePublicId: uploaded.publicId,
      uploadedById: requester.id,
    },
    include: workerDocumentInclude,
  });
}

export async function listWorkerDocuments(requester: AuthUser, targetUserId: string) {
  ensureDocumentAccess(requester, targetUserId);

  return prisma.workerDocument.findMany({
    where: { userId: targetUserId },
    include: workerDocumentInclude,
    orderBy: { createdAt: "desc" },
  });
}

/** Borrar: el Jefe siempre puede (cualquier documento), o quien lo subio
 * originalmente (uploadedById) — no necesariamente el dueño del documento,
 * ya que un Jefe/Supervisor puede haberlo subido en nombre de otro. */
export async function deleteWorkerDocument(requester: AuthUser, targetUserId: string, documentId: string) {
  const document = await prisma.workerDocument.findUnique({ where: { id: documentId } });
  if (!document || document.userId !== targetUserId) {
    throw ApiError.notFound(ErrorCode.WORKER_DOCUMENT_NOT_FOUND, "Documento no encontrado");
  }

  if (requester.role !== Role.JEFE && document.uploadedById !== requester.id) {
    throw ApiError.forbidden(ErrorCode.WORKER_DOCUMENT_DELETE_FORBIDDEN, "No puedes eliminar este documento");
  }

  await prisma.workerDocument.delete({ where: { id: documentId } });

  try {
    await deleteDocumentFile(document.filePublicId);
  } catch (error) {
    console.error(`No se pudo borrar el documento de Cloudinary (public_id ${document.filePublicId}):`, error);
  }
}
