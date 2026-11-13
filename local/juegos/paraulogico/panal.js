// Panal de 7 hexágonos (compartido por el móvil y la TV).
import { h } from "../../comun/ui.js";

const ANCHO = 30; // % del contenedor
const SEPARACION = 2.2;

export function crearPanal(centro, letras, alPulsar = null, alSoltar = null) {
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
    // Tocar una letra la escribe. También se puede arrastrar el dedo por varias: al soltar se comprueba.
    const pulsar = (b) => {
      b.classList.remove("toque");
      void b.offsetWidth;
      b.classList.add("toque");
      navigator.vibrate?.(8);
      alPulsar(b.dataset.l);
    };
    let arrastre = null;
    const bajoDedo = (ev) => {
      // El hexágono cuyo centro está más cerca (y dentro de su círculo interior): sin fallos en las esquinas.
      let mejor = null;
      for (const p of arrastre.centros) {
        const dd = Math.hypot(ev.clientX - p.x, ev.clientY - p.y);
        if (dd < p.r && (!mejor || dd < mejor.dd)) mejor = { b: p.b, dd };
      }
      return mejor?.b ?? null;
    };
    el.addEventListener("pointerdown", (ev) => {
      const b = ev.target.closest(".hex");
      if (!b) return;
      ev.preventDefault();
      const centros = piezas.map((x) => {
        const r = x.getBoundingClientRect();
        return { b: x, x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width * 0.42 };
      });
      arrastre = { id: ev.pointerId, ultimo: b, centros, varias: false };
      try {
        el.setPointerCapture(ev.pointerId);
      } catch {}
      pulsar(b);
    });
    el.addEventListener("pointermove", (ev) => {
      if (!arrastre || ev.pointerId !== arrastre.id) return;
      const b = bajoDedo(ev);
      if (!b || b === arrastre.ultimo) return;
      arrastre.ultimo = b;
      arrastre.varias = true;
      pulsar(b);
    });
    const soltar = (ev) => {
      if (!arrastre || ev.pointerId !== arrastre.id) return;
      const varias = arrastre.varias;
      arrastre = null;
      if (varias && ev.type === "pointerup") alSoltar?.();
    };
    el.addEventListener("pointerup", soltar);
    el.addEventListener("pointercancel", soltar);
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
