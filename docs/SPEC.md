# Patrimonio — Especificación funcional y técnica

> App web personal (PWA instalable en el celular) para gestionar las finanzas personales de José: activos productivos, pasivos con inversores, movimientos del mes, estado de resultados, flujo de caja, balance y evolución del patrimonio neto.
>
> Versión 1.0 — 27/09/2026

---

## 0. Alcance

**Dentro del alcance**
- Finanzas **personales** de José, exclusivamente.
- Mutuos con inversores cuyo capital José usa **para sí**, estén instrumentados a su nombre o, por práctica heredada, a nombre de Esther X Fusión S.A. (ver §5.8). Económicamente son deuda de José, así que se registran como pasivos personales.
- Activos productivos de cualquier tipo (préstamos, financiamiento de celulares y vehículos, compraventa de vehículos, apalancamiento a terceros, inversiones, bienes).
- Monedas: **ARS y USD**. Tipo de cambio de referencia: **oficial, valor venta**.

**Fuera del alcance**
- Contabilidad de Esther X Fusión S.A. y de +Activos Holding.
- Multiusuario, roles o acceso de terceros.
- Integración bancaria automática (queda para una fase futura: importación de CSV).
- Liquidación de impuestos.

**Usuario:** uno solo (José). Uso principal desde el celular y secundario desde la MacBook.

---

## 1. Principios de diseño

1. **Mobile-first.** Cada pantalla se diseña primero para 390 px de ancho. Una carga de gasto tiene que resolverse en menos de 10 segundos.
2. **La carga de datos es el producto.** Si cargar da fiaca, la app muere. Siempre hay defaults inteligentes: fecha de hoy, última cuenta usada, categorías recientes.
3. **Dinero exacto.** Nunca `float`. Todo monto es `Decimal(18,2)` y toda tasa `Decimal(9,6)`.
4. **Moneda original + conversión.** Cada movimiento se guarda en su moneda original con el tipo de cambio del día. Los reportes se pueden ver en ARS o en USD.
5. **Tasas siempre mensuales.** Se guardan como tasa mensual simple (0.04 = 4%). La TNA (×12) y la TEA son solo de visualización.
6. **Lógica de dominio pura y testeada.** Cronogramas, estado de resultados, balance, spread y días hábiles viven en funciones puras con tests.
7. **Nada se borra en duro si tiene historia.** Activos, pasivos y cuentas se archivan. Los movimientos sí se pueden borrar o editar mientras el mes no esté cerrado.
8. **Todo el copy de la UI en español rioplatense (voseo).**

---

## 2. Stack y arquitectura

| Capa | Elección |
|---|---|
| Framework | Next.js (última estable), App Router, TypeScript estricto |
| DB | PostgreSQL en Railway |
| ORM | Prisma |
| UI | Tailwind CSS + shadcn/ui, íconos lucide-react |
| Gráficos | Recharts |
| Validación | Zod (formularios y server actions) |
| Decimales | `Prisma.Decimal` / decimal.js; jamás `Number` para dinero |
| Fechas | date-fns + zona horaria `America/Argentina/Buenos_Aires` |
| Auth | Auth.js con proveedor Google y **allowlist de un solo email** (`ALLOWED_EMAIL`) |
| PWA | Web App Manifest + service worker (Serwist o equivalente), instalable en iOS y Android |
| Tests | Vitest para `src/domain/**` |
| Deploy | Railway: servicio web + Postgres + cron job diario |

> Si el dashboard de Academy ya usa un stack distinto, replicar ese stack para no mantener dos mundos.

### Estructura de carpetas

```
prisma/
  schema.prisma
  seed.ts
src/
  app/
    (auth)/login/
    (app)/                 # rutas protegidas
      page.tsx             # Inicio / dashboard
      activos/
      pasivos/
      movimientos/
      reportes/
        resultados/
        flujo/
        balance/
      cierre/
      config/
    api/cron/              # endpoints invocados por el cron (protegidos por secret)
  domain/                  # lógica pura, sin I/O, 100% testeada
    cronograma.ts
    diasHabiles.ts
    fx.ts
    estadoResultados.ts
    flujoCaja.ts
    balance.ts
    spread.ts
    kpis.ts
    meta.ts
  server/                  # queries Prisma y server actions
  components/
  lib/
```

### Servicios en Railway
- `web`: la app Next.js.
- `postgres`: base de datos. Activar backups.
- `cron`: se ejecuta diariamente a las 10:30 ART. Llama a `/api/cron/diario`, que:
  1. trae el TC oficial del día;
  2. marca cuotas vencidas;
  3. recalcula las alertas.

---

## 3. Glosario del dominio

