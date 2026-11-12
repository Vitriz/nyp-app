// Llegar al resultado · TV: objetivo y números como en el concurso; distancia de cada jugador.
import { h } from "../../comun/ui.js";
import { tarjetasJugadores } from "../comun/util.js";

export function montar(cuerpo, e, ctx) {
  const d = e.datos;
  cuerpo.append(
    h(
      "div.lr-tv",
      h("span.ficha.oscura.lr-objetivo-tv", String(d.objetivo)),
      h("div.lr-numeros-tv", d.numeros.map((n, i) => h("span.ficha", { style: { animationDelay: `${i * 90}ms` } }, String(n))))
    )
  );
  const actualizar = tarjetasJugadores(cuerpo, ctx, (e, id) => {
    const dist = e.datos?.jugadores?.[id];
    if (dist === undefined) return null;
    return dist == null ? { valor: "–" } : { valor: dist === 0 ? "✔" : dist, extra: dist === 0 ? "¡exacto!" : "de distancia" };
  });
  actualizar(e);
  return { actualizar };
}

export function resumen(r) {
  return h(
    "div.pl-resumen.tarjeta.aparece",
    { style: { animationDelay: "900ms" } },
    h("span.etiqueta", r.exacta ? `Así se llegaba a ${r.objetivo}` : `Lo más cerca posible: ${r.valor}`),
    h("div.lr-pasos-tv", r.pasos.map((p) => h("div", p)))
  );
}
