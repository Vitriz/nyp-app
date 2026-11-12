// Piezas compartidas por los juegos (móvil y TV).
import { h, avatar } from "../../comun/ui.js";

/** Misma huella que el servidor (FNV-1a), para comprobar respuestas al instante. */
export function huella(texto) {
  let x = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    x ^= texto.charCodeAt(i);
    x = Math.imul(x, 0x01000193) >>> 0;
  }
  return x.toString(36);
}

export function reiniciarAnim(el, clase) {
  el.classList.remove(clase);
  void el.offsetWidth;
  el.classList.add(clase);
}

/** Teclado de letras en pantalla (QWERTY español con Ñ), grande y estable. */
export function tecladoLetras(alPulsar) {
  const filas = ["qwertyuiop", "asdfghjklñ", "zxcvbnm⌫"];
  const el = h(
    "div.teclado-letras",
    filas.map((f) =>
      h("div.fila-teclas", [...f].map((t) => h(`button.tecla-l${t === "⌫" ? ".borrar" : ""}`, { type: "button", "data-t": t }, t.toUpperCase())))
    )
  );
  el.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    ev.preventDefault();
    navigator.vibrate?.(6);
    alPulsar(b.dataset.t);
  });
  return el;
}

/**
 * Tarjetas de jugadores para la TV con un número que rebota al cambiar.
 * valorDe(e, id) -> { valor, extra } | null
 */
export function tarjetasJugadores(contenedor, ctx, valorDe) {
  const rejilla = h("div.mf-rejilla");
  contenedor.append(rejilla);
  const cartas = new Map();
  return function actualizar(e) {
    for (const j of e.jugadores) {
      const d = valorDe(e, j.id);
      if (!j.conectado && !d) continue;
      let c = cartas.get(j.id);
      if (!c) {
        const num = h("span.ficha", "0");
        const extra = h("span.pl-estado");
        c = { el: h("div.mf-carta.tarjeta.aparece", avatar(j), h("span.nombre", j.nombre), extra, num), num, extra, valor: 0 };
        cartas.set(j.id, c);
        rejilla.append(c.el);
      }
      const v = d?.valor ?? 0;
      if (v !== c.valor) {
        c.valor = v;
        c.num.textContent = v;
        reiniciarAnim(c.num, "rebote");
        const r = c.num.getBoundingClientRect();
        ctx.onda(r.left + r.width / 2, r.top + r.height / 2, 0.6);
      }
      c.extra.textContent = d?.extra ?? "";
      c.el.querySelector(".avatar").classList.toggle("desconectado", !j.conectado);
    }
  };
}

/** Igual que en el servidor: minúsculas, sin tildes, conserva la ñ. */
export function clave(texto) {
  let out = "";
  for (const ch of String(texto).toLowerCase()) out += ch === "ñ" ? "ñ" : ch.normalize("NFD")[0];
  return out;
}

/** Teclado numérico grande (1-9, borrar, 0, OK). */
export function tecladoNumerico(alPulsar) {
  const el = h(
    "div.teclado",
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"].map((t) =>
      h(`button.boton${t === "OK" ? ".ok" : ""}`, { type: "button", "data-t": t }, t)
    )
  );
  el.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    ev.preventDefault();
    navigator.vibrate?.(6);
    alPulsar(b.dataset.t);
  });
  return el;
}

/** Estado de una cadena de Cálculo mental en un instante dado. */
export function momentoCadena(cadenas, ahora) {
  for (let k = 0; k < cadenas.length; k++) {
    const c = cadenas[k];
    if (ahora < c.t0) return { k, fase: "previa", c };
    if (ahora < c.finPasos) return { k, fase: "pasos", c, paso: Math.min(c.pasos.length - 1, Math.floor((ahora - c.t0) / c.intervalo)) };
    if (ahora < c.fin) return { k, fase: "responder", c };
    const sig = cadenas[k + 1];
    if (!sig || ahora < sig.t0 - 600) return { k, fase: "fin", c };
  }
  return { k: cadenas.length - 1, fase: "fin", c: cadenas.at(-1) };
}
