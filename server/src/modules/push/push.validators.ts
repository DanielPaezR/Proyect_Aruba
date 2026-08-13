import { z } from "zod";

// Coincide con la forma que produce PushSubscription.toJSON() en el navegador.
export const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;
