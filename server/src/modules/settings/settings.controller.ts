import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as settingsService from "./settings.service";
import { updateSettingsSchema } from "./settings.validators";

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await settingsService.getSettings();
  res.json({ settings });
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const input = updateSettingsSchema.parse(req.body);
  const settings = await settingsService.updateSettings(input);
  res.json({ settings });
});
