// Parcelas · TV: el tablero con sus pistas y cuántos rectángulos lleva bien cada uno.
import { h } from "../../comun/ui.js";
import { tarjetasJugadores } from "../comun/util.js";
import { crearTablero } from "./rejilla.js";

export function montar(cuerpo, e, ctx) {
  const d = e.datos;
  const lado = h("div.sopa-lado");
  cuerpo.append(h("div.sopa-tv.puzle-escena", h("div.puzle-tv", h("span.puzle-tv-etiqueta", "🧩 El mismo tablero para todos"), crearTablero(d).el), lado));
  const actualizar = tarjetasJugadores(lado, ctx, (e, id) => {
    const j = e.datos?.jugadores?.[id];
    if (!j) return null;
    return j.resuelto ? { valor: "✔", extra: "¡resuelto!" } : { valor: j.bien, total: d.pistas.length, extra: `${j.bien}/${d.pistas.length} rectángulos` };
  });
  actualizar(e);
  return { actualizar };
}

export function resumen(r) {
  const t = crearTablero(r);
  t.pintar(r.solucion);
  return h("div.pl-resumen.tarjeta.aparece", { style: { animationDelay: "900ms" } }, h("span.etiqueta", "La solución"), h("div.puzle-mini", t.el));
}
