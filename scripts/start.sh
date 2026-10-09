#!/bin/sh
# Arranque en producción (Railway): migraciones → seed → app.
# Se invoca con `sh scripts/start.sh`, así no depende de que Railway use un shell.
# Si cualquier paso falla, el script termina con error, la app no arranca, el
# healthcheck (/api/salud) no pasa y Railway no pone este deploy online.
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[deploy] ERROR: falta la variable DATABASE_URL. No se aplican migraciones ni se arranca la app." >&2
  exit 1
fi

echo "[deploy] 1/3 Aplicando migraciones (prisma migrate deploy)…"
npx prisma migrate deploy

echo "[deploy] 2/3 Cargando datos iniciales (prisma db seed)…"
npx prisma db seed

echo "[deploy] 3/3 Migraciones y seed OK. Iniciando la app…"
exec npx next start
