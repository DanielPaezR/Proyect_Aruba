import cron from "node-cron";
import { PunchType, Role, type ReminderWindow } from "@prisma/client";
import { prisma } from "../config/prisma";
import * as settingsService from "../modules/settings/settings.service";
import { arubaStartOfTodayUtc, arubaToday, currentArubaMinutes, isWithinWindow } from "../utils/geo";
import { sendPushToUser } from "../utils/push";

const REMINDER_MESSAGES: Record<ReminderWindow, { title: string; body: string }> = {
  MORNING: { title: "DECS", body: "Recuerda marcar tu entrada." },
  AFTERNOON: { title: "DECS", body: "Recuerda marcar tu salida." },
};

/**
 * Corre cada 5 minutos: si la hora actual (Aruba) cae en la ventana matutina
 * o vespertina configurada en CompanySettings, busca TRABAJADOR_CAMPO a
 * quienes les falte la marcacion correspondiente hoy y les manda un push —
 * pero solo una vez por ventana por dia (PunchReminderLog lleva la cuenta).
 */
export async function runPunchReminderTick() {
  const settings = await settingsService.getSettings();
  const nowMinutes = currentArubaMinutes();

  let window: ReminderWindow | null = null;
  if (isWithinWindow(nowMinutes, settings.morningWindowStart, settings.morningWindowEnd)) {
    window = "MORNING";
  } else if (isWithinWindow(nowMinutes, settings.afternoonWindowStart, settings.afternoonWindowEnd)) {
    window = "AFTERNOON";
  }
  if (!window) {
    return;
  }

  const today = arubaToday();
  const startOfToday = arubaStartOfTodayUtc();

  const workers = await prisma.user.findMany({
    where: { role: Role.TRABAJADOR_CAMPO, isActive: true },
    select: {
      id: true,
      timeEntries: {
        where: { timestamp: { gte: startOfToday } },
        orderBy: { timestamp: "asc" },
        select: { type: true },
      },
    },
  });

  for (const worker of workers) {
    const hasEntradaToday = worker.timeEntries.some((entry) => entry.type === PunchType.ENTRADA);
    const lastToday = worker.timeEntries.at(-1);

    // Mañana: falta si todavia no marco ENTRADA hoy. Tarde: falta si marco
    // ENTRADA hoy pero la ultima marcacion del dia sigue siendo esa ENTRADA
    // (no la cerro con una SALIDA).
    const needsReminder =
      window === "MORNING" ? !hasEntradaToday : hasEntradaToday && lastToday?.type === PunchType.ENTRADA;

    if (!needsReminder) {
      continue;
    }

    const alreadySent = await prisma.punchReminderLog.findUnique({
      where: { userId_window_date: { userId: worker.id, window, date: today } },
    });
    if (alreadySent) {
      continue;
    }

    await sendPushToUser(worker.id, REMINDER_MESSAGES[window]);
    // Se registra el intento aunque no tenga ninguna suscripcion activa:
    // reintentar cada 5 min a alguien sin push configurado no logra nada.
    await prisma.punchReminderLog.create({ data: { userId: worker.id, window, date: today } });
  }
}

export function startPunchReminderJob() {
  cron.schedule("*/5 * * * *", () => {
    runPunchReminderTick().catch((error) => {
      console.error("[punch-reminders] Error en el job:", error);
    });
  });
  console.log("[punch-reminders] Job de recordatorios programado cada 5 minutos.");
}
