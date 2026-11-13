// CORONAS · cuadrícula N×N partida en N zonas de colores. Hay que poner N coronas: una en cada fila,
// una en cada columna y una en cada zona, y dos coronas nunca pueden tocarse (ni en diagonal).
// Cada tablero tiene una sola solución. Gana quien lo resuelva antes; si nadie, quien tenga más coronas bien.
import { nivelDificultad } from "../util.js";

const TAMANOS = [6, 7, 8];

/** Una corona por fila y columna, sin tocarse: columna de cada fila. */
function colocarCoronas(azar, n) {
  const col = [];
  const usadas = new Set();
  const paso = (r) => {
    if (r === n) return true;
    for (const c of azar.barajar([...Array(n).keys()])) {
      if (usadas.has(c) || (r > 0 && Math.abs(c - col[r - 1]) < 2)) continue;
      col[r] = c;
      usadas.add(c);
      if (paso(r + 1)) return true;
      usadas.delete(c);
    }
    return false;
  };
  paso(0);
  return col;
}

/** Zonas que crecen al azar desde cada corona hasta cubrir toda la cuadrícula. */
function crecerZonas(azar, n, col) {
  const zona = new Array(n * n).fill(-1);
  col.forEach((c, r) => (zona[r * n + c] = r));
  // Cada zona crece con su propio ritmo: así salen zonas grandes y pequeñas.
  const ritmo = col.map(() => 0.3 + azar() * 1.7);
  let libres = n * n - n;
  while (libres > 0) {
    const z = elegirPeso(azar, ritmo);
    const borde = [];
    for (let k = 0; k < n * n; k++) {
      if (zona[k] !== z) continue;
      for (const x of vecinas(n, k)) if (zona[x] < 0) borde.push(x);
    }
    if (!borde.length) {
      ritmo[z] = 0.0001; // ya no puede crecer
      if (ritmo.every((x) => x <= 0.0001)) break;
      continue;
    }
    zona[azar.elegir(borde)] = z;
    libres--;
  }
  return zona;
}

function elegirPeso(azar, pesos) {
  let t = azar() * pesos.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pesos.length; i++) if ((t -= pesos[i]) <= 0) return i;
  return pesos.length - 1;
}

function vecinas(n, k) {
  const r = Math.floor(k / n), c = k % n;
  const l = [];
  if (r > 0) l.push(k - n);
  if (r < n - 1) l.push(k + n);
  if (c > 0) l.push(k - 1);
  if (c < n - 1) l.push(k + 1);
  return l;
}

/** Soluciones del tablero (hasta `limite`): columna de la corona de cada fila. */
export function resolverCoronas(n, zona, limite = 2) {
  const sols = [];
  const col = [];
  const usadasC = new Set(), usadasZ = new Set();
  const paso = (r) => {
    if (sols.length >= limite) return;
    if (r === n) return void sols.push([...col]);
    for (let c = 0; c < n; c++) {
      const z = zona[r * n + c];
      if (usadasC.has(c) || usadasZ.has(z) || (r > 0 && Math.abs(c - col[r - 1]) < 2)) continue;
      col[r] = c;
      usadasC.add(c);
      usadasZ.add(z);
      paso(r + 1);
      usadasC.delete(c);
      usadasZ.delete(z);
    }
  };
  paso(0);
  return sols;
}

/** ¿Sigue unida la zona z si le quitamos la casilla k? */
function sigueUnida(n, zona, z, k) {
  const celdas = [];
  for (let i = 0; i < n * n; i++) if (zona[i] === z && i !== k) celdas.push(i);
  if (!celdas.length) return false;
  const visto = new Set([celdas[0]]);
  const pila = [celdas[0]];
  while (pila.length) {
    const x = pila.pop();
    for (const y of vecinas(n, x)) if (y !== k && zona[y] === z && !visto.has(y)) visto.add(y), pila.push(y);
  }
  return visto.size === celdas.length;
}

/** Coronas puestas que chocan (misma fila, columna o zona, o se tocan). */
export function choques(n, zona, coronas) {
  const malas = new Set();
  for (let i = 0; i < coronas.length; i++)
    for (let j = i + 1; j < coronas.length; j++) {
      const a = coronas[i], b = coronas[j];
      const ra = Math.floor(a / n), ca = a % n, rb = Math.floor(b / n), cb = b % n;
      if (ra === rb || ca === cb || zona[a] === zona[b] || (Math.abs(ra - rb) < 2 && Math.abs(ca - cb) < 2)) malas.add(a).add(b);
    }
  return malas;
}

