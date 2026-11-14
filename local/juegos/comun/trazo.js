// Arrastrar el dedo por una cuadrícula (Hilo, Culebras, Parcelas, Coronas): qué casilla hay bajo el dedo
// y, si el dedo va deprisa y se salta casillas, las de en medio (en línea recta, sin diagonales).
import { h } from "../../comun/ui.js";

/**
 * el: el elemento de la cuadrícula (filas×cols casillas iguales).
 * al: { empezar(k, ev) -> bool (true = seguir el dedo), mover(k), soltar(k|null, seMovio), cancelar() }
 */
export function seguirDedo(el, filas, cols, al) {
  let activo = null; // { id, ultima, seMovio, t0 }
  const casillaEn = (x, y) => {
    const r = el.getBoundingClientRect();
    const c = Math.floor(((x - r.left) / r.width) * cols);
    const f = Math.floor(((y - r.top) / r.height) * filas);
    if (c < 0 || f < 0 || c >= cols || f >= filas) return null;
    return f * cols + c;
  };
  function inicio(id, x, y, ev) {
    if (activo) return false;
    const k = casillaEn(x, y);
    if (k == null) return false;
    if (al.empezar(k, ev) === false) return false;
    activo = { id, ultima: k, seMovio: false, t0: Date.now() };
    return true;
  }
  function movimiento(id, x, y) {
    if (!activo || id !== activo.id) return;
    const k = casillaEn(x, y);
    if (k == null || k === activo.ultima) return;
    // Casillas intermedias, de una en una (sin diagonales), siguiendo la dirección del dedo.
    let fa = Math.floor(activo.ultima / cols), ca = activo.ultima % cols;
    const fb = Math.floor(k / cols), cb = k % cols;
    let pasos = 0;
    while ((fa !== fb || ca !== cb) && pasos++ < filas + cols) {
      if (Math.abs(cb - ca) >= Math.abs(fb - fa)) ca += Math.sign(cb - ca);
      else fa += Math.sign(fb - fa);
      activo.seMovio = true;
      al.mover(fa * cols + ca);
    }
    activo.ultima = k;
  }
  function final(id, x, y, cancelado) {
    if (!activo || id !== activo.id) return;
    const a = activo;
    activo = null;
    if (cancelado) return al.cancelar?.();
    // Un «toque» de verdad es corto; si el dedo estuvo mucho rato quieto, no cuenta como toque.
    al.soltar?.(x == null ? a.ultima : casillaEn(x, y) ?? a.ultima, a.seMovio, Date.now() - a.t0);
  }

  // Dedo (pantallas táctiles, sobre todo iPhone): eventos táctiles propios, que Safari nunca convierte en desplazamiento.
  const tocar = (t) => ({ id: `t${t.identifier}`, x: t.clientX, y: t.clientY });
  el.addEventListener(
    "touchstart",
    (ev) => {
      const t = tocar(ev.changedTouches[0]);
      if (inicio(t.id, t.x, t.y, ev)) ev.preventDefault();
    },
    { passive: false }
  );
  el.addEventListener(
    "touchmove",
    (ev) => {
      if (!activo) return;
      ev.preventDefault();
      for (const x of ev.changedTouches) {
        const t = tocar(x);
        movimiento(t.id, t.x, t.y);
      }
    },
    { passive: false }
  );
  const finToque = (cancelado) => (ev) => {
    for (const x of ev.changedTouches) {
      const t = tocar(x);
      final(t.id, t.x, t.y, cancelado);
    }
  };
  el.addEventListener("touchend", finToque(false));
  el.addEventListener("touchcancel", finToque(true));

  // Ratón y lápiz (y el dedo en navegadores sin eventos táctiles).
  const esToque = (ev) => ev.pointerType === "touch" && "ontouchstart" in window;
  el.addEventListener("pointerdown", (ev) => {
    if (esToque(ev)) return;
    if (inicio(ev.pointerId, ev.clientX, ev.clientY, ev)) {
      ev.preventDefault();
      try {
        el.setPointerCapture(ev.pointerId);
      } catch {}
    }
  });
  el.addEventListener("pointermove", (ev) => !esToque(ev) && movimiento(ev.pointerId, ev.clientX, ev.clientY));
  el.addEventListener("pointerup", (ev) => !esToque(ev) && final(ev.pointerId, ev.clientX, ev.clientY, false));
  el.addEventListener("pointercancel", (ev) => !esToque(ev) && final(ev.pointerId, null, null, true));
  el.style.touchAction = "none";
  el.style.webkitUserSelect = "none";
  el.style.userSelect = "none";
}

/** Centro de una casilla en coordenadas de la cuadrícula (cada casilla mide 1). */
export const centro = (k, cols) => [(k % cols) + 0.5, Math.floor(k / cols) + 0.5];

const NS = "http://www.w3.org/2000/svg";
/** Elemento SVG con atributos. */
export function s(nombre, atributos = {}, ...hijos) {
  const e = document.createElementNS(NS, nombre);
  for (const [k, v] of Object.entries(atributos)) if (v != null) e.setAttribute(k, v);
  for (const x of hijos.flat()) if (x != null) e.append(x);
  return e;
}

/** Mezcla dos colores #rrggbb (t de 0 a 1). */
export function mezclar(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((x, i) => Math.round(x + (pb[i] - x) * t).toString(16).padStart(2, "0")).join("")}`;
}

/** Un trazo de casilla en casilla (polilínea redondeada). */
export function trazoSvg(celdas, cols, atributos = {}) {
  const puntos = celdas.map((k) => centro(k, cols).join(",")).join(" ");
  return s("polyline", { points: puntos, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round", ...atributos });
}

/** Aviso que aparece un momento (bien / mal / suave). */
export function avisoBreve(el) {
  let t = 0;
  return (texto, tono = "suave", ms = 1800) => {
    clearTimeout(t);
    el.className = `pl-aviso ${tono}`;
    el.textContent = texto;
    if (ms) t = setTimeout(() => (el.className = "pl-aviso suave"), ms);
  };
}

export { h };
