// Hilo · TV: el tablero vacío y cuántas casillas lleva cada uno.
import { h } from "../../comun/ui.js";
import { tarjetasJugadores } from "../comun/util.js";
import { crearTablero } from "./rejilla.js";

export function montar(cuerpo, e, ctx) {
  const d = e.datos;
  const t = crearTablero({ ...d, numeros: new Map(d.numeros) });
  t.pintar([], { cabeza: false });
  const lado = h("div.sopa-lado");
  cuerpo.append(h("div.sopa-tv.puzle-escena", h("div.puzle-tv", h("span.puzle-tv-etiqueta", "🧩 El mismo tablero para todos"), t.el), lado));
  const actualizar = tarjetasJugadores(lado, ctx, (e, id) => {
    const j = e.datos?.jugadores?.[id];
    if (!j) return null;
    return j.resuelto ? { valor: "✔", extra: "¡completo!" } : { valor: j.casillas, total: d.n * d.n, extra: `${j.casillas}/${d.n * d.n} casillas` };
  });
  actualizar(e);
  return { actualizar };
}

export function resumen(r) {
  const t = crearTablero({ ...r, numeros: new Map(r.numeros) });
  t.pintar(r.solucion, { completo: true });
  return h("div.pl-resumen.tarjeta.aparece", { style: { animationDelay: "900ms" } }, h("span.etiqueta", "El camino"), h("div.puzle-mini", t.el));
}
