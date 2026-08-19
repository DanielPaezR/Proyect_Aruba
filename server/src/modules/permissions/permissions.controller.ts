import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as permissionsService from "./permissions.service";
import { updateFeatureAccessSchema } from "./permissions.validators";

export const getMine = asyncHandler(async (req: Request, res: Response) => {
  const permissions = await permissionsService.getEffectivePermissions(req.user!.id);
  res.json({ permissions });
});

export const getForUser = asyncHandler(async (req: Request, res: Response) => {
  const permissions = await permissionsService.getEffectivePermissions(req.params.userId);
  res.json({ permissions });
});

export const updateForUser = asyncHandler(async (req: Request, res: Response) => {
  const { feature, granted } = updateFeatureAccessSchema.parse(req.body);
  const permissions = await permissionsService.setFeatureAccess(req.params.userId, feature, granted, req.user!.id);
  res.json({ permissions });
});