- **Cuenta**: donde está la plata líquida (efectivo, banco, billetera virtual, broker). Tiene una sola moneda.
- **Activo productivo**: capital aplicado a algo que genera rendimiento. Cada activo pertenece a un **Tipo de activo**, definido por el usuario, y cada tipo tiene un **Comportamiento** que define cómo se registra y valúa.
- **Pasivo**: deuda de José. El caso principal es el mutuo con inversor.
- **Cuota**: línea de un cronograma (de cobro en activos, de pago en pasivos). Tiene un **período de devengamiento** (`YYYY-MM`) y una fecha de vencimiento.
- **Fondeo**: asignación de capital de un pasivo a un activo ("los USD 10.000 de Óscar están en la cartera de celulares"). Es la base del cálculo de spread.
- **Movimiento**: todo hecho con impacto en caja o en patrimonio.
- **Cierre mensual**: foto inmutable del mes (saldos, TC, estados).

---

## 4. Modelo de datos (Prisma, borrador)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Moneda { ARS USD }

enum TipoCuenta { EFECTIVO BANCO BILLETERA_VIRTUAL BROKER OTRO }

enum Comportamiento {
  RENTA_PROGRAMADA   // préstamo individual con cronograma (ej. apalancamiento a terceros al 8%)
  CARTERA            // cartera agregada (préstamos personales, celulares): se registra ganancia mensual y capital en calle
  COMPRAVENTA        // operación de compra y reventa (ej. vehículos): margen por operación
  TENENCIA           // bien o inversión que se valúa (inmueble, auto propio, acciones, cripto, participación)
}

enum EsquemaCronograma {
  INTERES_MENSUAL_CAPITAL_AL_VENCIMIENTO  // estándar de los mutuos de José
  CUOTAS_IGUALES_INTERES_DIRECTO          // cuota = (capital × (1 + tasa × n)) / n
}

enum EstadoActivo { ACTIVO CERRADO EN_MORA INCOBRABLE ARCHIVADO }
enum TipoPasivo { MUTUO_INVERSOR PRESTAMO TARJETA OTRO }
enum Instrumentacion { PERSONAL SOCIEDAD }
enum EstadoRegularizacion { NO_APLICA PENDIENTE REGULARIZADO }
enum EstadoPasivo { VIGENTE EN_PREAVISO CANCELADO ARCHIVADO }
enum EstadoCuota { PENDIENTE PARCIAL PAGADA VENCIDA }
enum TipoContraparte { INVERSOR DEUDOR AMBOS OTRO }
enum TipoCategoria { INGRESO GASTO }
enum GrupoER { INGRESO_PERSONAL GASTO_FIJO GASTO_VARIABLE COSTO_FINANCIERO_OTRO OTRO }

enum TipoMovimiento {
  INGRESO                 // ingreso personal (retiros del holding, honorarios, otros)
  GASTO                   // gasto personal, o gasto directo de un activo si tiene activoId
  TRANSFERENCIA           // entre cuentas propias; incluye compra/venta de USD
  APLICACION_ACTIVO       // sale capital de una cuenta hacia un activo
  COBRO_RENDIMIENTO       // interés o ganancia cobrada de un activo
  COBRO_CAPITAL           // recupero de capital de un activo
  TOMA_PASIVO             // entra capital de un inversor o prestamista
  PAGO_INTERES            // pago de interés de un pasivo
  PAGO_CAPITAL            // devolución de capital de un pasivo
  BAJA_INCOBRABLE         // write-off de capital de un activo (sin cuenta)
  AJUSTE                  // conciliación de saldo de cuenta
}

model Cuenta {
  id                String      @id @default(cuid())
  nombre            String
  tipo              TipoCuenta
  moneda            Moneda
  saldoInicial      Decimal     @default(0) @db.Decimal(18, 2)
  fechaSaldoInicial DateTime    @db.Date
  archivada         Boolean     @default(false)
  movimientos       Movimiento[] @relation("CuentaOrigen")
  entradas          Movimiento[] @relation("CuentaDestino")
  createdAt         DateTime    @default(now())
}

model Contraparte {
  id        String          @id @default(cuid())
  nombre    String
  tipo      TipoContraparte
  telefono  String?
  email     String?
  notas     String?
  activos   Activo[]
  pasivos   Pasivo[]
  createdAt DateTime        @default(now())
}

model TipoActivo {
  id             String         @id @default(cuid())
  nombre         String         @unique
  comportamiento Comportamiento
  color          String?
  archivado      Boolean        @default(false)
  activos        Activo[]
}

model Activo {
  id                         String             @id @default(cuid())
  nombre                     String
  tipoActivoId               String
  tipoActivo                 TipoActivo         @relation(fields: [tipoActivoId], references: [id])
  contraparteId              String?
  contraparte                Contraparte?       @relation(fields: [contraparteId], references: [id])
  moneda                     Moneda
  capitalInicial             Decimal            @db.Decimal(18, 2)
  fechaInicio                DateTime           @db.Date
  fechaFin                   DateTime?          @db.Date
  // RENTA_PROGRAMADA
  tasaMensual                Decimal?           @db.Decimal(9, 6)
  esquema                    EsquemaCronograma?
  plazoMeses                 Int?
  // CARTERA / COMPRAVENTA: referencia para comparar real vs esperado
  rendimientoEsperadoMensual Decimal?           @db.Decimal(9, 6)
  // COMPRAVENTA
  precioVenta                Decimal?           @db.Decimal(18, 2)
  fechaVenta                 DateTime?          @db.Date
  // TENENCIA
  valuacionActual            Decimal?           @db.Decimal(18, 2)
  fechaValuacion             DateTime?          @db.Date
  estado                     EstadoActivo       @default(ACTIVO)
  notas                      String?
  cuotas                     CuotaActivo[]
  registrosCartera           RegistroCartera[]
  movimientos                Movimiento[]
  fondeos                    Fondeo[]
  createdAt                  DateTime           @default(now())
}

