// HILO · un solo trazo que pasa por todas las casillas y por los números en orden (1, 2, 3…).
// Puede haber paredes entre casillas, que el hilo no puede cruzar. Cada tablero tiene un único camino.
// Gana quien lo complete antes; si nadie, quien llegue más lejos en los números.
import { nivelDificultad } from "../util.js";
import { vecinasDe, caminoCompleto, claveMuro } from "./caminos.js";

const NIVELES = [
  { n: 5, numeros: 7, muros: 0 },
  { n: 6, numeros: 8, muros: 0.45 },
  { n: 7, numeros: 9, muros: 0.6 },
];

/**
 * Cuántos caminos válidos hay (hasta `limite`). Devuelve { cuenta, caminos } o null si tarda demasiado.
 * numeros: Map casilla -> número; muros: Set de claveMuro.
 */
export function resolverHilo(n, numeros, muros, limite = 2, maxNodos = 300000) {
  const total = n * n;
  const vec = vecinasDe(n, n).map((l, k) => l.filter((x) => !muros.has(claveMuro(k, x))));
  let inicio = -1, fin = -1, ultimo = 0;
  for (const [k, v] of numeros) {
    if (v === 1) inicio = k;
    if (v > ultimo) (ultimo = v), (fin = k);
  }
  const visto = new Uint8Array(total);
  const camino = [inicio];
  const caminos = [];
  let nodos = 0;
  visto[inicio] = 1;
  const pila = new Int32Array(total);

  // ¿Todas las casillas libres se alcanzan desde la cabeza?
  function conectadas(cabeza, libres) {
    const marca = new Uint8Array(total);
    let arriba = 0, cuenta = 0;
    pila[arriba++] = cabeza;
    marca[cabeza] = 1;
    while (arriba) {
      const k = pila[--arriba];
      for (const x of vec[k]) {
        if (marca[x] || visto[x]) continue;
        marca[x] = 1;
        cuenta++;
        pila[arriba++] = x;
      }
    }
    return cuenta === libres;
  }
  // Una casilla libre necesita dos salidas (entrar y salir), salvo el final, que necesita una.
  function salidas(u, cabeza) {
    let s = 0;
    for (const x of vec[u]) if (!visto[x] || x === cabeza) s++;
    return s;
  }

  function paso(k, siguiente) {
    if (caminos.length >= limite || ++nodos > maxNodos) return;
    if (camino.length === total) {
      if (k === fin) caminos.push([...camino]);
      return;
    }
    for (const x of vec[k]) {
      if (visto[x]) continue;
      const num = numeros.get(x);
      if (num != null && num !== siguiente) continue;
      if (x === fin && camino.length + 1 < total) continue;
      visto[x] = 1;
      camino.push(x);
      let bien = true;
      for (const u of vec[k]) {
        if (visto[u]) continue;
        const s = salidas(u, x);
        if (s === 0 || (s === 1 && u !== fin)) {
          bien = false;
          break;
        }
      }
      if (bien && camino.length < total && !conectadas(x, total - camino.length)) bien = false;
      if (bien) paso(x, num != null ? siguiente + 1 : siguiente);
      camino.pop();
      visto[x] = 0;
      if (caminos.length >= limite) return;
    }
  }
  paso(inicio, 2);
  if (nodos > maxNodos) return null;
  return { cuenta: caminos.length, caminos };
}

/** Pone números a las posiciones del camino elegidas (en orden: 1, 2, 3…). */
function numerar(sol, posiciones) {
  const orden = [...posiciones].sort((a, b) => a - b);
  return new Map(orden.map((i, j) => [sol[i], j + 1]));
}

/** ¿Es válido este trazo (aunque esté a medias)? Devuelve el último número alcanzado o -1 si no vale. */
export function revisarTrazo(n, numeros, muros, c) {
  if (!Array.isArray(c) || !c.length) return -1;
  const vistos = new Set();
  let siguiente = 1;
  for (let i = 0; i < c.length; i++) {
    const k = c[i];
    if (!Number.isInteger(k) || k < 0 || k >= n * n || vistos.has(k)) return -1;
    if (i > 0) {
      const p = c[i - 1];
      const ady = (Math.abs(p - k) === 1 && Math.floor(p / n) === Math.floor(k / n)) || Math.abs(p - k) === n;
      if (!ady || muros.has(claveMuro(p, k))) return -1;
    }
    const num = numeros.get(k);
    if (i === 0 && num !== 1) return -1;
    if (num != null) {
      if (num !== siguiente) return -1;
      siguiente++;
    }
    vistos.add(k);
  }
  return siguiente - 1;
}

