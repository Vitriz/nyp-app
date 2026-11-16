// Panel para retocar en vivo cómo se mueven las letras del título (se abre con #ajustes en la dirección).
// Cada deslizador cambia el valor al momento; lo cambiado se guarda en este dispositivo. «📋 Copiar» copia
// los valores para pegarlos en VALORES (titulo-vivo.js) y que queden para todos.
import { h } from "./ui.js";
import { VALORES, DEFECTO } from "./titulo-vivo.js";

const GUARDA = "nyp-ajustes-titulo";
// [clave, nombre, mínimo, máximo, paso]
const CONTROLES = [
  ["Agarrar", [
    ["muelle", "Fuerza del muelle", 50, 1500, 10],
    ["amortigua", "Amortiguación", 0.2, 1.5, 0.02],
  ]],
  ["Lanzar", [
    ["tironSoltar", "Tirón al soltar", 0, 1.5, 0.05],
    ["velMax", "Velocidad máxima (px/s)", 1000, 10000, 100],
    ["roce", "Rozamiento", 0.3, 8, 0.1],
    ["roceGiro", "Freno del giro", 0.2, 6, 0.1],
  ]],
  ["Golpes y choques", [
    ["golpe", "Fuerza de un toque", 0, 800, 10],
    ["giroGolpe", "Giro con un toque", 0, 500, 10],
    ["alcance", "Alcance de un toque (px)", 0, 200, 2],
    ["rebote", "Rebote en los choques", 0, 1, 0.02],
  ]],
  ["Volver a su sitio", [
    ["vueltaMs", "Espera antes de volver (ms, por letra)", 500, 8000, 100],
    ["vueltaVel", "Velocidad de vuelta (px/s)", 100, 3000, 20],
    ["vueltaRadio", "Radio de frenada (px)", 20, 1500, 10],
  ]],
];

let abierto = null;

export function panelAjustes() {
  if (abierto?.isConnected) return;
  const guardar = () => {
    const cambiados = Object.fromEntries(Object.entries(VALORES).filter(([k, v]) => v !== DEFECTO[k]));
    try {
      localStorage.setItem(GUARDA, JSON.stringify(cambiados));
    } catch {}
  };
  const filas = [];
  const texto = (k, v) => String(v);
  const fila = ([k, nombre, min, max, paso]) => {
    const valor = h("b.aj-valor", texto(k, VALORES[k]));
    const rango = h("input.aj-rango", { type: "range", min, max, step: paso, value: VALORES[k], "aria-label": nombre });
    // ↺ de cada deslizador: vuelve a su valor de serie (solo ese).
    const reset = h("button.aj-reset", {
      type: "button",
      title: `Volver a ${texto(k, DEFECTO[k])}`,
      "aria-label": `Restablecer ${nombre}`,
      onclick: (ev) => {
        ev.preventDefault();
        VALORES[k] = DEFECTO[k];
        pintar();
        guardar();
      },
    }, "↺");
    const pintar = () => {
      valor.textContent = texto(k, VALORES[k]);
      rango.value = VALORES[k];
      el.classList.toggle("cambiado", VALORES[k] !== DEFECTO[k]);
    };
    rango.addEventListener("input", () => {
      VALORES[k] = Number(rango.value);
      pintar();
      guardar();
    });
    const el = h("div.aj-fila", h("span.aj-nombre", h("span", nombre), h("span.aj-der", valor, reset)), rango);
    filas.push(pintar);
    pintar();
    return el;
  };
  const aviso = h("small.aj-aviso", "Se guarda solo en este dispositivo.");
  const cuerpo = h(
    "div.aj-cuerpo",
    CONTROLES.map(([titulo, lista]) => h("div.aj-grupo", h("span.aj-titulo", titulo), lista.map(fila))),
    h(
      "div.aj-botones",
      h("button.aj-boton", {
        type: "button",
        onclick: async () => {
          const texto = Object.entries(VALORES).map(([k, v]) => `  ${k}: ${v},`).join("\n");
          try {
            await navigator.clipboard.writeText(texto);
            aviso.textContent = "✔ Copiado: pégalo en VALORES (web/comun/titulo-vivo.js).";
          } catch {
            aviso.textContent = texto.replace(/\n/g, " ");
          }
        },
      }, "📋 Copiar"),
      h("button.aj-boton", {
        type: "button",
        onclick: () => {
          Object.assign(VALORES, DEFECTO);
          guardar();
          filas.forEach((f) => f());
          aviso.textContent = "Valores de serie restablecidos.";
        },
      }, "↺ Restablecer"),
      h("button.aj-boton", {
        type: "button",
        onclick: () => {
          sessionStorage.removeItem("nyp-panel-ajustes");
          abierto.remove();
        },
      }, "✕ Cerrar")
    ),
    aviso
  );
  const plegar = h("button.aj-cabeza", { type: "button", onclick: () => abierto.classList.toggle("plegado") }, "⚙️ Movimiento de las letras");
  abierto = h("div.panel-ajustes", plegar, cuerpo);
  // Que tocar el panel no mueva las letras ni lance ondas en el fondo.
  abierto.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  document.body.append(abierto);
}
