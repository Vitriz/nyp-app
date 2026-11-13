// KenKen · TV: la cuadrícula vacía (con sus jaulas) y cómo va cada uno.
import { h } from "../../comun/ui.js";
import { tarjetasJugadores } from "../comun/util.js";
import { crearRejilla } from "./rejilla.js";

export function montar(cuerpo, e, ctx) {
  const d = e.datos;
  const lado = h("div.sopa-lado");
  cuerpo.append(h("div.sopa-tv.kk-escena", h("div.kk-tv", crearRejilla(d).el), lado));
  const actualizar = tarjetasJugadores(lado, ctx, (e, id) => {
    const j = e.datos?.jugadores?.[id];
    if (!j) return null;
    return j.resuelto ? { valor: "✔", extra: "¡resuelto!" } : { valor: j.llenas, extra: `de ${d.n * d.n}` };
  });
  actualizar(e);
  return { actualizar };
}

/** Al acabar: el puzle resuelto. */
export function resumen(r) {
  const rej = crearRejilla(r);
  rej.poner(r.solucion);
  return h("div.pl-resumen.tarjeta.aparece.kk-resumen", { style: { animationDelay: "900ms" } }, h("span.etiqueta", "Una solución"), rej.el);
}
