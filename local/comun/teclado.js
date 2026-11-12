// Campo de texto con teclado propio de la app: nunca se abre el teclado del móvil.
import { h } from "./ui.js";
import { teclasFisicas, marcarTecla, ES_LETRA } from "./teclas.js";

const ACENTOS = { a: "á", e: "é", i: "í", o: "ó", u: "ú", á: "a", é: "e", í: "i", ó: "o", ú: "u" };

/**
 * opciones:
 *   valor      texto inicial
 *   max        longitud máxima
 *   modo       "nombre" (mayúscula al empezar cada palabra, tildes, espacio) | "codigo" (minúsculas y guion)
 *   alCambiar  (texto) => void
 *   alAceptar  (texto) => void   (tecla OK; si no se pasa, no aparece)
 */
export function campoTexto({ valor = "", max = 14, modo = "nombre", alCambiar, alAceptar, placeholder = "" } = {}) {
  let texto = valor;
  const visor = h("div.campo-propio", { role: "textbox", "aria-label": placeholder });
  const filas = ["qwertyuiop", "asdfghjklñ", modo === "nombre" ? "´zxcvbnm⌫" : "zxcvbnm-⌫"];
  const ultima = [h("button.tecla-l.espacio", { type: "button", "data-t": modo === "nombre" ? " " : "-" }, modo === "nombre" ? "espacio" : "guion  -")];
  if (alAceptar) ultima.push(h("button.tecla-l.aceptar", { type: "button", "data-t": "OK" }, "OK"));
  const teclado = h(
    "div.teclado-letras",
    filas.map((f) =>
      h("div.fila-teclas", [...f].map((t) => h(`button.tecla-l${t === "⌫" ? ".borrar" : ""}`, { type: "button", "data-t": t }, t === "´" ? "´" : t.toUpperCase())))
    ),
    h("div.fila-teclas", ultima)
  );

  function pintar() {
    visor.replaceChildren(texto ? h("span", texto) : h("span.marcador", placeholder), h("span.cursor"));
  }

  function pulsar(t) {
    if (t === "OK") return alAceptar?.(texto.trim());
    if (t === "⌫") texto = texto.slice(0, -1);
    else if (t === "´") {
      const ult = texto.slice(-1);
      const cambio = ACENTOS[ult.toLowerCase()];
      if (cambio) texto = texto.slice(0, -1) + (ult === ult.toUpperCase() ? cambio.toUpperCase() : cambio);
    } else if (texto.length < max) {
      if (t === " " && (!texto || texto.endsWith(" "))) return;
      if (modo === "nombre") {
        const empieza = !texto || texto.endsWith(" ");
        texto += empieza ? t.toUpperCase() : t;
      } else texto += t;
    }
    pintar();
    alCambiar?.(texto);
  }

  teclado.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    ev.preventDefault();
    navigator.vibrate?.(6);
    pulsar(b.dataset.t);
  });

  // En el ordenador, con el teclado de verdad (las tildes se escriben tal cual).
  teclasFisicas(teclado, (t) => {
    const vale = t === "⌫" || (t === "OK" && alAceptar) || (modo === "nombre" ? ES_LETRA.test(t) || t === " " : /^[a-zñ0-9-]$/.test(t));
    if (!vale) return false;
    marcarTecla(teclado, t);
    pulsar(t);
  });

  pintar();
  return {
    visor,
    teclado,
    valor: () => texto.trim(),
    fijar(v) {
      texto = v;
      pintar();
    },
  };
}
