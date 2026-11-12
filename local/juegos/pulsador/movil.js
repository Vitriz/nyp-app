// Pulsador · móvil: la pregunta y un botón enorme para pulsar el primero.
import { h } from "../../comun/ui.js";
import { pintarPregunta } from "./tv.js";
import { teclasFisicas } from "../../comun/teclas.js";

export function montar(cuerpo, e, ctx) {
  const pregunta = h("div.pul-m-pregunta");
  const boton = h("button.pul-boton", { type: "button" }, h("span", "¡PULSA!"));
  const estadoTxt = h("div.pul-m-estado");
  const aciertos = h("span.ficha", "0");
  cuerpo.append(h("div.pul-m", h("div.mf-cont", "Aciertos", aciertos), pregunta, h("div.pul-m-centro", boton), estadoTxt));

  let d = e.datos;
  let ultimaI = -1;

  boton.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    if (boton.disabled) return;
    navigator.vibrate?.(30);
    boton.classList.add("pulsado");
    ctx.enviar({ a: "pulsar" });
  });

  // En el ordenador: espacio o Enter para pulsar.
  teclasFisicas(boton, (t, ev) => {
    if ((t !== " " && t !== "OK") || ev.repeat) return false;
    boton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
  });

  function actualizar(e) {
    d = e.datos;
    if (!d) return;
    aciertos.textContent = d.aciertos;
    if (d.i !== ultimaI) {
      ultimaI = d.i;
      pregunta.replaceChildren(...pintarPregunta(d.pregunta));
    }
    const yo = e.yo.id;
    const quien = d.pulsado ? e.jugadores.find((j) => j.id === d.pulsado.id) : null;
    boton.classList.remove("pulsado", "mio", "otro");
    if (d.pulsado?.id === yo) {
      boton.disabled = true;
      boton.classList.add("mio");
      estadoTxt.textContent = "🎤 ¡Has sido el primero! Responde en voz alta";
      navigator.vibrate?.([60, 40, 60]);
    } else if (quien) {
      boton.disabled = true;
      boton.classList.add("otro");
      estadoTxt.textContent = `🔔 ${quien.nombre} ha pulsado primero`;
    } else if (d.bloqueado) {
      boton.disabled = true;
      estadoTxt.textContent = "✘ Has fallado esta. Espera a la siguiente";
    } else {
      boton.disabled = !d.pregunta;
      estadoTxt.textContent = d.anterior ? `Era: ${d.anterior.solucion.toUpperCase()}` : "Pulsa cuando sepas la respuesta";
    }
  }

  actualizar(e);
  return { actualizar };
}
