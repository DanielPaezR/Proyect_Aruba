import type { Request, Response } from "express";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import { asyncHandler } from "../../utils/asyncHandler";
import * as evidencesService from "./evidences.service";
import { listEvidencesQuerySchema, reviewEvidenceSchema, uploadEvidenceSchema } from "./evidences.validators";

export const listForActivity = asyncHandler(async (req: Request, res: Response) => {
  const evidences = await evidencesService.listForActivity(req.user!, req.params.activityId);
  res.json({ evidences });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const filters = listEvidencesQuerySchema.parse(req.query);
  const evidences = await evidencesService.listEvidences(filters);
  res.json({ evidences });
});

export const upload = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw ApiError.badRequest(ErrorCode.IMAGE_REQUIRED, "Falta la imagen (campo 'image')");
  }

  const { description } = uploadEvidenceSchema.parse(req.body);
  const evidence = await evidencesService.uploadEvidence(req.user!, req.params.activityId, req.file, description);
  res.status(201).json({ evidence });
});

export const review = asyncHandler(async (req: Request, res: Response) => {
  const { status, reviewComment } = reviewEvidenceSchema.parse(req.body);
  const evidence = await evidencesService.reviewEvidence(req.user!, req.params.evidenceId, status, reviewComment);
  res.json({ evidence });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await evidencesService.deleteEvidence(req.user!, req.params.evidenceId);
  res.status(204).send();
});
