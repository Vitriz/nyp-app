// MEMORIA FOTOGRÁFICA · se enseñan unas tarjetas unos segundos, se tapan y llega la pregunta.
// Tres tipos de prueba (se van alternando):
//  - orden:    números; hay que tocar las tarjetas tapadas de menor a mayor.
//  - pregunta: palabras; "¿dónde estaba la que significa…?" o "¿dónde estaba GATO?".
//  - cambio:   palabras; se vuelven a enseñar y una ha cambiado por otra parecida: ¿cuál?
// Todos reciben la misma serie. Gana quien acierte más (si empatan, quien respondió más rápido).
import { cargarDefiniciones } from "../lexico.js";
import { nivelDificultad } from "../util.js";

// Fácil: empieza con 4 tarjetas en 2 × 2. Medio: 6 en 3 × 2. Difícil: 6 en un 3 × 3 con huecos y menos tiempo.
// Cada 4 pruebas sale una tarjeta más (hasta el máximo del nivel), y un poco más de tiempo para mirarlas.
const NIVELES = [
  { tarjetas: 4, max: 6, ver: 5000, rejilla: 4 },
  { tarjetas: 6, max: 8, ver: 5500, rejilla: 6 },
  { tarjetas: 6, max: 10, ver: 4500, rejilla: 9 },
];
const CADA = 4; // pruebas por cada tarjeta de más
/** La rejilla más pequeña de las de siempre (2 × 2, 3 × 2, 3 × 3, 4 × 3) donde caben n tarjetas, nunca menor que la del nivel. */
const rejillaPara = (n, minimo) => [4, 6, 9, 12].find((r) => r >= n && r >= minimo) ?? 12;
const NOMBRES = { orden: "Orden", pregunta: "Pregunta", cambio: "Cambio", paridad: "Pares/impares", colores: "Colores", vacia: "Huecos" };
// Colores de la prueba «¿dónde estaba el ROJO?».
export const COLORES_MEM = { rojo: "#e5484d", azul: "#3b82f6", verde: "#30a46c", amarillo: "#f5d90a", naranja: "#f76b15", morado: "#8e4ec6", rosa: "#e93d82", marrón: "#8d5a3b", gris: "#8b8d98", negro: "#1c1c1f", blanco: "#ffffff", celeste: "#7dd3fc" };
const TOTAL = 40;

/** Palabras parecidas: misma longitud y solo una letra distinta (CASA → CAZA), entre las comunes. */
function parecidas(defs) {
  const por = new Map();
  for (const d of defs) {
    for (let i = 0; i < d.clave.length; i++) {
      const k = d.clave.slice(0, i) + "_" + d.clave.slice(i + 1);
      por.set(k, [...(por.get(k) ?? []), d]);
    }
  }
  return (d) => {
    const res = [];
    for (let i = 0; i < d.clave.length; i++) for (const x of por.get(d.clave.slice(0, i) + "_" + d.clave.slice(i + 1)) ?? []) if (x.clave !== d.clave) res.push(x);
    return res;
  };
}

/** En qué orden hay que tocarlas (índices de las tarjetas). */
export function ordenBueno(p) {
  const l = p.textos.map((t, k) => [Number(t), k]).sort((a, b) => a[0] - b[0]);
  if (p.sentido === "baja") l.reverse();
  return l.map((x) => x[1]);
}
/** Las tarjetas que hay que tocar en «pares/impares». */
export function buscadas(p) {
  return p.textos.map((t, k) => [Number(t), k]).filter(([v]) => (v % 2 === 0) === p.par).map((x) => x[1]);
}

