import { z } from "zod";
import { Feature } from "@prisma/client";

export const updateFeatureAccessSchema = z.object({
  feature: z.nativeEnum(Feature),
  granted: z.boolean(),
});

export type UpdateFeatureAccessInput = z.infer<typeof updateFeatureAccessSchema>;
