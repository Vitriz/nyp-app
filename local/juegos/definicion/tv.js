// Definición · TV: puntuación de cada jugador en directo; al final, las palabras que salieron.
import { h } from "../../comun/ui.js";
import { tarjetasJugadores } from "../comun/util.js";

export function montar(cuerpo, e, ctx) {
  cuerpo.append(h("p.descripcion.tv-ayuda", "Cada uno va resolviendo su lista de definiciones en el móvil."));
  const actualizar = tarjetasJugadores(cuerpo, ctx, (e, id) => {
    const j = e.datos?.jugadores?.[id];
    return j && { valor: j.valor, extra: `${j.aciertos} ✔` };
  });
  actualizar(e);
  return { actualizar };
}

export function resumen(r) {
  return h(
    "div.pl-resumen.tarjeta.aparece",
    { style: { animationDelay: "900ms" } },
    h("span.etiqueta", "Las primeras palabras eran"),
    h(
      "div.df-lista-tv",
      r.palabras.map((p) => h("div.df-item-tv", h("b", p.forma.toUpperCase()), h("span.suave", p.definicion)))
    )
  );
}
