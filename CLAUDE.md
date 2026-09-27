# Patrimonio — Contexto del proyecto para Claude Code

App web personal (PWA instalable) para gestionar las finanzas personales de José:

- activos productivos,
- pasivos con inversores (mutuos en ARS y USD),
- movimientos,
- estado de resultados, flujo de caja, balance y patrimonio neto.

Un solo usuario. Uso principal desde el celular.

La especificación completa está en `docs/SPEC.md`. Leela antes de cualquier tarea.

## Alcance

- Solo finanzas personales. Queda fuera la contabilidad de Esther X Fusión S.A. y de +Activos Holding.
- Excepción: los mutuos instrumentados vía Esther X Fusión cuyo capital usa José personalmente se registran como pasivos personales, con `instrumentacion = SOCIEDAD`. Ver SPEC §5.8.

## Stack

Next.js (App Router) + TypeScript estricto · Prisma + PostgreSQL · Tailwind + shadcn/ui · Recharts · Zod · Auth.js (Google, allowlist de un solo email) · date-fns (TZ America/Argentina/Buenos_Aires) · Vitest · PWA · Deploy en Railway (web + Postgres + cron diario).

## Reglas no negociables

1. **Dinero:** nunca `number` ni `float`. Montos en `Decimal(18,2)`, tasas en `Decimal(9,6)`, TC en `Decimal(12,4)`. Operar con `Prisma.Decimal` / decimal.js.
2. **Tasas:** se guardan como tasa mensual simple (0.04 = 4%). TNA y TEA son solo de visualización.
3. **Moneda:** cada movimiento guarda su moneda original y el TC oficial venta del día. Conversión: USD = ARS / TC.
4. **Lógica de dominio** (cronogramas, fechas de pago, ER, balance, flujo, spread, KPIs, meta): funciones puras en `src/domain/`, sin acceso a DB, con tests en Vitest. La UI y las server actions solo orquestan.
5. **ER:** las cuotas se imputan por devengado mensual (cada cuota reparte su interés en partes iguales entre los meses que cubre); el resto de los movimientos, por fecha. Un movimiento vinculado a una cuota no se suma de nuevo. Ver SPEC §6.1.
6. **Seguridad:** toda ruta y toda server action verifican sesión + `ALLOWED_EMAIL`. Nunca loguear montos.
7. **Mobile-first:** diseñar para 390 px de ancho. La carga rápida debe resolverse en 4 taps más el monto.
8. **Copy de la UI:** español rioplatense con voseo ("Cargá", "Tu patrimonio", "¿Confirmás?"). Formato de números es-AR (1.234.567,89). Mostrar siempre la moneda (ARS / USD).
9. **Borrado:** activos, pasivos, cuentas y categorías se archivan, no se borran. Excepción: un pasivo o una cuenta sin movimientos (cargado por error) se puede eliminar (`domain/borrado.ts`). Un pago registrado desde la app se puede deshacer. Los movimientos de meses cerrados no se editan sin reabrir el cierre.

## Forma de trabajo

- Trabajar por fases (SPEC §10). No adelantar funcionalidades de fases siguientes.
- Antes de codear cada fase: plan breve (archivos, migraciones, riesgos) y esperar OK.
- Cada fase se cierra cuando pasan sus criterios de aceptación y los tests de dominio.
- Si algo de SPEC §12 (decisiones abiertas) bloquea la tarea, preguntar; no asumir.
- Commits pequeños y descriptivos, en español.

## Comandos

- `npm run dev` — desarrollo (necesita `.env`; ver `.env.example`)
- `npm run test` — Vitest
- `npm run typecheck` · `npm run lint`
- `npm run build` — `prisma generate` + `next build`
- `npx prisma migrate dev` — migraciones
- `npx prisma db seed` — seed (categorías, tipos de activo y configuración; idempotente)
- Deploy en Railway: ver `docs/DEPLOY.md`.

## Notas técnicas

- Next.js 16: la protección de rutas va en `src/proxy.ts` (antes `middleware.ts`). Además, cada página y server action llama a `requireSession()` (`src/server/sesion.ts`).
- Auth.js arma las URLs con `AUTH_URL`; `src/auth.ts` la fija desde `src/lib/url-publica.ts` (AUTH_URL → `RAILWAY_PUBLIC_DOMAIN`) porque detrás de Railway el `host` es interno. No construir URLs absolutas con el host del request: usar redirecciones relativas.
- Prisma 7: la URL de la base va en `prisma.config.ts`; el cliente se genera en `src/generated/prisma` y se usa con `@prisma/adapter-pg` (`src/server/db.ts`).
- El dominio (`src/domain/`) trabaja con fechas `YYYY-MM-DD` sin zona horaria; "hoy" en ART sale de `src/lib/hoy.ts`.
- Componentes shadcn/ui en `src/components/ui/` (`components.json` listo para el CLI).
- No importar constantes desde módulos `"use client"` en componentes de servidor: llegan como referencias de cliente. Ponerlas en `src/lib/`.

## Integraciones externas

- TC oficial diario: `GET https://dolarapi.com/v1/dolares/oficial`, usando el campo `venta`.
- Histórico de TC: ArgentinaDatos, `GET https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial` (verificado; campos `fecha`, `compra`, `venta`).
- Fechas de pago por aniversario (SPEC §5.2): no se usan días hábiles ni feriados.
