import { WebPushError } from "web-push";
import { prisma } from "../config/prisma";
import { webpush } from "../config/webpush";

/** Manda un push a todas las suscripciones activas de un usuario (puede tener
 * varias, un dispositivo/navegador cada una). Best-effort por suscripcion: si
 * una fallo con 404/410 el navegador ya la invalido (desinstalo la app,
 * revoco el permiso...) y se borra en vez de reintentar contra un endpoint
 * muerto; cualquier otro error solo se loguea, no debe tumbar al caller. */
export async function sendPushToUser(userId: string, payload: { title: string; body: string }): Promise<void> {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) {
    return;
  }

  const serialized = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          serialized,
        );
      } catch (error) {
        if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
          await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
        } else {
          console.error(`No se pudo enviar push (subscription ${subscription.id}):`, error);
        }
      }
    }),
  );
}
