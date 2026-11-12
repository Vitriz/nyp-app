// Cálculo mental · TV: la cadena en grande, sincronizada con los móviles.
import { h } from "../../comun/ui.js";
import { tarjetasJugadores, momentoCadena, reiniciarAnim } from "../comun/util.js";

export function montar(cuerpo, e, ctx) {
  let d = e.datos;
  let vivo = true;
  let ultima = "";
  const etiqueta = h("div.etiqueta");
  const grande = h("div.cm-grande-tv");
  const lado = h("div.sopa-lado");
  cuerpo.append(h("div.sopa-tv.cm-tv", h("div.cm-escena", etiqueta, grande), lado));

  const actualizarTarjetas = tarjetasJugadores(lado, ctx, (e, id) => {
    const r = e.datos?.jugadores?.[id];
    if (!r) return null;
    return { valor: r.filter((x) => x === 1).length, extra: r.map((x) => (x === 1 ? "✔" : x === 0 ? "✘" : "·")).join("") };
  });

  function pintar() {
    if (!vivo) return;
    const m = momentoCadena(d.cadenas, ctx.ahora());
    const clave = `${m.k}-${m.fase}-${m.paso ?? ""}-${m.c.resultado ?? ""}`;
    if (clave !== ultima) {
      ultima = clave;
      etiqueta.textContent = `Cadena ${m.k + 1} de ${d.cadenas.length}`;
      if (m.fase === "previa") grande.replaceChildren(h("span.cm-texto-tv.suave", "Prepárate…"));
      else if (m.fase === "pasos") {
        grande.replaceChildren(h("span.ficha", m.c.pasos[m.paso]));
        reiniciarAnim(grande.firstChild, "aparece");
      } else if (m.fase === "responder") grande.replaceChildren(h("span.cm-texto-tv", "¿Resultado?"));
      else grande.replaceChildren(h("span.cm-texto-tv.suave", "Era"), h("span.ficha", String(m.c.resultado ?? "…")));
    }
  }
  const reloj = setInterval(pintar, 100);
  pintar();

  actualizarTarjetas(e);
  return {
    actualizar(e) {
      if (e.datos) d = e.datos;
      actualizarTarjetas(e);
    },
    desmontar() {
      vivo = false;
      clearInterval(reloj);
    },
  };
}

export function resumen(r) {
  return h(
    "div.pl-resumen.tarjeta.aparece",
    { style: { animationDelay: "900ms" } },
    h("span.etiqueta", "Las cadenas eran"),
    h("div.df-lista-tv", r.cadenas.map((c) => h("div.df-item-tv", h("span", c.pasos.join(" → ")), h("b", `= ${c.r}`))))
  );
}
