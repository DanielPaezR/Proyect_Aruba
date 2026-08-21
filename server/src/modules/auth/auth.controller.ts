import type { Request, Response } from "express";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import { asyncHandler } from "../../utils/asyncHandler";
import * as authService from "./auth.service";
import {
  changePasswordSchema,
  createSalaryAdjustmentSchema,
  createScoreEventSchema,
  createUserSchema,
  getMonthlyScoreQuerySchema,
  getSalaryAdjustmentsQuerySchema,
  loginSchema,
  resetUserPasswordSchema,
  updateHourlyRateSchema,
  updateLocaleSchema,
  updateMeSchema,
  updateProfileSchema,
  updateUserSchema,
  uploadWorkerDocumentSchema,
} from "./auth.validators";

const REFRESH_COOKIE = "refreshToken";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
// Frontend (Vercel) y backend (Railway) son dominios distintos: en produccion
// esto es una peticion cross-site, y sameSite "lax" NO manda la cookie de
// vuelta salvo en navegacion directa — cualquier recarga perdia la sesion.
// "none" es obligatorio para cookies cross-site en navegadores modernos, pero
// requiere secure: true (los navegadores rechazan "none" sin secure) — por
// eso van atados a la misma condicion, no sueltos. En dev, cliente y server
// corren los dos en localhost (mismo-site, distinto puerto) y "none" sin
// secure directamente se rechazaria, asi que ahi se mantiene "lax".
const REFRESH_COOKIE_SAME_SITE: "none" | "lax" = IS_PRODUCTION ? "none" : "lax";
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: REFRESH_COOKIE_SAME_SITE,
  secure: IS_PRODUCTION,
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

export const getWorkerProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await authService.getWorkerProfile(req.params.userId, req.user!.role);
  res.json(profile);
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const input = updateUserSchema.parse(req.body);
  const user = await authService.updateUser(req.user!, req.params.userId, input);
  res.json({ user });
});

export const deactivateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.deactivateUser(req.user!, req.params.userId);
  res.json({ user });
});

export const reactivateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.reactivateUser(req.user!, req.params.userId);
  res.json({ user });
});

export const updateUserPhoto = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw ApiError.badRequest(ErrorCode.IMAGE_REQUIRED, "Falta la imagen (campo 'photo')");
  }
  const user = await authService.updateUserPhoto(req.params.userId, req.file, req.user!.role);
  res.json({ user });
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const input = updateMeSchema.parse(req.body);
  const user = await authService.updateOwnBasicInfo(req.user!.id, input);
  res.json({ user });
});

export const uploadWorkerDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw ApiError.badRequest(ErrorCode.FILE_REQUIRED, "Selecciona un archivo para subir");
  }
  const input = uploadWorkerDocumentSchema.parse(req.body);
  const document = await authService.uploadWorkerDocument(req.user!, req.params.userId, input, req.file);
  res.status(201).json({ document });
});

export const listWorkerDocuments = asyncHandler(async (req: Request, res: Response) => {
  const documents = await authService.listWorkerDocuments(req.user!, req.params.userId);
  res.json({ documents });
});

export const deleteWorkerDocument = asyncHandler(async (req: Request, res: Response) => {
  await authService.deleteWorkerDocument(req.user!, req.params.userId, req.params.documentId);
  res.status(204).send();
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

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const input = changePasswordSchema.parse(req.body);
  await authService.changeOwnPassword(req.user!.id, input);
  res.status(204).send();
});

export const resetUserPassword = asyncHandler(async (req: Request, res: Response) => {
  const input = resetUserPasswordSchema.parse(req.body);
  await authService.resetUserPassword(req.user!, req.params.userId, input);
  res.status(204).send();
});

export const updateHourlyRate = asyncHandler(async (req: Request, res: Response) => {
  const input = updateHourlyRateSchema.parse(req.body);
  const user = await authService.updateHourlyRate(req.user!, req.params.userId, input);
  res.json({ user });
});

export const salaryHistory = asyncHandler(async (req: Request, res: Response) => {
  const history = await authService.getSalaryHistory(req.user!, req.params.userId);
  res.json({ history });
});

export const createSalaryAdjustment = asyncHandler(async (req: Request, res: Response) => {
  const input = createSalaryAdjustmentSchema.parse(req.body);
  const adjustment = await authService.createSalaryAdjustment(req.user!, req.params.userId, input);
  res.status(201).json({ adjustment });
});

export const listSalaryAdjustments = asyncHandler(async (req: Request, res: Response) => {
  const query = getSalaryAdjustmentsQuerySchema.parse(req.query);
  const adjustments = await authService.getSalaryAdjustments(req.user!, req.params.userId, query);
  res.json({ adjustments });
});

export const deleteSalaryAdjustment = asyncHandler(async (req: Request, res: Response) => {
  await authService.deleteSalaryAdjustment(req.user!, req.params.userId, req.params.adjustmentId);
  res.status(204).send();
});

export const createScoreEvent = asyncHandler(async (req: Request, res: Response) => {
  const input = createScoreEventSchema.parse(req.body);
  const event = await authService.createScoreEvent(req.user!, req.params.userId, input);
  res.status(201).json({ event });
});

export const monthlyScore = asyncHandler(async (req: Request, res: Response) => {
  const { month, year } = getMonthlyScoreQuerySchema.parse(req.query);
  const score = await authService.getMonthlyScore(req.user!, req.params.userId, month, year);
  res.json(score);
});
