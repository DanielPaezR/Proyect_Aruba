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
  ChangePasswordInput,
  CreateSalaryAdjustmentInput,
  CreateScoreEventInput,
  CreateUserInput,
  GetSalaryAdjustmentsQuery,
  LoginInput,
  ResetUserPasswordInput,
  UpdateHourlyRateInput,
  UpdateMeInput,
  UpdateProfileInput,
  UpdateUserInput,
  UploadWorkerDocumentInput,
} from "./auth.validators";

type AuthUser = { id: string; role: Role };

// Acceso equivalente al antiguo JEFE (ahora ADMINISTRADOR) mas GERENTE, que
// tiene el mismo acceso en todo lo existente por diseno de la
// reestructuracion de roles — ver auditoria en cada punto de este archivo
// que compara contra este conjunto.
const ADMIN_ROLES: Role[] = [Role.ADMINISTRADOR, Role.GERENTE];

// Rango de jerarquia real (distinto de "que roles pueden entrar a la ruta",
// eso ya lo filtra authorize()). GERENTE por encima de ADMINISTRADOR por
// diseno; los tres roles de abajo no tienen orden entre si, solo importan
// como "menos que ADMINISTRADOR" para este chequeo.
const ROLE_RANK: Record<Role, number> = {
  [Role.TRABAJADOR_CAMPO]: 0,
  [Role.MERCADERISTA]: 0,
  [Role.SUPERVISOR]: 0,
  [Role.ADMINISTRADOR]: 1,
  [Role.GERENTE]: 2,
};

/**
 * "Porton" de jerarquia real: authorize(ADMINISTRADOR, GERENTE) a nivel de
 * ruta solo valida "tengo uno de estos dos roles", nunca la jerarquia
 * relativa contra el usuario que se esta gestionando — sin esto, cualquier
 * ADMINISTRADOR podia editar/desactivar/restablecerle la contraseña/
 * cambiarle el sueldo a un GERENTE, que por diseno esta por encima.
 *
 * GERENTE es la unica excepcion a "estrictamente mayor": puede gestionar a
 * otro GERENTE (son pares en la cima, a proposito — nunca debe quedar un
 * Gerente sin nadie mas que pueda gestionar su cuenta). Un ADMINISTRADOR
 * nunca puede gestionar a otro ADMINISTRADOR ni a un GERENTE.
 *
 * Aplicar SOLO en rutas que ya estan detras de authorize(ADMINISTRADOR,
 * GERENTE) — nunca en rutas donde SUPERVISOR/MERCADERISTA (rank 0) tambien
 * son actores legitimos (ej. updateUserPhoto, documentos de trabajador):
 * ahi un Supervisor gestionando a un Trabajador de Campo son ambos rank 0,
 * y esta funcion los bloquearia por error — eso no es el hueco que esto
 * cierra, es una funcionalidad existente e intencional.
 */
export async function ensureCanManageTarget(actor: AuthUser, targetUserId: string): Promise<void> {
  if (actor.role === Role.GERENTE) {
    return;
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true } });
  if (!target) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }

  if (ROLE_RANK[actor.role] <= ROLE_RANK[target.role]) {
    throw ApiError.forbidden(
      ErrorCode.CANNOT_MANAGE_HIGHER_ROLE,
      "No puedes gestionar la cuenta de un usuario con un rol igual o superior al tuyo",
    );
  }
}

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
  // ADMIN_PROFILE_FIELDS/SUPERVISOR_PROFILE_FIELDS), pero hace falta en el
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
// ProjectDetailPage): sin hourlyRate, que es exclusivo de vistas de
// ADMINISTRADOR/GERENTE (sueldo/puntaje) aunque el propio GET /users ya sea
// de lectura compartida.
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
// datos de perfil laboral — overtimeHourlyRate solo para ADMINISTRADOR/
// GERENTE (mismo criterio que hourlyRate, ya incluido en PUBLIC_USER_FIELDS),
// el resto (hireDate, specialties, etc) es visible para ambos.
const ADMIN_PROFILE_FIELDS = {
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
  // desactivada necesita un mensaje claro ("contacta al Administrador"), no
  // el mismo generico de credenciales invalidas que confundiria al trabajador.
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

/** Solo Administrador/Gerente pueden dar de alta usuarios (no hay auto-registro). */
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
    select: ADMIN_ROLES.includes(requesterRole) ? PUBLIC_USER_FIELDS : SUPERVISOR_USER_FIELDS,
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
    select: ADMIN_ROLES.includes(requesterRole) ? ADMIN_PROFILE_FIELDS : SUPERVISOR_PROFILE_FIELDS,
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
 * Edicion general de usuario (ADMINISTRADOR/GERENTE-only): datos basicos +
 * perfil laboral (ver updateUserSchema). hourlyRate queda fuera, ver
 * comentario ahi.
 */
export async function updateUser(actor: AuthUser, userId: string, input: UpdateUserInput) {
  await ensureCanManageTarget(actor, userId);

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
      ...(input.specialties !== undefined ? { specialties: input.specialties } : {}),
      ...(input.workDaysPerWeek !== undefined ? { workDaysPerWeek: input.workDaysPerWeek } : {}),
      ...(input.workScheduleNote !== undefined ? { workScheduleNote: input.workScheduleNote } : {}),
    },
    select: ADMIN_PROFILE_FIELDS,
  });
}

