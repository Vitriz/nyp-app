// Tablero de Coronas (móvil, TV y final): cada zona con su color y bordes gruesos entre zonas.
import { h } from "../../comun/ui.js";

// Un color distinto para cada zona (hasta 9), claros para que se vean bien las ✕ y las coronas.
export const COLORES = ["#b7d3ff", "#ffe08a", "#d8c4ff", "#ffc7a1", "#a6e3f2", "#f6c3df", "#cfd5e3", "#e9d6a8", "#c4e8c0"];

export function crearTablero({ n, zona }) {
  const el = h("div.cor", { style: { "--n": n } });
  const celdas = [];
  for (let k = 0; k < n * n; k++) {
    const r = Math.floor(k / n), c = k % n;
    const borde = (rr, cc) => rr < 0 || cc < 0 || rr >= n || cc >= n || zona[rr * n + cc] !== zona[k];
    const clases = [borde(r - 1, c) && "b-arr", borde(r + 1, c) && "b-aba", borde(r, c - 1) && "b-izq", borde(r, c + 1) && "b-der"].filter(Boolean);
    const celda = h(`div.cor-celda${clases.map((x) => "." + x).join("")}`, { "data-k": k, style: { "--zona": COLORES[zona[k] % COLORES.length] } }, h("span.cor-marca"));
    celdas.push(celda);
    el.append(celda);
  }
  return {
    el,
    celdas,
    /** marcas: 0 vacío, 1 ✕, 2 corona. malas: casillas con coronas que chocan. */
    pintar(marcas, malas = new Set()) {
      marcas.forEach((m, k) => {
        const c = celdas[k];
        c.classList.toggle("x", m === 1);
        c.classList.toggle("corona", m === 2);
        c.classList.toggle("choca", malas.has(k));
        c.firstChild.textContent = m === 2 ? "👑" : m === 1 ? "✕" : "";
      });
    },
  };
}

/** Coronas que chocan entre sí (misma fila, columna o zona, o se tocan). */
export function choques(n, zona, coronas) {
  const malas = new Set();
  for (let i = 0; i < coronas.length; i++)
    for (let j = i + 1; j < coronas.length; j++) {
      const a = coronas[i], b = coronas[j];
      const ra = Math.floor(a / n), ca = a % n, rb = Math.floor(b / n), cb = b % n;
      if (ra === rb || ca === cb || zona[a] === zona[b] || (Math.abs(ra - rb) < 2 && Math.abs(ca - cb) < 2)) malas.add(a).add(b);
    }
  return malas;
}