export default {
  id: "memoria",
  nombre: "Memoria fotográfica",
  categoria: "palabras",
  duracion: 90,
  breve: "Mira las tarjetas, se tapan… ¿te acuerdas?",
  descripcion: "Se enseñan unas tarjetas unos segundos y se tapan. Luego: tócalas en orden, toca los pares o impares, di dónde estaba una palabra o un color, dónde había un hueco o cuál ha cambiado. Cada 4 pruebas, una tarjeta más. Gana quien acierte más.",

  crear({ azar, config }) {
    const nivel = NIVELES[nivelDificultad(config) + 1];
    const defs = cargarDefiniciones().filter((d) => d.nivel <= 1 && d.clave.length >= 3 && d.clave.length <= 7 && d.palabras <= 9);
    // Parejas parecidas (CASA/CAZA), entre palabras comunes.
    const similares = parecidas(cargarDefiniciones().filter((d) => d.nivel <= 1 && d.clave.length >= 4 && d.clave.length <= 7));
    const conPareja = defs.filter((d) => similares(d).length);
    const tipos = azar.barajar(["orden", "pregunta", "cambio", "paridad", "colores", "vacia"]);
    const pruebas = [];
    for (let i = 0; i < TOTAL; i++) {
      const n = Math.min(nivel.max, nivel.tarjetas + Math.floor(i / CADA)); // cuántas tarjetas en esta prueba
      const rej = rejillaPara(n, nivel.rejilla);
      const ver = nivel.ver + (n - nivel.tarjetas) * 400;
      let tipo = tipos[i % tipos.length];
      if (tipo === "vacia" && rej === n) tipo = "pregunta"; // «¿dónde había un hueco?» solo si hay huecos
      const sitios = azar.barajar([...Array(rej).keys()]).slice(0, n); // dónde va cada tarjeta
      const base = { tipo, sitios, tarjetas: n, rejilla: rej, ver };
      if (tipo === "colores") {
        const cols = azar.barajar(Object.keys(COLORES_MEM)).slice(0, n);
        const k = azar.entero(0, n - 1);
        pruebas.push({ ...base, textos: cols, pregunta: `¿Dónde estaba el ${cols[k].toUpperCase()}?`, respuesta: k });
        continue;
      }
      if (tipo === "vacia") {
        // Palabras; luego se tapan todos los sitios (también los vacíos): ¿dónde había un hueco?
        const textos = azar.barajar(defs).slice(0, n).map((d) => d.forma.toUpperCase());
        const vacios = [...Array(rej).keys()].filter((x) => !sitios.includes(x));
        pruebas.push({ ...base, textos, vacios });
        continue;
      }
      if (tipo === "orden") {
        // De menor a mayor o de mayor a menor.
        const nums = new Set();
        while (nums.size < n) nums.add(azar.entero(1, 99));
        pruebas.push({ ...base, textos: [...nums].map(String), sentido: azar() < 0.5 ? "sube" : "baja" });
        continue;
      }
      if (tipo === "paridad") {
        // Toca todos los pares (o todos los impares): hay al menos uno de cada.
        let nums;
        do {
          const s = new Set();
          while (s.size < n) s.add(azar.entero(1, 99));
          nums = [...s];
        } while (nums.every((x) => x % 2) || nums.every((x) => !(x % 2)));
        pruebas.push({ ...base, textos: nums.map(String), par: azar() < 0.5 });
        continue;
      }
      const elegidas = [];
      const usadas = new Set();
      const k = azar.entero(0, n - 1);
      // En "cambio", la que cambia tiene que tener una parecida.
      const fija = tipo === "cambio" && conPareja.length ? azar.elegir(conPareja) : null;
      if (fija) usadas.add(fija.clave);
      while (elegidas.length < n - (fija ? 1 : 0)) {
        const d = azar.elegir(defs);
        if (!usadas.has(d.clave)) {
          usadas.add(d.clave);
          elegidas.push(d);
        }
      }
      if (fija) elegidas.splice(k, 0, fija);
      const textos = elegidas.map((d) => d.forma.toUpperCase());
      if (tipo === "pregunta") {
        const porDefinicion = azar() < 0.6;
        pruebas.push({ ...base, textos, pregunta: porDefinicion ? `¿Dónde estaba la palabra que significa «${elegidas[k].definicion}»?` : `¿Dónde estaba ${textos[k]}?`, respuesta: k });
      } else {
        // Una cambia por otra parecida (si no hay, por otra del mismo largo).
        const otras = similares(elegidas[k]).filter((x) => !usadas.has(x.clave));
        const nueva = otras.length ? azar.elegir(otras) : azar.elegir(defs.filter((x) => x.clave.length === elegidas[k].clave.length && !usadas.has(x.clave)));
        const despues = [...textos];
        despues[k] = nueva.forma.toUpperCase();
        pruebas.push({ ...base, textos, despues, respuesta: k });
      }
    }
    return { nivel, pruebas, jugadores: {} };
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { i: 0, aciertos: 0, ms: 0, hechas: [] });
  },

  vistaJugador(ronda, id) {
    const j = this.estadoJugador(ronda, id);
    return { rejilla: ronda.nivel.rejilla, ver: ronda.nivel.ver, pruebas: ronda.pruebas, i: j.i, aciertos: j.aciertos };
  },

  vistaTV(ronda) {
    return { jugadores: Object.fromEntries(Object.entries(ronda.jugadores).map(([id, j]) => [id, { aciertos: j.aciertos, hechas: j.i }])) };
  },

  /** respuesta: { i, valor, ms } — valor: lista de tarjetas tocadas (orden) o la tarjeta elegida. */
  accion(ronda, id, msg) {
    if (msg.a !== "respuesta") return false;
    const j = this.estadoJugador(ronda, id);
    const p = ronda.pruebas[j.i];
    if (!p || msg.i !== j.i) return false;
    let ok = false;
    if (p.tipo === "orden") {
      const bien = ordenBueno(p);
      ok = Array.isArray(msg.valor) && msg.valor.length === bien.length && msg.valor.every((x, n) => x === bien[n]);
    } else if (p.tipo === "vacia") {
      ok = Array.isArray(p.vacios) && p.vacios.includes(msg.valor);
    } else if (p.tipo === "paridad") {
      const bien = new Set(buscadas(p));
      ok = Array.isArray(msg.valor) && msg.valor.length === bien.size && msg.valor.every((x) => bien.has(x));
    } else ok = msg.valor === p.respuesta;
    if (ok) j.aciertos++;
    j.ms += Math.max(0, Math.min(60000, Number(msg.ms) || 0));
    j.hechas.push(ok);
    j.i++;
    return true;
  },

  terminado(ronda, id) {
    return (ronda.jugadores[id]?.i ?? 0) >= ronda.pruebas.length;
  },

  resultados(ronda, ids) {
    return ids.map((id) => {
      const j = ronda.jugadores[id];
      if (!j || !j.i) return { id, valor: null, texto: "No jugó" };
      const detalle = j.hechas.map((ok, k) => ({ t: `${k + 1}. ${NOMBRES[ronda.pruebas[k].tipo]}`, k: ok ? "bien" : "mal" }));
      return {
        id,
        valor: j.aciertos ? j.aciertos * 1e7 - j.ms : null,
        texto: `${j.aciertos} de ${j.i} ${j.i === 1 ? "prueba" : "pruebas"}`,
        corto: `${j.aciertos} ${j.aciertos === 1 ? "acierto" : "aciertos"}`,
        detalle,
      };
    });
  },

  resumen() {
    return null;
  },
};
