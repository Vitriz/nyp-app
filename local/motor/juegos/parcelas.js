// PARCELAS · hay que partir la cuadrícula en rectángulos. Cada rectángulo tiene dentro una sola pista,
// que dice su forma (cuadrado, rectángulo alto, rectángulo ancho o cualquiera) y, a veces, su tamaño
// (cuántas casillas ocupa). Cada tablero tiene una sola solución. Gana quien lo complete antes.
import { nivelDificultad } from "../util.js";

const NIVELES = [
  { n: 5, maxArea: 6, conTipo: 0.85, conNumero: 0.55 },
  { n: 6, maxArea: 8, conTipo: 0.7, conNumero: 0.45 },
  { n: 7, maxArea: 9, conTipo: 0.6, conNumero: 0.35 },
];

export const formaDe = (alto, ancho) => (alto === ancho ? "cuadrado" : alto > ancho ? "alto" : "ancho");

/** Parte la cuadrícula en rectángulos al azar: [{ r, c, alto, ancho }]. */
function partir(azar, n, maxArea) {
  const de = new Array(n * n).fill(-1);
  const rects = [];
  for (let k = 0; k < n * n; k++) {
    if (de[k] >= 0) continue;
    const r = Math.floor(k / n), c = k % n;
    let anchoMax = 0;
    while (c + anchoMax < n && de[r * n + c + anchoMax] < 0) anchoMax++;
    // Pocas casillas sueltas (1×1): se descartan casi siempre.
    const opciones = [];
    for (let ancho = 1; ancho <= anchoMax; ancho++)
      for (let alto = 1; r + alto <= n && alto * ancho <= maxArea; alto++) {
        let libre = true;
        for (let y = 0; y < alto && libre; y++) for (let x = 0; x < ancho && libre; x++) if (de[(r + y) * n + c + x] >= 0) libre = false;
        if (!libre) break;
        const area = alto * ancho;
        opciones.push({ alto, ancho, peso: area === 1 ? 0.15 : area <= 2 ? 0.6 : 1 });
      }
    let t = azar() * opciones.reduce((s, o) => s + o.peso, 0);
    const o = opciones.find((x) => (t -= x.peso) <= 0) ?? opciones[opciones.length - 1];
    for (let y = 0; y < o.alto; y++) for (let x = 0; x < o.ancho; x++) de[(r + y) * n + c + x] = rects.length;
    rects.push({ r, c, alto: o.alto, ancho: o.ancho });
  }
  return rects;
}

/** ¿Cumple el rectángulo la pista? */
export function cumple(p, alto, ancho) {
  if (p.numero != null && alto * ancho !== p.numero) return false;
  return p.forma === "cualquiera" || p.forma === formaDe(alto, ancho);
}

/** Soluciones (hasta `limite`): para cada pista, su rectángulo { r, c, alto, ancho }. */
export function resolverParcelas(n, pistas, limite = 2) {
  const pistaEn = new Map(pistas.map((p, i) => [p.k, i]));
  // Rectángulos posibles de cada pista (dentro, sin otras pistas y cumpliendo la suya).
  const porCelda = Array.from({ length: n * n }, () => []);
  pistas.forEach((p, i) => {
    const pr = Math.floor(p.k / n), pc = p.k % n;
    for (let r = 0; r <= pr; r++)
      for (let c = 0; c <= pc; c++)
        for (let alto = pr - r + 1; r + alto <= n; alto++)
          for (let ancho = pc - c + 1; c + ancho <= n; ancho++) {
            if (!cumple(p, alto, ancho)) continue;
            let otra = false;
            const celdas = [];
            for (let y = 0; y < alto && !otra; y++)
              for (let x = 0; x < ancho; x++) {
                const k = (r + y) * n + c + x;
                if (k !== p.k && pistaEn.has(k)) {
                  otra = true;
                  break;
                }
                celdas.push(k);
              }
            if (otra) continue;
            const cand = { i, r, c, alto, ancho, celdas };
            for (const k of celdas) porCelda[k].push(cand);
          }
  });
  const ocupada = new Uint8Array(n * n);
  const usada = new Uint8Array(pistas.length);
  const elegidos = [];
  const sols = [];
  let nodos = 0;
  const paso = (desde) => {
    if (sols.length >= limite || ++nodos > 200000) return;
    let k = desde;
    while (k < n * n && ocupada[k]) k++;
    if (k === n * n) return void sols.push(elegidos.map((x) => ({ i: x.i, r: x.r, c: x.c, alto: x.alto, ancho: x.ancho })));
    for (const cand of porCelda[k]) {
      if (usada[cand.i] || cand.celdas.some((x) => ocupada[x])) continue;
      usada[cand.i] = 1;
      for (const x of cand.celdas) ocupada[x] = 1;
      elegidos.push(cand);
      paso(k + 1);
      elegidos.pop();
      for (const x of cand.celdas) ocupada[x] = 0;
      usada[cand.i] = 0;
      if (sols.length >= limite) return;
    }
  };
  paso(0);
  return nodos > 200000 ? null : sols.map((s) => s.sort((a, b) => a.i - b.i));
}

/** Comprueba lo que ha dibujado el jugador: cuántos rectángulos están bien y si está resuelto. */
export function revisarParcelas(n, pistas, rects) {
  const pistaEn = new Map(pistas.map((p, i) => [p.k, p]));
  const cubierta = new Uint8Array(n * n);
  let bien = 0, solapa = false;
  for (const [r, c, alto, ancho] of rects) {
    const dentro = [];
    for (let y = 0; y < alto; y++)
      for (let x = 0; x < ancho; x++) {
        const k = (r + y) * n + c + x;
        if (cubierta[k]) solapa = true;
        cubierta[k] = 1;
        if (pistaEn.has(k)) dentro.push(pistaEn.get(k));
      }
    if (dentro.length === 1 && cumple(dentro[0], alto, ancho)) bien++;
  }
  return { bien, resuelto: !solapa && bien === pistas.length && rects.length === pistas.length && cubierta.every(Boolean) };
}

