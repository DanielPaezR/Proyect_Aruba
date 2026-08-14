import { Role } from "@prisma/client";
import { prisma } from "../../config/prisma";

/**
 * Todos los trabajadores de campo activos, hayan reportado ubicacion o no
 * (lat/lng/lastLocationAt quedan null si nunca reportaron) — el cliente
 * decide que hacer con cada caso: el mapa solo plotea a los que si tienen
 * coordenadas, pero la lista de estado del equipo necesita verlos a todos.
 */
export async function listWorkerLocations() {
  return prisma.user.findMany({
    where: {
      role: Role.TRABAJADOR_CAMPO,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      lastKnownLatitude: true,
      lastKnownLongitude: true,
      lastLocationAt: true,
    },
    orderBy: { lastLocationAt: "desc" },
  });
}
