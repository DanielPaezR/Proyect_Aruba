import { prisma } from "../../config/prisma";
import type { UpdateSettingsInput } from "./settings.validators";

// Singleton: siempre la misma fila (id fijo). El default de la columna "id"
// tambien es 1, asi que un create() sin id explicito cae en la misma fila si
// dos requests concurrentes intentan crearla por primera vez a la vez.
const SETTINGS_ID = 1;

export async function getSettings() {
  return prisma.companySettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
}

export async function updateSettings(input: UpdateSettingsInput) {
  return prisma.companySettings.upsert({
    where: { id: SETTINGS_ID },
    update: input,
    create: { id: SETTINGS_ID, ...input },
  });
}