model CuotaActivo {
  id               String       @id @default(cuid())
  activoId         String
  activo           Activo       @relation(fields: [activoId], references: [id], onDelete: Cascade)
  numero           Int
  periodo          String       // "YYYY-MM", mes de devengamiento
  fechaVencimiento DateTime     @db.Date
  interes          Decimal      @db.Decimal(18, 2)
  capital          Decimal      @db.Decimal(18, 2)
  estado           EstadoCuota  @default(PENDIENTE)
  montoCobrado     Decimal      @default(0) @db.Decimal(18, 2)
  fechaCobro       DateTime?    @db.Date
  movimientos      Movimiento[]
  @@unique([activoId, numero])
}

model RegistroCartera {
  id              String   @id @default(cuid())
  activoId        String
  activo          Activo   @relation(fields: [activoId], references: [id], onDelete: Cascade)
  periodo         String   // "YYYY-MM"
  capitalEnCalle  Decimal  @db.Decimal(18, 2)
  capitalEnMora   Decimal  @default(0) @db.Decimal(18, 2)
  clientesActivos Int?
  notas           String?
  @@unique([activoId, periodo])
}

model Pasivo {
  id                 String               @id @default(cuid())
  nombre             String
  tipo               TipoPasivo
  contraparteId      String?
  contraparte        Contraparte?         @relation(fields: [contraparteId], references: [id])
  moneda             Moneda
  capital            Decimal              @db.Decimal(18, 2)
  tasaMensual        Decimal              @db.Decimal(9, 6)
  esquema            EsquemaCronograma    @default(INTERES_MENSUAL_CAPITAL_AL_VENCIMIENTO)
  fechaInicio        DateTime             @db.Date
  fechaVencimiento   DateTime             @db.Date   // se carga tal cual figura en el contrato
  plazoMeses         Int
  prorrateaPrimerMes Boolean              @default(false)
  diaHabilLimite     Int                  @default(10) // interés: hasta el N-ésimo día hábil del mes siguiente
  instrumentacion    Instrumentacion      @default(PERSONAL)
  regularizacion     EstadoRegularizacion @default(NO_APLICA)
  preavisoDias       Int?                 // 90 en el contrato estándar
  penalidadRetiroPct Decimal?             @db.Decimal(5, 4)  // 0.30
  punitorioMensual   Decimal?             @db.Decimal(9, 6)  // 0.02
  fechaPreaviso      DateTime?            @db.Date
  montoPreaviso      Decimal?             @db.Decimal(18, 2)
  estado             EstadoPasivo         @default(VIGENTE)
  notas              String?
  cuotas             CuotaPasivo[]
  movimientos        Movimiento[]
  fondeos            Fondeo[]
  createdAt          DateTime             @default(now())
}

model CuotaPasivo {
  id               String       @id @default(cuid())
  pasivoId         String
  pasivo           Pasivo       @relation(fields: [pasivoId], references: [id], onDelete: Cascade)
  numero           Int
  periodo          String       // "YYYY-MM", mes de devengamiento
  fechaVencimiento DateTime     @db.Date
  interes          Decimal      @db.Decimal(18, 2)
  capital          Decimal      @db.Decimal(18, 2)
  estado           EstadoCuota  @default(PENDIENTE)
  montoPagado      Decimal      @default(0) @db.Decimal(18, 2)
  fechaPago        DateTime?    @db.Date
  movimientos      Movimiento[]
  @@unique([pasivoId, numero])
}

model Fondeo {
  id         String    @id @default(cuid())
  pasivoId   String
  pasivo     Pasivo    @relation(fields: [pasivoId], references: [id])
  activoId   String
  activo     Activo    @relation(fields: [activoId], references: [id])
  monto      Decimal   @db.Decimal(18, 2)  // en la moneda del pasivo
  fechaDesde DateTime  @db.Date
  fechaHasta DateTime? @db.Date
  notas      String?
}

model Categoria {
  id          String        @id @default(cuid())
  nombre      String
  tipo        TipoCategoria
  grupoER     GrupoER
  archivada   Boolean       @default(false)
  movimientos Movimiento[]
  @@unique([nombre, tipo])
}

