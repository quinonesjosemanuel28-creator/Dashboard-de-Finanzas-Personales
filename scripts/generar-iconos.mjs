// Genera los íconos de la PWA desde un SVG. Uso: node scripts/generar-iconos.mjs
// (sharp viene como dependencia de Next.js).
import sharp from "sharp";

const fondo = "#1e2638";
const verde = "#34d399";

// Tres barras ascendentes dentro de un área segura (`escala` < 1 para maskable).
function svg({ tam, redondeo, escala }) {
  const s = tam * escala;
  const o = (tam - s) / 2;
  const ancho = s * 0.16;
  const gap = s * 0.08;
  const base = o + s * 0.78;
  const x0 = o + (s - (3 * ancho + 2 * gap)) / 2;
  const alturas = [0.28, 0.44, 0.6].map((h) => h * s);
  const barras = alturas
    .map((h, i) => {
      const opac = [0.55, 0.78, 1][i];
      return `<rect x="${x0 + i * (ancho + gap)}" y="${base - h}" width="${ancho}" height="${h}" rx="${ancho * 0.22}" fill="${verde}" fill-opacity="${opac}"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}" viewBox="0 0 ${tam} ${tam}"><rect width="${tam}" height="${tam}" rx="${tam * redondeo}" fill="${fondo}"/>${barras}</svg>`;
}

const salidas = [
  { archivo: "public/icons/icon-192.png", tam: 192, redondeo: 0.22, escala: 0.9 },
  { archivo: "public/icons/icon-512.png", tam: 512, redondeo: 0.22, escala: 0.9 },
  { archivo: "public/icons/icon-maskable-512.png", tam: 512, redondeo: 0, escala: 0.7 },
  { archivo: "src/app/apple-icon.png", tam: 180, redondeo: 0, escala: 0.8 },
  { archivo: "src/app/icon.png", tam: 64, redondeo: 0.22, escala: 0.95 },
];

for (const s of salidas) {
  await sharp(Buffer.from(svg(s))).png().toFile(s.archivo);
  console.log("✓", s.archivo);
}
