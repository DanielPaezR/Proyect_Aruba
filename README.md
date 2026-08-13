# Sistema de Gestión Empresarial — Empresa Eléctrica (Aruba)

PWA de gestión empresarial: usuarios/roles, marcación de horas, proyectos y
actividades, evidencias fotográficas y dashboard de supervisor. Interfaz en
español, inglés y papiamento.

**Stack**: React + TypeScript + Vite (`/client`) · Node + Express + TypeScript
+ Prisma (`/server`) · PostgreSQL.

Monorepo con dos paquetes independientes (`/client` y `/server`), cada uno
con su propio `package.json`. El backend se despliega solo (ver más abajo);
el despliegue del cliente todavía no está configurado.

## Desarrollo local

Requiere Node 20+, Docker y Docker Compose.

1. Levanta Postgres 16 en un contenedor local:

   ```bash
   docker compose up -d
   ```

   Esto crea una base `app_dev` persistida en un volumen (`postgres_data`),
   expuesta en `localhost:5433` (no 5432, para no chocar con instalaciones
   nativas de Postgres que ya puedas tener corriendo). Credenciales de
   desarrollo definidas en [docker-compose.yml](docker-compose.yml).

2. Backend:

   ```bash
   cd server
   cp .env.example .env
   npm install
   npx prisma migrate dev
   npm run prisma:seed   # crea el primer usuario Jefe
   npm run dev           # http://localhost:4000
   ```

   El `DATABASE_URL` de `.env.example` ya apunta al contenedor de
   `docker-compose.yml`; no hace falta cambiarlo para desarrollo local.

3. Frontend:

   ```bash
   cd client
   cp .env.example .env
   npm install
   npm run dev            # http://localhost:5173
   ```

Para bajar el contenedor de Postgres (conservando los datos):
`docker compose down`. Para borrar también los datos: `docker compose down -v`.

### Alternativa: backend también en Docker

En algunas máquinas (típicamente con VPN/antivirus corporativo) el proceso
de Node que corre nativo en el host no logra conectarse al Postgres del
contenedor por `localhost`, aunque el contenedor esté sano — la conexión
queda interceptada antes de llegar a Postgres (sin error del lado de la
base de datos). Si `npm run dev` nativo te da `500` en cualquier ruta que
toque la base, usa el servicio `server` del compose en su lugar: corre
la app **dentro** de Docker, en la misma red que Postgres, hablándole por
el nombre del servicio (`postgres:5432`) en vez de `localhost`.

```bash
docker compose up -d --build   # postgres + server
```

- Backend disponible en `http://localhost:4000` (igual que con `npm run dev` nativo).
- Hot reload: el código de `./server` está montado como volumen, así que los
  cambios se reflejan sin rebuild (`docker compose up -d --build` solo hace
  falta si cambias `package.json`/`Dockerfile.dev`).
- Usa `server/.env.docker` (no `server/.env`) para sus variables — ya viene
  con `DATABASE_URL` apuntando a `postgres:5432` y con las mismas variables
  `SEED_*` de `.env.example`. `server/.env` sigue siendo el que usa la CLI
  de Prisma desde el host (`npx prisma migrate dev`, etc.), así que no hay
  que tocarlo.
- El cliente (`/client`) sigue corriendo nativo con `npm run dev`, sin
  problema — el bloqueo es específicamente hacia Postgres, no hacia HTTP.
- Logs: `docker logs -f proyecto_daniel_server`.

## Despliegue en Railway

Railway despliega **solo `/server`** (el cliente aún no tiene despliegue
configurado).

- **Root Directory**: `server`
- **Build Command**: por defecto (`npm run build`, que corre `tsc && prisma generate`)
- **Start Command**: por defecto (`npm start`, que corre `prisma migrate deploy`
  y luego `node dist/server.js` — aplica migraciones pendientes en cada deploy
  antes de levantar el servidor)
- `postinstall` corre `prisma generate` automáticamente después de `npm install`,
  antes del build.

### Variables de entorno necesarias

Ver [server/src/config/env.ts](server/src/config/env.ts) para la lista completa
que lee el servidor:

