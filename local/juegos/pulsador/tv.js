// Pulsador · TV: la pregunta en grande y, cuando alguien pulsa, su nombre bien visible.
import { h, avatar } from "../../comun/ui.js";
import { tarjetasJugadores, expresionColor } from "../comun/util.js";

// Timbre distinto para cada jugador (nota y sonido propios), con el audio del navegador.
let audio = null;
const NOTAS = [523.25, 659.25, 783.99, 587.33, 698.46, 880, 493.88, 622.25, 739.99, 830.61];
const FORMAS = ["square", "triangle", "sawtooth", "sine"];
function timbre(i) {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const f = NOTAS[Math.max(0, i) % NOTAS.length];
    const t0 = audio.currentTime;
    for (const [k, mult] of [[0, 1], [1, 1.5]]) {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = FORMAS[Math.max(0, i) % FORMAS.length];
      o.frequency.value = f * mult;
      g.gain.setValueAtTime(0.0001, t0 + k * 0.12);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + k * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + k * 0.12 + 0.28);
      o.connect(g).connect(audio.destination);
      o.start(t0 + k * 0.12);
      o.stop(t0 + k * 0.12 + 0.3);
    }
  } catch {}
}

export function pintarPregunta(p) {
  if (!p) return [h("p.pul-texto", "¡Se acabaron las preguntas!")];
  const partes = [h("span.etiqueta.pul-titulo", p.titulo)];
  // Los paréntesis (cada operación de un color) dejan claro el orden: ((6 − 3) × 3) no es 6 − 9.
  if (p.tipo === "calculo") partes.push(h("div.cm-expresion.pul-expresion", expresionColor(p.pasos), h("span.cm-igual", " = ?")));
  if (p.tipo === "revuelto") partes.push(h("div.pul-fichas", p.letras.map((l) => h("span.ficha", l.toUpperCase()))));
  if (p.texto) partes.push(h("p.pul-texto", p.texto));
  if (p.pista) partes.push(h("span.pul-pista.suave", p.pista));
  return partes;
}

export function montar(cuerpo, e, ctx) {
  const pregunta = h("div.pul-pregunta");
  const anterior = h("div.pul-anterior");
  const cuentaLeer = h("div.pul-leer");
  const caja = h("div.pul-tv", pregunta, cuentaLeer, anterior);
  cuerpo.append(caja);
  const tarjetas = tarjetasJugadores(caja, ctx, (e, id) => {
    const d = e.datos;
    if (!d) return null;
    return { valor: (d.aciertos[id] ?? 0) - (d.fallos?.[id] ?? 0), extra: d.bloqueados.includes(id) ? "✘" : "" };
  });
  let ultimaI = -1, ultimoPulsado = null, capa = null, anteriorVisto = -1;
  let d = e.datos;
  // Unos segundos para leer: hasta entonces no se puede pulsar.
  const reloj = setInterval(() => {
    const falta = d?.pregunta ? (d.abre ?? 0) - ctx.ahora() : 0;
    const txt = falta > 0 ? `Leed la pregunta… ${Math.ceil(falta / 1000)}` : d?.pregunta && !d.pulsado ? "¡Ya se puede pulsar!" : "";
    if (cuentaLeer.textContent !== txt) {
      cuentaLeer.textContent = txt;
      cuentaLeer.classList.toggle("abierto", falta <= 0);
    }
  }, 100);

  function actualizar(e) {
    d = e.datos;
    if (!d) return;
    if (d.i !== ultimaI) {
      ultimaI = d.i;
      pregunta.replaceChildren(...pintarPregunta(d.pregunta));
      pregunta.classList.remove("aparece");
      void pregunta.offsetWidth;
      pregunta.classList.add("aparece");
    }
    if (d.anterior && d.anterior.n !== anteriorVisto) {
      anteriorVisto = d.anterior.n;
      const quien = e.jugadores.find((j) => j.id === d.anterior.quien);
      anterior.replaceChildren(
        d.anterior.ok && quien ? `✔ ${quien.nombre} acertó: ` : "Era: ",
        h("b", d.anterior.solucion.toUpperCase())
      );
    }
    const pid = d.pulsado?.id ?? null;
    if (pid !== ultimoPulsado) {
      ultimoPulsado = pid;
      capa?.remove();
      capa = null;
      const j = e.jugadores.find((x) => x.id === pid);
      if (j) {
        timbre(e.jugadores.findIndex((x) => x.id === pid));
        capa = h("div.pul-capa", h("div.caja", avatar(j), h("b", j.nombre), h("span", "¡Responde en voz alta!")));
        caja.append(capa);
        const r = capa.getBoundingClientRect();
        ctx.onda(r.left + r.width / 2, r.top + r.height / 2, 1.2);
      }
    }
    tarjetas(e);
  }

  actualizar(e);
  return { actualizar, desmontar: () => clearInterval(reloj) };
}