/**
 * Desactivar (ADMINISTRADOR/GERENTE-only): nunca borra nada, solo
 * isActive=false — el historial financiero/laboral (TimeEntry, Payment,
 * SalaryRaise...) sigue intacto, y login() ya bloquea a los usuarios
 * inactivos con un mensaje propio (ver ErrorCode.USER_ACCOUNT_DEACTIVATED).
 */
export async function deactivateUser(actor: AuthUser, userId: string) {
  if (userId === actor.id) {
    // Si el unico Administrador/Gerente se desactiva a si mismo, nadie mas
    // puede reactivarlo (reactivar tambien es ADMINISTRADOR/GERENTE-only) —
    // un candado sin llave.
    throw ApiError.badRequest(ErrorCode.CANNOT_DEACTIVATE_SELF, "No puedes desactivar tu propia cuenta");
  }
  await ensureCanManageTarget(actor, userId);

  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true } });
  if (!existing) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }
  if (!existing.isActive) {
    throw ApiError.conflict(ErrorCode.USER_ALREADY_INACTIVE, "El usuario ya está inactivo");
  }

  return prisma.user.update({ where: { id: userId }, data: { isActive: false }, select: ADMIN_PROFILE_FIELDS });
}

/** Reactivar (ADMINISTRADOR/GERENTE-only): por si Don Daniel se equivoca, o alguien vuelve a trabajar. */
export async function reactivateUser(actor: AuthUser, userId: string) {
  await ensureCanManageTarget(actor, userId);

  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true } });
  if (!existing) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }
  if (existing.isActive) {
    throw ApiError.conflict(ErrorCode.USER_ALREADY_ACTIVE, "El usuario ya está activo");
  }

  return prisma.user.update({ where: { id: userId }, data: { isActive: true }, select: ADMIN_PROFILE_FIELDS });
}

/** Equivalente a updateProfile (foto propia) pero para que un Administrador/
 * Gerente/Supervisor suba/reemplace la foto de CUALQUIER trabajador — mismo
 * patron Cloudinary. requesterRole decide el select de vuelta: un Supervisor
 * no debe ver el hourlyRate/overtimeHourlyRate de otro trabajador solo por
 * subirle una foto (mismo criterio que listUsers). */
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
    select: ADMIN_ROLES.includes(requesterRole) ? PUBLIC_USER_FIELDS : SUPERVISOR_USER_FIELDS,
  });
}

/**
 * Autoservicio (cualquier usuario, para si mismo): telefono y especialidades.
 * Separado de updateProfile (telefono + foto, multipart) porque este es
 * JSON plano — mezclar un array con un upload de archivo es mas incomodo
 * que tener dos endpoints chicos. name/email/hireDate/workSchedule* quedan
 * exclusivos de updateUser (ADMINISTRADOR/GERENTE-only).
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
 * nombre/email quedan fuera a proposito — eso lo controla el Administrador/
 * Gerente desde gestión de usuarios, no el propio usuario.
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

/** Autoservicio: cualquier usuario cambia su propia contraseña, siempre que
 * confirme la actual (bcrypt.compare) — sin esto, alguien con la sesion
 * abierta de otro (dispositivo compartido, olvido cerrar sesion) podria
 * tomar la cuenta con solo saber el email. No revoca sesiones/refresh
 * tokens existentes: cambiar la contraseña no debe cerrarle la sesion actual
 * al propio usuario, solo afecta logins futuros. */
export async function changeOwnPassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }

  const currentMatches = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!currentMatches) {
    throw ApiError.unauthorized(ErrorCode.INVALID_CURRENT_PASSWORD, "La contraseña actual no es correcta");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

/** ADMINISTRADOR/GERENTE-only: restablece la contraseña de cualquier usuario
 * sin pedir la actual (para cuando se le olvido la suya). Mismo hash/costo
 * que createUser y changeOwnPassword. */
export async function resetUserPassword(actor: AuthUser, userId: string, input: ResetUserPasswordInput): Promise<void> {
  await ensureCanManageTarget(actor, userId);

  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!existing) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

/**
 * Registra un aumento de sueldo por hora: crea la fila de historial
 * (previousRate = el hourlyRate actual antes de este cambio) y actualiza
 * User.hourlyRate, todo en una sola transaccion — no debe quedar el precio
 * actualizado sin su registro en el historial, ni al reves. Unico lugar
 * donde se toca hourlyRate/overtimeHourlyRate — newOvertimeRate es opcional,
 * un aumento puede tocar solo la tarifa normal.
 */
export async function updateHourlyRate(actor: AuthUser, userId: string, input: UpdateHourlyRateInput) {
  await ensureCanManageTarget(actor, userId);

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
        createdById: actor.id,
      },
    }),
  ]);

  return updatedUser;
}

