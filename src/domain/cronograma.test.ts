import { describe, expect, it } from "vitest";
import {
  type ParametrosCronograma,
  devengadoDelPeriodo,
  diaPagoPorDefecto,
  distribuirDevengado,
  fechaVencimientoSugerida,
  generarCronograma,
  interesDevengadoImpago,
} from "./cronograma";
import { diaDeSemana, sumarMesesPeriodo } from "./fechas";

const mutuoBase: ParametrosCronograma = {
  capital: "10000",
  tasaMensual: "0.04",
  esquema: "INTERES_MENSUAL_CAPITAL_AL_VENCIMIENTO",
  fechaInicio: "2026-10-15",
  fechaVencimiento: "2028-10-15",
  plazoMeses: 24,
  diaPago: 15,
  frecuenciaPago: "MENSUAL",
};

const soloInteres = (cuotas: ReturnType<typeof generarCronograma>) =>
  cuotas.filter((c) => c.mesesCubiertos > 0);

describe("generarCronograma — pago MENSUAL", () => {
  const cuotas = generarCronograma(mutuoBase);
  const intereses = soloInteres(cuotas);

  it("genera 24 cuotas de interés de USD 400 los días 15, del 15/11/2026 al 15/10/2028", () => {
    expect(intereses).toHaveLength(24);
    expect(intereses.every((c) => c.interes.eq(400) && c.capital.eq(0))).toBe(true);
    expect(intereses.every((c) => c.fechaVencimiento.endsWith("-15"))).toBe(true);
    expect(intereses[0]!.fechaVencimiento).toBe("2026-11-15");
    expect(intereses[23]!.fechaVencimiento).toBe("2028-10-15");
  });

  it("devuelve el capital en una cuota aparte en la fecha de vencimiento", () => {
    expect(cuotas).toHaveLength(25);
    const capital = cuotas[24]!;
    expect(capital).toMatchObject({ numero: 25, fechaVencimiento: "2028-10-15", mesesCubiertos: 0 });
    expect(capital.capital.eq(10000)).toBe(true);
    expect(capital.interes.eq(0)).toBe(true);
  });

  it("no mueve una cuota que cae domingo", () => {
    expect(diaDeSemana("2026-11-15")).toBe(0);
    expect(cuotas[0]!.fechaVencimiento).toBe("2026-11-15");
  });

  it("cada cuota devenga en el mes de su aniversario", () => {
    expect(intereses[0]!.periodoDesde).toBe("2026-11");
    expect(devengadoDelPeriodo(cuotas, "2026-10").eq(0)).toBe(true);
    expect(devengadoDelPeriodo(cuotas, "2026-11").eq(400)).toBe(true);
  });
});

