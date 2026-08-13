import { app } from "./app";
import { env } from "./config/env";
import { startPunchReminderJob } from "./jobs/punchReminders";

app.listen(env.port, () => {
  console.log(`Servidor escuchando en http://localhost:${env.port}`);
});

// Corre dentro del mismo proceso: Railway mantiene el contenedor siempre
// activo (no es serverless), y por ahora solo hay una instancia del server
// (ver README, seccion de evidencias, sobre por que escalar horizontalmente
// necesitaria repensar esto).
startPunchReminderJob();
