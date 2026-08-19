import http from "node:http";
import { app } from "./app";
import { env } from "./config/env";
import { startPunchReminderJob } from "./jobs/punchReminders";
import { attachChatGateway } from "./realtime/chat.gateway";

// http.createServer(app) en vez de app.listen(): Socket.IO necesita el mismo
// servidor HTTP subyacente para hacer el upgrade a WebSocket sobre el puerto
// que ya expone Express.
const httpServer = http.createServer(app);
attachChatGateway(httpServer);

httpServer.listen(env.port, () => {
  console.log(`Servidor escuchando en http://localhost:${env.port}`);
});

// Corre dentro del mismo proceso: Railway mantiene el contenedor siempre
// activo (no es serverless), y por ahora solo hay una instancia del server
// (ver README, seccion de evidencias, sobre por que escalar horizontalmente
// necesitaria repensar esto).
startPunchReminderJob();
