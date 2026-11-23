// Panal de 7 hexágonos (compartido por el móvil y la TV).
import { h } from "../../comun/ui.js";

const ANCHO = 30; // % del contenedor
const SEPARACION = 2.2;
const SVG = "http://www.w3.org/2000/svg";

/**
 * alPulsar(letra): tocar una letra (o pasar el dedo por ella) la escribe. Al soltar no se comprueba nada: así
 * se puede escribir parte de la palabra arrastrando y el resto tocando.
 */
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
    b.centro = { x, y }; // en % del panal (para la línea del recorrido)
    el.append(b);
    return b;
  };
  piezas.push(poner(centro, 50, 50, true));
  letras.forEach((l, k) => {
    const a = (Math.PI / 3) * k + Math.PI; // empieza a la izquierda
    piezas.push(poner(l, 50 + d * Math.cos(a), 50 + d * Math.sin(a), false));
  });
  if (alPulsar) {
    // La línea del recorrido del dedo: semitransparente y por encima, para seguir viendo las letras (alguna se
    // puede repetir). No recibe toques: los dedos siguen llegando a las casillas de debajo.
    const linea = document.createElementNS(SVG, "svg");
    linea.setAttribute("class", "panal-linea");
    linea.setAttribute("viewBox", "0 0 100 100");
    linea.setAttribute("aria-hidden", "true");
    const trazo = document.createElementNS(SVG, "polyline");
    linea.append(trazo);
    el.append(linea);
    const pintarLinea = (ev) => {
      if (!arrastre) return;
      const r = el.getBoundingClientRect();
      const puntos = arrastre.camino.map((b) => `${b.centro.x},${b.centro.y}`);
      if (ev && r.width) puntos.push(`${((ev.clientX - r.left) / r.width) * 100},${((ev.clientY - r.top) / r.height) * 100}`);
      trazo.setAttribute("points", puntos.join(" "));
      linea.classList.add("visible");
    };
    const borrarLinea = () => linea.classList.remove("visible");

    // Tocar una letra la escribe. También se puede arrastrar el dedo por varias.
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
      arrastre = { id: ev.pointerId, ultimo: b, centros, camino: [b], x: ev.clientX, y: ev.clientY };
      try {
        el.setPointerCapture(ev.pointerId);
      } catch {}
      pulsar(b);
    });
    el.addEventListener("pointermove", (ev) => {
      if (!arrastre || ev.pointerId !== arrastre.id) return;
      // La línea sale en cuanto el dedo se mueve un poco (un toque normal no la dibuja).
      if (arrastre.movido || Math.hypot(ev.clientX - arrastre.x, ev.clientY - arrastre.y) > 6) {
        arrastre.movido = true;
        pintarLinea(ev);
      }
      const b = bajoDedo(ev);
      if (!b || b === arrastre.ultimo) return;
      arrastre.ultimo = b;
      arrastre.camino.push(b);
      pulsar(b);
      pintarLinea(ev);
    });
    const soltar = (ev) => {
      if (!arrastre || ev.pointerId !== arrastre.id) return;
      arrastre = null;
      borrarLinea();
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
