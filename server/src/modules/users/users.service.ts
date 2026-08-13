import { Role } from "@prisma/client";
import { prisma } from "../../config/prisma";

/** Solo trabajadores que ya reportaron ubicacion al menos una vez. */
export async function listWorkerLocations() {
  return prisma.user.findMany({
    where: {
      role: Role.TRABAJADOR_CAMPO,
      isActive: true,
      lastLocationAt: { not: null },
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