export default {
  id: "coronas",
  nombre: "Coronas",
  categoria: "numeros",
  duracion: 120,
  sinDiccionario: true,
  breve: "Una corona en cada fila, columna y zona de color.",
  descripcion: "Pon una corona en cada fila, en cada columna y en cada zona de color. Dos coronas nunca pueden tocarse, ni siquiera en diagonal. Toca una vez para marcar ✕ (aquí no va) y dos para poner la corona. Gana quien lo resuelva antes.",

  crear({ azar, config, inicio = Date.now() }) {
    const n = TAMANOS[nivelDificultad(config) + 1];
    let mejor = null;
    for (let intento = 0; intento < 120; intento++) {
      const col = colocarCoronas(azar, n);
      const zona = crecerZonas(azar, n, col);
      const buena = new Set(col.map((c, r) => r * n + c));
      let unico = false;
      // Mientras haya otra solución, una casilla de esa otra solución se pasa a una zona vecina.
      for (let vuelta = 0; vuelta < 400; vuelta++) {
        const sols = resolverCoronas(n, zona);
        if (sols.length === 1) {
          unico = true;
          break;
        }
        const otra = sols.find((s) => s.some((c, r) => c !== col[r]));
        if (!otra) break;
        let movida = false;
        for (const k of azar.barajar(otra.map((c, r) => r * n + c).filter((k) => !buena.has(k)))) {
          const z = zona[k];
          const destinos = azar.barajar([...new Set(vecinas(n, k).map((x) => zona[x]).filter((x) => x !== z))]);
          if (!destinos.length || !sigueUnida(n, zona, z, k)) continue;
          zona[k] = destinos[0];
          movida = true;
          break;
        }
        if (!movida) break;
      }
      mejor = { col, zona };
      if (unico) break;
    }
    return { n, zona: mejor.zona, solucion: mejor.col.map((c, r) => r * n + c), inicio, jugadores: {} };
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { marcas: new Array(ronda.n * ronda.n).fill(0), ms: null });
  },

  vistaJugador(ronda, id) {
    const j = this.estadoJugador(ronda, id);
    return { n: ronda.n, zona: ronda.zona, marcas: j.marcas, resuelto: j.ms != null };
  },

  vistaTV(ronda) {
    return {
      n: ronda.n,
      zona: ronda.zona,
      jugadores: Object.fromEntries(Object.entries(ronda.jugadores).map(([id, j]) => [id, { coronas: j.marcas.filter((x) => x === 2).length, resuelto: j.ms != null }])),
    };
  },

  accion(ronda, id, msg) {
    const n = ronda.n;
    if (msg.a !== "marcas" || !Array.isArray(msg.m) || msg.m.length !== n * n) return false;
    const j = this.estadoJugador(ronda, id);
    if (j.ms != null) return false;
    j.marcas = msg.m.map((x) => (x === 1 || x === 2 ? x : 0));
    const coronas = j.marcas.flatMap((x, k) => (x === 2 ? [k] : []));
    if (coronas.length === n && choques(n, ronda.zona, coronas).size === 0) j.ms = Math.max(0, Date.now() - ronda.inicio);
    return true;
  },

  terminado(ronda, id) {
    return ronda.jugadores[id]?.ms != null;
  },

  resultados(ronda, ids) {
    const sol = new Set(ronda.solucion);
    return ids.map((id) => {
      const j = ronda.jugadores[id];
      if (!j || !j.marcas.some(Boolean)) return { id, valor: null, texto: "No jugó" };
      if (j.ms != null) {
        const t = `${(j.ms / 1000).toFixed(1).replace(".", ",")} s`;
        return { id, valor: 1e7 - j.ms, texto: `⏱ ${t}`, corto: t };
      }
      const bien = j.marcas.filter((x, k) => x === 2 && sol.has(k)).length;
      return { id, valor: bien || null, texto: `${bien} de ${ronda.n} coronas bien`, corto: `${bien}/${ronda.n} 👑` };
    });
  },

  resumen(ronda) {
    return { n: ronda.n, zona: ronda.zona, solucion: ronda.solucion };
  },
};
