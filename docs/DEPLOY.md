# Deploy en Railway

Proyecto de Railway propio, separado de los del holding y Academy (SPEC §9).

## 1. Servicios

1. **Postgres**: agregá una base PostgreSQL al proyecto y activá los backups.
2. **web**: servicio desde este repositorio de GitHub. Railway lee `railway.json`:
   - build: `npm run build` (genera el cliente de Prisma y compila Next.js);
   - antes de cada deploy: `npm run db:deploy && npm run db:seed` (migraciones y seed idempotente);
   - arranque: `npm run start`;
   - healthcheck: `/login`.
3. En el servicio **web** → *Settings* → *Networking*, generá un dominio público (por ejemplo `patrimonio-production.up.railway.app`).

El cron diario se suma en el bloque (d) de la Fase 1.

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
