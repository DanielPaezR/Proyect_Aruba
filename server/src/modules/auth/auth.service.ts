import bcrypt from "bcryptjs";
import type { Locale } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { deleteImage, uploadImage, USER_PROFILE_PHOTOS_FOLDER } from "../../config/storage";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import { generateRefreshToken, hashRefreshToken, signAccessToken } from "../../utils/jwt";
import type { CreateUserInput, LoginInput, UpdateProfileInput } from "./auth.validators";

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

export async function listUsers() {
  return prisma.user.findMany({
    select: PUBLIC_USER_FIELDS,
    orderBy: { name: "asc" },
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
