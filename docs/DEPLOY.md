# Deploy en Railway

Proyecto de Railway propio, separado de los del holding y Academy (SPEC §9).

## 1. Servicios

1. **Postgres**: agregá una base PostgreSQL al proyecto y activá los backups.
2. **web**: servicio desde este repositorio de GitHub. Railway lee `railway.json`:
   - build: `npm run build` (genera el cliente de Prisma y compila Next.js);
   - arranque: `sh scripts/start.sh`, que hace, en orden y cortando ante el primer error:
     1. `prisma migrate deploy` (aplica las migraciones pendientes);
     2. `prisma db seed` (categorías, tipos de activo y configuración; idempotente);
     3. `next start`;
   - healthcheck: `/api/salud`, que responde 200 solo si la base tiene el esquema migrado y el seed. Si no, 503;
   - reinicio: ante falla, hasta 3 intentos.
3. En el servicio **web** → *Settings* → *Networking*, generá un dominio público (por ejemplo `patrimonio-production.up.railway.app`).
4. En *Settings* → *Deploy*, dejá **vacío** el campo *Pre-deploy command*. Las migraciones van en el arranque (ver abajo).

El cron diario se suma en el bloque (d) de la Fase 1.

### Por qué las migraciones corren en el arranque y no en el pre-deploy

El primer deploy quedó online con la base vacía: el `preDeployCommand` de `railway.json` no se ejecutó, y el healthcheck era `/login`, que no toca la base. Railway ejecuta ese comando sin shell, así que el `&&` tampoco se interpretaba. Ahora:

- las migraciones y el seed corren en `scripts/start.sh`, invocado con `sh` explícito, así que no depende de cómo Railway ejecute los comandos;
- si falta `DATABASE_URL`, la base no responde o una migración falla, el script termina con error y la app **no arranca**;
- el healthcheck `/api/salud` falla si la base no tiene el esquema. Railway marca el deploy como fallido y **deja online el deploy anterior**.

## Cómo confirmar en los logs que se aplicaron las migraciones

En Railway → servicio **web** → pestaña *Deployments* → el deploy → *Deploy Logs*. Las líneas clave, en este orden:

```
[deploy] 1/3 Aplicando migraciones (prisma migrate deploy)…
Datasource "db": PostgreSQL database "railway", schema "public" at "postgres.railway.internal:5432"
2 migrations found in prisma/migrations
Applying migration `20260927045238_inicial`
Applying migration `20260927201456_activos_valuaciones`
All migrations have been successfully applied.
[deploy] 2/3 Cargando datos iniciales (prisma db seed)…
Seed listo: 22 categorías, 8 tipos de activo.
[deploy] 3/3 Migraciones y seed OK. Iniciando la app…
✓ Ready in …
```

En los deploys siguientes, en lugar de `Applying migration…` aparece `No pending migrations to apply.`

Además, abrí `https://<tu-dominio>/api/salud` en el navegador: tiene que responder `{"ok":true}`.

## Si un deploy falla

| En el log | Qué pasa | Qué hacer |
|---|---|---|
| `[deploy] ERROR: falta la variable DATABASE_URL` | El servicio web no tiene la referencia a Postgres | Cargá `DATABASE_URL = ${{Postgres.DATABASE_URL}}` |
| `Error: P1001: Can't reach database server` | La base no responde | Revisá que el servicio Postgres esté corriendo |
| `Error: P3009` / `migrate found failed migrations` | Una migración quedó a medias | No la borres a mano: avisá y se resuelve con `prisma migrate resolve` |
| `[error] … ruta=/api/salud … codigo=P2021` | La app arrancó sin el esquema | No debería pasar con `scripts/start.sh`; revisá que el *Start command* sea ese |

### Errores de la app

Cuando una pantalla falla, la app muestra "No pudimos cargar esta pantalla" con un **código del error**. En los logs del servidor hay una línea que empieza con `[error] digest=<ese código>`, con la ruta, el tipo de error y el código de Prisma (por ejemplo `P2021` = tabla inexistente). Los logs nunca incluyen montos: los mensajes se recortan y los números largos se reemplazan por `‹n›`.

## 2. Variables de entorno del servicio web

| Variable | Valor |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referencia al servicio Postgres) |
| `AUTH_SECRET` | Un secreto aleatorio largo: `npx auth secret` u `openssl rand -base64 33` |
| `AUTH_GOOGLE_ID` | Client ID de Google OAuth |
| `AUTH_GOOGLE_SECRET` | Client secret de Google OAuth |
| `ALLOWED_EMAIL` | El único email que puede entrar |
| `TZ` | `America/Argentina/Buenos_Aires` |
| `AUTH_URL` | *Opcional.* Solo si usás un dominio propio: `https://tu-dominio.com` |

`RAILWAY_PUBLIC_DOMAIN` la define Railway sola cuando el servicio tiene dominio público; no hace falta cargarla.

No hacen falta `AUTH_TRUST_HOST` (la config de Auth.js ya tiene `trustHost: true`) ni `NEXTAUTH_URL`. Si las cargaste a mano como parche, podés borrarlas; `AUTH_URL` también, salvo que uses un dominio propio.

### Por qué importa la URL pública

Detrás del proxy de Railway, el header `host` que llega a la app es el interno (`localhost:8080`). Si Auth.js armara las URLs con ese host, el login con Google, el logout y la redirección a `/login` mandarían al navegador a `localhost:8080`. Por eso `src/auth.ts` fija la URL pública antes de inicializar Auth.js (`src/lib/url-publica.ts`), en este orden:

1. `AUTH_URL` (o `NEXTAUTH_URL`), si está configurada;
2. `https://${RAILWAY_PUBLIC_DOMAIN}`.

Si no hay ninguna de las dos en producción, la app lo avisa en los logs al arrancar.

## 3. Google OAuth

En Google Cloud Console → *APIs y servicios* → *Credenciales* → *Crear credenciales* → *ID de cliente de OAuth* → tipo **Aplicación web**:

- **Orígenes de JavaScript autorizados**: `https://<tu-dominio>`
- **URI de redireccionamiento autorizados**: `https://<tu-dominio>/api/auth/callback/google`

`<tu-dominio>` es el dominio público de Railway (el mismo valor que `RAILWAY_PUBLIC_DOMAIN`) o tu dominio propio si configuraste `AUTH_URL`. Tiene que coincidir exacto, con `https` y sin barra final.

Para desarrollo local, agregá también `http://localhost:3000` y `http://localhost:3000/api/auth/callback/google`.

Si la pantalla de consentimiento está en modo *Prueba*, agregá tu email como usuario de prueba.

## 4. Instalar en el celular

Con la app deployada, abrí el dominio en el celular e ingresá. Después, desde el menú → *Instalar la app* están los pasos para iPhone (Safari) y Android (Chrome).
