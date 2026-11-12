// Sopa de letras · TV: el tablero en grande y cuántas lleva cada uno.
import { h } from "../../comun/ui.js";
import { crearTablero, COLORES_SOPA } from "./tablero.js";
import { tarjetasJugadores } from "../comun/util.js";

export function montar(cuerpo, e, ctx) {
  const tablero = crearTablero(e.datos.tablero);
  const lado = h("div.sopa-lado");
  cuerpo.append(h("div.sopa-tv", h("div.sopa-tv-tablero", tablero.el), lado));
  const total = e.datos.total;
  const actualizar = tarjetasJugadores(lado, ctx, (e, id) => {
    const n = e.datos?.jugadores?.[id];
    return n == null ? null : { valor: n, extra: `de ${total}` };
  });
  actualizar(e);
  return { actualizar };
}

export function resumen(r) {
  const t = crearTablero(r.tablero);
  r.palabras.forEach((p, k) => t.marcar(p.r0, p.c0, p.r1, p.c1, COLORES_SOPA[k % COLORES_SOPA.length]));
  return h(
    "div.pl-resumen.tarjeta.aparece.sopa-resumen",
    { style: { animationDelay: "900ms" } },
    h("div.sopa-mini", t.el),
    h(
      "div.columna",
      h("span.etiqueta", "Las palabras eran"),
      h("div.pl-soluciones", r.palabras.map((p) => h("span.pl-sol", p.forma.toUpperCase())))
    )
  );
}
