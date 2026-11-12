// Laberinto de cálculos · TV: la rejilla con los números dados y el progreso de cada jugador.
import { h } from "../../comun/ui.js";
import { tarjetasJugadores } from "../comun/util.js";
import { crearRejilla } from "./rejilla.js";

export function montar(cuerpo, e, ctx) {
  const rejilla = crearRejilla(e.datos, { conHuecos: true });
  rejilla.el.classList.add("lab-tv-rejilla");
  const lado = h("div.sopa-lado");
  cuerpo.append(h("div.sopa-tv", h("div.lab-tv", rejilla.el), lado));
  const total = e.datos.total;
  const actualizar = tarjetasJugadores(lado, ctx, (e, id) => {
    const n = e.datos?.jugadores?.[id];
    return n == null ? null : { valor: n, extra: `de ${total}` };
  });
  actualizar(e);
  return { actualizar };
}

export function resumen(r) {
  const rejilla = crearRejilla(r, { conHuecos: false });
  return h("div.pl-resumen.tarjeta.aparece", { style: { animationDelay: "900ms" } }, h("span.etiqueta", "La solución"), h("div.lab-mini", rejilla.el));
}