model Movimiento {
  id              String         @id @default(cuid())
  fecha           DateTime       @db.Date
  tipo            TipoMovimiento
  monto           Decimal        @db.Decimal(18, 2)   // en la moneda de la cuenta
  moneda          Moneda
  tipoCambio      Decimal        @db.Decimal(12, 4)   // ARS por USD, oficial venta del día
  cuentaId        String?
  cuenta          Cuenta?        @relation("CuentaOrigen", fields: [cuentaId], references: [id])
  cuentaDestinoId String?
  cuentaDestino   Cuenta?        @relation("CuentaDestino", fields: [cuentaDestinoId], references: [id])
  montoDestino    Decimal?       @db.Decimal(18, 2)   // transferencias entre monedas
  categoriaId     String?
  categoria       Categoria?     @relation(fields: [categoriaId], references: [id])
  activoId        String?
  activo          Activo?        @relation(fields: [activoId], references: [id])
  pasivoId        String?
  pasivo          Pasivo?        @relation(fields: [pasivoId], references: [id])
  cuotaActivoId   String?
  cuotaActivo     CuotaActivo?   @relation(fields: [cuotaActivoId], references: [id])
  cuotaPasivoId   String?
  cuotaPasivo     CuotaPasivo?   @relation(fields: [cuotaPasivoId], references: [id])
  descripcion     String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  @@index([fecha])
  @@index([tipo, fecha])
}

model TipoCambio {
  fecha  DateTime @id @db.Date
  compra Decimal  @db.Decimal(12, 4)
  venta  Decimal  @db.Decimal(12, 4)
  fuente String   // "dolarapi" | "argentinadatos" | "manual"
  manual Boolean  @default(false)
}

model Feriado {
  fecha  DateTime @id @db.Date
  nombre String
}

model CierreMensual {
  periodo          String   @id   // "YYYY-MM"
  fechaCierre      DateTime @default(now())
  tipoCambioCierre Decimal  @db.Decimal(12, 4)
  snapshot         Json     // balance, ER, flujo y KPIs congelados
  notas            String?
}

model Configuracion {
  id                     Int       @id @default(1)
  metaPatrimonioUsd      Decimal?  @db.Decimal(18, 2)
  fechaMeta              DateTime? @db.Date
  coberturaMinimaMeses   Decimal   @default(1) @db.Decimal(5, 2)
  umbralDescalceMonedaPct Decimal  @default(0.20) @db.Decimal(5, 4)
  costoOportunidadMensual Decimal  @default(0) @db.Decimal(9, 6) // costo del capital propio para el spread
  monedaReporte          Moneda    @default(USD)
}
```

### Validaciones clave
- `Movimiento.moneda` = moneda de la cuenta de origen.
- `TRANSFERENCIA` exige `cuentaDestinoId`. Si las monedas difieren, exige `montoDestino`, y el TC implícito se muestra como referencia.
- `APLICACION_ACTIVO`, `COBRO_RENDIMIENTO`, `COBRO_CAPITAL` y `BAJA_INCOBRABLE` exigen `activoId`.
- `TOMA_PASIVO`, `PAGO_INTERES` y `PAGO_CAPITAL` exigen `pasivoId`.
- `INGRESO` y `GASTO` exigen `categoriaId`, salvo un `GASTO` con `activoId` (gasto directo del activo).
- La suma de fondeos vigentes de un pasivo no puede superar su capital pendiente.
- No se pueden crear, editar ni borrar movimientos con fecha dentro de un período cerrado sin reabrir el cierre (acción explícita con confirmación).

---

## 5. Reglas de negocio

### 5.1 Tipo de cambio
- Fuente diaria: `GET https://dolarapi.com/v1/dolares/oficial` (campos `compra`, `venta`, `fechaActualizacion`). Se usa **venta**.
- Histórico para la carga inicial: ArgentinaDatos (verificar el endpoint de cotizaciones históricas del dólar oficial).
- Si no hay TC para una fecha (fin de semana o feriado), se usa el último hábil anterior.
- Se permite override manual (queda `manual = true`).
- Conversión: `USD = ARS / TC` y `ARS = USD × TC`.
- Si el último TC tiene más de 3 días hábiles, el dashboard muestra una alerta.

### 5.2 Días hábiles
- Lunes a viernes, excluyendo la tabla `Feriado`.
- Seed de feriados nacionales 2026–2028 (fuente sugerida: ArgentinaDatos). Editable desde Config.
- `nEsimoDiaHabil(año, mes, n)` es una función pura y testeada.

### 5.3 Cronograma de pasivos (mutuos)
Esquema `INTERES_MENSUAL_CAPITAL_AL_VENCIMIENTO`, que es el contrato estándar:
- Interés mensual simple sobre el capital original: `interes = capital × tasaMensual`. No capitaliza.
- Períodos por mes calendario, desde el mes de `fechaInicio` durante `plazoMeses` meses.
- Si `prorrateaPrimerMes`, el primer período prorratea por días corridos: `interes × díasRestantes / díasDelMes`.
- Fecha de vencimiento de cada cuota de interés: el `diaHabilLimite`-ésimo día hábil del mes siguiente al período (pago por período vencido).
- El capital se devuelve en un único pago en `fechaVencimiento`, tal como está cargado en el contrato. Va como cuota final con `capital = capital` e `interes = 0`, o sumado a la última cuota de interés si coinciden las fechas.
- **El cronograma generado es una propuesta**: se muestra en una vista previa antes de guardar, y cada cuota se puede editar a mano para calzar con el contrato real.

