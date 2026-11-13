// Conexiones · TV: cuántos grupos lleva cada uno; al final, los grupos del primer tablero.
import { h } from "../../comun/ui.js";
import { tarjetasJugadores } from "../comun/util.js";
import { franjaGrupo } from "./piezas.js";

export function montar(cuerpo, e, ctx) {
  const lado = h("div.sopa-lado");
  cuerpo.append(
    h(
      "div.sopa-tv.mem-tv",
      h("div.mem-tv-cartel", h("span.mem-tv-icono", "🔗"), h("b", "Buscad los 4 grupos de 4"), h("p.suave", "Cada uno en su móvil. ¡Ojo, que hay trampas!")),
      lado
    )
  );
  const actualizar = tarjetasJugadores(lado, ctx, (e, id) => {
    const n = e.datos?.jugadores?.[id];
    return n == null ? null : { valor: n, extra: n === 1 ? "grupo" : "grupos" };
  });
  actualizar(e);
  return { actualizar };
}

export function resumen(r) {
  return h(
    "div.pl-resumen.tarjeta.aparece",
    { style: { animationDelay: "900ms" } },
    h("span.etiqueta", "El primer tablero"),
    r.grupos.map((g, i) => franjaGrupo(g.nombre, g.palabras, g.color ?? i))
  );
}
