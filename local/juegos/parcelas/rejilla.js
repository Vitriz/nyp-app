// Tablero de Parcelas (móvil, TV y final): las pistas (forma y, a veces, tamaño) y los rectángulos.
import { h } from "../../comun/ui.js";

// Colores de los rectángulos bien hechos (los que no cumplen su pista se ven grises).
export const COLORES = ["#f2b84b", "#e9604f", "#4fb6e8", "#3fbf86", "#f08a3c", "#8f7ae6", "#33a9b8", "#e46fa8", "#9bbf3a", "#5b8def"];

export const formaDe = (alto, ancho) => (alto === ancho ? "cuadrado" : alto > ancho ? "alto" : "ancho");

export function cumple(p, alto, ancho) {
  if (p.numero != null && alto * ancho !== p.numero) return false;
  return p.forma === "cualquiera" || p.forma === formaDe(alto, ancho);
}

/** El dibujo de la forma de una pista (cuadrado, alto, ancho o cualquiera). */
export const iconoForma = (forma) => h(`span.pc-forma.${forma}`, { "aria-hidden": "true" });

export function crearTablero({ n, pistas }) {
  const el = h("div.pc", { style: { "--n": n } });
  for (let k = 0; k < n * n; k++) el.append(h("div.pc-celda", { style: { gridRow: Math.floor(k / n) + 1, gridColumn: (k % n) + 1 } }));
  const capaRects = h("div.pc-capa");
  el.append(capaRects);
  const marcasPista = pistas.map((p) =>
    h(
      `div.pc-pista${p.numero != null ? ".con-numero" : ""}`,
      { style: { gridRow: Math.floor(p.k / n) + 1, gridColumn: (p.k % n) + 1 }, title: p.numero != null ? `${p.numero} casillas` : "" },
      iconoForma(p.forma),
      p.numero != null ? h("b", String(p.numero)) : null
    )
  );
  el.append(...marcasPista);
  const previa = h("div.pc-rect.previa.oculto");
  el.append(previa);
  const pistaEn = new Map(pistas.map((p) => [p.k, p]));

  /** ¿Está bien este rectángulo? Devuelve el índice de su pista o -1. */
  function valida([r, c, alto, ancho]) {
    let i = -1, cuantas = 0;
    for (let y = 0; y < alto; y++)
      for (let x = 0; x < ancho; x++) {
        const k = (r + y) * n + c + x;
        if (pistaEn.has(k)) (cuantas++), (i = pistas.indexOf(pistaEn.get(k)));
      }
    return cuantas === 1 && cumple(pistas[i], alto, ancho) ? i : -1;
  }
  const colocar = (nodo, [r, c, alto, ancho]) => {
    nodo.style.gridRow = `${r + 1} / span ${alto}`;
    nodo.style.gridColumn = `${c + 1} / span ${ancho}`;
  };

  return {
    el,
    valida,
    /** Pinta los rectángulos [[r, c, alto, ancho], …]. */
    pintar(rects) {
      capaRects.replaceChildren(
        ...rects.map((x) => {
          const i = valida(x);
          const nodo = h(`div.pc-rect${i >= 0 ? ".bien" : ".mal"}`, { style: i >= 0 ? { "--c": COLORES[i % COLORES.length] } : {} });
          colocar(nodo, x);
          return nodo;
        })
      );
      // Las pistas que ya tienen su rectángulo bien hecho, más discretas.
      const hechas = new Set(rects.map(valida).filter((i) => i >= 0));
      marcasPista.forEach((m, i) => m.classList.toggle("hecha", hechas.has(i)));
    },
    /** El rectángulo que se está dibujando (o null para quitarlo). */
    previa(x) {
      previa.classList.toggle("oculto", !x);
      if (!x) return;
      colocar(previa, x);
      previa.classList.toggle("bien", valida(x) >= 0);
    },
  };
}
