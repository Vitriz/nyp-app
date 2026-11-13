// Culebras · TV: el tablero de letras y cuántas palabras lleva cada uno.
import { h } from "../../comun/ui.js";
import { tarjetasJugadores } from "../comun/util.js";
import { crearTablero, COLORES } from "./rejilla.js";

export function montar(cuerpo, e, ctx) {
  const d = e.datos;
  const t = crearTablero(d);
  t.pintar([]);
  const lado = h("div.sopa-lado");
  cuerpo.append(h("div.sopa-tv", h("div.puzle-tv", t.el), lado));
  const actualizar = tarjetasJugadores(lado, ctx, (e, id) => {
    const v = e.datos?.jugadores?.[id];
    return v == null ? null : { valor: v, extra: `de ${d.total}` };
  });
  actualizar(e);
  return { actualizar };
}

export function resumen(r) {
  const t = crearTablero(r);
  t.pintar(r.palabras.map((p, i) => ({ celdas: p.celdas, color: COLORES[i % COLORES.length] })));
  return h(
    "div.pl-resumen.tarjeta.aparece",
    { style: { animationDelay: "900ms" } },
    h("span.etiqueta", "Las palabras"),
    h("div.puzle-mini", t.el),
    h("div.solo-chips", r.palabras.map((p) => h("span.pg-chip", (p.forma ?? p.clave).toUpperCase())))
  );
}
