// Coronas · TV: el tablero de colores y cuántas coronas lleva cada uno.
import { h } from "../../comun/ui.js";
import { tarjetasJugadores } from "../comun/util.js";
import { crearTablero } from "./rejilla.js";

export function montar(cuerpo, e, ctx) {
  const d = e.datos;
  const lado = h("div.sopa-lado");
  cuerpo.append(h("div.sopa-tv", h("div.puzle-tv", crearTablero(d).el), lado));
  const actualizar = tarjetasJugadores(lado, ctx, (e, id) => {
    const j = e.datos?.jugadores?.[id];
    if (!j) return null;
    return j.resuelto ? { valor: "✔", extra: "¡resuelto!" } : { valor: j.coronas, extra: `de ${d.n} 👑` };
  });
  actualizar(e);
  return { actualizar };
}

export function resumen(r) {
  const t = crearTablero(r);
  t.pintar(Array.from({ length: r.n * r.n }, (_, k) => (r.solucion.includes(k) ? 2 : 0)));
  return h("div.pl-resumen.tarjeta.aparece", { style: { animationDelay: "900ms" } }, h("span.etiqueta", "La solución"), h("div.puzle-mini", t.el));
}
