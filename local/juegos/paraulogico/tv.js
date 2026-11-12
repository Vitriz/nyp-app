// Tutifruti (antes Paraulógico) · TV: el panal en grande y la puntuación de cada jugador.
import { h } from "../../comun/ui.js";
import { tarjetasJugadores } from "../comun/util.js";
import { crearPanal } from "./panal.js";

export function montar(cuerpo, e, ctx) {
  const panal = crearPanal(e.datos.centro, e.datos.letras);
  const lado = h("div.sopa-lado");
  cuerpo.append(h("div.sopa-tv", h("div.pg-tv-panal", panal.el), lado));
  const actualizar = tarjetasJugadores(lado, ctx, (e, id) => {
    const j = e.datos?.jugadores?.[id];
    return j && { valor: j.puntos, extra: `${j.n} pal.` };
  });
  actualizar(e);
  return { actualizar };
}

export function resumen(r) {
  const panal = crearPanal(r.centro, r.letras);
  return h(
    "div.pl-resumen.tarjeta.aparece.sopa-resumen",
    { style: { animationDelay: "900ms" } },
    h("div.pg-mini", panal.el),
    h(
      "div.columna",
      h("span.etiqueta", `Había ${r.total} palabras comunes`),
      r.tutis.length ? h("div.pl-soluciones", h("span.suave", "Con las 7:"), r.tutis.map((t) => h("span.pl-sol", t.toUpperCase()))) : null,
      h("div.pl-soluciones", h("span.suave", "Largas:"), r.largas.map((t) => h("span.pl-sol", t.toUpperCase())))
    )
  );
}
