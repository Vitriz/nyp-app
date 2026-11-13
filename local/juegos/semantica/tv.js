// Semántica · TV: lo más cerca que va cada uno (sin decir la palabra) y quién la ha encontrado.
import { h } from "../../comun/ui.js";
import { tarjetasJugadores } from "../comun/util.js";

export function montar(cuerpo, e, ctx) {
  const lado = h("div.sopa-lado");
  cuerpo.append(
    h(
      "div.sopa-tv.mem-tv",
      h("div.mem-tv-cartel", h("span.mem-tv-icono", "🔥"), h("b", "¿Cuál es la palabra secreta?"), h("p.suave", "Cuanto más bajo el puesto, más cerca: el #1 es la secreta.")),
      lado
    )
  );
  const actualizar = tarjetasJugadores(lado, ctx, (e, id) => {
    const j = e.datos?.jugadores?.[id];
    if (!j) return null;
    if (j.encontrada) return { valor: "🎯", extra: `¡en ${j.n}!` };
    return { valor: j.mejor == null ? "–" : `#${j.mejor + 1}`, extra: `${j.n} intentos` };
  });
  actualizar(e);
  return { actualizar };
}

export function resumen(r) {
  return h(
    "div.pl-resumen.tarjeta.aparece",
    { style: { animationDelay: "900ms" } },
    h("span.etiqueta", "La palabra secreta era"),
    h("div.sm-secreta-tv", r.secreta.toUpperCase()),
    h("span.etiqueta", "Las más cercanas"),
    h("div.pl-soluciones", r.cercanas.map((c) => h("span.pl-sol", c.toUpperCase())))
  );
}
