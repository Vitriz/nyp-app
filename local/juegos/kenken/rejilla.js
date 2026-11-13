// Cuadrícula del KenKen (móvil, TV y resumen final): cada zona (jaula) con su color y bordes gruesos
// entre zonas distintas. En la primera casilla de cada zona, su cuenta: el signo en un círculo y el
// resultado («× = 80»: los números de la zona, multiplicados, dan 80). El número va siempre centrado.
import { h } from "../../comun/ui.js";

// Colores de las zonas: bien distintos entre sí y sin verdes ni rojos (esos son para «bien» y «mal»).
// Dos zonas que se tocan nunca tienen el mismo color.
const COLORES = ["#bcd7ff", "#ffe98a", "#dcc8ff", "#f5d7b0", "#c7cde0", "#a8e4f5"];
const BORDES = ["#3d74c9", "#b8941a", "#7a52c7", "#b07a3a", "#5d6886", "#2d8fb0"];

function colorear(n, jaulas, de) {
  const vecinas = jaulas.map(() => new Set());
  for (let k = 0; k < n * n; k++) {
    const r = Math.floor(k / n), c = k % n;
    for (const [rr, cc] of [[r + 1, c], [r, c + 1]]) {
      if (rr >= n || cc >= n) continue;
      const a = de[k], b = de[rr * n + cc];
      if (a !== b) {
        vecinas[a].add(b);
        vecinas[b].add(a);
      }
    }
  }
  const color = [];
  // Primero las zonas con más vecinas (así casi nunca hacen falta muchos colores).
  const orden = jaulas.map((_, i) => i).sort((a, b) => vecinas[b].size - vecinas[a].size);
  for (const i of orden) {
    const usados = new Set([...vecinas[i]].map((v) => color[v]));
    let c = (i * 3) % COLORES.length; // empezamos en un color distinto para que haya variedad
    for (let t = 0; t < COLORES.length && usados.has(c); t++) c = (c + 1) % COLORES.length;
    color[i] = c;
  }
  return color;
}

export function crearRejilla({ n, jaulas, de }) {
  const el = h("div.kk", { style: { "--n": n } });
  const etiqueta = new Map(jaulas.map((j, i) => [Math.min(...j.celdas), i]));
  const color = colorear(n, jaulas, de);
  const celdas = [];
  for (let k = 0; k < n * n; k++) {
    const r = Math.floor(k / n), c = k % n;
    const borde = (rr, cc) => rr < 0 || cc < 0 || rr >= n || cc >= n || de[rr * n + cc] !== de[k];
    const clases = [borde(r - 1, c) && "b-arr", borde(r + 1, c) && "b-aba", borde(r, c - 1) && "b-izq", borde(r, c + 1) && "b-der"].filter(Boolean);
    const j = etiqueta.has(k) ? jaulas[etiqueta.get(k)] : null;
    const z = color[de[k]];
    const celda = h(
      `button.kk-celda${clases.map((x) => "." + x).join("")}`,
      { type: "button", "data-k": k, tabindex: -1, style: { "--zona": COLORES[z], "--zona-borde": BORDES[z] } },
      j
        ? h(
            "span.kk-cuenta",
            { title: j.op ? `Los números de esta zona, con ${j.op}, dan ${j.objetivo}` : `Aquí va el ${j.objetivo}` },
            j.op ? h("i.kk-op", j.op) : null,
            h("b", `= ${j.objetivo}`)
          )
        : null,
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
