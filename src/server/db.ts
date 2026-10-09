import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

function crearCliente() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    // Sin marcos de código ni rutas de archivos en los mensajes de error.
    errorFormat: "minimal",
  });
}

/** Cliente único (en desarrollo se reutiliza entre recargas en caliente). */
export const db = globalParaPrisma.prisma ?? crearCliente();

if (process.env.NODE_ENV !== "production") globalParaPrisma.prisma = db;