export default {
  id: "parcelas",
  nombre: "Parcelas",
  categoria: "numeros",
  duracion: 120,
  sinDiccionario: true,
  breve: "Reparte la cuadrícula en rectángulos según sus pistas.",
  descripcion: "Arrastra el dedo para dibujar rectángulos hasta cubrir toda la cuadrícula. Cada rectángulo tiene que tener dentro una sola pista y cumplirla: su forma (cuadrado, alto, ancho o cualquiera) y, si lleva número, ese es su tamaño en casillas. Gana quien lo complete antes.",

  crear({ azar, config, inicio = Date.now() }) {
    const nv = NIVELES[nivelDificultad(config) + 1];
    const n = nv.n;
    let mejor = null;
    for (let intento = 0; intento < 40; intento++) {
      const rects = partir(azar, n, nv.maxArea);
      // Una pista en una casilla al azar de cada rectángulo; a veces se dice la forma exacta, a veces el tamaño.
      const pistas = rects.map((x) => {
        const k = (x.r + azar.entero(0, x.alto - 1)) * n + x.c + azar.entero(0, x.ancho - 1);
        let forma = azar() < nv.conTipo ? formaDe(x.alto, x.ancho) : "cualquiera";
        let numero = azar() < nv.conNumero ? x.alto * x.ancho : null;
        if (forma === "cualquiera" && numero == null) numero = x.alto * x.ancho;
        return { k, forma, numero, sol: x };
      });
      let unico = false;
      for (let vuelta = 0; vuelta < 30; vuelta++) {
        const sols = resolverParcelas(n, pistas);
        if (sols && sols.length === 1) {
          unico = true;
          break;
        }
        // Otra solución (o demasiadas): se desvela algo más de una pista que se dibuja distinta.
        const otra = sols?.find((s) => s.some((x) => x.alto !== pistas[x.i].sol.alto || x.ancho !== pistas[x.i].sol.ancho || x.r !== pistas[x.i].sol.r || x.c !== pistas[x.i].sol.c));
        const distintas = otra
          ? otra.filter((x) => x.alto !== pistas[x.i].sol.alto || x.ancho !== pistas[x.i].sol.ancho || x.r !== pistas[x.i].sol.r || x.c !== pistas[x.i].sol.c).map((x) => pistas[x.i])
          : pistas;
        const p = azar.barajar(distintas).find((q) => q.numero == null || q.forma === "cualquiera");
        if (!p) break;
        if (p.numero == null) p.numero = p.sol.alto * p.sol.ancho;
        else p.forma = formaDe(p.sol.alto, p.sol.ancho);
      }
      mejor = pistas;
      if (unico) break;
    }
    return {
      n,
      pistas: mejor.map(({ k, forma, numero }) => ({ k, forma, numero })),
      solucion: mejor.map(({ sol }) => [sol.r, sol.c, sol.alto, sol.ancho]),
      inicio,
      jugadores: {},
    };
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { rects: [], ms: null });
  },

  vistaJugador(ronda, id) {
    const j = this.estadoJugador(ronda, id);
    return { n: ronda.n, pistas: ronda.pistas, rects: j.rects, resuelto: j.ms != null };
  },

  vistaTV(ronda) {
    return {
      n: ronda.n,
      pistas: ronda.pistas,
      jugadores: Object.fromEntries(
        Object.entries(ronda.jugadores).map(([id, j]) => [id, { bien: revisarParcelas(ronda.n, ronda.pistas, j.rects).bien, resuelto: j.ms != null }])
      ),
    };
  },

  accion(ronda, id, msg) {
    const n = ronda.n;
    if (msg.a !== "parcelas" || !Array.isArray(msg.p) || msg.p.length > n * n) return false;
    const ok = msg.p.every((x) => Array.isArray(x) && x.length === 4 && x.every(Number.isInteger) && x[0] >= 0 && x[1] >= 0 && x[2] >= 1 && x[3] >= 1 && x[0] + x[2] <= n && x[1] + x[3] <= n);
    if (!ok) return false;
    const j = this.estadoJugador(ronda, id);
    if (j.ms != null) return false;
    j.rects = msg.p.map((x) => x.slice());
    if (revisarParcelas(n, ronda.pistas, j.rects).resuelto) j.ms = Math.max(0, Date.now() - ronda.inicio);
    return true;
  },

  terminado(ronda, id) {
    return ronda.jugadores[id]?.ms != null;
  },

  resultados(ronda, ids) {
    return ids.map((id) => {
      const j = ronda.jugadores[id];
      if (!j || !j.rects.length) return { id, valor: null, texto: "No jugó" };
      if (j.ms != null) {
        const t = `${(j.ms / 1000).toFixed(1).replace(".", ",")} s`;
        return { id, valor: 1e7 - j.ms, texto: `⏱ ${t}`, corto: t };
      }
      const { bien } = revisarParcelas(ronda.n, ronda.pistas, j.rects);
      return { id, valor: bien || null, texto: `${bien} de ${ronda.pistas.length} rectángulos bien`, corto: `${bien}/${ronda.pistas.length}` };
    });
  },

  resumen(ronda) {
    return { n: ronda.n, pistas: ronda.pistas, solucion: ronda.solucion };
  },
};
