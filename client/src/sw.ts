/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare let self: ServiceWorkerGlobalScope;

// vite-plugin-pwa (injectManifest) reemplaza esto por la lista real de
// archivos del build en tiempo de compilacion.
precacheAndRoute(self.__WB_MANIFEST);

// Fallback de navegacion para que rutas del cliente (ej. /projects/123) sirvan
// el index.html precacheado en vez de fallar offline. /api y /uploads viven
// en otro origen (el backend) asi que ni siquiera pasan por este service
// worker, pero se excluyen explicitamente igual como documentacion/defensa.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//, /^\/uploads\//],
  }),
);

self.skipWaiting();
clientsClaim();

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  let payload: PushPayload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      data: { url: payload.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const windowClient of clientList) {
        if ("focus" in windowClient) {
          return windowClient.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
