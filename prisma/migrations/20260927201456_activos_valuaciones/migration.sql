-- AlterTable
ALTER TABLE "Activo" ADD COLUMN     "capitalInicialRegistrado" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Valuacion" (
    "id" TEXT NOT NULL,
    "activoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Valuacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Valuacion_activoId_fecha_idx" ON "Valuacion"("activoId", "fecha");

-- CreateIndex
CREATE INDEX "Movimiento_cuentaId_idx" ON "Movimiento"("cuentaId");

-- CreateIndex
CREATE INDEX "Movimiento_activoId_idx" ON "Movimiento"("activoId");

-- CreateIndex
CREATE INDEX "Movimiento_pasivoId_idx" ON "Movimiento"("pasivoId");

-- AddForeignKey
ALTER TABLE "Valuacion" ADD CONSTRAINT "Valuacion_activoId_fkey" FOREIGN KEY ("activoId") REFERENCES "Activo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
