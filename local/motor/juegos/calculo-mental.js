// CÁLCULO MENTAL · una operación encadenada con paréntesis, entera desde el principio, igual para todos:
//   (((500 + 50) ÷ 2) + 15) ÷ 5 = ?
// Se resuelve de cabeza y se da el resultado (un solo intento por operación).
// Gana quien acierte más; si empatan, quien respondió más rápido en total.
import { nivelDificultad, SIN_LIMITE_MS } from "../util.js";

const PREVIA = 1800; // ms de "prepárate" antes de cada operación
const MAX = 150;
const SIMBOLO = { "+": "+", "-": "−", "*": "×", "/": "÷" };

/** "(((500 + 50) ÷ 2) + 15) ÷ 5": cada paso envuelve lo anterior entre paréntesis. */
function expresion(inicio, ops) {
  let txt = String(inicio);
  ops.forEach(([op, n], k) => {
    txt = `${k ? `(${txt})` : txt} ${SIMBOLO[op]} ${n}`;
  });
  return txt;
}

function cadena(azar, nivel, PASOS) {
  // Si alguna vez no queda más remedio que repetir o anular un paso, se prueba otra cadena.
  let c = null;
  for (let intento = 0; intento < 40; intento++) {
    c = cadenaUnaVez(azar, nivel, PASOS);
    if (c.limpia) break;
  }
  return c;
}

function cadenaUnaVez(azar, nivel, PASOS) {
  let limpia = true;
  let v = azar.entero(2, nivel < 2 ? 12 : 20);
  const inicio = v;
  const ops = [];
  const pasos = [String(v)];
  const vistos = new Set([v]);
  const INVERSA = { "+": "-", "-": "+", "*": "/", "/": "*" };
  for (let k = 1; k < PASOS; k++) {
    const prev = ops.at(-1);
    let opciones = [];
    opciones.push(["+", azar.entero(2, nivel < 2 ? 15 : 30)]);
    if (v > 3) opciones.push(["-", azar.entero(2, Math.min(v - 1, nivel < 2 ? 15 : 40))]);
    const mult = [2, 3, 4, 5].filter((m) => v * m <= MAX);
    if (mult.length && v > 1) opciones.push(["*", azar.elegir(mult)]);
    const divs = [2, 3, 4, 5, 6, 7, 8, 9].filter((d) => v % d === 0 && v / d >= 2);
    if (divs.length && v > 3) opciones.push(["/", azar.elegir(divs)], ["/", azar.elegir(divs)]); // más peso a dividir cuando se puede
    // Nada de pasos que se anulen o se repitan: ni la misma operación dos veces seguidas (+1 y +1),
    // ni deshacer la anterior (× 4 y ÷ 4), ni volver a un número que ya ha salido.
    const calc = ([op, n]) => (op === "+" ? v + n : op === "-" ? v - n : op === "*" ? v * n : v / n);
    const buenas = opciones.filter(([op, n]) => !(prev && (op === prev[0] || (op === INVERSA[prev[0]] && n === prev[1]))) && !vistos.has(calc([op, n])));
    if (buenas.length) opciones = buenas;
    else limpia = false;
    const [op, n] = azar.elegir(opciones);
    v = op === "+" ? v + n : op === "-" ? v - n : op === "*" ? v * n : v / n;
    pasos.push(`${SIMBOLO[op]} ${n}`);
    ops.push([op, n]);
    vistos.add(v);
  }
  return { pasos, expresion: expresion(inicio, ops), r: v, limpia };
}

export default {
  id: "calculo-mental",
  nombre: "Cálculo mental",
  categoria: "numeros",
  duracion: 60,
  tic: 400, // la sala nos refresca a menudo: el reloj de las cadenas es nuestro
  breve: "Resuelve de cabeza la operación con paréntesis.",
  descripcion: "Resuelve de cabeza la operación entera, empezando por los paréntesis de dentro, y escribe el resultado. Un solo intento por operación; gana quien acierte más (y antes).",

  crear({ azar, config, duracion = 75000, inicio = Date.now() }) {
    const d = nivelDificultad(config);
    // Fácil: 3 operaciones y más tiempo para cada una; difícil: 5 y menos tiempo.
    const pasos = [4, 5, 6][d + 1];
    // Sin límite de tiempo: 8 operaciones a su ritmo normal.
    if (duracion >= SIN_LIMITE_MS) duracion = 8 * [25000, 18750, 15000][d + 1];
    const n = Math.max(1, Math.min(8, Math.round(duracion / [25000, 18750, 15000][d + 1])));
    const tramo = duracion / n;
    const cadenas = [];
    for (let k = 0; k < n; k++) {
      const c = cadena(azar, Math.max(0, Math.min(3, k + d)), pasos);
      const t0 = inicio + k * tramo + PREVIA;
      // Sin pasos sueltos: la operación se ve entera y se puede responder desde el primer momento.
      cadenas.push({ ...c, t0, intervalo: 0, finPasos: t0, fin: inicio + (k + 1) * tramo - 1200 }); // y un momento para ver la solución
    }
    return { cadenas, jugadores: {} };
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { respuestas: [] });
  },

  vistaCadenas(ronda) {
    const ahora = Date.now();
    return ronda.cadenas.map((c) => ({
      pasos: c.pasos, expresion: c.expresion, t0: c.t0, intervalo: c.intervalo, finPasos: c.finPasos, fin: c.fin,
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
    // Si ya han respondido todos, no hace falta esperar: se enseña la solución y se adelanta lo que queda.
    const todos = Object.values(ronda.jugadores).every((x) => x.respuestas[msg.c]);
    if (todos && ahora < c.fin - 400) {
      const adelanto = c.fin - (ahora + 200);
      c.fin -= adelanto;
      for (const sig of ronda.cadenas.slice(msg.c + 1)) {
        sig.t0 -= adelanto;
        sig.finPasos -= adelanto;
        sig.fin -= adelanto;
      }
    }
    return true;
  },

  terminado(ronda, id) {
    const r = ronda.jugadores[id]?.respuestas ?? [];
    // También cuando ya han pasado todas las operaciones (se acabó, aunque falte responder alguna).
    return ronda.cadenas.every((_, k) => r[k]) || Date.now() > ronda.cadenas.at(-1).fin + 1500;
  },

  resultados(ronda, ids) {
    return ids.map((id) => {
      const r = (ronda.jugadores[id]?.respuestas ?? []).filter(Boolean);
      if (!r.length) return { id, valor: null, texto: "No respondió" };
      const ok = r.filter((x) => x.ok);
      const ms = ok.reduce((a, x) => a + x.ms, 0);
      const seg = ok.length ? ` · ${(ms / 1000).toFixed(1).replace(".", ",")} s` : "";
      const todas = ronda.jugadores[id]?.respuestas ?? [];
      const detalle = ronda.cadenas.map((c, k) => {
        const x = todas[k];
        return { t: x ? `${k + 1}. ${x.valor}${x.ok ? "" : ` (era ${c.r})`}` : `${k + 1}. —`, k: x?.ok ? "bien" : "mal" };
      });
      return { id, valor: ok.length ? ok.length * 1e6 - ms : null, texto: `${ok.length} de ${ronda.cadenas.length}${seg}`, corto: `${ok.length}/${ronda.cadenas.length}${seg}`, detalle };
    });
  },

  resumen(ronda) {
    return { cadenas: ronda.cadenas.map((c) => ({ pasos: c.pasos, expresion: c.expresion, r: c.r })) };
  },
};
