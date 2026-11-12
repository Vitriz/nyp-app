// Tablero de sopa de letras (compartido por el móvil y la TV).
import { h } from "../../comun/ui.js";

export const COLORES_SOPA = ["#5fb7d0", "#e7a05c", "#6cc49a", "#c58be0", "#e46a62", "#e9c75a", "#7c9cf0", "#f08fb5", "#8fd3e0", "#b4c06a"];
const NS = "http://www.w3.org/2000/svg";

export function crearTablero(filas) {
  const tam = filas.length;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${tam} ${tam}`);
  svg.classList.add("sopa-trazos");
  const temporal = document.createElementNS(NS, "line");
  temporal.classList.add("sopa-temporal");
  const letras = h(
    "div.sopa-letras",
    { style: { gridTemplateColumns: `repeat(${tam}, 1fr)` } },
    filas.flatMap((f) => [...f].map((l) => h("span", l.toUpperCase())))
  );
  const el = h("div.sopa", svg, letras);

  function linea(r0, c0, r1, c1, color, nodo = document.createElementNS(NS, "line")) {
    nodo.setAttribute("x1", c0 + 0.5);
    nodo.setAttribute("y1", r0 + 0.5);
    nodo.setAttribute("x2", c1 + 0.5);
    nodo.setAttribute("y2", r1 + 0.5);
    nodo.setAttribute("stroke", color);
    return nodo;
  }

  return {
    el,
    tam,
    marcar(r0, c0, r1, c1, color) {
      const l = linea(r0, c0, r1, c1, color);
      l.classList.add("sopa-marca");
      svg.insertBefore(l, temporal.parentNode ? temporal : null);
    },
    temporal(r0, c0, r1, c1) {
      linea(r0, c0, r1, c1, "rgba(255,255,255,0.9)", temporal);
      if (!temporal.parentNode) svg.append(temporal);
    },
    quitarTemporal() {
      temporal.remove();
    },
    celdaEn(x, y) {
      const r = letras.getBoundingClientRect();
      const c = Math.floor(((x - r.left) / r.width) * tam);
      const f = Math.floor(((y - r.top) / r.height) * tam);
      return { r: Math.min(tam - 1, Math.max(0, f)), c: Math.min(tam - 1, Math.max(0, c)) };
    },
    texto(r0, c0, r1, c1) {
      const dr = Math.sign(r1 - r0), dc = Math.sign(c1 - c0);
      const n = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0)) + 1;
      let s = "";
      for (let k = 0; k < n; k++) s += filas[r0 + dr * k][c0 + dc * k];
      return s;
    },
  };
}
