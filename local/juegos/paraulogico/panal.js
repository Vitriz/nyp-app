// Panal de 7 hexágonos (compartido por el móvil y la TV).
import { h } from "../../comun/ui.js";

const ANCHO = 30; // % del contenedor
const SEPARACION = 2.2;

export function crearPanal(centro, letras, alPulsar = null) {
  const el = h("div.panal");
  const d = ANCHO + SEPARACION;
  const piezas = [];
  const poner = (letra, x, y, esCentro) => {
    const b = h(`${alPulsar ? "button" : "div"}.hex${esCentro ? ".centro" : ""}`, {
      type: alPulsar ? "button" : null,
      style: { left: `${x - ANCHO / 2}%`, top: `${y - (ANCHO / Math.sqrt(3))}%`, width: `${ANCHO}%` },
      "data-l": letra,
    }, h("span", letra.toUpperCase()));
    el.append(b);
    return b;
  };
  piezas.push(poner(centro, 50, 50, true));
  letras.forEach((l, k) => {
    const a = (Math.PI / 3) * k + Math.PI; // empieza a la izquierda
    piezas.push(poner(l, 50 + d * Math.cos(a), 50 + d * Math.sin(a), false));
  });
  if (alPulsar) {
    el.addEventListener("pointerdown", (ev) => {
      const b = ev.target.closest(".hex");
      if (!b) return;
      ev.preventDefault();
      b.classList.remove("toque");
      void b.offsetWidth;
      b.classList.add("toque");
      navigator.vibrate?.(8);
      alPulsar(b.dataset.l);
    });
  }
  return {
    el,
    mezclar(nuevas) {
      piezas.slice(1).forEach((b, k) => {
        b.dataset.l = nuevas[k];
        b.firstChild.textContent = nuevas[k].toUpperCase();
        b.classList.remove("girar");
        void b.offsetWidth;
        b.classList.add("girar");
      });
    },
  };
}
