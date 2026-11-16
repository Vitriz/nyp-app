// SOPA DE LETRAS · el mismo tablero para todos; gana quien encuentre más palabras.
import { nivelDificultad, reglasSolo, quedan, restan } from "../util.js";
import { elegirDefiniciones } from "../lexico.js";
import { AMBITOS, palabrasDeTema } from "./crucigrama.js";

const DIRECCIONES = [
  [0, 1], [1, 0], [1, 1], [-1, 1], // →  ↓  ↘  ↗
  [0, -1], [-1, 0], [-1, -1], [1, -1], // ←  ↑  ↖  ↙
];
const RELLENO = "aaaaaeeeeeiiiooooouusssrrrnnnddlllcccttmmppbgvyhfzjñq";

// Direcciones por nivel: fácil solo → ↓ ↘; medio y difícil, también al revés (← ↑) y en diagonal hacia arriba.
const DIR_NIVEL = [DIRECCIONES.slice(0, 3), DIRECCIONES, DIRECCIONES];
const NORMALES = [1, 0.45, 0.25]; // cuántas van «al derecho» (→ ↓ ↘) en cada nivel

// Cuántas palabras pueden ir en la misma dirección (mismo sentido y orientación), según el nivel:
// fácil, algo más de la mitad; medio, la mitad como mucho; difícil, bien repartidas (nunca la mitad).
const MAX_MISMA = [(n) => Math.ceil(n * 0.67), (n) => Math.floor(n / 2), (n) => Math.min(3, Math.ceil(n / 2) - 1)];

function colocar(azar, tam, palabras, d = 0) {
  // Primero con las dos reglas (tope por dirección y nada pegado en el mismo eje), probando el tablero
  // entero varias veces; si no sale, solo con el tope por dirección; y, como último recurso, sin reglas.
  for (const reglas of [2, 1]) {
    for (let vez = 0; vez < 40; vez++) {
      const t = colocarUna(azar, tam, palabras, d, reglas);
      if (t) return t;
    }
  }
  return colocarUna(azar, tam, palabras, d, 0);
}

