// Selector de color: unos colores rápidos y una rueda para elegir cualquier otro.
import { h } from "./ui.js";

const hex2 = (n) => Math.round(n).toString(16).padStart(2, "0");

export function hsvAHex(hue, s, v) {
  const f = (n) => {
    const k = (n + hue / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return `#${hex2(f(5) * 255)}${hex2(f(3) * 255)}${hex2(f(1) * 255)}`;
}

export function hexAHsv(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  if (Number.isNaN(n)) return { hue: 0, s: 0, v: 1 };
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  let hue = 0;
  if (d) hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { hue: (hue * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

/**
 * colores: lista de colores rápidos. ninguno: texto del botón "sin color" (o null si no hay).
 * Devuelve { el, fijar(valor) }. alCambiar(color|null) se llama al tocar.
 */
export function selectorColor({ valor, colores, alCambiar, ninguno = null }) {
  let actual = valor ?? null;
  let hsv = hexAHsv(actual ?? colores[0]);
  const rapidos = h("div.paleta");
  const botonRueda = h("button.color.color-rueda", { type: "button", "aria-label": "Otro color" });
  const panel = h("div.rueda-panel.oculto");
  const lado = 220;
  const lienzo = h("canvas.rueda", { width: lado, height: lado });
  const marca = h("span.rueda-marca");
  const brillo = h("input.rueda-brillo", { type: "range", min: 0, max: 100, "aria-label": "Brillo" });
  panel.append(h("div.rueda-caja", lienzo, marca), brillo);

  let dibujada = false;
  // La rueda se pinta siempre con colores vivos; la barra de debajo los oscurece.
  function dibujarRueda() {
    const ctx = lienzo.getContext("2d");
    const img = ctx.createImageData(lado, lado);
    const r0 = lado / 2;
    for (let y = 0; y < lado; y++) {
      for (let x = 0; x < lado; x++) {
        const dx = x - r0 + 0.5, dy = y - r0 + 0.5;
        const d = Math.hypot(dx, dy) / r0;
        if (d > 1) continue;
        const c = parseInt(hsvAHex((Math.atan2(dy, dx) * 180) / Math.PI + 360, d, 1).slice(1), 16);
        const i = (y * lado + x) * 4;
        img.data[i] = c >> 16;
        img.data[i + 1] = (c >> 8) & 255;
        img.data[i + 2] = c & 255;
        img.data[i + 3] = d > 0.985 ? 255 * (1 - d) / 0.015 : 255; // borde suave
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function colocarMarca() {
    const a = (hsv.hue * Math.PI) / 180;
    marca.style.left = `${50 + 50 * hsv.s * Math.cos(a)}%`;
    marca.style.top = `${50 + 50 * hsv.s * Math.sin(a)}%`;
    marca.style.background = actual ?? "transparent";
    brillo.style.setProperty("--vivo", hsvAHex(hsv.hue, hsv.s, 1));
  }

  function pintar() {
    const enLista = colores.includes(actual);
    rapidos.replaceChildren(
      ...(ninguno
        ? [h(`button.color.color-ninguno${actual == null ? ".elegido" : ""}`, { type: "button", "aria-label": ninguno, onclick: () => elegir(null) }, "∅")]
        : []),
      botonRueda, // la rueda siempre a la vista, al principio
      ...colores.map((c) => h(`button.color${actual === c ? ".elegido" : ""}`, { type: "button", style: { "--c": c }, "aria-label": c, onclick: () => elegir(c) }))
    );
    botonRueda.classList.toggle("elegido", actual != null && !enLista);
    botonRueda.style.setProperty("--c", actual != null && !enLista ? actual : "transparent");
    colocarMarca();
  }

  function elegir(c, desdeRueda = false) {
    actual = c;
    if (c && !desdeRueda) {
      hsv = hexAHsv(c);
      brillo.value = Math.round(hsv.v * 100);
    }
    pintar();
    alCambiar(c);
  }

  botonRueda.addEventListener("click", () => {
    const abrir = panel.classList.contains("oculto");
    panel.classList.toggle("oculto", !abrir);
    if (abrir) {
      brillo.value = Math.round(hsv.v * 100);
      if (!dibujada) dibujarRueda();
      dibujada = true;
      colocarMarca();
    }
  });

  // Arrastrar el dedo por la rueda elige el tono (alrededor) y la intensidad (del centro al borde).
  const caja = panel.firstChild;
  const tocar = (ev) => {
    const r = lienzo.getBoundingClientRect();
    const dx = ev.clientX - (r.left + r.width / 2), dy = ev.clientY - (r.top + r.height / 2);
    hsv.hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    hsv.s = Math.min(1, Math.hypot(dx, dy) / (r.width / 2));
    // Lo que tocas es lo que ves: si venías de un color muy oscuro, la rueda da el color vivo.
    if (hsv.v < 0.35) brillo.value = Math.round((hsv.v = 1) * 100);
    elegir(hsvAHex(hsv.hue, hsv.s, hsv.v), true);
  };
  caja.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    caja.setPointerCapture(ev.pointerId);
    tocar(ev);
    const mover = (e) => tocar(e);
    const soltar = () => (caja.removeEventListener("pointermove", mover), caja.removeEventListener("pointerup", soltar), caja.removeEventListener("pointercancel", soltar));
    caja.addEventListener("pointermove", mover);
    caja.addEventListener("pointerup", soltar);
    caja.addEventListener("pointercancel", soltar);
  });
  brillo.addEventListener("input", () => {
    hsv.v = brillo.value / 100;
    elegir(hsvAHex(hsv.hue, hsv.s, hsv.v), true);
  });

  brillo.value = Math.round(hsv.v * 100);
  pintar();
  return { el: h("div.selector-color", rapidos, panel) };
}
