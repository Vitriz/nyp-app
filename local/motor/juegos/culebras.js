// CULEBRAS · palabras escondidas en una cuadrícula: cada una serpentea de letra en letra (arriba, abajo,
// izquierda o derecha) y entre todas llenan el tablero, salvo algunos huecos. Solo se sabe cuántas letras
// tiene cada una. Se encuentran arrastrando el dedo de la primera letra a la última.
// Gana quien las encuentre todas antes; si nadie, quien encuentre más.
import { nivelDificultad } from "../util.js";
import { elegirDefiniciones } from "../lexico.js";
import { caminoCompleto } from "./caminos.js";

const NIVELES = [
  { n: 5, min: 3, max: 6, huecos: [1, 1], nivelMax: 1 },
  { n: 6, min: 4, max: 8, huecos: [1, 2], nivelMax: 1 },
  { n: 7, min: 4, max: 9, huecos: [2, 3], nivelMax: 2 },
];

/** Largos de las palabras que suman `total` (entre min y max, a ser posible distintos). */
function repartir(azar, total, min, max) {
  for (let intento = 0; intento < 200; intento++) {
    const largos = [];
    let queda = total;
    while (queda > 0) {
      if (queda >= min && queda <= max && (largos.includes(queda) === false || azar() < 0.3)) {
        largos.push(queda);
        queda = 0;
        break;
      }
      const tope = Math.min(max, queda - min);
      if (tope < min) break;
      const libres = [];
      for (let l = min; l <= tope; l++) if (!largos.includes(l)) libres.push(l);
      const l = libres.length && azar() < 0.85 ? azar.elegir(libres) : azar.entero(min, tope);
      largos.push(l);
      queda -= l;
    }
    if (queda === 0) return largos;
  }
  return null;
}

