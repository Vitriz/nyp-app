// Arrastrar el dedo por una cuadrícula (Hilo, Culebras, Parcelas, Coronas): qué casilla hay bajo el dedo
// y, si el dedo va deprisa y se salta casillas, las de en medio (en línea recta, sin diagonales).
import { h } from "../../comun/ui.js";

/**
 * el: el elemento de la cuadrícula (filas×cols casillas iguales).
 * al: { empezar(k, ev) -> bool (true = seguir el dedo), mover(k), soltar(k|null, seMovio), cancelar() }
 */
export function seguirDedo(el, filas, cols, al) {
  let activo = null; // { id, ultima, seMovio }
  const casillaEn = (x, y) => {
    const r = el.getBoundingClientRect();
    const c = Math.floor(((x - r.left) / r.width) * cols);
    const f = Math.floor(((y - r.top) / r.height) * filas);
    if (c < 0 || f < 0 || c >= cols || f >= filas) return null;
    return f * cols + c;
  };
  el.addEventListener("pointerdown", (ev) => {
    if (activo) return;
    const k = casillaEn(ev.clientX, ev.clientY);
    if (k == null) return;
    ev.preventDefault();
    if (al.empezar(k, ev) === false) return;
    activo = { id: ev.pointerId, ultima: k, seMovio: false };
    try {
      el.setPointerCapture(ev.pointerId);
    } catch {}
  });
  el.addEventListener("pointermove", (ev) => {
    if (!activo || ev.pointerId !== activo.id) return;
    const k = casillaEn(ev.clientX, ev.clientY);
    if (k == null || k === activo.ultima) return;
    // Casillas intermedias: primero en horizontal y luego en vertical, de una en una.
    let fa = Math.floor(activo.ultima / cols), ca = activo.ultima % cols;
    const fb = Math.floor(k / cols), cb = k % cols;
    let pasos = 0;
    while ((fa !== fb || ca !== cb) && pasos++ < filas + cols) {
      // Avanzamos por el eje en el que queda más distancia (así sigue mejor la dirección del dedo).
      if (Math.abs(cb - ca) >= Math.abs(fb - fa)) ca += Math.sign(cb - ca);
      else fa += Math.sign(fb - fa);
      activo.seMovio = true;
      al.mover(fa * cols + ca);
    }
    activo.ultima = k;
  });
  const fin = (ev) => {
    if (!activo || ev.pointerId !== activo.id) return;
    const a = activo;
    activo = null;
    if (ev.type === "pointercancel") return al.cancelar?.();
    al.soltar?.(casillaEn(ev.clientX, ev.clientY), a.seMovio);
  };
  el.addEventListener("pointerup", fin);
  el.addEventListener("pointercancel", fin);
  el.style.touchAction = "none";
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
