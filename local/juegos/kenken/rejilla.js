// Cuadrícula del KenKen (móvil y TV): bordes gruesos entre jaulas distintas y, en la primera casilla
// de cada jaula, su cuenta ("12×", "3−"…).
import { h } from "../../comun/ui.js";

export function crearRejilla({ n, jaulas, de }) {
  const el = h("div.kk", { style: { "--n": n } });
  const etiqueta = new Map(jaulas.map((j, i) => [Math.min(...j.celdas), i]));
  const celdas = [];
  for (let k = 0; k < n * n; k++) {
    const r = Math.floor(k / n), c = k % n;
    const borde = (rr, cc) => rr < 0 || cc < 0 || rr >= n || cc >= n || de[rr * n + cc] !== de[k];
    const clases = [borde(r - 1, c) && "b-arr", borde(r + 1, c) && "b-aba", borde(r, c - 1) && "b-izq", borde(r, c + 1) && "b-der"].filter(Boolean);
    const j = etiqueta.has(k) ? jaulas[etiqueta.get(k)] : null;
    const celda = h(
      `button.kk-celda${clases.map((x) => "." + x).join("")}`,
      { type: "button", "data-k": k, tabindex: -1 },
      j ? h("span.kk-cuenta", `${j.objetivo}${j.op}`) : null,
      h("span.kk-num")
    );
    celdas.push(celda);
    el.append(celda);
  }
  return {
    el,
    celdas,
    /** Pinta los números (0 = vacío). */
    poner(valores) {
      valores.forEach((v, k) => (celdas[k].lastChild.textContent = v ? String(v) : ""));
    },
  };
}
