// Memoria fotográfica · TV: cada uno juega en su móvil; aquí se ve cuántas lleva cada uno.
import { h } from "../../comun/ui.js";
import { tarjetasJugadores } from "../comun/util.js";

export function montar(cuerpo, e, ctx) {
  const lado = h("div.sopa-lado");
  cuerpo.append(
    h(
      "div.sopa-tv.mem-tv",
      h("div.mem-tv-cartel", h("span.mem-tv-icono", "📸"), h("b", "¡Mirad bien vuestro móvil!"), h("p.suave", "Memoriza las tarjetas antes de que se tapen.")),
      lado
    )
  );
  const actualizar = tarjetasJugadores(lado, ctx, (e, id) => {
    const j = e.datos?.jugadores?.[id];
    if (!j) return null;
    return { valor: j.aciertos, extra: `de ${j.hechas}` };
  });
  actualizar(e);
  return { actualizar };
}
