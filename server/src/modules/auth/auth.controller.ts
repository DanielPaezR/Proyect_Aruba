import type { Request, Response } from "express";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import { asyncHandler } from "../../utils/asyncHandler";
import * as authService from "./auth.service";
import {
  createScoreEventSchema,
  createUserSchema,
  getMonthlyScoreQuerySchema,
  loginSchema,
  updateHourlyRateSchema,
  updateLocaleSchema,
  updateProfileSchema,
} from "./auth.validators";

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
    throw ApiError.unauthorized(ErrorCode.MISSING_TOKEN, "Falta el refresh token");
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

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await authService.listUsers(req.user!.role);
  res.json({ users });
});

export const updateLocale = asyncHandler(async (req: Request, res: Response) => {
  const { locale } = updateLocaleSchema.parse(req.body);
  const user = await authService.updateLocale(req.user!.id, locale);
  res.json({ user });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const input = updateProfileSchema.parse(req.body);
  const user = await authService.updateProfile(req.user!.id, input, req.file);
  res.json({ user });
});

export const updateHourlyRate = asyncHandler(async (req: Request, res: Response) => {
  const input = updateHourlyRateSchema.parse(req.body);
  const user = await authService.updateHourlyRate(req.params.userId, req.user!.id, input);
  res.json({ user });
});

export const salaryHistory = asyncHandler(async (req: Request, res: Response) => {
  const history = await authService.getSalaryHistory(req.params.userId);
  res.json({ history });
});

export const createScoreEvent = asyncHandler(async (req: Request, res: Response) => {
  const input = createScoreEventSchema.parse(req.body);
  const event = await authService.createScoreEvent(req.params.userId, req.user!.id, input);
  res.status(201).json({ event });
});

export const monthlyScore = asyncHandler(async (req: Request, res: Response) => {
  const { month, year } = getMonthlyScoreQuerySchema.parse(req.query);
  const score = await authService.getMonthlyScore(req.params.userId, month, year);
  res.json(score);
});
