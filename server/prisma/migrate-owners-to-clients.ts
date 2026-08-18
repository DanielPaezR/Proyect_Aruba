/**
 * Migracion de DATOS (no de schema): para cada Project con ownerName no nulo
 * y sin clientId todavia, busca o crea el Client correspondiente (match por
 * name+phone, para no duplicar cuando el mismo dueño tiene varios proyectos)
 * y setea project.clientId.
 *
 * Idempotente: los proyectos que ya tienen clientId se saltan por completo en
 * corridas posteriores, asi que correrlo dos veces no duplica clientes ni
 * vuelve a tocar lo ya migrado.
 *
 * No se ejecuta automaticamente en el deploy — se corre a mano:
 *   npx tsx prisma/migrate-owners-to-clients.ts
 *
 * ownerName/ownerPhone/ownerEmail de Project NO se tocan ni se borran aca,
 * quedan como respaldo (se quitan en una ronda aparte una vez confirmado que
 * esta migracion salio bien).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    where: { ownerName: { not: null }, clientId: null },
    select: { id: true, ownerName: true, ownerPhone: true, ownerEmail: true },
  });

  let clientsCreated = 0;
  let projectsLinked = 0;
  let projectsSkipped = 0;

  for (const project of projects) {
    const name = project.ownerName!.trim();
    // ownerPhone es nullable en Project pero Client.phone es obligatorio —
    // cae a "" si no hay telefono registrado (poco comun, pero posible en
    // datos viejos).
    const phone = (project.ownerPhone ?? "").trim();

    if (!name) {
      console.warn(`Proyecto ${project.id}: ownerName vacio tras trim, se omite.`);
      projectsSkipped++;
      continue;
    }

    let client = await prisma.client.findFirst({ where: { name, phone } });
    if (!client) {
      client = await prisma.client.create({
        data: {
          name,
          phone,
          email: project.ownerEmail ?? undefined,
        },
      });
      clientsCreated++;
      console.log(`Cliente creado: "${name}" (${phone || "sin teléfono"}) -> ${client.id}`);
    }

    await prisma.project.update({ where: { id: project.id }, data: { clientId: client.id } });
    projectsLinked++;
  }

  console.log("---");
  console.log(`Clientes creados: ${clientsCreated}`);
  console.log(`Proyectos enlazados: ${projectsLinked}`);
  console.log(`Proyectos omitidos (ownerName vacío): ${projectsSkipped}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
