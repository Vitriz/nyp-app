// Pintar el fondo del banner a mano: un lienzo con la forma del banner (grande, y se puede ampliar para
// los detalles), pincel o goma de tres grosores, deshacer y borrar todo. Lo pintado va encima del color de
// fondo y se guarda como una imagen pequeña (WebP) en el perfil: perfil.fondo.
import { h } from "../comun/ui.js";

const ANCHO = 960, ALTO = 240; // el lienzo de trabajo (4 : 1, como un banner)
const GUARDA_ANCHO = 480, GUARDA_ALTO = 120; // lo que se guarda (pesa poco)
const GROSORES = [["Fino", 8], ["Medio", 20], ["Gordo", 44]];
const MAX_HISTORIA = 30;

/**
 * base: color de fondo (debajo de lo pintado) · fondo: lo pintado antes (data URL) o null
 * alCambiar(fondo | null): al acabar cada trazo (null si no queda nada pintado)
 * Devuelve { el, color(c): cambia el color del pincel, base(c): cambia el color de debajo }
 */
export function editorPintura({ base, fondo = null, alCambiar }) {
  const lienzo = h("canvas.pin-lienzo", { width: ANCHO, height: ALTO });
  const ctx = lienzo.getContext("2d");
  const hoja = h("div.pin-hoja", { style: { "--base": base } }, lienzo);
  const marco = h("div.pin-marco", hoja);
  let color = "#ffd34d";
  let grosor = GROSORES[1][1];
  let goma = false;
  let ampliado = false;
  let historia = [], pos = -1;

  const instantanea = () => ctx.getImageData(0, 0, ANCHO, ALTO);
  function guardarHistoria() {
    historia = historia.slice(0, pos + 1);
    historia.push(instantanea());
    if (historia.length > MAX_HISTORIA) historia.shift();
    pos = historia.length - 1;
    pintarBotones();
  }
  function irA(p) {
    if (p < 0 || p >= historia.length) return;
    pos = p;
    ctx.putImageData(historia[p], 0, 0);
    pintarBotones();
    exportar();
  }
  function vacio() {
    const d = ctx.getImageData(0, 0, ANCHO, ALTO).data;
    for (let i = 3; i < d.length; i += 16) if (d[i]) return false;
    return true;
  }
  function exportar() {
    if (vacio()) return alCambiar?.(null);
    const c = Object.assign(document.createElement("canvas"), { width: GUARDA_ANCHO, height: GUARDA_ALTO });
    const g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(lienzo, 0, 0, GUARDA_ANCHO, GUARDA_ALTO);
    const webp = c.toDataURL("image/webp", 0.86);
    alCambiar?.(webp.startsWith("data:image/webp") ? webp : c.toDataURL("image/png"));
  }

  // ---- herramientas
  const bPincel = h("button.pin-herr.activa", { type: "button", onclick: () => usarGoma(false) }, "🖌️ Pincel");
  const bGoma = h("button.pin-herr", { type: "button", onclick: () => usarGoma(true) }, "🧽 Goma");
  const bGrosores = GROSORES.map(([t, g]) =>
    h(`button.pin-grosor${g === grosor ? ".activa" : ""}`, { type: "button", title: t, "aria-label": `Grosor ${t.toLowerCase()}`, onclick: () => ((grosor = g), bGrosores.forEach((b, i) => b.classList.toggle("activa", GROSORES[i][1] === g))) }, h("i", { style: { "--g": `${Math.max(4, g / 2.4)}px` } }))
  );
  const bDeshacer = h("button.pin-herr", { type: "button", title: "Deshacer", "aria-label": "Deshacer", onclick: () => irA(pos - 1) }, "↶");
  const bRehacer = h("button.pin-herr", { type: "button", title: "Rehacer", "aria-label": "Rehacer", onclick: () => irA(pos + 1) }, "↷");
  const bBorrar = h("button.pin-herr", { type: "button", onclick: () => (ctx.clearRect(0, 0, ANCHO, ALTO), guardarHistoria(), exportar()) }, "🗑️ Borrar todo");
  const bAmpliar = h("button.pin-herr", { type: "button", onclick: () => ampliar(!ampliado) }, "🔍 Ampliar");
  const muestra = h("span.pin-muestra");
  function usarGoma(v) {
    goma = v;
    bPincel.classList.toggle("activa", !v);
    bGoma.classList.toggle("activa", v);
    marco.classList.toggle("con-goma", v);
  }
  function ampliar(v) {
    ampliado = v;
    hoja.classList.toggle("ampliada", v);
    bAmpliar.textContent = v ? "🔍 Ver entero" : "🔍 Ampliar";
  }
  function pintarBotones() {
    bDeshacer.disabled = pos <= 0;
    bRehacer.disabled = pos >= historia.length - 1;
  }

  // ---- dibujar
  let trazo = null; // { id, x, y }
  const aLienzo = (ev) => {
    const r = lienzo.getBoundingClientRect();
    return [((ev.clientX - r.left) / r.width) * ANCHO, ((ev.clientY - r.top) / r.height) * ALTO];
  };
  function linea(a, b) {
    ctx.save();
    ctx.globalCompositeOperation = goma ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = grosor;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.restore();
  }
  lienzo.addEventListener("pointerdown", (ev) => {
    if (trazo) return;
    ev.preventDefault();
    try {
      lienzo.setPointerCapture(ev.pointerId);
    } catch {}
    const p = aLienzo(ev);
    trazo = { id: ev.pointerId, p };
    linea(p, [p[0] + 0.01, p[1]]); // un toque deja un punto
  });
  lienzo.addEventListener("pointermove", (ev) => {
    if (!trazo || ev.pointerId !== trazo.id) return;
    const p = aLienzo(ev);
    linea(trazo.p, p);
    trazo.p = p;
  });
  const acabar = (ev) => {
    if (!trazo || ev.pointerId !== trazo.id) return;
    trazo = null;
    guardarHistoria();
    exportar();
  };
  lienzo.addEventListener("pointerup", acabar);
  lienzo.addEventListener("pointercancel", acabar);

  // Lo pintado antes (si lo hay) y el primer paso de la historia.
  if (fondo) {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, ANCHO, ALTO);
      historia = [];
      pos = -1;
      guardarHistoria();
    };
    img.src = fondo;
  }
  guardarHistoria();

  const el = h(
    "div.pintura",
    h(
      "div.pin-barra",
      h("div.pin-grupo", bPincel, bGoma),
      h("div.pin-grupo.pin-grosores", ...bGrosores),
      h("div.pin-grupo", bDeshacer, bRehacer, bAmpliar, bBorrar)
    ),
    marco,
    h("p.pin-ayuda", muestra, "Pinta encima del color de fondo. El color del pincel se elige abajo.")
  );
  const ponerColor = (c) => {
    color = c;
    muestra.style.background = c;
    usarGoma(false);
  };
  ponerColor(color);
  return {
    el,
    color: ponerColor,
    base: (c) => hoja.style.setProperty("--base", c),
  };
}
