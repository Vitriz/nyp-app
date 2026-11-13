// Tablero de Culebras (móvil, TV y final): las letras, los huecos y las palabras encontradas
// (cada una con su color, como una culebra que va de la primera letra a la última).
import { h } from "../../comun/ui.js";
import { s, trazoSvg } from "../comun/trazo.js";

export const COLORES = ["#ec5f86", "#9a62e0", "#45b04a", "#f59a23", "#1fb3d1", "#e8513d", "#3f7de8", "#c9a227", "#2bb39a"];

export function crearTablero({ n, letras }) {
  const capaHechas = s("g");
  const capaTrazo = s("g");
  const svg = s("svg", { viewBox: `0 0 ${n} ${n}`, class: "cul-svg", "aria-hidden": "true" }, capaHechas, capaTrazo);
  const fichas = letras.map((l, k) =>
    h(`div.cul-celda${l ? "" : ".hueco"}`, { "data-k": k, style: { gridRow: Math.floor(k / n) + 1, gridColumn: (k % n) + 1 } }, l ? l.toUpperCase() : "")
  );
  const el = h("div.cul", { style: { "--n": n } }, svg, ...fichas);
  return {
    el,
    /** hechas: [{ celdas, color }]; trazo: casillas que se están eligiendo. */
    pintar(hechas, trazo = []) {
      capaHechas.replaceChildren(
        ...hechas.map(({ celdas, color }) => trazoSvg(celdas, n, { stroke: color, "stroke-width": 0.74, opacity: 0.95 }))
      );
      capaTrazo.replaceChildren(trazo.length ? trazoSvg(trazo, n, { class: "cul-trazo", "stroke-width": 0.62 }) : "");
      const color = new Map();
      for (const x of hechas) for (const k of x.celdas) color.set(k, x.color);
      const enTrazo = new Set(trazo);
      fichas.forEach((f, k) => {
        f.classList.toggle("hecha", color.has(k));
        f.classList.toggle("eligiendo", enTrazo.has(k));
      });
    },
  };
}