Esquema `CUOTAS_IGUALES_INTERES_DIRECTO`:
- `interesTotal = capital × tasa × n`; cuota = `(capital + interesTotal) / n`, dividida en capital `capital/n` e interés `capital × tasa`.
- La última cuota absorbe el redondeo.

### 5.4 Estados de cuota
- `PENDIENTE` pasa a `VENCIDA` cuando pasa `fechaVencimiento` sin pago total (lo hace el cron diario).
- Pago parcial deja la cuota en `PARCIAL`; pago total, en `PAGADA`.
- En pasivos con cuota vencida, se muestra el **punitorio estimado** = `interesImpago × punitorioMensual × díasDeAtraso / 30`. Si se paga, se registra como `GASTO` con categoría "Punitorios" (grupo `COSTO_FINANCIERO_OTRO`).
- Registrar el pago o cobro desde la cuota crea el `Movimiento` vinculado con un solo tap, prellenado con el monto pendiente, la cuenta por defecto de esa moneda y la fecha de hoy.

### 5.5 Preaviso de retiro
- Se registra `fechaPreaviso` y `montoPreaviso`, y el pasivo pasa a `EN_PREAVISO`.
- `fechaDevolucion = fechaPreaviso + preavisoDias` (días corridos).
- La penalidad sobre el monto retirado sale de `penalidadRetiroPct`. **Pendiente de confirmar con José a quién afecta** (ver §12).
- Al confirmar, se genera la cuota de devolución y se recortan las cuotas de interés posteriores. Si el retiro es parcial, se recalculan sobre el capital remanente.

### 5.6 Comportamientos de activos

| Comportamiento | Cómo se registra | Valor en balance | Rendimiento |
|---|---|---|---|
| `RENTA_PROGRAMADA` | Cronograma de cobro (mismos esquemas que pasivos) | Capital pendiente de cobro | Interés devengado por cuota |
| `CARTERA` | Aportes (`APLICACION_ACTIVO`), retiros (`COBRO_CAPITAL`), ganancia mensual (`COBRO_RENDIMIENTO`); en el cierre, `RegistroCartera` con capital en calle y mora | Capital aplicado neto (aportes − retiros − bajas) | Ganancia registrada en el mes, neta de gastos directos |
| `COMPRAVENTA` | Compra (`APLICACION_ACTIVO`) + gastos directos (`GASTO` con `activoId`, que **se capitalizan**) + venta | Costo total (compra + gastos) mientras está en stock | Al vender: `ganancia = precioVenta − costoTotal`. El registro de la venta genera automáticamente `COBRO_CAPITAL` (costo) + `COBRO_RENDIMIENTO` (ganancia). Si hay pérdida, va a Pérdidas |
| `TENENCIA` | Compra + valuaciones periódicas | `valuacionActual` | Los revalúos no pasan por el ER: van a "Revalúos" en la conciliación patrimonial. Las rentas cobradas (alquiler, dividendo) sí van al ER como `COBRO_RENDIMIENTO` |

- Pasar un activo a `INCOBRABLE` genera un `BAJA_INCOBRABLE` por el capital pendiente, que impacta Pérdidas en el ER de ese mes.

Tipos de activo del seed (el usuario puede crear más):

| Tipo | Comportamiento |
|---|---|
| Préstamos personales | CARTERA |
| Financiamiento de celulares | CARTERA |
| Financiamiento de vehículos | CARTERA |
| Compraventa de vehículos | COMPRAVENTA |
| Apalancamiento a terceros | RENTA_PROGRAMADA |
| Inversiones financieras | TENENCIA |
| Participaciones societarias | TENENCIA |
| Bienes (inmuebles, vehículo propio) | TENENCIA |

### 5.7 Fondeo y spread
- Un pasivo puede fondear varios activos, y un activo puede estar fondeado por varios pasivos.
- **Costo de fondeo de un activo** = promedio ponderado de `tasaMensual` de los pasivos que lo fondean, por monto asignado. La parte no fondeada por pasivos se considera capital propio, a `costoOportunidadMensual`.
- **Rendimiento mensual de un activo**:
  - `RENTA_PROGRAMADA`: su `tasaMensual`.
  - `CARTERA` y `COMPRAVENTA`: real, sobre los últimos 3 meses = rendimiento neto / capital promedio / meses.
  - `TENENCIA`: rentas cobradas / valuación (sin revalúos).
- **Spread del activo** = rendimiento − costo de fondeo.
- **Descalce de moneda**: un fondeo donde la moneda del pasivo difiere de la del activo se marca como descalce. Caso típico: USD al 4% colocados en pesos al 8%.