describe("generarCronograma — pago TRIMESTRAL", () => {
  const cuotas = generarCronograma({ ...mutuoBase, frecuenciaPago: "TRIMESTRAL" });
  const intereses = soloInteres(cuotas);

  it("genera 8 cuotas de USD 1.200 cada 3 meses", () => {
    expect(intereses).toHaveLength(8);
    expect(intereses.every((c) => c.interes.eq(1200) && c.mesesCubiertos === 3)).toBe(true);
    expect(intereses.map((c) => c.fechaVencimiento)).toEqual([
      "2027-01-15",
      "2027-04-15",
      "2027-07-15",
      "2027-10-15",
      "2028-01-15",
      "2028-04-15",
      "2028-07-15",
      "2028-10-15",
    ]);
  });

  it("el ER muestra USD 400 de costo en cada mes, de noviembre 2026 a octubre 2028", () => {
    for (let i = 0; i < 24; i++) {
      const periodo = sumarMesesPeriodo("2026-11", i);
      expect(devengadoDelPeriodo(cuotas, periodo).toString(), periodo).toBe("400");
    }
    expect(devengadoDelPeriodo(cuotas, "2026-10").eq(0)).toBe(true);
    expect(devengadoDelPeriodo(cuotas, "2028-11").eq(0)).toBe(true);
  });

  it("inicio 25/09 trimestral: la cuota del 25/12 imputa un tercio a octubre, noviembre y diciembre", () => {
    const primera = generarCronograma({
      ...mutuoBase,
      fechaInicio: "2026-09-25",
      fechaVencimiento: "2027-09-25",
      plazoMeses: 12,
      diaPago: 25,
      frecuenciaPago: "TRIMESTRAL",
    })[0]!;
    expect(primera.fechaVencimiento).toBe("2026-12-25");
    expect(distribuirDevengado(primera).map((p) => [p.periodo, p.interes.toString()])).toEqual([
      ["2026-10", "400"],
      ["2026-11", "400"],
      ["2026-12", "400"],
    ]);
  });

  it("plazo de 10 meses: 3 cuotas de 3 meses y una última de 1 mes al vencimiento", () => {
    const c = soloInteres(
      generarCronograma({
        ...mutuoBase,
        plazoMeses: 10,
        fechaVencimiento: "2027-08-15",
        frecuenciaPago: "TRIMESTRAL",
      }),
    );
    expect(c.map((x) => [x.fechaVencimiento, x.mesesCubiertos, x.interes.toString()])).toEqual([
      ["2027-01-15", 3, "1200"],
      ["2027-04-15", 3, "1200"],
      ["2027-07-15", 3, "1200"],
      ["2027-08-15", 1, "400"],
    ]);
  });
});

describe("generarCronograma — otras frecuencias", () => {
  it("ANUAL a 24 meses: 2 cuotas de capital × tasa × 12", () => {
    const c = soloInteres(generarCronograma({ ...mutuoBase, frecuenciaPago: "ANUAL" }));
    expect(c.map((x) => [x.fechaVencimiento, x.interes.toString()])).toEqual([
      ["2027-10-15", "4800"],
      ["2028-10-15", "4800"],
    ]);
  });

  it("SEMESTRAL y CUATRIMESTRAL a 24 meses", () => {
    expect(soloInteres(generarCronograma({ ...mutuoBase, frecuenciaPago: "SEMESTRAL" }))).toHaveLength(4);
    const cuatri = soloInteres(generarCronograma({ ...mutuoBase, frecuenciaPago: "CUATRIMESTRAL" }));
    expect(cuatri).toHaveLength(6);
    expect(cuatri[0]!.fechaVencimiento).toBe("2027-02-15");
    expect(cuatri[0]!.interes.eq(1600)).toBe(true);
  });
});

describe("fechas de pago por aniversario", () => {
  it("inicio 31/01: usa el último día en meses cortos y vuelve al 31", () => {
    const c = soloInteres(
      generarCronograma({
        ...mutuoBase,
        fechaInicio: "2027-01-31",
        diaPago: 31,
        plazoMeses: 3,
        fechaVencimiento: fechaVencimientoSugerida("2027-01-31", 31, 3),
      }),
    );
    expect(c.map((x) => x.fechaVencimiento)).toEqual(["2027-02-28", "2027-03-31", "2027-04-30"]);
  });

  it("inicio 31/01 de un año bisiesto: la cuota de febrero cae el 29", () => {
    const c = soloInteres(
      generarCronograma({
        ...mutuoBase,
        fechaInicio: "2028-01-31",
        diaPago: 31,
        plazoMeses: 2,
        fechaVencimiento: "2028-03-31",
      }),
    );
    expect(c.map((x) => x.fechaVencimiento)).toEqual(["2028-02-29", "2028-03-31"]);
  });

  it("inicio 29/02 de un año bisiesto: día 29 salvo febrero no bisiesto", () => {
    const c = soloInteres(
      generarCronograma({
        ...mutuoBase,
        fechaInicio: "2028-02-29",
        diaPago: diaPagoPorDefecto("2028-02-29"),
        plazoMeses: 13,
        fechaVencimiento: fechaVencimientoSugerida("2028-02-29", 29, 13),
      }),
    );
    expect(c[0]!.fechaVencimiento).toBe("2028-03-29");
    expect(c[11]!.fechaVencimiento).toBe("2029-02-28");
    expect(c[12]!.fechaVencimiento).toBe("2029-03-29");
  });

  it("el día de pago es editable", () => {
    const c = generarCronograma({ ...mutuoBase, diaPago: 5, fechaVencimiento: "2028-10-05" });
    expect(c[0]!.fechaVencimiento).toBe("2026-11-05");
  });

  it("valida día de pago y fecha de vencimiento", () => {
    expect(() => generarCronograma({ ...mutuoBase, diaPago: 0 })).toThrow();
    expect(() => generarCronograma({ ...mutuoBase, diaPago: 32 })).toThrow();
    expect(() => generarCronograma({ ...mutuoBase, fechaVencimiento: "2028-09-15" })).toThrow();
    expect(() => generarCronograma({ ...mutuoBase, plazoMeses: 0 })).toThrow();
  });
});