export default {
  id: "hilo",
  nombre: "Hilo",
  categoria: "numeros",
  duracion: 120,
  sinDiccionario: true,
  breve: "Une los números en orden pasando por todas las casillas.",
  descripcion: "Arrastra el dedo desde el 1 y pasa por los números en orden (1, 2, 3…) hasta rellenar todas las casillas. El hilo no puede cruzar las paredes ni pasar dos veces por la misma casilla. Gana quien lo complete antes.",

  crear({ azar, config, inicio = Date.now() }) {
    const nv = NIVELES[nivelDificultad(config) + 1];
    const n = nv.n, total = n * n;
    let mejor = null;
    for (let intento = 0; intento < 6; intento++) {
      const sol = caminoCompleto(azar, n, n);
      // Números repartidos por el camino (con algo de azar), siempre el principio y el final.
      const pos = new Set([0, total - 1]);
      const tramo = (total - 1) / (nv.numeros - 1);
      for (let j = 1; j < nv.numeros - 1; j++) pos.add(Math.max(1, Math.min(total - 2, Math.round(j * tramo + (azar() - 0.5) * tramo * 0.6))));
      const muros = new Set();
      let unico = false;
      for (let vuelta = 0; vuelta < 40; vuelta++) {
        const numeros = numerar(sol, pos);
        const r = resolverHilo(n, numeros, muros);
        if (r && r.cuenta === 1) {
          unico = true;
          break;
        }
        if (!r) {
          // Demasiados caminos posibles: un número más en el tramo más largo.
          const orden = [...pos].sort((a, b) => a - b);
          let largo = 0, donde = 1;
          for (let j = 1; j < orden.length; j++) if (orden[j] - orden[j - 1] > largo) (largo = orden[j] - orden[j - 1]), (donde = orden[j - 1] + Math.floor(largo / 2));
          pos.add(donde);
          continue;
        }
        // Hay otro camino: donde se separa del bueno, una pared (que el bueno no cruza) o un número.
        const otro = r.caminos.find((c) => c.some((k, i) => k !== sol[i]));
        const i = otro.findIndex((k, j) => k !== sol[j]);
        // (Si esa casilla ya tiene número, el número va donde se metió el otro camino.)
        const alt = pos.has(i) ? sol.indexOf(otro[i]) : i;
        if (azar() < nv.muros || pos.has(alt)) muros.add(claveMuro(otro[i - 1], otro[i]));
        else pos.add(alt);
      }
      const numeros = numerar(sol, pos);
      mejor = { sol, numeros, muros };
      if (unico) break;
    }
    return {
      n,
      solucion: mejor.sol,
      numeros: [...mejor.numeros].map(([k, v]) => [k, v]),
      muros: [...mejor.muros],
      ultimo: mejor.numeros.size,
      inicio,
      jugadores: {},
    };
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { camino: [], llegado: 0, ms: null });
  },

  vistaJugador(ronda, id) {
    const j = this.estadoJugador(ronda, id);
    return { n: ronda.n, numeros: ronda.numeros, muros: ronda.muros, camino: j.camino, resuelto: j.ms != null };
  },

  vistaTV(ronda) {
    return {
      n: ronda.n,
      numeros: ronda.numeros,
      muros: ronda.muros,
      jugadores: Object.fromEntries(Object.entries(ronda.jugadores).map(([id, j]) => [id, { casillas: j.camino.length, resuelto: j.ms != null }])),
    };
  },

  accion(ronda, id, msg) {
    if (msg.a !== "camino" || !Array.isArray(msg.c) || msg.c.length > ronda.n * ronda.n) return false;
    const j = this.estadoJugador(ronda, id);
    if (j.ms != null) return false;
    const numeros = new Map(ronda.numeros);
    const llegado = msg.c.length ? revisarTrazo(ronda.n, numeros, new Set(ronda.muros), msg.c) : 0;
    if (llegado < 0) return false;
    j.camino = msg.c.slice();
    j.llegado = Math.max(j.llegado, llegado);
    if (j.camino.length === ronda.n * ronda.n && llegado === ronda.ultimo) j.ms = Math.max(0, Date.now() - ronda.inicio);
    return true;
  },

  terminado(ronda, id) {
    return ronda.jugadores[id]?.ms != null;
  },

  resultados(ronda, ids) {
    const total = ronda.n * ronda.n;
    return ids.map((id) => {
      const j = ronda.jugadores[id];
      if (!j || j.camino.length < 2) return { id, valor: null, texto: "No jugó" };
      if (j.ms != null) {
        const t = `${(j.ms / 1000).toFixed(1).replace(".", ",")} s`;
        return { id, valor: 1e7 - j.ms, texto: `⏱ ${t}`, corto: t };
      }
      const llegado = Math.max(1, revisarTrazo(ronda.n, new Map(ronda.numeros), new Set(ronda.muros), j.camino));
      return { id, valor: llegado * 1000 + j.camino.length, texto: `Hasta el ${llegado} de ${ronda.ultimo} · ${j.camino.length} de ${total} casillas`, corto: `${llegado}/${ronda.ultimo}` };
    });
  },

  resumen(ronda) {
    return { n: ronda.n, numeros: ronda.numeros, muros: ronda.muros, solucion: ronda.solucion };
  },
};