### 5.8 Mutuos instrumentados vía sociedad (práctica heredada)
- `instrumentacion = SOCIEDAD` identifica mutuos firmados por Esther X Fusión S.A. cuyo capital usa José personalmente. Se tratan como pasivo personal, con la misma lógica de cronograma.
- `regularizacion`: `PENDIENTE` hasta que se regularice la estructura; después, `REGULARIZADO`.
- El dashboard muestra la tarjeta **"Estructura a regularizar"** con la cantidad de contratos y el capital en `SOCIEDAD + PENDIENTE`. El objetivo es verla bajar a cero.
- Al crear un pasivo nuevo con `instrumentacion = SOCIEDAD`, se pide una confirmación suave ("Esta estructura está marcada para dejar de usarse. ¿Confirmás?").

---

## 6. Estados financieros

### 6.1 Estado de resultados mensual

Criterio **mixto y explícito**:
- Las partidas con cronograma (cuotas de activos `RENTA_PROGRAMADA` y cuotas de pasivos) se imputan por **devengado**, según `periodo`, se hayan pagado o no.
- Todo lo demás se imputa por **fecha del movimiento**.
- Un movimiento vinculado a una cuota **no** vuelve a sumar al ER, porque ya lo cuenta la cuota. Así se evita el doble conteo.

```
ESTADO DE RESULTADOS — Período YYYY-MM                     ARS | USD

1. Rendimiento de activos productivos
     por tipo de activo (préstamos personales, celulares, vehículos,
     compraventa, apalancamiento, tenencias)
   (−) Gastos directos de activos (no capitalizables)
   = Rendimiento neto de activos

2. (−) Costo del capital
     Intereses de mutuos con inversores (devengados)
     Otros costos financieros (tarjetas, punitorios)
   = MARGEN FINANCIERO

3. (+) Ingresos personales (por categoría: retiros del holding, honorarios, otros)

4. (−) Gastos personales fijos (por categoría)
5. (−) Gastos personales variables (por categoría)

6. (−) Pérdidas (incobrables, pérdidas en compraventa)

   = RESULTADO DEL PERÍODO (capacidad de ahorro)

Indicadores: tasa de ahorro · cobertura del costo financiero
(rendimiento neto de activos / costo del capital) · margen financiero / capital fondeado
```

- **Conversión**: cada partida se convierte al TC de su fecha (movimientos) o al TC de su fecha de vencimiento (cuotas; si todavía no existe, se usa el último TC).
- **Vista comparativa**: últimos 6 o 12 meses en columnas, con variación contra el mes anterior.

### 6.2 Flujo de caja mensual (percibido)
Agrupa todos los movimientos del mes por naturaleza:
- **Operativo personal**: ingresos y gastos.
- **Activos**: aplicaciones, cobros de rendimiento, cobros de capital.
- **Financiamiento**: tomas de pasivo, pagos de interés, pagos de capital.
- **Transferencias entre monedas**: informativo.

Termina con saldo inicial + variación = saldo final por cuenta y total convertido.

### 6.3 Balance (a una fecha)
```
ACTIVO
  Disponibilidades (por cuenta y moneda)
  Activos productivos (por tipo; valor según §5.6)
  Bienes y tenencias
PASIVO
  Mutuos con inversores (capital pendiente, separando PERSONAL y SOCIEDAD)
  Intereses devengados impagos
  Otras deudas
PATRIMONIO NETO = Activo − Pasivo
```
- Todo convertido al TC de la fecha de corte.
- Posición por moneda: activo USD − pasivo USD, y activo ARS − pasivo ARS.

### 6.4 Conciliación patrimonial (mes a mes, en USD)
```
PN inicial
+ Resultado del período
+ Revalúos de tenencias
± Diferencia de cambio   (residual: efecto del TC sobre partidas en ARS)
± Ajustes de conciliación de cuentas
= PN final
```
Este es el cuadro que explica por qué el patrimonio subió o bajó.

---

## 7. Dashboard y KPIs

### 7.1 Tarjetas de Inicio (en orden)
1. **Patrimonio neto** en la moneda de reporte, con variación contra el cierre anterior y mini-gráfico de 12 meses.
2. **Alertas** (solo si hay; ver §7.3).
3. **Próximos 30 días**:
   - Pagos a inversores (interés y capital) agrupados por fecha.
   - Cobros esperados.
   - Neto.
4. **Caja disponible** por moneda y total convertido, con **cobertura en meses**.
5. **Margen financiero del mes en curso**: rendimiento de activos − costo del capital, a la fecha.
6. **Spread global**: rendimiento ponderado de activos − costo ponderado del capital, en % mensual.
7. **Capital ocioso**: capital de pasivos no asignado a activos productivos, con su costo mensual ("te está costando $X por mes").
8. **Estructura a regularizar** (§5.8).
9. **Meta patrimonial**: progreso y curva real vs requerida.

### 7.2 Fórmulas
- **Costo ponderado del capital** (por moneda y total convertido) = Σ(capitalPendiente × tasaMensual) / Σ capitalPendiente.
- **Rendimiento ponderado de activos** = Σ(valorBalance × rendimientoMensual) / Σ valorBalance, solo sobre activos productivos.
- **Cobertura de liquidez (meses)** = caja disponible / (intereses a pagar en los próximos 30 días + promedio de gastos fijos de los últimos 3 meses).
- **Capital ocioso** = Σ capital pendiente de pasivos − Σ fondeos vigentes.
- **Exposición cambiaria** = Σ fondeos con descalce de moneda. Se acompaña de sensibilidad: "si el oficial sube 10%, tu deuda en USD sube $X en pesos".
- **Meta**:
  - tasa mensual requerida = (metaUsd / PNactualUsd)^(1 / mesesRestantes) − 1;
  - se grafica la curva requerida contra el PN real de cada cierre.

