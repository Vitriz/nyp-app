// Mates fugaces · móvil: operación grande, teclado numérico y botón de pasar.
import { h } from "../../comun/ui.js";
import { tecladoNumerico } from "../comun/util.js";

export function montar(cuerpo, e, ctx) {
  const ops = e.datos.ops;
  let i = e.datos.i;
  let aciertos = e.datos.aciertos;
  let respuesta = "";

  const contador = h("span.ficha", String(aciertos));
  const texto = h("div.texto");
  const resp = h("div.ficha.mf-resp");
  const pasar = h("button.boton.suave.mf-pasar", { type: "button" }, "Pasar ➜");

  const teclado = tecladoNumerico(pulsar);

  // Racha: aciertos seguidos sin fallar (desde 3 se enseña con su fueguito).
  let racha = 0;
  const rachaEl = h("span.mf-racha.oculto");
  const pintarRacha = () => {
    rachaEl.classList.toggle("oculto", racha < 3);
    rachaEl.textContent = `🔥 ${racha} seguidas`;
  };
  const raiz = h("div.mf", h("div.mf-cont", "Aciertos", contador, rachaEl), h("div.mf-op", texto), resp, pasar, teclado);
  cuerpo.append(raiz);

  function mostrarOp(animar = true) {
    if (i >= ops.length) {
      texto.textContent = "¡Todas hechas!";
      teclado.classList.add("oculto");
      pasar.classList.add("oculto");
      return;
    }
    texto.textContent = `${ops[i].texto} =`;
    if (animar) {
      texto.classList.remove("entra");
      void texto.offsetWidth;
      texto.classList.add("entra");
    }
    respuesta = "";
    pintarRespuesta();
  }

  function pintarRespuesta() {
    resp.textContent = respuesta || " ";
  }

  function pulsar(t) {
    if (i >= ops.length) return;
    if (t === "⌫") respuesta = respuesta.slice(0, -1);
    else if (t === "OK") return comprobar();
    else if (respuesta.length < 3) respuesta = respuesta === "0" ? t : respuesta + t;
    pintarRespuesta();
  }

  function comprobar() {
    if (!respuesta) return;
    const valor = Number(respuesta);
    ctx.enviar({ a: "respuesta", i, valor });
    if (valor === ops[i].r) {
      aciertos++;
      i++;
      racha++;
      pintarRacha();
      if (racha >= 3) reiniciarAnim(rachaEl, "rebote");
      contador.textContent = aciertos;
      reiniciarAnim(contador, "rebote");
      resp.classList.add("bien");
      const r = resp.getBoundingClientRect();
      ctx.onda(r.left + r.width / 2, r.top + r.height / 2, 0.8);
      navigator.vibrate?.(15);
      setTimeout(() => {
        resp.classList.remove("bien");
        mostrarOp();
      }, 160);
    } else {
      racha = 0;
      pintarRacha();
      reiniciarAnim(resp, "sacudir");
      navigator.vibrate?.([30, 40, 30]);
      respuesta = "";
      setTimeout(pintarRespuesta, 200);
    }
  }

  pasar.addEventListener("click", () => {
    if (i >= ops.length) return;
    ctx.enviar({ a: "pasar", i });
    i++;
    racha = 0;
    pintarRacha();
    mostrarOp();
  });

  mostrarOp(false);

  return {
    actualizar(e) {
      // Si el servidor va por delante (p. ej. tras reconectar), nos ponemos al día.
      if (e.datos && e.datos.i > i) {
        i = e.datos.i;
        aciertos = e.datos.aciertos;
        contador.textContent = aciertos;
        mostrarOp();
      }
    },
  };
}

function reiniciarAnim(el, clase) {
  el.classList.remove(clase);
  void el.offsetWidth;
  el.classList.add(clase);
}
