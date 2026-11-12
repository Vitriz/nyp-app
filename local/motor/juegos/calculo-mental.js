// CÁLCULO MENTAL · cadenas de operaciones que aparecen una a una, a la vez para todos.
// Al terminar cada cadena hay unos segundos para dar el resultado (un solo intento).
// Gana quien acierte más cadenas; si empatan, quien respondió más rápido en total.
import { nivelDificultad } from "../util.js";

const PASOS = 6;
const VENTANA = 9000; // ms para responder
const PREVIA = 1800; // ms de "prepárate" antes de cada cadena
const MAX = 150;

function cadena(azar, nivel) {
  let v = azar.entero(2, nivel < 2 ? 12 : 20);
  const pasos = [String(v)];
  for (let k = 1; k < PASOS; k++) {
    const opciones = [];
    opciones.push(["+", azar.entero(1, nivel < 2 ? 15 : 30)]);
    if (v > 1) opciones.push(["-", azar.entero(1, Math.min(v - 1, nivel < 2 ? 15 : 40))]);
    const mult = [2, 3, 4, 5].filter((m) => v * m <= MAX);
    if (mult.length && v > 1) opciones.push(["*", azar.elegir(mult)]);
    const divs = [2, 3, 4, 5, 6, 7, 8, 9].filter((d) => v % d === 0 && v / d >= 1);
    if (divs.length && v > 3) opciones.push(["/", azar.elegir(divs)], ["/", azar.elegir(divs)]); // más peso a dividir cuando se puede
    const [op, n] = azar.elegir(opciones);
    v = op === "+" ? v + n : op === "-" ? v - n : op === "*" ? v * n : v / n;
    pasos.push(`${{ "+": "+", "-": "−", "*": "×", "/": "÷" }[op]} ${n}`);
  }
  return { pasos, r: v };
}

export default {
  id: "calculo-mental",
  nombre: "Cálculo mental",
  categoria: "numeros",
  duracion: 75,
  tic: 400, // la sala nos refresca a menudo: el reloj de las cadenas es nuestro
  descripcion: "Van apareciendo operaciones una a una: hazlas de cabeza. Al final escribe el resultado. Solo tienes un intento por cadena.",

  crear({ azar, config, duracion = 75000, inicio = Date.now() }) {
    const d = nivelDificultad(config);
    const n = Math.max(1, Math.min(6, Math.round(duracion / 25000)));
    const tramo = duracion / n;
    const intervalo = Math.max(1600 - d * 300, Math.min(3200, (tramo - VENTANA - PREVIA - 600) / PASOS) * (1 - d * 0.15));
    const cadenas = [];
    for (let k = 0; k < n; k++) {
      const c = cadena(azar, Math.max(0, Math.min(3, k + d)));
      const t0 = inicio + k * tramo + PREVIA;
      const finPasos = t0 + PASOS * intervalo;
      cadenas.push({ ...c, t0, intervalo, finPasos, fin: Math.min(finPasos + VENTANA, inicio + (k + 1) * tramo - 300) });
    }
    return { cadenas, jugadores: {} };
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { respuestas: [] });
  },

  vistaCadenas(ronda) {
    const ahora = Date.now();
    return ronda.cadenas.map((c) => ({
      pasos: c.pasos, t0: c.t0, intervalo: c.intervalo, finPasos: c.finPasos, fin: c.fin,
      resultado: ahora > c.fin ? c.r : null,
    }));
  },

  vistaJugador(ronda, id) {
    return { cadenas: this.vistaCadenas(ronda), respuestas: this.estadoJugador(ronda, id).respuestas };
  },

  vistaTV(ronda) {
    return {
      cadenas: this.vistaCadenas(ronda),
      jugadores: Object.fromEntries(
        Object.entries(ronda.jugadores).map(([id, j]) => [id, j.respuestas.map((r) => (r ? (r.ok ? 1 : 0) : null))])
      ),
    };
  },

  accion(ronda, id, msg) {
    if (msg.a !== "respuesta") return false;
    const j = this.estadoJugador(ronda, id);
    const c = ronda.cadenas[msg.c];
    const ahora = Date.now();
    if (!c || j.respuestas[msg.c] || ahora < c.finPasos - 300 || ahora > c.fin + 1500) return false;
    const valor = Number(msg.valor);
    j.respuestas[msg.c] = { valor, ok: valor === c.r, ms: Math.max(0, ahora - c.finPasos) };
    return true;
  },

  terminado(ronda, id) {
    const r = ronda.jugadores[id]?.respuestas ?? [];
    return ronda.cadenas.every((_, k) => r[k]);
  },

  resultados(ronda, ids) {
    return ids.map((id) => {
      const r = (ronda.jugadores[id]?.respuestas ?? []).filter(Boolean);
      if (!r.length) return { id, valor: null, texto: "No respondió" };
      const ok = r.filter((x) => x.ok);
      const ms = ok.reduce((a, x) => a + x.ms, 0);
      const seg = ok.length ? ` · ${(ms / 1000).toFixed(1).replace(".", ",")} s` : "";
      return { id, valor: ok.length ? ok.length * 1e6 - ms : null, texto: `${ok.length} de ${ronda.cadenas.length}${seg}` };
    });
  },

  resumen(ronda) {
    return { cadenas: ronda.cadenas.map((c) => ({ pasos: c.pasos, r: c.r })) };
  },
};
