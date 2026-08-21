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
  InventoryItemType,
  EmergencyPriority,
} from "@prisma/client";
import { EVIDENCES_FOLDER, uploadImage } from "../src/config/storage";

const prisma = new PrismaClient();

interface SeedUser {
  name: string;
  role: Role;
  email: string;
  password: string;
}

// El email/env var siguen llamandose JEFE por compatibilidad (no hace falta
// tocar la config de Railway) — el rol real ahora es Role.ADMINISTRADOR, ver
// la reestructuracion de roles (JEFE -> ADMINISTRADOR + nuevo GERENTE).
const JEFE_EMAIL = process.env.SEED_JEFE_EMAIL ?? "jefe@empresa.com";
const GERENTE_EMAIL = process.env.SEED_GERENTE_EMAIL ?? "gerente@empresa.com";
const SUPERVISOR_EMAIL = process.env.SEED_SUPERVISOR_EMAIL ?? "supervisor@empresa.com";
const WORKER_EMAIL = process.env.SEED_WORKER_EMAIL ?? "trabajador@empresa.com";
const WORKER2_EMAIL = process.env.SEED_WORKER2_EMAIL ?? "trabajador2@empresa.com";
const MERCADERISTA_EMAIL = process.env.SEED_MERCADERISTA_EMAIL ?? "mercaderista@empresa.com";

const SEED_USERS: SeedUser[] = [
  {
    name: "Administrador",
    role: Role.ADMINISTRADOR,
    email: JEFE_EMAIL,
    password: process.env.SEED_JEFE_PASSWORD ?? "CambiarEsta123!",
  },
  {
    name: "Gerente de Prueba",
    role: Role.GERENTE,
    email: GERENTE_EMAIL,
    password: process.env.SEED_GERENTE_PASSWORD ?? "CambiarEsta123!",
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
  {
    name: "Mercaderista de Prueba",
    role: Role.MERCADERISTA,
    email: MERCADERISTA_EMAIL,
    password: process.env.SEED_MERCADERISTA_PASSWORD ?? "CambiarEsta123!",
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
const SEED_TOOL_ITEM_ID = "seed-inventory-taladro-demo";
const SEED_MATERIAL_ITEM_ID = "seed-inventory-cable-demo";
const SEED_TOOL_ASSIGNMENT_ID = "seed-tool-assignment-demo";
const SEED_VEHICLE_ID = "seed-vehicle-demo";
const SEED_EMERGENCY_ID = "seed-emergency-demo";

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
  const administrador = usersByEmail[JEFE_EMAIL];
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
      createdById: administrador.id,
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
    const uploaded = await uploadImage(buffer, { folder: EVIDENCES_FOLDER, publicId: SEED_EVIDENCE_PUBLIC_ID });

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

async function seedInventory(usersByEmail: Record<string, { id: string }>) {
  const worker1 = usersByEmail[WORKER_EMAIL];

  const tool = await prisma.inventoryItem.upsert({
    where: { id: SEED_TOOL_ITEM_ID },
    update: {},
    create: {
      id: SEED_TOOL_ITEM_ID,
      name: "Taladro percutor inalámbrico",
      type: InventoryItemType.HERRAMIENTA,
      unit: "unidad",
      stockQuantity: 3,
      lowStockThreshold: 1,
      notes: "Incluye cargador y dos baterías.",
    },
  });

  await prisma.inventoryItem.upsert({
    where: { id: SEED_MATERIAL_ITEM_ID },
    update: {},
    create: {
      id: SEED_MATERIAL_ITEM_ID,
      name: "Cable THHN #12 AWG",
      type: InventoryItemType.MATERIAL,
      unit: "metros",
      stockQuantity: 500,
      lowStockThreshold: 50,
    },
  });

  await prisma.toolAssignment.upsert({
    where: { id: SEED_TOOL_ASSIGNMENT_ID },
    update: {},
    create: {
      id: SEED_TOOL_ASSIGNMENT_ID,
      itemId: tool.id,
      userId: worker1.id,
      condition: "Buen estado, sin daños visibles al momento de entregar.",
    },
  });

  console.log("Inventario de prueba (herramienta, material, y asignación) listo.");
}

async function seedVehicles(usersByEmail: Record<string, { id: string }>) {
  const worker1 = usersByEmail[WORKER_EMAIL];

  await prisma.vehicle.upsert({
    where: { id: SEED_VEHICLE_ID },
    update: {},
    create: {
      id: SEED_VEHICLE_ID,
      plate: "AR-1234",
      brand: "Toyota",
      model: "Hilux",
      year: 2021,
      identificationNumber: "SEED-VIN-0001",
      assignedToId: worker1.id,
      notes: "Camioneta de prueba, asignada al trabajador de prueba.",
    },
  });

  console.log("Vehículo de prueba (asignado al trabajador de prueba) listo.");
}

// Sin asignar (REPORTADA) a proposito: el flujo de asignar + push es lo que
// se prueba en vivo (ver verificacion del Modulo 4.1), no algo que el seed
// deba dejar ya resuelto.
async function seedDemoEmergency(usersByEmail: Record<string, { id: string }>) {
  const supervisor = usersByEmail[SUPERVISOR_EMAIL];

  await prisma.emergency.upsert({
    where: { id: SEED_EMERGENCY_ID },
    update: {},
    create: {
      id: SEED_EMERGENCY_ID,
      projectId: SEED_PROJECT_ID,
      title: "Corto circuito en tablero principal",
      description:
        "El cliente reporta chispas y olor a quemado al encender el interruptor principal. Sin electricidad en toda la casa desde hace 20 minutos.",
      locationMapsUrl: "https://maps.app.goo.gl/SeedDemoEmergenciaParadera",
      priority: EmergencyPriority.URGENTE,
      reportedById: supervisor.id,
    },
  });

  console.log("Emergencia de prueba (sin asignar) lista.");
}

async function main() {
  const usersByEmail = await seedUsers();
  await seedDemoProject(usersByEmail);
  await seedInventory(usersByEmail);
  await seedVehicles(usersByEmail);
  await seedDemoEmergency(usersByEmail);

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
