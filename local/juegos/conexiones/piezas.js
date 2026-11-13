// Conexiones · piezas comunes (móvil, TV y resumen del modo solo):
//  - las palabras se ajustan a su casilla y, si son muy largas, se parten por sílabas (PAISA- / JISMO);
//  - los grupos encontrados se pintan como una franja de color con su título y sus 4 casillas.
import { h } from "../../comun/ui.js";

export const COLORES = ["#f0d455", "#6cc49a", "#5aaaf2", "#ae8ef5"];

const VOCAL = /[aeiouáéíóúü]/;
// Parejas de consonantes que no se separan (van juntas a la sílaba siguiente).
const JUNTAS = new Set(["pr", "br", "tr", "dr", "cr", "gr", "fr", "pl", "bl", "cl", "gl", "fl", "kr", "kl", "tl", "ch", "ll", "rr"]);

/** Dónde se puede partir la palabra entre sílabas (índices del corte). Solo entre consonantes y vocales: nunca separa vocales. */
export function cortesSilaba(palabra) {
  const p = palabra.toLowerCase();
  const esVocal = (i) => VOCAL.test(p[i]) || (p[i] === "y" && i === p.length - 1);
  const cortes = [];
  let i = 0;
  while (i < p.length && !esVocal(i)) i++; // las consonantes del principio van con la primera sílaba
  while (i < p.length) {
    while (i < p.length && esVocal(i)) i++;
    const a = i;
    while (i < p.length && !esVocal(i)) i++;
    if (i >= p.length) break; // consonantes del final: con la última sílaba
    const grupo = p.slice(a, i);
    const n = grupo.length;
    if (n === 1) cortes.push(a);
    else if (n === 2) cortes.push(JUNTAS.has(grupo) ? a : a + 1);
    else if (n === 3) cortes.push(JUNTAS.has(grupo.slice(1)) ? a + 1 : a + 2);
    else if (n >= 4) cortes.push(a + 2);
  }
  return cortes;
}

/** Cómo se escribe en una casilla: en una línea si cabe; si no, partida por la sílaba más cercana a la mitad. */
export function partir(forma, max = 7) {
  const t = forma.toUpperCase();
  if (t.length <= max) return { lineas: [t], n: t.length };
  const cs = cortesSilaba(forma).filter((i) => i >= 3 && t.length - i >= 3);
  if (!cs.length) return { lineas: [t], n: t.length };
  const mitad = t.length / 2;
  const i = cs.reduce((m, x) => (Math.abs(x - mitad) < Math.abs(m - mitad) ? x : m));
  return { lineas: [t.slice(0, i) + "-", t.slice(i)], n: Math.max(i + 1, t.length - i) };
}

/** El texto de una casilla: el tamaño de letra se ajusta al ancho (--n = letras de la línea más larga). */
export function textoCasilla(forma, max = 7) {
  const { lineas, n } = partir(forma, max);
  return h("span.cx-texto", { style: { "--n": Math.max(5, n) } }, ...lineas.flatMap((l, k) => (k ? [h("br"), l] : [l])));
}

/** Franja de un grupo: el título bien visible y debajo sus 4 palabras en casillas. */
export function franjaGrupo(nombre, formas, color, { perdido = false, clase = "" } = {}) {
  return h(
    `div.cx-grupo.cx-franja${perdido ? ".perdido" : ""}${clase}`,
    { style: { "--c": COLORES[color % 4] } },
    h("b.cx-grupo-nombre", nombre),
    h("div.cx-grupo-casillas", formas.map((f) => h("span.cx-mini", textoCasilla(f, 7))))
  );
}

/** Al acabar (modo solo): todos los tableros jugados con sus grupos, para estudiarlos. */
export function estudioGrupos(resumen, yo) {
  if (!resumen?.tableros?.length) return null;
  const encontrados = resumen.tableros.reduce((s, t) => s + t.grupos.filter((g) => g.por.includes(yo)).length, 0);
  return h(
    "div.cx-estudio.tarjeta",
    h("small", `Los grupos de cada tablero · encontraste ${encontrados}`),
    resumen.tableros.map((t, k) =>
      h(
        "div.cx-estudio-tablero",
        h("span.cx-estudio-titulo", `Tablero ${k + 1}`),
        t.grupos.map((g, gi) => franjaGrupo(g.nombre, g.palabras, g.color ?? gi, { perdido: !g.por.includes(yo) }))
      )
    )
  );
}
