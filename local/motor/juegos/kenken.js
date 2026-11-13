// KENKEN (Mathdoku) · cuadrícula N×N: en cada fila y columna van los números del 1 al N sin repetir.
// La cuadrícula está partida en "jaulas" con un número y una operación (+ − × ÷): los números de la
// jaula, con esa operación, tienen que dar ese resultado. Vale cualquier solución que cumpla las reglas.
// Todos reciben el mismo puzle; gana quien lo resuelva antes (si nadie, quien tenga más jaulas bien).
import { nivelDificultad } from "../util.js";

const NIVELES = [
  { n: 4, maxJaula: 3 },
  { n: 5, maxJaula: 4 },
  { n: 6, maxJaula: 4 },
];

/** Cuadrado latino al azar: filas desplazadas y luego filas, columnas y símbolos barajados. */
function cuadradoLatino(azar, n) {
  const base = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => ((r + c) % n) + 1));
  const filas = azar.barajar(base);
  const orden = azar.barajar([...Array(n).keys()]);
  const simbolo = azar.barajar([...Array(n).keys()].map((x) => x + 1));
  return filas.map((f) => orden.map((c) => simbolo[f[c] - 1]));
}

/** Parte la cuadrícula en jaulas de celdas vecinas (crecen al azar, de 1 a maxJaula celdas). */
function jaulas(azar, n, maxJaula) {
  const de = new Array(n * n).fill(-1);
  const lista = [];
  for (const inicio of azar.barajar([...Array(n * n).keys()])) {
    if (de[inicio] >= 0) continue;
    // Pocas jaulas de una sola celda (son pistas regaladas).
    const objetivo = azar() < 0.12 ? 1 : azar.entero(2, maxJaula);
    const celdas = [inicio];
    de[inicio] = lista.length;
    while (celdas.length < objetivo) {
      const vecinas = [];
      for (const k of celdas) {
        const r = Math.floor(k / n), c = k % n;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && cc >= 0 && rr < n && cc < n && de[rr * n + cc] < 0) vecinas.push(rr * n + cc);
        }
      }
      if (!vecinas.length) break;
      const k = azar.elegir(vecinas);
      de[k] = lista.length;
      celdas.push(k);
    }
    lista.push(celdas);
  }
  return { de, lista };
}

/** Operación y resultado de cada jaula, a partir de los números de la solución. */
function operacion(azar, valores) {
  if (valores.length === 1) return { op: "", objetivo: valores[0] };
  if (valores.length === 2) {
    const [a, b] = [Math.max(...valores), Math.min(...valores)];
    if (a % b === 0 && a !== b && azar() < 0.75) return { op: "÷", objetivo: a / b };
    const op = azar.elegir(["−", "−", "+", "×"]);
    return { op, objetivo: op === "−" ? a - b : op === "+" ? a + b : a * b };
  }
  const op = azar() < 0.5 ? "+" : "×";
  return { op, objetivo: op === "+" ? valores.reduce((x, y) => x + y, 0) : valores.reduce((x, y) => x * y, 1) };
}

/** ¿Cumple la jaula? (con todas sus celdas llenas) */
export function jaulaBien(j, valores) {
  const v = j.celdas.map((k) => valores[k]);
  if (v.some((x) => !x)) return false;
  if (!j.op) return v[0] === j.objetivo;
  if (j.op === "+") return v.reduce((a, b) => a + b, 0) === j.objetivo;
  if (j.op === "×") return v.reduce((a, b) => a * b, 1) === j.objetivo;
  const [a, b] = [Math.max(...v), Math.min(...v)];
  return j.op === "−" ? a - b === j.objetivo : b !== 0 && a / b === j.objetivo;
}

/** ¿Resuelto? Sin repetidos en filas ni columnas y todas las jaulas bien. */
export function resuelto(n, jaulasLista, valores) {
  if (valores.length !== n * n || valores.some((x) => !(x >= 1 && x <= n))) return false;
  for (let i = 0; i < n; i++) {
    const fila = new Set(), col = new Set();
    for (let j = 0; j < n; j++) {
      fila.add(valores[i * n + j]);
      col.add(valores[j * n + i]);
    }
    if (fila.size !== n || col.size !== n) return false;
  }
  return jaulasLista.every((j) => jaulaBien(j, valores));
}

export default {
  id: "kenken",
  nombre: "KenKen",
  categoria: "numeros",
  duracion: 120,
  breve: "Rellena la cuadrícula: cada jaula da su cuenta.",
  descripcion: "En cada fila y columna van los números del 1 al N sin repetir. Los números de cada jaula, con su operación, tienen que dar el número que marca. Gana quien lo resuelva antes.",

  crear({ azar, config, inicio = Date.now() }) {
    const { n, maxJaula } = NIVELES[nivelDificultad(config) + 1];
    const sol = cuadradoLatino(azar, n).flat();
    const { de, lista } = jaulas(azar, n, maxJaula);
    const js = lista.map((celdas) => ({ celdas, ...operacion(azar, celdas.map((k) => sol[k])) }));
    return { n, solucion: sol, jaulas: js, de, inicio, jugadores: {} };
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { valores: new Array(ronda.n * ronda.n).fill(0), ms: null });
  },

  vistaJugador(ronda, id) {
    const j = this.estadoJugador(ronda, id);
    return { n: ronda.n, jaulas: ronda.jaulas, de: ronda.de, valores: j.valores, resuelto: j.ms != null };
  },

  vistaTV(ronda) {
    return {
      n: ronda.n,
      jaulas: ronda.jaulas,
      de: ronda.de,
      jugadores: Object.fromEntries(
        Object.entries(ronda.jugadores).map(([id, j]) => [id, { llenas: j.valores.filter(Boolean).length, resuelto: j.ms != null }])
      ),
    };
  },

  accion(ronda, id, msg) {
    if (msg.a !== "valores" || !Array.isArray(msg.v) || msg.v.length !== ronda.n * ronda.n) return false;
    const j = this.estadoJugador(ronda, id);
    if (j.ms != null) return false;
    j.valores = msg.v.map((x) => (Number.isInteger(x) && x >= 1 && x <= ronda.n ? x : 0));
    if (resuelto(ronda.n, ronda.jaulas, j.valores)) j.ms = Math.max(0, Date.now() - ronda.inicio);
    return true;
  },

  terminado(ronda, id) {
    return ronda.jugadores[id]?.ms != null;
  },

  resultados(ronda, ids) {
    return ids.map((id) => {
      const j = ronda.jugadores[id];
      if (!j || !j.valores.some(Boolean)) return { id, valor: null, texto: "No jugó" };
      if (j.ms != null) {
        const t = `${(j.ms / 1000).toFixed(1).replace(".", ",")} s`;
        return { id, valor: 1e7 - j.ms, texto: `⏱ ${t}`, corto: t };
      }
      const bien = ronda.jaulas.filter((x) => jaulaBien(x, j.valores)).length;
      return { id, valor: bien || null, texto: `${bien} de ${ronda.jaulas.length} jaulas`, corto: `${bien}/${ronda.jaulas.length} jaulas` };
    });
  },

  resumen(ronda) {
    return { n: ronda.n, jaulas: ronda.jaulas, de: ronda.de, solucion: ronda.solucion };
  },
};
