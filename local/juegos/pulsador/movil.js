// Pulsador · móvil: la pregunta y un botón enorme para pulsar el primero.
import { h } from "../../comun/ui.js";
import { pintarPregunta } from "./tv.js";
import { teclasFisicas } from "../../comun/teclas.js";

export function montar(cuerpo, e, ctx) {
  const pregunta = h("div.pul-m-pregunta");
  const textoBoton = h("span", "¡PULSA!");
  const boton = h("button.pul-boton", { type: "button" }, textoBoton);
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

  let ultimoE = e;
  // Unos segundos para leer la pregunta: el botón cuenta 3, 2, 1 y luego se puede pulsar.
  const reloj = setInterval(() => d && actualizar(ultimoE, true), 150);

  function actualizar(e, soloReloj = false) {
    ultimoE = e;
    d = e.datos;
    if (!d) return;
    const falta = (d.abre ?? 0) - ctx.ahora();
    aciertos.textContent = d.aciertos;
    if (!soloReloj && d.i !== ultimaI) {
      ultimaI = d.i;
      pregunta.replaceChildren(...pintarPregunta(d.pregunta));
    }
    const yo = e.yo.id;
    const quien = d.pulsado ? e.jugadores.find((j) => j.id === d.pulsado.id) : null;
    const esperando = boton.classList.contains("pulsado");
    boton.classList.remove("pulsado", "mio", "otro", "leyendo");
    textoBoton.textContent = "¡PULSA!";
    if (d.pregunta && falta > 0 && !d.pulsado) {
      boton.disabled = true;
      boton.classList.add("leyendo");
      textoBoton.textContent = String(Math.ceil(falta / 1000));
      estadoTxt.textContent = "Lee la pregunta…";
    } else if (d.pulsado?.id === yo) {
      boton.disabled = true;
      boton.classList.add("mio");
      estadoTxt.textContent = "🎤 ¡Has sido el primero! Responde en voz alta";
      if (!soloReloj) navigator.vibrate?.([60, 40, 60]);
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
      if (soloReloj && esperando) boton.classList.add("pulsado"); // esperando la respuesta del servidor
    }
  }

  actualizar(e);
  return { actualizar: (e) => actualizar(e), desmontar: () => clearInterval(reloj) };
}
