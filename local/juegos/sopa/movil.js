// Sopa de letras · móvil: arrastra el dedo de la primera a la última letra.
import { h } from "../../comun/ui.js";
import { crearTablero, COLORES_SOPA } from "./tablero.js";
import { reiniciarAnim } from "../comun/util.js";

export function montar(cuerpo, e, ctx) {
  const d = e.datos;
  const tablero = crearTablero(d.tablero);
  const marcadas = new Set();
  // En difícil no se ven las palabras: solo sus definiciones (al encontrarla, aparece la palabra).
  const conDefs = Array.isArray(d.definiciones);
  const chips = d.palabras.map((p, k) => (conDefs ? h("span.sopa-chip.sopa-def", h("b", "?"), h("span", d.definiciones[k])) : h("span.sopa-chip", p.toUpperCase())));
  const contador = h("span.ficha", "0");

  cuerpo.append(
    h(
      "div.sopa-movil",
      h("div.mf-cont", "Encontradas", contador, h("span.suave", `de ${d.palabras.length}`)),
      h(`div.sopa-lista${conDefs ? ".con-defs" : ""}`, chips),
      h("div.sopa-caja.sin-onda", tablero.el)
    )
  );

  function marcar(k, r0, c0, r1, c1) {
    if (marcadas.has(k)) return;
    marcadas.add(k);
    tablero.marcar(r0, c0, r1, c1, COLORES_SOPA[k % COLORES_SOPA.length]);
    chips[k].classList.add("hecha");
    if (conDefs) chips[k].firstChild.textContent = d.palabras[k].toUpperCase();
    chips[k].style.setProperty("--c", COLORES_SOPA[k % COLORES_SOPA.length]);
    contador.textContent = marcadas.size;
    reiniciarAnim(contador, "rebote");
  }

  for (const f of d.encontradas) marcar(f.k, f.r0, f.c0, f.r1, f.c1);

  // ------- arrastre
  let inicio = null, fin = null;
  const zona = tablero.el;

  function ajustar(a, b) {
    // Lleva el final a la dirección recta (8 direcciones) más cercana.
    let dr = b.r - a.r, dc = b.c - a.c;
    if (dr === 0 && dc === 0) return b;
    const ang = Math.round(Math.atan2(dr, dc) / (Math.PI / 4)) * (Math.PI / 4);
    const n = Math.max(Math.abs(dr), Math.abs(dc));
    const sr = Math.round(Math.sin(ang)), sc = Math.round(Math.cos(ang));
    let r = a.r + sr * n, c = a.c + sc * n;
    // si se sale del tablero, acortamos
    while (r < 0 || c < 0 || r >= tablero.tam || c >= tablero.tam) {
      r -= sr;
      c -= sc;
    }
    return { r, c };
  }

  zona.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    zona.setPointerCapture(ev.pointerId);
    inicio = tablero.celdaEn(ev.clientX, ev.clientY);
    fin = inicio;
    tablero.temporal(inicio.r, inicio.c, fin.r, fin.c);
  });
  zona.addEventListener("pointermove", (ev) => {
    if (!inicio) return;
    const nuevo = ajustar(inicio, tablero.celdaEn(ev.clientX, ev.clientY));
    if (nuevo.r !== fin.r || nuevo.c !== fin.c) {
      fin = nuevo;
      tablero.temporal(inicio.r, inicio.c, fin.r, fin.c);
      navigator.vibrate?.(4);
    }
  });
  const soltar = () => {
    if (!inicio) return;
    const a = inicio, b = fin;
    inicio = null;
    tablero.quitarTemporal();
    if (a.r === b.r && a.c === b.c) return;
    const s = tablero.texto(a.r, a.c, b.r, b.c);
    const inv = [...s].reverse().join("");
    const k = d.palabras.findIndex((p, i) => !marcadas.has(i) && (p === s || p === inv));
    if (k >= 0) {
      marcar(k, a.r, a.c, b.r, b.c);
      navigator.vibrate?.(25);
      ctx.enviar({ a: "marcar", r0: a.r, c0: a.c, r1: b.r, c1: b.c });
    } else {
      reiniciarAnim(zona, "sacudir");
    }
  };
  zona.addEventListener("pointerup", soltar);
  zona.addEventListener("pointercancel", soltar);

  return {
    actualizar(e) {
      for (const f of e.datos?.encontradas ?? []) marcar(f.k, f.r0, f.c0, f.r1, f.c1);
    },
  };
}