function colocarUna(azar, tam, palabras, d, reglas) {
  const estricto = reglas > 0;
  const tablero = Array.from({ length: tam }, () => Array(tam).fill(null));
  const puestas = [];
  const porDir = new Map(); // "dr,dc" -> cuántas van así
  const celdasEje = new Map(); // eje (horizontal, vertical o cada diagonal, en los dos sentidos) -> casillas
  const eje = (dr, dc) => (dr < 0 || (dr === 0 && dc < 0) ? `${-dr},${-dc}` : `${dr},${dc}`);
  const maximo = Math.max(1, MAX_MISMA[d + 1](palabras.length));
  for (const w of palabras) {
    const c = w.clave;
    // Todas las posiciones donde cabe (con las reglas, si toca) y se elige una al azar.
    const sitios = [];
    for (const [dr, dc] of DIR_NIVEL[d + 1]) {
      if (estricto && (porDir.get(`${dr},${dc}`) ?? 0) >= maximo) continue;
      const mismas = reglas > 1 ? celdasEje.get(eje(dr, dc)) : null;
      for (let r0 = 0; r0 < tam; r0++)
        for (let c0 = 0; c0 < tam; c0++) {
          const r1 = r0 + dr * (c.length - 1), c1 = c0 + dc * (c.length - 1);
          if (r1 < 0 || r1 >= tam || c1 < 0 || c1 >= tam) continue;
          let vale = true;
          for (let k = 0; k < c.length && vale; k++) {
            const r = r0 + dr * k, cc = c0 + dc * k;
            const x = tablero[r][cc];
            if (x !== null && x !== c[k]) vale = false;
            // Nada de palabras en el mismo eje pegadas una a la otra (en filas seguidas se ven enseguida).
            if (mismas) for (let i = -1; i <= 1 && vale; i++) for (let j = -1; j <= 1 && vale; j++) if (mismas.has(`${r + i},${cc + j}`)) vale = false;
          }
          if (vale) sitios.push([dr, dc, r0, c0, r1, c1]);
        }
    }
    if (!sitios.length) {
      if (estricto) return null; // no cabe con las reglas: se vuelve a empezar el tablero
      continue;
    }
    // Al derecho (→ ↓ ↘) con la proporción de cada nivel; si no, cualquier dirección (repartidas por igual).
    const normales = sitios.filter(([dr, dc]) => DIRECCIONES.findIndex((x) => x[0] === dr && x[1] === dc) < 3);
    let grupo = normales.length && azar() < NORMALES[d + 1] ? normales : sitios;
    const dirs = [...new Set(grupo.map(([dr, dc]) => `${dr},${dc}`))];
    const dir = azar.elegir(dirs);
    grupo = grupo.filter(([dr, dc]) => `${dr},${dc}` === dir);
    const [dr, dc, r0, c0, r1, c1] = azar.elegir(grupo);
    for (let k = 0; k < c.length; k++) tablero[r0 + dr * k][c0 + dc * k] = c[k];
    porDir.set(`${dr},${dc}`, (porDir.get(`${dr},${dc}`) ?? 0) + 1);
    const e = eje(dr, dc);
    if (!celdasEje.has(e)) celdasEje.set(e, new Set());
    for (let k = 0; k < c.length; k++) celdasEje.get(e).add(`${r0 + dr * k},${c0 + dc * k}`);
    puestas.push({ clave: c, forma: w.forma, definicion: w.definicion, r0, c0, r1, c1 });
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
  descripcion: "Busca las palabras escondidas en el tablero y arrastra el dedo de la primera letra a la última. En fácil van → ↓ ↘; en medio y difícil, en cualquier dirección. En difícil solo ves sus definiciones. Si dos las encuentran todas, gana el más rápido.",
  ambitos: AMBITOS,
  ambitoDefecto: "todos",

  crear({ azar, config, inicio = Date.now() }) {
    const d = nivelDificultad(config);
    const tam = [9, 10, 12][d + 1];
    const cuantas = [6, 8, 10][d + 1];
    const largoMax = Math.min(tam - 1, 8 + d);
    let candidatas = null;
    let ambito = "todos";
    // Sopa temática: palabras del tema elegido (si hay bastantes).
    if (config?.ambito && config.ambito !== "todos") {
      const t = palabrasDeTema(azar, config.ambito);
      ambito = t.ambito;
      // Del tema, mejor palabras conocidas (en difícil solo se ven las definiciones: ya es bastante reto).
      const aptas = t.lista.filter((x) => x.clave.length >= 4 && x.clave.length <= largoMax && x.palabras <= 16);
      const conocidas = aptas.filter((x) => x.nivel <= (d < 0 ? 1 : 2));
      const usar = conocidas.length >= cuantas + 4 ? conocidas : aptas;
      if (usar.length >= cuantas + 4) candidatas = azar.barajar(usar).slice(0, cuantas + 8);
    }
    candidatas = (candidatas ?? elegirDefiniciones(azar, cuantas + 8, { largoMin: 4, largoMax, nivelMax: d > 0 ? 2 : 1, categorias: ["Sustantivo", "Adjetivo"] }))
      .sort((a, b) => b.clave.length - a.clave.length);
    // Evitamos palabras contenidas en otras (p. ej. MAR y MARCO).
    const elegidas = [];
    for (const w of candidatas) {
      if (elegidas.length >= cuantas) break;
      if (elegidas.some((o) => o.clave.includes(w.clave) || w.clave.includes(o.clave))) continue;
      elegidas.push(w);
    }
    const { tablero, puestas } = colocar(azar, tam, elegidas, d);
    puestas.sort((a, b) => a.clave.localeCompare(b.clave, "es"));
    return { tam, tablero, palabras: puestas, inicio, ambito, soloDefiniciones: d > 0, reglas: reglasSolo("sopa", config), jugadores: {} };
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { encontradas: [], fallos: 0, pistas: [] });
  },

  vistaJugador(ronda, id) {
    const j = this.estadoJugador(ronda, id);
    return {
      tablero: ronda.tablero,
      palabras: ronda.palabras.map((p) => p.clave),
      // En difícil, en vez de la lista de palabras se enseñan sus definiciones.
      definiciones: ronda.soloDefiniciones ? ronda.palabras.map((p) => p.definicion ?? "") : null,
      ambito: ronda.ambito,
      encontradas: j.encontradas,
      // Pistas pedidas: la primera letra de esas palabras ({ k, r, c }).
      pistas: j.pistas ?? [],
      quedanPistas: restan(ronda.reglas?.pistas, (j.pistas ?? []).length),
      quedanFallos: restan(ronda.reglas?.fallos, j.fallos ?? 0),
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
    const j = this.estadoJugador(ronda, id);
    if (msg.a === "fallo") {
      // Una línea que no es ninguna palabra (solo cuenta si hay límite de fallos).
      if (ronda.reglas?.fallos == null) return false;
      j.fallos = (j.fallos ?? 0) + 1;
      return true;
    }
    if (msg.a === "pista") {
      j.pistas ??= [];
      if (!quedan(ronda.reglas?.pistas, j.pistas.length) || ronda.reglas?.pistas == null) return false;
      const faltan = ronda.palabras.map((p, k) => k).filter((k) => !j.encontradas.some((e) => e.k === k) && !j.pistas.some((x) => x.k === k));
      if (!faltan.length) return false;
      const k = faltan[Math.floor(Math.random() * faltan.length)];
      j.pistas.push({ k, r: ronda.palabras[k].r0, c: ronda.palabras[k].c0 });
      return true;
    }
    if (msg.a !== "marcar") return false;
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
    if (j.encontradas.length === ronda.palabras.length) j.ms = Math.max(0, Date.now() - (ronda.inicio ?? Date.now()));
    return true;
  },

  terminado(ronda, id) {
    const j = ronda.jugadores[id];
    return (j?.encontradas.length ?? 0) >= ronda.palabras.length || !quedan(ronda.reglas?.fallos, j?.fallos ?? 0);
  },

  /** Arriba: las palabras encontradas de las que hay, y los fallos que quedan. */
  marcador(ronda, id) {
    const j = this.estadoJugador(ronda, id);
    return { texto: `${j.encontradas.length} / ${ronda.palabras.length}`, vidas: restan(ronda.reglas?.fallos, j.fallos ?? 0), vidasMax: ronda.reglas?.fallos ?? null };
  },

  resultados(ronda, ids) {
    return ids.map((id) => {
      const j = ronda.jugadores[id];
      if (!j) return { id, valor: null, texto: "No jugó" };
      const n = j.encontradas.length;
      const detalle = j.encontradas.map((e) => ({ t: ronda.palabras[e.k].forma, k: "bien" }));
      if (j.ms != null) {
        // Todas: desempata el tiempo (decimales del valor).
        const t = `${Math.floor(j.ms / 60000)}:${String(Math.round((j.ms % 60000) / 1000)).padStart(2, "0")}`;
        return { id, valor: n + 0.99 * (1 - Math.min(j.ms, 3.6e6) / 3.6e6), texto: `¡Todas! en ${t}`, corto: `Todas · ${t}`, detalle };
      }
      return { id, valor: n > 0 ? n : null, texto: `${n} de ${ronda.palabras.length} palabras`, corto: `${n}/${ronda.palabras.length} palabras`, detalle };
    });
  },

  resumen(ronda) {
    return { tablero: ronda.tablero, palabras: ronda.palabras };
  },
};
