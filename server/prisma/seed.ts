import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import {
  PrismaClient,
  Role,
  ProjectStatus,
  ActivityStatus,
  EvidenceStatus,
  ProjectSector,
  ProjectPropertyType,
  ProjectWorkType,
  ProjectPriority,
} from "@prisma/client";
import { uploadEvidenceImage } from "../src/config/storage";

const prisma = new PrismaClient();

interface SeedUser {
  name: string;
  role: Role;
  email: string;
  password: string;
}

const JEFE_EMAIL = process.env.SEED_JEFE_EMAIL ?? "jefe@empresa.com";
const SUPERVISOR_EMAIL = process.env.SEED_SUPERVISOR_EMAIL ?? "supervisor@empresa.com";
const WORKER_EMAIL = process.env.SEED_WORKER_EMAIL ?? "trabajador@empresa.com";
const WORKER2_EMAIL = process.env.SEED_WORKER2_EMAIL ?? "trabajador2@empresa.com";

const SEED_USERS: SeedUser[] = [
  {
    name: "Administrador",
    role: Role.JEFE,
    email: JEFE_EMAIL,
    password: process.env.SEED_JEFE_PASSWORD ?? "CambiarEsta123!",
  },
  {
    name: "Supervisor de Prueba",
    role: Role.SUPERVISOR,
    email: SUPERVISOR_EMAIL,
    password: process.env.SEED_SUPERVISOR_PASSWORD ?? "CambiarEsta123!",
  },
  {
    name: "Trabajador de Prueba",
    role: Role.TRABAJADOR_CAMPO,
    email: WORKER_EMAIL,
    password: process.env.SEED_WORKER_PASSWORD ?? "CambiarEsta123!",
  },
  {
    name: "Segundo Trabajador de Prueba",
    role: Role.TRABAJADOR_CAMPO,
    email: WORKER2_EMAIL,
    password: process.env.SEED_WORKER2_PASSWORD ?? "CambiarEsta123!",
  },
];

// IDs fijos para que el proyecto/actividades/evidencia de prueba sean
// idempotentes vía upsert, igual que los usuarios (correr el seed dos veces
// no crea duplicados).
const SEED_PROJECT_ID = "seed-project-paradera-demo";
const SEED_ACTIVITY_TABLERO_ID = "seed-activity-tablero-demo";
const SEED_ACTIVITY_TOMACORRIENTES_ID = "seed-activity-tomacorrientes-demo";
const SEED_EVIDENCE_ID = "seed-evidence-tablero-demo";
const SEED_EVIDENCE_PUBLIC_ID = "seed-placeholder-evidence";

async function seedUsers(): Promise<Record<string, { id: string }>> {
  const usersByEmail: Record<string, { id: string }> = {};

  for (const user of SEED_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: user.email } });
    if (existing) {
      console.log(`El usuario ${user.role} ya existe (${user.email}), no se crea de nuevo.`);
      usersByEmail[user.email] = existing;
      continue;
    }

    const passwordHash = await bcrypt.hash(user.password, 12);

    const created = await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
      },
    });

    console.log(`Usuario ${user.role} creado: ${user.email} / ${user.password}`);
    usersByEmail[user.email] = created;
  }

  return usersByEmail;
}

async function seedDemoProject(usersByEmail: Record<string, { id: string }>) {
  const jefe = usersByEmail[JEFE_EMAIL];
  const worker1 = usersByEmail[WORKER_EMAIL];
  const worker2 = usersByEmail[WORKER2_EMAIL];

  const project = await prisma.project.upsert({
    where: { id: SEED_PROJECT_ID },
    update: {},
    create: {
      id: SEED_PROJECT_ID,
      name: "Instalación eléctrica - Villa Paradera (demo)",
      description: "Proyecto de prueba con todos los campos operativos llenos, para QA y demos.",
      status: ProjectStatus.EN_PROGRESO,
      ownerName: "Carlos Wever",
      ownerPhone: "+297 592 1122",
      ownerEmail: "carlos.wever@example.com",
      address: "Paradera 12, Aruba",
      sector: ProjectSector.PARADERA,
      accessNotes: "Portón verde, tocar timbre dos veces. Hay un perro guardián amarrado en el patio.",
      propertyType: ProjectPropertyType.RESIDENCIAL,
      workType: ProjectWorkType.INSTALACION_NUEVA,
      priority: ProjectPriority.ALTA,
      electricalPlansUrl: "https://drive.google.com/drive/folders/1SeedDemoPlanosParadera",
      createdById: jefe.id,
    },
  });
  console.log(`Proyecto de prueba listo: ${project.name}`);

  const activityTablero = await prisma.activity.upsert({
    where: { id: SEED_ACTIVITY_TABLERO_ID },
    update: {},
    create: {
      id: SEED_ACTIVITY_TABLERO_ID,
      title: "Cableado de tablero principal",
      description: "Tendido y conexión de cableado desde el medidor hasta el tablero principal.",
      status: ActivityStatus.EN_PROGRESO,
      projectId: project.id,
    },
  });

  const activityTomacorrientes = await prisma.activity.upsert({
    where: { id: SEED_ACTIVITY_TOMACORRIENTES_ID },
    update: {},
    create: {
      id: SEED_ACTIVITY_TOMACORRIENTES_ID,
      title: "Instalación de tomacorrientes exteriores",
      description: "Colocación de tomacorrientes con protección IP65 en patio y terraza.",
      status: ActivityStatus.PENDIENTE,
      projectId: project.id,
    },
  });

  await prisma.activityAssignment.upsert({
    where: { activityId_userId: { activityId: activityTablero.id, userId: worker1.id } },
    update: {},
    create: { activityId: activityTablero.id, userId: worker1.id },
  });

  await prisma.activityAssignment.upsert({
    where: { activityId_userId: { activityId: activityTomacorrientes.id, userId: worker1.id } },
    update: {},
    create: { activityId: activityTomacorrientes.id, userId: worker1.id },
  });

  await prisma.activityAssignment.upsert({
    where: { activityId_userId: { activityId: activityTomacorrientes.id, userId: worker2.id } },
    update: {},
    create: { activityId: activityTomacorrientes.id, userId: worker2.id },
  });

  console.log("Actividades de prueba y sus asignaciones listas.");

  const existingEvidence = await prisma.evidence.findUnique({ where: { id: SEED_EVIDENCE_ID } });
  if (existingEvidence) {
    console.log("La evidencia de prueba ya existe, no se vuelve a subir a Cloudinary.");
  } else {
    const sourceImage = path.join(__dirname, "seed-assets", "placeholder-evidence.png");
    const buffer = fs.readFileSync(sourceImage);
    // public_id fijo (con overwrite) para que volver a correr el seed despues
    // de borrar la fila no acumule assets duplicados en Cloudinary.
    const uploaded = await uploadEvidenceImage(buffer, { publicId: SEED_EVIDENCE_PUBLIC_ID });

    await prisma.evidence.create({
      data: {
        id: SEED_EVIDENCE_ID,
        activityId: activityTablero.id,
        uploadedById: worker1.id,
        imageUrl: uploaded.url,
        imagePublicId: uploaded.publicId,
        description: "Avance de cableado del tablero principal.",
        status: EvidenceStatus.PENDIENTE,
      },
    });
    console.log(`Evidencia de prueba subida a Cloudinary y lista (pendiente de revisión): ${uploaded.url}`);
  }
}

async function main() {
  const usersByEmail = await seedUsers();
  await seedDemoProject(usersByEmail);

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
