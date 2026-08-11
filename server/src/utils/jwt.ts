import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { env } from "../config/env";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
}

/** Token de refresco: un secreto aleatorio opaco (no un JWT firmado con datos). */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

/** Solo se persiste el hash del refresh token, nunca el valor en texto plano. */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
