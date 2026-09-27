-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('ARS', 'USD');

-- CreateEnum
CREATE TYPE "TipoCuenta" AS ENUM ('EFECTIVO', 'BANCO', 'BILLETERA_VIRTUAL', 'BROKER', 'OTRO');

-- CreateEnum
CREATE TYPE "Comportamiento" AS ENUM ('RENTA_PROGRAMADA', 'CARTERA', 'COMPRAVENTA', 'TENENCIA');

-- CreateEnum
CREATE TYPE "EsquemaCronograma" AS ENUM ('INTERES_MENSUAL_CAPITAL_AL_VENCIMIENTO', 'CUOTAS_IGUALES_INTERES_DIRECTO');

-- CreateEnum
CREATE TYPE "FrecuenciaPago" AS ENUM ('MENSUAL', 'TRIMESTRAL', 'CUATRIMESTRAL', 'SEMESTRAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "EstadoActivo" AS ENUM ('ACTIVO', 'CERRADO', 'EN_MORA', 'INCOBRABLE', 'ARCHIVADO');

-- CreateEnum
CREATE TYPE "TipoPasivo" AS ENUM ('MUTUO_INVERSOR', 'PRESTAMO', 'TARJETA', 'OTRO');

-- CreateEnum
CREATE TYPE "Instrumentacion" AS ENUM ('PERSONAL', 'SOCIEDAD');

-- CreateEnum
CREATE TYPE "EstadoRegularizacion" AS ENUM ('NO_APLICA', 'PENDIENTE', 'REGULARIZADO');

-- CreateEnum
CREATE TYPE "EstadoPasivo" AS ENUM ('VIGENTE', 'EN_PREAVISO', 'CANCELADO', 'ARCHIVADO');

-- CreateEnum
CREATE TYPE "EstadoCuota" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADA', 'VENCIDA');

-- CreateEnum
CREATE TYPE "TipoContraparte" AS ENUM ('INVERSOR', 'DEUDOR', 'AMBOS', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoCategoria" AS ENUM ('INGRESO', 'GASTO');

-- CreateEnum
CREATE TYPE "GrupoER" AS ENUM ('INGRESO_PERSONAL', 'GASTO_FIJO', 'GASTO_VARIABLE', 'COSTO_FINANCIERO_OTRO', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('INGRESO', 'GASTO', 'TRANSFERENCIA', 'APLICACION_ACTIVO', 'COBRO_RENDIMIENTO', 'COBRO_CAPITAL', 'TOMA_PASIVO', 'PAGO_INTERES', 'PAGO_CAPITAL', 'BAJA_INCOBRABLE', 'AJUSTE');

-- CreateTable
CREATE TABLE "Cuenta" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCuenta" NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "saldoInicial" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fechaSaldoInicial" DATE NOT NULL,
    "archivada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contraparte" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoContraparte" NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contraparte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoActivo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "comportamiento" "Comportamiento" NOT NULL,
    "color" TEXT,
    "archivado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TipoActivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoActivoId" TEXT NOT NULL,
    "contraparteId" TEXT,
    "moneda" "Moneda" NOT NULL,
    "capitalInicial" DECIMAL(18,2) NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE,
    "tasaMensual" DECIMAL(9,6),
    "esquema" "EsquemaCronograma",
    "plazoMeses" INTEGER,
    "diaPago" INTEGER,
    "frecuenciaPago" "FrecuenciaPago" NOT NULL DEFAULT 'MENSUAL',
    "rendimientoEsperadoMensual" DECIMAL(9,6),
    "precioVenta" DECIMAL(18,2),
    "fechaVenta" DATE,
    "valuacionActual" DECIMAL(18,2),
    "fechaValuacion" DATE,
    "estado" "EstadoActivo" NOT NULL DEFAULT 'ACTIVO',
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuotaActivo" (
    "id" TEXT NOT NULL,
    "activoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "periodoDesde" TEXT NOT NULL,
    "mesesCubiertos" INTEGER NOT NULL,
    "fechaVencimiento" DATE NOT NULL,
    "interes" DECIMAL(18,2) NOT NULL,
    "capital" DECIMAL(18,2) NOT NULL,
    "estado" "EstadoCuota" NOT NULL DEFAULT 'PENDIENTE',
    "montoCobrado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fechaCobro" DATE,

    CONSTRAINT "CuotaActivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroCartera" (
    "id" TEXT NOT NULL,
    "activoId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "capitalEnCalle" DECIMAL(18,2) NOT NULL,
    "capitalEnMora" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "clientesActivos" INTEGER,
    "notas" TEXT,

    CONSTRAINT "RegistroCartera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pasivo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoPasivo" NOT NULL,
    "contraparteId" TEXT,
    "moneda" "Moneda" NOT NULL,
    "capital" DECIMAL(18,2) NOT NULL,
    "tasaMensual" DECIMAL(9,6) NOT NULL,
    "esquema" "EsquemaCronograma" NOT NULL DEFAULT 'INTERES_MENSUAL_CAPITAL_AL_VENCIMIENTO',
    "fechaInicio" DATE NOT NULL,
    "fechaVencimiento" DATE NOT NULL,
    "plazoMeses" INTEGER NOT NULL,
    "diaPago" INTEGER NOT NULL,
    "frecuenciaPago" "FrecuenciaPago" NOT NULL DEFAULT 'MENSUAL',
    "instrumentacion" "Instrumentacion" NOT NULL DEFAULT 'PERSONAL',
    "regularizacion" "EstadoRegularizacion" NOT NULL DEFAULT 'NO_APLICA',
    "preavisoDias" INTEGER,
    "penalidadRetiroPct" DECIMAL(5,4),
    "punitorioMensual" DECIMAL(9,6),
    "fechaPreaviso" DATE,
    "montoPreaviso" DECIMAL(18,2),
    "estado" "EstadoPasivo" NOT NULL DEFAULT 'VIGENTE',
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pasivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuotaPasivo" (
    "id" TEXT NOT NULL,
    "pasivoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "periodoDesde" TEXT NOT NULL,
    "mesesCubiertos" INTEGER NOT NULL,
    "fechaVencimiento" DATE NOT NULL,
    "interes" DECIMAL(18,2) NOT NULL,
    "capital" DECIMAL(18,2) NOT NULL,
    "estado" "EstadoCuota" NOT NULL DEFAULT 'PENDIENTE',
    "montoPagado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fechaPago" DATE,

    CONSTRAINT "CuotaPasivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fondeo" (
    "id" TEXT NOT NULL,
    "pasivoId" TEXT NOT NULL,
    "activoId" TEXT NOT NULL,
    "monto" DECIMAL(18,2) NOT NULL,
    "fechaDesde" DATE NOT NULL,
    "fechaHasta" DATE,
    "notas" TEXT,

    CONSTRAINT "Fondeo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCategoria" NOT NULL,
    "grupoER" "GrupoER" NOT NULL,
    "archivada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimiento" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "monto" DECIMAL(18,2) NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "tipoCambio" DECIMAL(12,4) NOT NULL,
    "cuentaId" TEXT,
    "cuentaDestinoId" TEXT,
    "montoDestino" DECIMAL(18,2),
    "categoriaId" TEXT,
    "activoId" TEXT,
    "pasivoId" TEXT,
    "cuotaActivoId" TEXT,
    "cuotaPasivoId" TEXT,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoCambio" (
    "fecha" DATE NOT NULL,
    "compra" DECIMAL(12,4) NOT NULL,
    "venta" DECIMAL(12,4) NOT NULL,
    "fuente" TEXT NOT NULL,
    "manual" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TipoCambio_pkey" PRIMARY KEY ("fecha")
);

-- CreateTable
CREATE TABLE "CierreMensual" (
    "periodo" TEXT NOT NULL,
    "fechaCierre" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipoCambioCierre" DECIMAL(12,4) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "notas" TEXT,

    CONSTRAINT "CierreMensual_pkey" PRIMARY KEY ("periodo")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "metaPatrimonioUsd" DECIMAL(18,2),
    "fechaMeta" DATE,
    "coberturaMinimaMeses" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "umbralDescalceMonedaPct" DECIMAL(5,4) NOT NULL DEFAULT 0.20,
    "costoOportunidadMensual" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "monedaReporte" "Moneda" NOT NULL DEFAULT 'USD',

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TipoActivo_nombre_key" ON "TipoActivo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "CuotaActivo_activoId_numero_key" ON "CuotaActivo"("activoId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "RegistroCartera_activoId_periodo_key" ON "RegistroCartera"("activoId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "CuotaPasivo_pasivoId_numero_key" ON "CuotaPasivo"("pasivoId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nombre_tipo_key" ON "Categoria"("nombre", "tipo");

-- CreateIndex
CREATE INDEX "Movimiento_fecha_idx" ON "Movimiento"("fecha");

-- CreateIndex
CREATE INDEX "Movimiento_tipo_fecha_idx" ON "Movimiento"("tipo", "fecha");

-- AddForeignKey
ALTER TABLE "Activo" ADD CONSTRAINT "Activo_tipoActivoId_fkey" FOREIGN KEY ("tipoActivoId") REFERENCES "TipoActivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activo" ADD CONSTRAINT "Activo_contraparteId_fkey" FOREIGN KEY ("contraparteId") REFERENCES "Contraparte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuotaActivo" ADD CONSTRAINT "CuotaActivo_activoId_fkey" FOREIGN KEY ("activoId") REFERENCES "Activo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroCartera" ADD CONSTRAINT "RegistroCartera_activoId_fkey" FOREIGN KEY ("activoId") REFERENCES "Activo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pasivo" ADD CONSTRAINT "Pasivo_contraparteId_fkey" FOREIGN KEY ("contraparteId") REFERENCES "Contraparte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuotaPasivo" ADD CONSTRAINT "CuotaPasivo_pasivoId_fkey" FOREIGN KEY ("pasivoId") REFERENCES "Pasivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fondeo" ADD CONSTRAINT "Fondeo_pasivoId_fkey" FOREIGN KEY ("pasivoId") REFERENCES "Pasivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fondeo" ADD CONSTRAINT "Fondeo_activoId_fkey" FOREIGN KEY ("activoId") REFERENCES "Activo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_cuentaDestinoId_fkey" FOREIGN KEY ("cuentaDestinoId") REFERENCES "Cuenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_activoId_fkey" FOREIGN KEY ("activoId") REFERENCES "Activo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_pasivoId_fkey" FOREIGN KEY ("pasivoId") REFERENCES "Pasivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_cuotaActivoId_fkey" FOREIGN KEY ("cuotaActivoId") REFERENCES "CuotaActivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_cuotaPasivoId_fkey" FOREIGN KEY ("cuotaPasivoId") REFERENCES "CuotaPasivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restricciones que Prisma no expresa en el esquema (SPEC §4, validaciones clave)
ALTER TABLE "Pasivo" ADD CONSTRAINT "Pasivo_diaPago_rango" CHECK ("diaPago" BETWEEN 1 AND 31);
ALTER TABLE "Activo" ADD CONSTRAINT "Activo_diaPago_rango" CHECK ("diaPago" IS NULL OR "diaPago" BETWEEN 1 AND 31);
ALTER TABLE "Pasivo" ADD CONSTRAINT "Pasivo_plazoMeses_positivo" CHECK ("plazoMeses" >= 1);
ALTER TABLE "CuotaPasivo" ADD CONSTRAINT "CuotaPasivo_mesesCubiertos_no_negativo" CHECK ("mesesCubiertos" >= 0);
ALTER TABLE "CuotaActivo" ADD CONSTRAINT "CuotaActivo_mesesCubiertos_no_negativo" CHECK ("mesesCubiertos" >= 0);
ALTER TABLE "Configuracion" ADD CONSTRAINT "Configuracion_fila_unica" CHECK ("id" = 1);
