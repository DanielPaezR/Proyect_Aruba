import { z } from "zod";

export const listMessagesQuerySchema = z.object({
  before: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
