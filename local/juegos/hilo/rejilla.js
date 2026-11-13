// Tablero del Hilo (móvil, TV y final): las casillas, el hilo (de azul a coral, como el título),
// las paredes y los números encima. Todo en un SVG que se adapta al tamaño.
import { s, centro, mezclar } from "../comun/trazo.js";
import { h } from "../../comun/ui.js";

export const COLOR_INICIO = "#2f9fd0";
export const COLOR_MEDIO = "#8d6be0";
export const COLOR_FIN = "#ef7a4f";
// Azul → violeta → coral (si se mezclaran directamente, en medio saldría gris).
const colorEn = (t) => (t < 0.5 ? mezclar(COLOR_INICIO, COLOR_MEDIO, t * 2) : mezclar(COLOR_MEDIO, COLOR_FIN, (t - 0.5) * 2));

export function crearTablero({ n, numeros, muros }) {
  const capaHilo = s("g", { class: "hilo-trazo" });
  const capaCabeza = s("g");
  const fondo = s("g");
  for (let k = 0; k < n * n; k++) {
    const [x, y] = centro(k, n);
    fondo.append(s("rect", { x: x - 0.5, y: y - 0.5, width: 1, height: 1, class: "hilo-casilla" }));
  }
  // Paredes: en el borde entre dos casillas.
  const paredes = s("g", { class: "hilo-paredes" });
  for (const m of muros) {
    const [a, b] = m.split("-").map(Number);
    const ra = Math.floor(a / n), ca = a % n, rb = Math.floor(b / n), cb = b % n;
    if (ra === rb) {
      const x = Math.max(ca, cb);
      paredes.append(s("line", { x1: x, y1: ra + 0.02, x2: x, y2: ra + 0.98 }));
    } else {
      const y = Math.max(ra, rb);
      paredes.append(s("line", { x1: ca + 0.02, y1: y, x2: ca + 0.98, y2: y }));
    }
  }
  const capaNumeros = s("g", { class: "hilo-numeros" });
  const circulos = new Map();
  for (const [k, v] of numeros) {
    const [x, y] = centro(k, n);
    const c = s("circle", { cx: x, cy: y, r: 0.3 });
    const t = s("text", { x, y: y + 0.012, "text-anchor": "middle", "dominant-baseline": "central" }, String(v));
    const g = s("g", { class: "hilo-num" }, c, t);
    circulos.set(k, g);
    capaNumeros.append(g);
  }
  const svg = s("svg", { viewBox: `0 0 ${n} ${n}`, class: "hilo-svg", "aria-hidden": "true" }, fondo, capaHilo, capaCabeza, paredes, s("rect", { x: 0, y: 0, width: n, height: n, class: "hilo-marco" }), capaNumeros);
  const el = h("div.hilo", { style: { "--n": n } }, svg);
  const total = n * n;

  return {
    el,
    /** Dibuja el hilo. cabeza: resaltar la punta. */
    pintar(camino, { cabeza = true, completo = false } = {}) {
      capaHilo.replaceChildren();
      capaCabeza.replaceChildren();
      for (let i = 1; i < camino.length; i++) {
        const [x1, y1] = centro(camino[i - 1], n), [x2, y2] = centro(camino[i], n);
        // El color avanza con el hilo: de azul (1) a coral (cuando cubre todo el tablero).
        const color = colorEn((i - 0.5) / (total - 1));
        capaHilo.append(s("line", { x1, y1, x2, y2, stroke: color }));
      }
      if (camino.length === 1) {
        const [x, y] = centro(camino[0], n);
        capaHilo.append(s("circle", { cx: x, cy: y, r: 0.3, fill: COLOR_INICIO }));
      }
      if (cabeza && camino.length && !completo) {
        const [x, y] = centro(camino[camino.length - 1], n);
        capaCabeza.append(s("circle", { cx: x, cy: y, r: 0.36, class: "hilo-cabeza" }));
      }
      const pasados = new Set(camino);
      for (const [k, g] of circulos) g.classList.toggle("pasado", pasados.has(k));
      el.classList.toggle("completo", completo);
    },
  };
}
