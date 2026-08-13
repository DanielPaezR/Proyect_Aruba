import { apiClient } from "../api/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const array = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    array[i] = rawData.charCodeAt(i);
  }
  return array;
}

/**
 * Pide permiso de notificaciones y, si se concede, suscribe el push del
 * dispositivo actual y lo registra en el backend. Nunca lanza ni bloquea al
 * que la llama: sin soporte del navegador, permiso denegado, o cualquier
 * fallo en el camino, simplemente no hace nada.
 */
export async function subscribeToPushIfPossible(): Promise<void> {
  if (!VAPID_PUBLIC_KEY) {
    return;
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    await apiClient.post("/push/subscribe", subscription.toJSON());
  } catch {
    // Silencioso a proposito: esto no debe interrumpir el login.
  }
}
