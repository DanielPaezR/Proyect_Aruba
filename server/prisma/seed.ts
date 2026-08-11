import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_JEFE_EMAIL ?? "jefe@empresa.com";
  const password = process.env.SEED_JEFE_PASSWORD ?? "CambiarEsta123!";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`El usuario Jefe ya existe (${email}), no se crea de nuevo.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      name: "Administrador",
      email,
      passwordHash,
      role: Role.JEFE,
    },
  });

  console.log(`Usuario Jefe creado: ${email} / ${password}`);
  console.log("Cambia esta contraseña después del primer inicio de sesión.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
