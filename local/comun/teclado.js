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
  const filas = ["qwertyuiop", "asdfghjklñ", modo === "nombre" ? "⇧zxcvbnm´⌫" : "zxcvbnm-⌫"];
  // Mayús (solo en nombres): 0 = normal (mayúscula al empezar cada palabra), 1 = la siguiente letra, 2 = todo en mayúsculas.
  let mayus = 0;
  const ultima = [h("button.tecla-l.espacio", { type: "button", "data-t": modo === "nombre" ? " " : "-" }, modo === "nombre" ? "espacio" : "guion  -")];
  if (alAceptar) ultima.push(h("button.tecla-l.aceptar", { type: "button", "data-t": "OK" }, "OK"));
  const teclado = h(
    "div.teclado-letras",
    filas.map((f) =>
      h("div.fila-teclas", [...f].map((t) => h(`button.tecla-l${t === "⌫" ? ".borrar" : t === "⇧" ? ".mayus" : ""}`, { type: "button", "data-t": t, title: t === "⇧" ? "Mayúsculas (dos toques: todo en mayúsculas)" : undefined }, t === "´" ? "´" : t.toUpperCase())))
    ),
    h("div.fila-teclas", ultima)
  );

  const mayusBtn = teclado.querySelector(".mayus");
  function pintarMayus() {
    if (!mayusBtn) return;
    mayusBtn.classList.toggle("activa", mayus > 0);
    mayusBtn.classList.toggle("bloqueada", mayus === 2);
    mayusBtn.textContent = mayus === 2 ? "⇪" : "⇧";
    // Las letras se ven como se van a escribir.
    const grande = modo !== "nombre" || mayus > 0 || !texto || texto.endsWith(" ");
    for (const b of teclado.querySelectorAll("button[data-t]")) if (b.dataset.t.length === 1 && /\p{L}/u.test(b.dataset.t)) b.textContent = grande ? b.dataset.t.toUpperCase() : b.dataset.t;
  }

  function pintar() {
    pintarMayus();
    visor.replaceChildren(texto ? h("span", texto) : h("span.marcador", placeholder), h("span.cursor"));
  }

  function pulsar(t, fisica = false) {
    if (t === "⇧") {
      mayus = (mayus + 1) % 3;
      return pintarMayus();
    }
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
        const enMayus = fisica ? t !== t.toLowerCase() : mayus > 0;
        texto += empieza || enMayus || mayus === 2 ? t.toUpperCase() : t.toLowerCase();
        if (mayus === 1 && t !== " ") mayus = 0;
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
  teclasFisicas(teclado, (t, ev) => {
    const vale = t === "⌫" || (t === "OK" && alAceptar) || (modo === "nombre" ? ES_LETRA.test(t) || t === " " : /^[a-zñ0-9-]$/.test(t));
    if (!vale) return false;
    marcarTecla(teclado, t);
    pulsar(modo === "nombre" && ev.key.length === 1 && ev.key !== ev.key.toLowerCase() ? ev.key : t, true);
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