| Variable | Requerida | Notas |
|---|---|---|
| `DATABASE_URL` | Sí | Si usas el plugin de Postgres de Railway, la inyecta automáticamente. |
| `JWT_ACCESS_SECRET` | Sí | String largo y aleatorio. |
| `JWT_REFRESH_SECRET` | Sí | String largo y aleatorio, distinto del anterior. |
| `JWT_ACCESS_EXPIRES_IN` | No | Default `15m`. |
| `JWT_REFRESH_EXPIRES_IN_DAYS` | No | Default `30`. |
| `CORS_ORIGIN` | No | Default `http://localhost:5173` — **cámbialo a la URL real del cliente en producción**, o el navegador bloqueará las peticiones. |
| `PORT` | No | Railway la asigna automáticamente; no hace falta fijarla a mano. |
| `NODE_ENV` | No | Poner `production`. |

`SEED_JEFE_EMAIL` / `SEED_JEFE_PASSWORD` solo se usan al correr manualmente
`npm run prisma:seed` (por ejemplo desde la shell de Railway la primera vez).

### ⚠️ Evidencias fotográficas y filesystem efímero

Las evidencias se guardan hoy en disco local (`server/uploads/evidences`,
ver [server/src/config/storage.ts](server/src/config/storage.ts)). Railway
usa un filesystem efímero: **sin un Volume montado, cualquier evidencia subida
se pierde en el próximo deploy o reinicio.**

Antes de manejar evidencias reales en producción:

1. Monta un **Railway Volume** en `/app/uploads` desde el dashboard del
   servicio (Settings → Volumes), o
2. Migra el módulo de evidencias a almacenamiento externo (S3, Cloudflare R2,
   etc.) — no implementado todavía; el resto de la app no debería verse
   afectado porque `Evidence.imageUrl` ya es solo un string.

Un Volume resuelve la persistencia entre deploys, pero **no** entre réplicas
si en algún momento escalas el servicio horizontalmente — para eso sí hace
falta almacenamiento externo.

## PWA (app instalable)

`client/` usa [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) (config
en `client/vite.config.ts`) con `registerType: 'autoUpdate'`: el service
worker se actualiza solo en cada visita, sin pedirle nada al usuario.

**Qué cachea y qué no**: solo el *app shell* (el JS/CSS/HTML/imágenes que
emite `vite build`). Las respuestas de `/api/*` **nunca** se cachean —
no hay `runtimeCaching` configurado a propósito, porque esos datos
cambian todo el tiempo y servir una versión vieja desde caché sería peor
que no tener PWA. Como además el backend vive en otro origen (Railway) que
el cliente, el service worker ni siquiera intercepta esas llamadas por
construcción.

**No incluido todavía, a propósito**: notificaciones push (`Notification.
requestPermission()`, suscripción push, tablas de suscripción en el
backend). Eso queda para cuando haya un evento real que dispare una
notificación — probablemente Fase 4 (emergencias). El `registerType:
'autoUpdate'` y la estructura del manifest ya están listos para agregarlo
después sin tener que rehacer esta parte.

### ⚠️ Ícono placeholder

`client/public/pwa-192x192.png`, `pwa-512x512.png` y `apple-touch-icon.png`
son un placeholder generado a mano (fondo navy `#1B2A4A`, la letra "D" en
gold `#C9A24B`) — **hay que reemplazarlos por el logo real de Decs** cuando
lo tengan. Mismo nombre de archivo, mismos tamaños (192×192, 512×512, y
180×180 para `apple-touch-icon.png`), y listo — no hace falta tocar
`vite.config.ts`. El placeholder tampoco es un ícono "maskable" de verdad
(le falta el margen de zona segura que Android necesita para recortarlo en
círculo); si el logo real se agrega como maskable, hay que sumar esa
variante al array `icons` del manifest en `vite.config.ts`.

### Probar la instalación

El dev server normal (`npm run dev`) **no** activa el service worker igual
que producción — hay que probarlo con el build real:

```bash
cd client
npm run build
npm run preview   # sirve dist/ tal como quedaría en producción
```

Abrí la URL que imprime `vite preview` en Chrome/Edge de escritorio o en un
celular Android — debería aparecer el ícono de instalar en la barra de
direcciones (desktop) o el banner "Agregar a pantalla de inicio" (Android).
En iOS Safari no hay prompt automático: se instala manual desde Compartir →
"Agregar a inicio".
