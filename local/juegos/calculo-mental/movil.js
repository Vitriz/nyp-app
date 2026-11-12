// Cálculo mental · móvil: la operación entera (con sus paréntesis) y el teclado para responder.
import { h } from "../../comun/ui.js";
import { tecladoNumerico, momentoCadena, reiniciarAnim } from "../comun/util.js";

export function montar(cuerpo, e, ctx) {
  let d = e.datos;
  let respuesta = "";
  let vivo = true;
  let ultimaClave = "";

  const etiqueta = h("div.cm-etiqueta.suave");
  const puntos = h("div.cm-puntos");
  const grande = h("div.cm-grande");
  const resp = h("div.ficha.mf-resp");
  const teclado = tecladoNumerico(pulsar);
  const zonaResp = h("div.cm-responder.oculto", resp, teclado);

  cuerpo.append(h("div.cm", etiqueta, puntos, h("div.cm-centro", grande), zonaResp));

  function pulsar(t) {
    const m = momentoCadena(d.cadenas, ctx.ahora());
    if (m.fase !== "responder" || d.respuestas[m.k]) return;
    if (t === "⌫") respuesta = respuesta.slice(0, -1);
    else if (t === "OK") {
      if (!respuesta) return;
      ctx.enviar({ a: "respuesta", c: m.k, valor: Number(respuesta) });
      d.respuestas[m.k] = { valor: Number(respuesta), pendiente: true };
      respuesta = "";
    } else if (respuesta.length < 4) respuesta = respuesta === "0" ? t : respuesta + t;
    resp.textContent = respuesta || " ";
  }

  // Temporizador (no requestAnimationFrame): así la pantalla sigue al día aunque el navegador pause las animaciones.
  function pintar() {
    if (!vivo) return;
    const m = momentoCadena(d.cadenas, ctx.ahora());
    const r = d.respuestas[m.k];
    const clave = `${m.k}-${m.fase}-${m.paso ?? ""}-${r ? (r.pendiente ? "p" : r.ok) : ""}-${m.c.resultado ?? ""}`;
    if (clave !== ultimaClave) {
      ultimaClave = clave;
      etiqueta.textContent = `Operación ${m.k + 1} de ${d.cadenas.length}`;
      // Un punto por operación: las ya pasadas, encendidas.
      puntos.replaceChildren(...d.cadenas.map((_, i) => h(`span.cm-punto${i < m.k || (i === m.k && m.fase === "fin") ? ".hecho" : ""}${i === m.k ? ".actual" : ""}`)));
      zonaResp.classList.toggle("oculto", !(m.fase === "responder" && !r));
      if (m.fase === "previa") grande.replaceChildren(h("span.cm-texto.suave", "Prepárate…"));
      else if (m.fase === "pasos") {
        grande.replaceChildren(h("span.ficha.cm-paso", m.c.pasos[m.paso]));
        reiniciarAnim(grande.firstChild, "aparece");
      } else if (m.fase === "responder" && !r) {
        grande.replaceChildren(h("div.cm-expresion", m.c.expresion ?? m.c.pasos.join(" "), h("span.cm-igual", " = ?")));
        resp.textContent = respuesta || " ";
      } else if (r && m.c.resultado == null) {
        grande.replaceChildren(h("span.cm-texto", "Respuesta enviada"), h("span.ficha.cm-paso", String(r.valor)));
      } else {
        const ok = r && r.valor === m.c.resultado;
        grande.replaceChildren(
          h(`span.cm-texto${ok ? ".bien" : ""}`, r ? (ok ? "✔ ¡Correcto!" : "✘ Era") : "Era"),
          h("span.ficha.cm-paso", String(m.c.resultado ?? "…"))
        );
      }
    }
  }
  const reloj = setInterval(pintar, 100);
  pintar();

  return {
    actualizar(e) {
      if (!e.datos) return;
      // Conservamos las respuestas pendientes de confirmar.
      const pend = d.respuestas;
      d = e.datos;
      pend.forEach((r, k) => r && !d.respuestas[k] && (d.respuestas[k] = r));
    },
    desmontar() {
      vivo = false;
      clearInterval(reloj);
    },
  };
}