export async function getSalaryHistory(actor: AuthUser, userId: string) {
  await ensureCanManageTarget(actor, userId);

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

const salaryAdjustmentInclude = {
  createdBy: { select: { id: true, name: true } },
} as const;

/**
 * Adelanto o descuento de sueldo, base para la liquidacion mensual (Modulo
 * 2.3). No toca User.hourlyRate ni ningun otro campo — a diferencia de
 * updateHourlyRate, esto es puro registro, el calculo de liquidacion lo
 * suma/resta aparte.
 */
export async function createSalaryAdjustment(actor: AuthUser, userId: string, input: CreateSalaryAdjustmentInput) {
  await ensureCanManageTarget(actor, userId);

  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }

  return prisma.salaryAdjustment.create({
    data: {
      userId,
      type: input.type,
      amount: input.amount,
      reason: input.reason,
      effectiveDate: input.effectiveDate,
      createdById: actor.id,
    },
    include: salaryAdjustmentInclude,
  });
}

export async function getSalaryAdjustments(actor: AuthUser, userId: string, query: GetSalaryAdjustmentsQuery) {
  await ensureCanManageTarget(actor, userId);

  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }

  return prisma.salaryAdjustment.findMany({
    where: {
      userId,
      ...(query.from || query.to
        ? {
            effectiveDate: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    },
    include: salaryAdjustmentInclude,
    orderBy: { effectiveDate: "desc" },
  });
}

/** Borrado real (no hay edicion): mismo criterio que Payment, solo para
 * corregir un registro mal ingresado — no hay auditoria de "quien lo borro". */
export async function deleteSalaryAdjustment(actor: AuthUser, targetUserId: string, adjustmentId: string) {
  await ensureCanManageTarget(actor, targetUserId);

  const adjustment = await prisma.salaryAdjustment.findUnique({
    where: { id: adjustmentId },
    select: { id: true, userId: true },
  });
  if (!adjustment || adjustment.userId !== targetUserId) {
    throw ApiError.notFound(ErrorCode.SALARY_ADJUSTMENT_NOT_FOUND, "Registro no encontrado");
  }

  await prisma.salaryAdjustment.delete({ where: { id: adjustmentId } });
}

export async function createScoreEvent(actor: AuthUser, userId: string, input: CreateScoreEventInput) {
  await ensureCanManageTarget(actor, userId);

  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) {
    throw ApiError.notFound(ErrorCode.USER_NOT_FOUND, "Usuario no encontrado");
  }

  return prisma.workerScoreEvent.create({
    data: { userId, points: input.points, reason: input.reason, createdById: actor.id },
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

/**
 * Puntaje de un mes = base fija + suma de los eventos de ese mes. Nunca se
 * lee ni se escribe un "puntaje actual" guardado — se recalcula desde el
 * origen cada vez, mismo patron de agregacion por periodo que getSummary()
 * en time-entries.service.ts.
 */
export async function getMonthlyScore(actor: AuthUser, userId: string, month?: number, year?: number) {
  await ensureCanManageTarget(actor, userId);

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
 * solo lectura — el propio dueño, o Administrador/Gerente/Supervisor
 * viendo/gestionando a cualquiera. Chequeo real aca, no solo en el cliente. */
function ensureDocumentAccess(requester: AuthUser, targetUserId: string) {
  const isSelf = requester.id === targetUserId;
  const isManager = ADMIN_ROLES.includes(requester.role) || requester.role === Role.SUPERVISOR;
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

  const uploaded = await uploadDocumentFile(file.buffer, file.mimetype);

  return prisma.workerDocument.create({
    data: {
      userId: targetUserId,
      label: input.label,
      fileUrl: uploaded.url,
      filePublicId: uploaded.publicId,
      fileSize: uploaded.bytes,
      mimeType: file.mimetype,
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

/** Borrar: Administrador/Gerente siempre pueden (cualquier documento), o
 * quien lo subio originalmente (uploadedById) — no necesariamente el dueño
 * del documento, ya que un Administrador/Gerente/Supervisor puede haberlo
 * subido en nombre de otro. */
export async function deleteWorkerDocument(requester: AuthUser, targetUserId: string, documentId: string) {
  const document = await prisma.workerDocument.findUnique({ where: { id: documentId } });
  if (!document || document.userId !== targetUserId) {
    throw ApiError.notFound(ErrorCode.WORKER_DOCUMENT_NOT_FOUND, "Documento no encontrado");
  }

  if (!ADMIN_ROLES.includes(requester.role) && document.uploadedById !== requester.id) {
    throw ApiError.forbidden(ErrorCode.WORKER_DOCUMENT_DELETE_FORBIDDEN, "No puedes eliminar este documento");
  }

  await prisma.workerDocument.delete({ where: { id: documentId } });

  try {
    await deleteDocumentFile(document.filePublicId);
  } catch (error) {
    console.error(`No se pudo borrar el documento de Cloudinary (public_id ${document.filePublicId}):`, error);
  }
}
