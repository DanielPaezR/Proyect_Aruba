import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedUser {
  name: string;
  role: Role;
  email: string;
  password: string;
}

const SEED_USERS: SeedUser[] = [
  {
    name: "Administrador",
    role: Role.JEFE,
    email: process.env.SEED_JEFE_EMAIL ?? "jefe@empresa.com",
    password: process.env.SEED_JEFE_PASSWORD ?? "CambiarEsta123!",
  },
  {
    name: "Supervisor de Prueba",
    role: Role.SUPERVISOR,
    email: process.env.SEED_SUPERVISOR_EMAIL ?? "supervisor@empresa.com",
    password: process.env.SEED_SUPERVISOR_PASSWORD ?? "CambiarEsta123!",
  },
  {
    name: "Trabajador de Prueba",
    role: Role.TRABAJADOR_CAMPO,
    email: process.env.SEED_WORKER_EMAIL ?? "trabajador@empresa.com",
    password: process.env.SEED_WORKER_PASSWORD ?? "CambiarEsta123!",
  },
];

async function main() {
  for (const user of SEED_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: user.email } });
    if (existing) {
      console.log(`El usuario ${user.role} ya existe (${user.email}), no se crea de nuevo.`);
      continue;
    }

    const passwordHash = await bcrypt.hash(user.password, 12);

    await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
      },
    });

    console.log(`Usuario ${user.role} creado: ${user.email} / ${user.password}`);
  }

  console.log("Cambia estas contraseñas después del primer inicio de sesión.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
