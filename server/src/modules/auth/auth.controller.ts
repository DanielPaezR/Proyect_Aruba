import type { Request, Response } from "express";
import { ApiError } from "../../utils/ApiError";
import { asyncHandler } from "../../utils/asyncHandler";
import * as authService from "./auth.service";
import { createUserSchema, loginSchema } from "./auth.validators";

const REFRESH_COOKIE = "refreshToken";
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api/auth",
};

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const { accessToken, refreshToken, user } = await authService.login(input);

  res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
  res.json({ user, accessToken });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) {
    throw ApiError.unauthorized("Falta el refresh token");
  }

  const { accessToken, refreshToken } = await authService.refresh(token);
  res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
  res.json({ accessToken });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    await authService.logout(token);
  }
  res.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
  res.status(204).send();
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getCurrentUser(req.user!.id);
  res.json({ user });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const input = createUserSchema.parse(req.body);
  const user = await authService.createUser(input);
  res.status(201).json({ user });
});