### 7.3 Alertas
| Alerta | Condición |
|---|---|
| Pago a inversor próximo | Cuota de pasivo con vencimiento ≤ 7 días |
| Pago a inversor vencido | Cuota de pasivo `VENCIDA` (incluye punitorio estimado) |
| Vencimiento de capital | Capital de pasivo que vence en ≤ 60 días |
| Preaviso activo | Pasivo `EN_PREAVISO` (días restantes y monto) |
| Cobro atrasado | Cuota de activo `VENCIDA` |
| Liquidez baja | Cobertura < `coberturaMinimaMeses` |
| Descalce de moneda | Exposición cambiaria / capital total > `umbralDescalceMonedaPct` |
| Spread negativo | Algún activo con rendimiento < costo de fondeo |
| TC desactualizado | Último TC con más de 3 días hábiles |
| Mes sin cerrar | Estamos después del día 10 y el mes anterior no se cerró |

---

## 8. Pantallas y flujos (mobile-first)

**Navegación inferior:** Inicio · Activos · [ + ] · Pasivos · Reportes. Movimientos y Config van en el menú superior.

**Toggle "ocultar montos"** en el header, para usar la app en público o compartiendo pantalla. Reemplaza cifras por `••••`.

### 8.1 Carga rápida (botón +)
1. Tipo: Gasto · Ingreso · Cobro · Pago · Transferencia · Más (los tipos avanzados).
2. Monto: teclado numérico grande con toggle ARS/USD.
3. Destino:
   - Gasto o Ingreso: categoría, con las 6 más usadas arriba.
   - Cobro: activo, o cuota pendiente sugerida.
   - Pago: pasivo, o cuota pendiente sugerida.
4. Cuenta: por defecto, la última usada en esa moneda.
5. Guardar. Fecha (hoy) y descripción son opcionales y están colapsadas.

Objetivo: **4 taps + monto**.

### 8.2 Activos
- Lista agrupada por tipo, con valor, rendimiento mensual, spread (chip verde o rojo) y estado.
- Detalle según comportamiento:
  - cronograma (RENTA_PROGRAMADA);
  - registros mensuales y evolución (CARTERA);
  - costo acumulado y botón "Registrar venta" (COMPRAVENTA);
  - valuaciones (TENENCIA).
- Además: fondeos asignados y movimientos.
- Alta en wizard: tipo → datos → (cronograma: vista previa editable) → fondeo opcional.

### 8.3 Pasivos (inversores)
- Lista con inversor, moneda, capital, tasa, próximo vencimiento y badges `SOCIEDAD` y `EN_PREAVISO`.
- Detalle:
  - cronograma, con botón "Pagar" por cuota;
  - capital, fondeos (dónde está ese capital) y spread de lo fondeado;
  - acción "Registrar preaviso".
- Alta en wizard: inversor → condiciones (con defaults del contrato estándar: interés mensual simple, 10º día hábil, preaviso 90 días, penalidad 30%, punitorio 2%) → vista previa editable del cronograma → confirmar.
- Vista **Calendario**: todos los vencimientos de pasivos y activos por mes.

### 8.4 Movimientos
- Listado con filtros (mes, tipo, cuenta, categoría, activo, pasivo, moneda) y búsqueda.
- Swipe para editar o borrar (bloqueado en meses cerrados).

### 8.5 Reportes
- Estado de resultados, Flujo de caja, Balance y Conciliación patrimonial.
- Selector de período y de moneda de reporte.
- Export CSV (y PDF del ER en fase 2).

### 8.6 Cierre de mes (wizard)
1. Revisar cuotas del período: marcar pagadas o cobradas, o dejarlas pendientes.
2. Carteras: cargar capital en calle y mora de cada activo `CARTERA`.
3. Tenencias: actualizar valuaciones (opcional).
4. Conciliación de cuentas: ingresar el saldo real de cada cuenta. La diferencia genera un `AJUSTE`.
5. Confirmar el TC de cierre.
6. Resumen y confirmación, que genera un `CierreMensual` con snapshot inmutable.

### 8.7 Config
- Cuentas, categorías, tipos de activo, contrapartes y feriados.
- TC manual.
- Meta patrimonial, umbrales, costo de oportunidad y moneda de reporte.
- Export completo (CSV por tabla, en ZIP).

### 8.8 Carga inicial (onboarding)
Primer uso, en este orden:
1. cuentas con saldos iniciales;
2. pasivos vigentes (mutuos en curso, marcando las cuotas ya pagadas);
3. activos vigentes;
4. fondeos.

Permite ingresar un mutuo con fecha de inicio pasada y marcar en bloque "cuotas pagadas hasta YYYY-MM".

