import { z } from "zod";
import { EvidenceStatus } from "@prisma/client";

export const uploadEvidenceSchema = z.object({
  description: z.string().max(500).optional(),
});

export const reviewEvidenceSchema = z.object({
  status: z.enum([EvidenceStatus.APROBADA, EvidenceStatus.RECHAZADA]),
  reviewComment: z.string().max(500).optional(),
});

export const listEvidencesQuerySchema = z.object({
  status: z.nativeEnum(EvidenceStatus).optional(),
  projectId: z.string().optional(),
  activityId: z.string().optional(),
});

export type UploadEvidenceInput = z.infer<typeof uploadEvidenceSchema>;
export type ReviewEvidenceInput = z.infer<typeof reviewEvidenceSchema>;
