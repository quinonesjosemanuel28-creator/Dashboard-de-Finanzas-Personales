/**
 * Eliminar vs. archivar (SPEC §1.7 y regla 9). Un pasivo o una cuenta se puede
 * eliminar solo si no tiene historia: sin movimientos (ni fondeos, en pasivos).
 * Con historia, solo se archiva.
 */

export interface Vinculos {
  movimientos: number;
  fondeos?: number;
}

export type Eliminacion = { permitido: true } | { permitido: false; motivo: string };

export function evaluarEliminacion(v: Vinculos): Eliminacion {
  if (v.movimientos > 0) {
    return {
      permitido: false,
      motivo: `Tiene ${v.movimientos} ${v.movimientos === 1 ? "movimiento vinculado" : "movimientos vinculados"}: solo se puede archivar.`,
    };
  }
  if ((v.fondeos ?? 0) > 0) {
    return { permitido: false, motivo: "Tiene fondeos asignados: solo se puede archivar." };
  }
  return { permitido: true };
}
