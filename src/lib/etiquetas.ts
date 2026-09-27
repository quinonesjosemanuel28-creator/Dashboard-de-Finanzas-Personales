/** Textos de UI para los enums del esquema. */

export const TIPOS_CUENTA = {
  EFECTIVO: "Efectivo",
  BANCO: "Banco",
  BILLETERA_VIRTUAL: "Billetera virtual",
  BROKER: "Broker",
  OTRO: "Otra",
} as const;

export const TIPOS_CATEGORIA = { GASTO: "Gasto", INGRESO: "Ingreso" } as const;

export const GRUPOS_ER = {
  INGRESO_PERSONAL: "Ingreso personal",
  GASTO_FIJO: "Gasto fijo",
  GASTO_VARIABLE: "Gasto variable",
  COSTO_FINANCIERO_OTRO: "Costo financiero",
  OTRO: "Otro",
} as const;

export const COMPORTAMIENTOS = {
  RENTA_PROGRAMADA: "Renta programada (con cronograma)",
  CARTERA: "Cartera (ganancia mensual)",
  COMPRAVENTA: "Compraventa (margen por operación)",
  TENENCIA: "Tenencia (se valúa)",
} as const;

export const TIPOS_CONTRAPARTE = {
  INVERSOR: "Inversor",
  DEUDOR: "Deudor",
  AMBOS: "Inversor y deudor",
  OTRO: "Otro",
} as const;

export const TIPOS_PASIVO = {
  MUTUO_INVERSOR: "Mutuo con inversor",
  PRESTAMO: "Préstamo",
  TARJETA: "Tarjeta",
  OTRO: "Otro",
} as const;

export const FRECUENCIAS = {
  MENSUAL: "Mensual",
  TRIMESTRAL: "Trimestral",
  CUATRIMESTRAL: "Cuatrimestral",
  SEMESTRAL: "Semestral",
  ANUAL: "Anual",
} as const;

export const ESQUEMAS = {
  INTERES_MENSUAL_CAPITAL_AL_VENCIMIENTO: "Interés periódico, capital al vencimiento",
  CUOTAS_IGUALES_INTERES_DIRECTO: "Cuotas iguales (interés directo)",
} as const;

export const ESTADOS_CUOTA = {
  PENDIENTE: "Pendiente",
  PARCIAL: "Parcial",
  PAGADA: "Pagada",
  VENCIDA: "Vencida",
} as const;

export const ESTADOS_PASIVO = {
  VIGENTE: "Vigente",
  EN_PREAVISO: "En preaviso",
  CANCELADO: "Cancelado",
  ARCHIVADO: "Archivado",
} as const;

export const ESTADOS_ACTIVO = {
  ACTIVO: "Activo",
  CERRADO: "Cerrado",
  EN_MORA: "En mora",
  INCOBRABLE: "Incobrable",
  ARCHIVADO: "Archivado",
} as const;

export const TIPOS_MOVIMIENTO = {
  INGRESO: "Ingreso",
  GASTO: "Gasto",
  TRANSFERENCIA: "Transferencia",
  APLICACION_ACTIVO: "Aplicación a activo",
  COBRO_RENDIMIENTO: "Cobro de rendimiento",
  COBRO_CAPITAL: "Cobro de capital",
  TOMA_PASIVO: "Ingreso de capital de pasivo",
  PAGO_INTERES: "Pago de interés",
  PAGO_CAPITAL: "Devolución de capital",
  BAJA_INCOBRABLE: "Baja por incobrable",
  AJUSTE: "Ajuste de saldo",
} as const;

export const MONEDAS = ["ARS", "USD"] as const;

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-11-15" → "15/11/2026". */
export function formatFechaCorta(fecha: string): string {
  const [a, m, d] = fecha.split("-");
  return `${d}/${m}/${a}`;
}

/** "2026-11-15" → "15 nov 2026". */
export function formatFechaMedia(fecha: string): string {
  const [a, m, d] = fecha.split("-");
  return `${Number(d)} ${MESES[Number(m) - 1]} ${a}`;
}

/** "2026-11" → "Noviembre 2026". */
export function formatPeriodoLargo(periodo: string): string {
  const [a, m] = periodo.split("-");
  const mes = MESES_LARGOS[Number(m) - 1] ?? "";
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${a}`;
}
