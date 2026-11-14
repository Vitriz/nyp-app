// Piezas compartidas por los juegos (móvil y TV).
import { h, avatar } from "../../comun/ui.js";
import { teclasFisicas, marcarTecla, sinTilde, ES_LETRA } from "../../comun/teclas.js";

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
  // En el ordenador también se escribe con el teclado.
  teclasFisicas(el, (t) => {
    if (el.classList.contains("oculto")) return false;
    if (t !== "⌫" && !ES_LETRA.test(t)) return false;
    const l = t === "⌫" ? t : sinTilde(t);
    marcarTecla(el, l);
    alPulsar(l);
  });
  return el;
}

/** Orden de calculadora: 7 8 9 arriba, 0 abajo. */
export const TECLAS_NUMEROS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "⌫", "0", "OK"];

/**
 * Tarjetas de jugadores para la TV con un número que rebota al cambiar.
 * valorDe(e, id) -> { valor, extra, total? } | null  (con total se dibuja una barra de progreso)
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
        const barra = h("span.mf-progreso", h("i"));
        c = { el: h("div.mf-carta.tarjeta.aparece", { style: { "--c": j.color } }, avatar(j), h("span.mf-quien", h("span.nombre", j.nombre), extra, barra), num), num, extra, barra, valor: 0 };
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
      // Con total (p. ej. 3 de 8 rectángulos), una barra de progreso bajo el nombre.
      c.barra.classList.toggle("oculto", !d?.total);
      if (d?.total) c.barra.firstChild.style.width = `${Math.min(100, (Number(d.valor) / d.total) * 100) || 0}%`;
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

/** Teclado numérico grande (orden de calculadora, borrar, 0, OK); también con el teclado del ordenador. */
export function tecladoNumerico(alPulsar) {
  const el = h(
    "div.teclado",
    TECLAS_NUMEROS.map((t) =>
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
  teclasFisicas(el, (t) => {
    if (el.closest(".oculto")) return false;
    if (!/^\d$|^⌫$|^OK$/.test(t)) return false;
    marcarTecla(el, t);
    alPulsar(t);
  });
  return el;
}

/** Colores de las operaciones, siempre en el mismo orden (arcoíris): verde, azul, morado, rosa, naranja, amarillo. */
export const COLORES_OPS = ["#5fd68e", "#5aaaf2", "#ae8ef5", "#f47fb0", "#f5a05a", "#f0d455"];

/**
 * ["500", "+ 50", "÷ 2", "+ 15"] -> (((500 + 50) ÷ 2) + 15) con cada operación (y sus paréntesis) de un color.
 * Devuelve los trozos para meter en un contenedor.
 */
export function expresionColor(pasos) {
  const ops = pasos.slice(1);
  const color = (k) => ({ style: { "--c": COLORES_OPS[k % COLORES_OPS.length] } });
  const abre = [];
  for (let k = ops.length - 1; k >= 0; k--) abre.push(h("span.ex-par", color(k), "("));
  return [
    h("span.ex-ini", abre, pasos[0]),
    // Un espacio normal entre operación y operación: si no cabe, la línea se parte por ahí.
    ...ops.flatMap((o, k) => [" ", h("span.ex-op", color(k), o.replace(" ", "\u00a0"), h("span.ex-par", ")"))]),
  ];
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
