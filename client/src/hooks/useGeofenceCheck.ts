import { useEffect } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";

/** Pide la ubicacion y llama a /time-entries/auto-check. Nunca molesta al
 * usuario: sin geolocalizacion disponible, permiso denegado, o error de red,
 * simplemente no hace nada — esto corre en segundo plano. */
function checkGeofence() {
  if (!("geolocation" in navigator)) {
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      void apiClient
        .post("/time-entries/auto-check", {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        .catch(() => undefined);
    },
    () => undefined,
    { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
  );
}

/** Al montar (abrir la app) y cada vez que vuelve a foreground, si el usuario
 * es TRABAJADOR_CAMPO, intenta el marcado automatico por geocerca. Silencioso
 * por diseno: sin loaders ni popups, el trabajador sigue usando la app normal. */
export function useGeofenceCheck() {
  const { user } = useAuth();
  const role = user?.role;

  useEffect(() => {
    if (role !== "TRABAJADOR_CAMPO") {
      return;
    }

    checkGeofence();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkGeofence();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [role]);
}