export default {
  id: "culebras",
  nombre: "Culebras",
  categoria: "palabras",
  duracion: 120,
  breve: "Encuentra las palabras que serpentean por el tablero.",
  descripcion: "El tablero está lleno de palabras escondidas que serpentean de letra en letra (sin diagonales). Solo sabes cuántas letras tiene cada una. Arrastra el dedo de la primera letra a la última; si te equivocas, vuelve atrás por el mismo camino. Gana quien las encuentre todas antes.",

  crear({ azar, config, inicio = Date.now() }) {
    const nv = NIVELES[nivelDificultad(config) + 1];
    const n = nv.n;
    let tablero = null;
    for (let intento = 0; intento < 30 && !tablero; intento++) {
      const camino = caminoCompleto(azar, n, n);
      const nHuecos = azar.entero(nv.huecos[0], nv.huecos[1]);
      const huecos = Array.from({ length: nHuecos }, () => azar.entero(2, 3));
      const largos = repartir(azar, n * n - huecos.reduce((a, b) => a + b, 0), nv.min, nv.max);
      if (!largos) continue;
      // Palabras de cada largo (comunes y sin repetir).
      const usadas = new Set();
      const palabras = [];
      for (const l of largos) {
        const w = elegirDefiniciones(azar, 12, { largoMin: l, largoMax: l, nivelMax: nv.nivelMax, categorias: ["Sustantivo", "Adjetivo"] }).find(
          (d) => !usadas.has(d.clave) && /^[a-zñ]+$/.test(d.clave)
        );
        if (!w) break;
        usadas.add(w.clave);
        palabras.push({ clave: w.clave, forma: w.forma ?? w.clave, definicion: w.definicion ?? "" });
      }
      if (palabras.length !== largos.length) continue;
      // Los trozos (palabras y huecos) en orden al azar a lo largo del camino.
      const trozos = azar.barajar([...palabras.map((p) => ({ p })), ...huecos.map((l) => ({ hueco: l }))]);
      const letras = new Array(n * n).fill("");
      const lista = [];
      let i = 0;
      for (const t of trozos) {
        const largo = t.p ? t.p.clave.length : t.hueco;
        let celdas = camino.slice(i, i + largo);
        i += largo;
        if (!t.p) continue;
        if (azar() < 0.5) celdas = celdas.reverse(); // se lee en un sentido o en el otro
        celdas.forEach((k, j) => (letras[k] = t.p.clave[j]));
        lista.push({ ...t.p, celdas });
      }
      lista.sort((a, b) => a.clave.length - b.clave.length || a.clave.localeCompare(b.clave, "es"));
      tablero = { letras, palabras: lista };
    }
    if (!tablero) throw new Error("no se pudo preparar el tablero");
    return { n, letras: tablero.letras, palabras: tablero.palabras, inicio, jugadores: {} };
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { encontradas: [], ultimo: null, intentos: 0, ms: null });
  },

  vistaJugador(ronda, id) {
    const j = this.estadoJugador(ronda, id);
    return {
      n: ronda.n,
      letras: ronda.letras,
      largos: ronda.palabras.map((p) => p.clave.length),
      encontradas: j.encontradas.map((i) => ({ i, celdas: ronda.palabras[i].celdas, clave: ronda.palabras[i].clave })),
      ultimo: j.ultimo,
      resuelto: j.ms != null,
    };
  },

  vistaTV(ronda) {
    return {
      n: ronda.n,
      letras: ronda.letras,
      total: ronda.palabras.length,
      jugadores: Object.fromEntries(Object.entries(ronda.jugadores).map(([id, j]) => [id, j.encontradas.length])),
    };
  },

  accion(ronda, id, msg) {
    if (msg.a !== "palabra" || !Array.isArray(msg.c) || msg.c.length < 2 || msg.c.length > 20) return false;
    if (!msg.c.every((k) => Number.isInteger(k) && k >= 0 && k < ronda.n * ronda.n)) return false;
    const j = this.estadoJugador(ronda, id);
    if (j.ms != null) return false;
    const texto = msg.c.map((k) => ronda.letras[k]).join("");
    j.intentos++;
    const n = (j.ultimo?.n ?? 0) + 1;
    // Por sus casillas (si es capicúa, también al revés: se lee igual).
    const mismas = (celdas) => celdas.length === msg.c.length && (celdas.every((k, y) => k === msg.c[y]) || celdas.every((k, y) => k === msg.c[msg.c.length - 1 - y]));
    const i = ronda.palabras.findIndex((p, x) => !j.encontradas.includes(x) && p.clave === texto && mismas(p.celdas));
    if (i >= 0) {
      j.encontradas.push(i);
      j.ultimo = { n, res: "bien", clave: texto };
      if (j.encontradas.length === ronda.palabras.length) j.ms = Math.max(0, Date.now() - ronda.inicio);
    } else if (ronda.palabras.some((p, x) => !j.encontradas.includes(x) && p.clave === texto)) {
      j.ultimo = { n, res: "camino", clave: texto }; // la palabra está, pero va por otras casillas
    } else if (ronda.palabras.some((p) => p.clave === texto)) {
      j.ultimo = { n, res: "repetida", clave: texto };
    } else j.ultimo = { n, res: "no", clave: texto };
    return true;
  },

  terminado(ronda, id) {
    return ronda.jugadores[id]?.ms != null;
  },

  resultados(ronda, ids) {
    const total = ronda.palabras.length;
    return ids.map((id) => {
      const j = ronda.jugadores[id];
      if (!j || !j.intentos) return { id, valor: null, texto: "No jugó" };
      const detalle = j.encontradas.map((i) => ronda.palabras[i].forma);
      if (j.ms != null) {
        const t = `${(j.ms / 1000).toFixed(1).replace(".", ",")} s`;
        return { id, valor: 1e7 - j.ms, texto: `⏱ ${t} · las ${total}`, corto: t, detalle };
      }
      const k = j.encontradas.length;
      return { id, valor: k || null, texto: `${k} de ${total} palabras`, corto: `${k}/${total}`, detalle };
    });
  },

  resumen(ronda) {
    return { n: ronda.n, letras: ronda.letras, palabras: ronda.palabras.map((p) => ({ clave: p.clave, forma: p.forma, celdas: p.celdas })) };
  },
};