describe("CUOTAS_IGUALES_INTERES_DIRECTO", () => {
  it("mensual: capital en partes iguales y la última absorbe el redondeo", () => {
    const c = generarCronograma({
      ...mutuoBase,
      esquema: "CUOTAS_IGUALES_INTERES_DIRECTO",
      capital: "1000",
      tasaMensual: "0.05",
      plazoMeses: 3,
      fechaVencimiento: "2027-01-15",
    });
    expect(c.map((x) => [x.capital.toString(), x.interes.toString()])).toEqual([
      ["333.33", "50"],
      ["333.33", "50"],
      ["333.34", "50"],
    ]);
  });

  it("trimestral a 10 meses: capital proporcional a los meses de cada cuota", () => {
    const c = generarCronograma({
      ...mutuoBase,
      esquema: "CUOTAS_IGUALES_INTERES_DIRECTO",
      plazoMeses: 10,
      fechaVencimiento: "2027-08-15",
      frecuenciaPago: "TRIMESTRAL",
    });
    expect(c.map((x) => [x.capital.toString(), x.interes.toString()])).toEqual([
      ["3000", "1200"],
      ["3000", "1200"],
      ["3000", "1200"],
      ["1000", "400"],
    ]);
  });
});

describe("distribuirDevengado", () => {
  it("reparte una cuota editada a mano y la última parte absorbe el redondeo", () => {
    const partes = distribuirDevengado({ interes: "100", periodoDesde: "2026-11", mesesCubiertos: 3 });
    expect(partes.map((p) => p.interes.toString())).toEqual(["33.33", "33.33", "33.34"]);
  });

  it("una cuota solo de capital no devenga", () => {
    expect(distribuirDevengado({ interes: "0", periodoDesde: "2028-10", mesesCubiertos: 0 })).toEqual([]);
  });
});

describe("interesDevengadoImpago (balance)", () => {
  const cuotas = generarCronograma({ ...mutuoBase, frecuenciaPago: "TRIMESTRAL" }).map((c) => ({
    ...c,
    montoPagado: "0",
  }));

  it("acumula lo devengado a la fecha de corte aunque la cuota no haya vencido", () => {
    expect(interesDevengadoImpago(cuotas, 15, "2026-11-14").toString()).toBe("0");
    expect(interesDevengadoImpago(cuotas, 15, "2026-11-15").toString()).toBe("400");
    expect(interesDevengadoImpago(cuotas, 15, "2026-12-31").toString()).toBe("800");
    expect(interesDevengadoImpago(cuotas, 15, "2027-01-15").toString()).toBe("1200");
  });

  it("descuenta lo pagado", () => {
    const pagada = cuotas.map((c, i) => (i === 0 ? { ...c, montoPagado: "1200" } : c));
    expect(interesDevengadoImpago(pagada, 15, "2027-01-15").toString()).toBe("0");
    expect(interesDevengadoImpago(pagada, 15, "2027-02-20").toString()).toBe("400");
  });
});
