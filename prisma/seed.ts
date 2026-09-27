/**
 * Seed inicial (SPEC §11): categorías, tipos de activo y configuración.
 * Es idempotente: se puede correr en cada deploy sin duplicar datos ni pisar
 * cambios hechos desde la app (solo crea lo que falta).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Comportamiento, GrupoER, TipoCategoria } from "../src/generated/prisma/enums";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const categorias: { nombre: string; tipo: TipoCategoria; grupoER: GrupoER }[] = [
  ...["Retiros / sueldo del holding", "Honorarios y consultorías", "Otros ingresos"].map((nombre) => ({
    nombre,
    tipo: "INGRESO" as const,
    grupoER: "INGRESO_PERSONAL" as const,
  })),
  ...[
    "Vivienda",
    "Servicios",
    "Seguros",
    "Suscripciones",
    "Educación",
    "Familia",
    "Impuestos personales",
  ].map((nombre) => ({ nombre, tipo: "GASTO" as const, grupoER: "GASTO_FIJO" as const })),
  ...[
    "Supermercado",
    "Comidas afuera",
    "Transporte y combustible",
    "Salud",
    "Ropa",
    "Entretenimiento",
    "Viajes",
    "Regalos",
    "Varios",
  ].map((nombre) => ({ nombre, tipo: "GASTO" as const, grupoER: "GASTO_VARIABLE" as const })),
  ...["Intereses de tarjeta", "Punitorios", "Comisiones bancarias"].map((nombre) => ({
    nombre,
    tipo: "GASTO" as const,
    grupoER: "COSTO_FINANCIERO_OTRO" as const,
  })),
];

const tiposActivo: { nombre: string; comportamiento: Comportamiento }[] = [
  { nombre: "Préstamos personales", comportamiento: "CARTERA" },
  { nombre: "Financiamiento de celulares", comportamiento: "CARTERA" },
  { nombre: "Financiamiento de vehículos", comportamiento: "CARTERA" },
  { nombre: "Compraventa de vehículos", comportamiento: "COMPRAVENTA" },
  { nombre: "Apalancamiento a terceros", comportamiento: "RENTA_PROGRAMADA" },
  { nombre: "Inversiones financieras", comportamiento: "TENENCIA" },
  { nombre: "Participaciones societarias", comportamiento: "TENENCIA" },
  { nombre: "Bienes (inmuebles, vehículo propio)", comportamiento: "TENENCIA" },
];

async function main() {
  for (const c of categorias) {
    await prisma.categoria.upsert({
      where: { nombre_tipo: { nombre: c.nombre, tipo: c.tipo } },
      update: {},
      create: c,
    });
  }
  for (const t of tiposActivo) {
    await prisma.tipoActivo.upsert({ where: { nombre: t.nombre }, update: {}, create: t });
  }
  await prisma.configuracion.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  console.log(`Seed listo: ${categorias.length} categorías, ${tiposActivo.length} tipos de activo.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