---

## 9. Seguridad, privacidad y operación
- Todas las rutas bajo `(app)` protegidas por middleware; toda server action verifica sesión y email en allowlist.
- Sin API pública. Los endpoints de cron se validan con `CRON_SECRET` en un header.
- Variables de entorno: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAIL`, `CRON_SECRET`, `TZ=America/Argentina/Buenos_Aires`.
- Sesión de 30 días en el dispositivo.
- Backups de Postgres activados en Railway, más export manual desde Config.
- Proyecto de Railway propio, separado de los del holding y Academy.
- No registrar montos en logs.

---

## 10. Roadmap por fases

### Fase 1 — Base operativa (MVP)
Alcance: auth y PWA instalable · Config (cuentas, categorías, tipos de activo, contrapartes, feriados) · Pasivos con cronograma y pagos · Activos (los 4 comportamientos) · Movimientos y carga rápida · TC diario automático · Cron diario · Onboarding · Inicio v1 (PN, caja, próximos 30 días, alertas de vencimientos) · Toggle ocultar montos.

Criterios de aceptación:
- [ ] Cargar un mutuo de USD 10.000 al 4% mensual a 24 meses, iniciado el 15/10/2026, genera 24 cuotas de interés de USD 400, cada una con vencimiento en el 10º día hábil del mes siguiente (respetando feriados), más la devolución de capital en la fecha cargada.
- [ ] Pagar una cuota desde el detalle del pasivo lleva 2 taps y crea el movimiento vinculado.
- [ ] Una compraventa comprada a ARS 8.000.000, con gastos de ARS 500.000 y vendida a ARS 10.000.000, muestra una ganancia de ARS 1.500.000, y el balance deja de incluirla.
- [ ] Una compra de USD con pesos (transferencia entre cuentas de distinta moneda) no afecta el ER.
- [ ] El TC oficial se actualiza solo cada día hábil; si falla, aparece la alerta.
- [ ] La app se instala en el celular y abre en pantalla completa.
- [ ] Tests de `domain/cronograma` y `domain/diasHabiles` en verde.

### Fase 2 — Estados financieros
Alcance: ER mensual y comparativo · Flujo de caja · Balance · Conciliación patrimonial · Cierre de mes con snapshot · Bloqueo de períodos cerrados · Export CSV y PDF del ER.

Criterios de aceptación:
- [ ] Un interés de mutuo devengado en octubre y pagado el 12 de noviembre aparece en el ER de octubre y en el flujo de caja de noviembre, sin duplicarse.
- [ ] La conciliación patrimonial cierra exacto: PN inicial + componentes = PN final, con diferencia 0.
- [ ] Un mes cerrado no admite ediciones sin reapertura explícita.
- [ ] Tests de `domain/estadoResultados`, `balance` y `flujoCaja` con casos multimoneda.

### Fase 3 — Inteligencia
Alcance: Fondeos (UI) · Spread por activo y global · Costo ponderado · Capital ocioso · Descalce y sensibilidad cambiaria · Cobertura de liquidez · Meta patrimonial con curva · Todas las alertas de §7.3 · Tarjeta "Estructura a regularizar".

### Fase 4 — Automatización
Alcance: notificaciones de vencimientos (web push en la PWA o bot de Telegram) · Importación de CSV bancario con reglas de categorización · Carga por mensaje ("gasté 45000 nafta") · Proyección de flujo a 90 días.

---

## 11. Seed inicial

**Categorías de ingreso** (grupo `INGRESO_PERSONAL`): Retiros / sueldo del holding · Honorarios y consultorías · Otros ingresos.

**Categorías de gasto**

| Grupo | Categorías |
|---|---|
| `GASTO_FIJO` | Vivienda · Servicios · Seguros · Suscripciones · Educación · Familia · Impuestos personales |
| `GASTO_VARIABLE` | Supermercado · Comidas afuera · Transporte y combustible · Salud · Ropa · Entretenimiento · Viajes · Regalos · Varios |
| `COSTO_FINANCIERO_OTRO` | Intereses de tarjeta · Punitorios · Comisiones bancarias |

**Tipos de activo**: los de §5.6.

**Feriados**: nacionales 2026–2028.

---

## 12. Decisiones abiertas (a confirmar con José antes o durante la Fase 1)
1. **Penalidad por retiro anticipado (30%)**: ¿la absorbe el inversor (se le devuelve el 70%) o es un costo para José? Define cómo se calcula el monto del preaviso.
2. **Carteras (préstamos personales, celulares)**: ¿se registra la ganancia mensual neta de una vez, o cobranza total más el capital recuperado para que la app calcule la ganancia? La propuesta por defecto es la ganancia mensual neta, que exige menos carga.
3. **Retiros del holding**: ¿entran como ingreso personal (categoría "Retiros / sueldo del holding")? Propuesta: sí.
4. **Costo de oportunidad del capital propio** para el spread: ¿0% o una tasa de referencia?
5. **Meta patrimonial**: monto en USD y fecha objetivo.
