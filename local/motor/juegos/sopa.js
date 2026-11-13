// SOPA DE LETRAS · el mismo tablero para todos; gana quien encuentre más palabras.
import { nivelDificultad } from "../util.js";
import { elegirDefiniciones } from "../lexico.js";

const DIRECCIONES = [
  [0, 1], [1, 0], [1, 1], [-1, 1], // →  ↓  ↘  ↗
  [0, -1], [-1, 0], [-1, -1], [1, -1], // ←  ↑  ↖  ↙
];
const RELLENO = "aaaaaeeeeeiiiooooouusssrrrnnnddlllcccttmmppbgvyhfzjñq";

function colocar(azar, tam, palabras) {
  const tablero = Array.from({ length: tam }, () => Array(tam).fill(null));
  const puestas = [];
  for (const w of palabras) {
    const c = w.clave;
    let hecha = false;
    for (let intento = 0; intento < 300 && !hecha; intento++) {
      // Al principio, más direcciones "normales" (→ ↓ ↘) para que no sea frustrante.
      const [dr, dc] = azar() < 0.55 ? DIRECCIONES[azar.entero(0, 2)] : azar.elegir(DIRECCIONES);
      const r0 = azar.entero(0, tam - 1), c0 = azar.entero(0, tam - 1);
      const r1 = r0 + dr * (c.length - 1), c1 = c0 + dc * (c.length - 1);
      if (r1 < 0 || r1 >= tam || c1 < 0 || c1 >= tam) continue;
      let cabe = true;
      for (let k = 0; k < c.length && cabe; k++) {
        const x = tablero[r0 + dr * k][c0 + dc * k];
        if (x !== null && x !== c[k]) cabe = false;
      }
      if (!cabe) continue;
      for (let k = 0; k < c.length; k++) tablero[r0 + dr * k][c0 + dc * k] = c[k];
      puestas.push({ clave: c, forma: w.forma, r0, c0, r1, c1 });
      hecha = true;
    }
  }
  for (const fila of tablero) for (let k = 0; k < tam; k++) fila[k] ??= azar.elegir([...RELLENO]);
  return { tablero: tablero.map((f) => f.join("")), puestas };
}

export default {
  id: "sopa",
  nombre: "Sopa de letras",
  categoria: "palabras",
  duracion: 120,
  breve: "Encuentra las palabras escondidas en la sopa.",
  descripcion: "Busca las palabras escondidas en el tablero. Pueden ir en cualquier dirección. Arrastra el dedo de la primera letra a la última.",

  crear({ azar, config }) {
    const d = nivelDificultad(config);
    const tam = [9, 10, 12][d + 1];
    const cuantas = [6, 8, 10][d + 1];
    const candidatas = elegirDefiniciones(azar, cuantas + 8, { largoMin: 4, largoMax: Math.min(tam - 1, 8 + d), nivelMax: d > 0 ? 2 : 1, categorias: ["Sustantivo", "Adjetivo"] })
      .sort((a, b) => b.clave.length - a.clave.length);
    // Evitamos palabras contenidas en otras (p. ej. MAR y MARCO).
    const elegidas = [];
    for (const w of candidatas) {
      if (elegidas.length >= cuantas) break;
      if (elegidas.some((o) => o.clave.includes(w.clave) || w.clave.includes(o.clave))) continue;
      elegidas.push(w);
    }
    const { tablero, puestas } = colocar(azar, tam, elegidas);
    puestas.sort((a, b) => a.clave.localeCompare(b.clave, "es"));
    return { tam, tablero, palabras: puestas, jugadores: {} };
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { encontradas: [] });
  },

  vistaJugador(ronda, id) {
    const j = this.estadoJugador(ronda, id);
    return {
      tablero: ronda.tablero,
      palabras: ronda.palabras.map((p) => p.clave),
      encontradas: j.encontradas,
    };
  },

  vistaTV(ronda) {
    return {
      tablero: ronda.tablero,
      total: ronda.palabras.length,
      jugadores: Object.fromEntries(Object.entries(ronda.jugadores).map(([id, j]) => [id, j.encontradas.length])),
    };
  },

  accion(ronda, id, msg) {
    if (msg.a !== "marcar") return false;
    const j = this.estadoJugador(ronda, id);
    const { r0, c0, r1, c1 } = msg;
    const n = ronda.tam;
    if (![r0, c0, r1, c1].every((x) => Number.isInteger(x) && x >= 0 && x < n)) return false;
    const dr = Math.sign(r1 - r0), dc = Math.sign(c1 - c0);
    const largo = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0)) + 1;
    if (!(r0 === r1 || c0 === c1 || Math.abs(r1 - r0) === Math.abs(c1 - c0))) return false;
    let s = "";
    for (let k = 0; k < largo; k++) s += ronda.tablero[r0 + dr * k][c0 + dc * k];
    const inv = [...s].reverse().join("");
    const k = ronda.palabras.findIndex((p, idx) => (p.clave === s || p.clave === inv) && !j.encontradas.some((e) => e.k === idx));
    if (k < 0) return false;
    j.encontradas.push({ k, r0, c0, r1, c1 });
    return true;
  },

  terminado(ronda, id) {
    return (ronda.jugadores[id]?.encontradas.length ?? 0) >= ronda.palabras.length;
  },

  resultados(ronda, ids) {
    return ids.map((id) => {
      const j = ronda.jugadores[id];
      if (!j) return { id, valor: null, texto: "No jugó" };
      const n = j.encontradas.length;
      const detalle = j.encontradas.map((e) => ({ t: ronda.palabras[e.k].forma, k: "bien" }));
      return { id, valor: n > 0 ? n : null, texto: `${n} de ${ronda.palabras.length} palabras`, detalle };
    });
  },

  resumen(ronda) {
    return { tablero: ronda.tablero, palabras: ronda.palabras };
  },
};
