// Pulsador · móvil: la pregunta y un botón enorme para pulsar el primero.
import { h } from "../../comun/ui.js";
import { pintarPregunta } from "./tv.js";
import { teclasFisicas } from "../../comun/teclas.js";
import { tecladoLetras, tecladoNumerico } from "../comun/util.js";

export function montar(cuerpo, e, ctx) {
  const pregunta = h("div.pul-m-pregunta");
  const textoBoton = h("span", "¡PULSA!");
  const boton = h("button.pul-boton", { type: "button" }, textoBoton);
  const estadoTxt = h("div.pul-m-estado");
  const aciertos = h("span.ficha", "0");
  // Batalla (sin presentador): quien pulsa escribe aquí la respuesta, con 5 s.
  let texto = "";
  let tipoTeclado = null;
  const escrito = h("div.pul-escrito");
  const cuentaResp = h("span.pul-cuenta");
  const enviarResp = h("button.boton.acento", { type: "button", onclick: () => responder() }, "Responder ✓");
  const tecladoCaja = h("div.pul-teclado");
  const zonaResp = h("div.pul-responder.oculto", h("div.pul-responder-cabeza", h("b", "✍️ ¡Escribe tu respuesta!"), cuentaResp), escrito, tecladoCaja, enviarResp);
  const teclear = (t) => {
    if (t === "OK") return responder();
    if (t === "⌫") texto = texto.slice(0, -1);
    else if (texto.length < 16) texto += t;
    pintarEscrito();
  };
  const pintarEscrito = () => escrito.replaceChildren(h("span", texto ? texto.toUpperCase() : "…"), h("span.cursor"));
  let respondida = null; // el «pulsado» al que ya respondí (para no volver a abrir el teclado)
  function responder() {
    if (!texto) return;
    respondida = d?.pulsado?.t ?? null;
    ctx.enviar({ a: "responder", texto });
    texto = "";
    zonaResp.classList.add("oculto");
  }
  cuerpo.append(h("div.pul-m", h("div.mf-cont", "Aciertos", aciertos), pregunta, h("div.pul-m-centro", boton), zonaResp, estadoTxt));
  let falloVisto = e.datos?.ultimoFallo?.n ?? 0;

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
  let ultimoAviso = "", avisoHasta = 0;
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
    // Batalla: si ya no me toca responder (acerté, fallé o se acabó el tiempo), fuera el teclado.
    if (d.pulsado?.id !== yo) {
      zonaResp.classList.add("oculto");
      boton.classList.remove("oculto");
    }
    // Batalla: alguien falló (se dice qué puso).
    if (d.auto && d.ultimoFallo && d.ultimoFallo.n !== falloVisto) {
      falloVisto = d.ultimoFallo.n;
      const quien = e.jugadores.find((j) => j.id === d.ultimoFallo.id);
      if (d.ultimoFallo.id === yo) navigator.vibrate?.([30, 40, 30]);
      ultimoAviso = `✘ ${d.ultimoFallo.id === yo ? "Has fallado" : `${quien?.nombre ?? "Alguien"} ha fallado`}${d.ultimoFallo.texto ? ` («${d.ultimoFallo.texto.toUpperCase()}»)` : " (se acabó el tiempo)"} · −1`;
      avisoHasta = Date.now() + 2500;
    }
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
      if (d.auto) {
        // Batalla: a escribir la respuesta antes de que acabe la cuenta.
        const quedan = Math.max(0, Math.ceil(((d.pulsado.hasta ?? 0) - ctx.ahora()) / 1000));
        const tipo = d.pregunta?.tipo === "calculo" ? "num" : "letras";
        if (zonaResp.classList.contains("oculto") && quedan > 0 && respondida !== d.pulsado.t) {
          texto = "";
          if (tipoTeclado !== tipo) {
            tipoTeclado = tipo;
            tecladoCaja.replaceChildren(tipo === "num" ? tecladoNumerico(teclear) : tecladoLetras(teclear));
          }
          pintarEscrito();
          zonaResp.classList.remove("oculto");
          navigator.vibrate?.([60, 40, 60]);
        }
        cuentaResp.textContent = `${quedan} s`;
        boton.classList.add("oculto");
        estadoTxt.textContent = "";
      } else {
        estadoTxt.textContent = "🎤 ¡Has sido el primero! Responde en voz alta";
        if (!soloReloj) navigator.vibrate?.([60, 40, 60]);
      }
    } else if (quien) {
      boton.disabled = true;
      boton.classList.add("otro");
      const quedan = d.auto && d.pulsado.hasta ? ` · ${Math.max(0, Math.ceil((d.pulsado.hasta - ctx.ahora()) / 1000))} s` : "";
      estadoTxt.textContent = d.auto ? `✍️ ${quien.nombre} está respondiendo${quedan}` : `🔔 ${quien.nombre} ha pulsado primero`;
    } else if (d.bloqueado) {
      boton.disabled = true;
      estadoTxt.textContent = Date.now() < avisoHasta ? ultimoAviso : "✘ Has fallado esta. Espera a la siguiente";
    } else {
      boton.disabled = !d.pregunta;
      estadoTxt.textContent =
        Date.now() < avisoHasta ? ultimoAviso
        : d.anterior ? `${d.anterior.ok && d.auto ? `✔ ${e.jugadores.find((j) => j.id === d.anterior.quien)?.nombre ?? ""} acertó · ` : ""}Era: ${d.anterior.solucion.toUpperCase()}`
        : "Pulsa cuando sepas la respuesta";
      if (soloReloj && esperando) boton.classList.add("pulsado"); // esperando la respuesta del servidor
    }
  }

  actualizar(e);
  return { actualizar: (e) => actualizar(e), desmontar: () => clearInterval(reloj) };
}
