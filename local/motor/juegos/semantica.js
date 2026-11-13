// SEMÁNTICA (tipo Semantle) · hay una palabra secreta; escribes palabras y el juego te dice lo cerca que
// están de su significado (puesto #1 = la secreta; #2, la más parecida…). Sin IA: la cercanía sale de las
// definiciones del diccionario, calculada de antemano (herramientas/preparar_semantica.py).
// Todos buscan la misma palabra. Gana quien la encuentre (con menos intentos y pistas); si nadie, quien
// se haya quedado más cerca.
import { cargarSemantica, clave } from "../lexico.js";
import { nivelDificultad } from "../util.js";

// Pistas: enseñan la palabra que está en ese puesto (cada vez más cerca). Menos en difícil.
const PISTAS = [[500, 150, 40, 10], [500, 100, 20], [300]];

let cache = null; // { datos, indice: Map(clave -> i), vec: [Map], normas }
function preparar() {
  const datos = cargarSemantica();
  if (!datos) return null;
  if (cache?.datos === datos) return cache;
  const indice = new Map(datos.palabras.map((p, i) => [p, i]));
  const vec = datos.vec.map((f) => {
    const m = new Map();
    for (let k = 0; k < f.length; k += 2) m.set(f[k], f[k + 1]);
    return m;
  });
  const normas = vec.map((m) => Math.sqrt([...m.values()].reduce((a, x) => a + x * x, 0)) || 1);
  cache = { datos, indice, vec, normas };
  return cache;
}

/** Puesto de cada palabra según lo cerca que está de la secreta (0 = la secreta). */
function clasificar(c, objetivo) {
  const vo = c.vec[objetivo], no = c.normas[objetivo];
  const sim = new Float32Array(c.vec.length);
  for (let i = 0; i < c.vec.length; i++) {
    let s = 0;
    for (const [k, x] of c.vec[i]) {
      const y = vo.get(k);
      if (y) s += x * y;
    }
    sim[i] = s / (c.normas[i] * no);
  }
  sim[objetivo] = 2; // la secreta, la primera
  const orden = [...sim.keys()].sort((a, b) => sim[b] - sim[a]);
  const puesto = new Int32Array(sim.length);
  orden.forEach((i, p) => (puesto[i] = p));
  return { sim, puesto, orden };
}

/** Busca la palabra (tal cual, o quitando un plural sencillo). */
function buscar(c, texto) {
  const k = clave(String(texto ?? "").trim());
  for (const cand of [k, k.replace(/es$/, ""), k.replace(/s$/, "")]) if (c.indice.has(cand)) return c.indice.get(cand);
  return -1;
}

export default {
  id: "semantica",
  nombre: "Semántica",
  categoria: "palabras",
  duracion: 0, // sin límite
  sinDiccionario: true, // trae sus propios datos
  breve: "Adivina la palabra secreta por lo cerca que vas.",
  descripcion: "Hay una palabra secreta. Escribe cualquier palabra y verás lo cerca que está de su significado: el #1 es la secreta. Ve acercándote. Puedes pedir pistas.",

  crear({ azar, config }) {
    const c = preparar();
    if (!c) return { sinDatos: true, jugadores: {} };
    // Fácil: la secreta es siempre una palabra muy común (de las 3000 más usadas).
    const facil = nivelDificultad(config) < 0 && c.datos.faciles?.length;
    const objetivo = azar.elegir(facil ? c.datos.faciles : c.datos.secretas);
    return { objetivo, pistas: PISTAS[nivelDificultad(config) + 1], jugadores: {}, tabla: null };
  },

  /** La clasificación se calcula la primera vez que hace falta (y se guarda en la ronda). */
  tabla(ronda) {
    if (!ronda.tabla) ronda.tabla = clasificar(preparar(), ronda.objetivo);
    return ronda.tabla;
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { intentos: [], pistas: 0, encontrada: null, ultimo: null, n: 0 });
  },

  vistaJugador(ronda, id) {
    if (ronda.sinDatos) return { sinDatos: true };
    const j = this.estadoJugador(ronda, id);
    const c = preparar();
    return {
      total: c.datos.palabras.length,
      intentos: j.intentos,
      ultimo: j.ultimo,
      pistasUsadas: j.pistas,
      pistasMax: ronda.pistas.length,
      encontrada: j.encontrada,
      secreta: j.encontrada ? c.datos.formas[ronda.objetivo] : null,
    };
  },

  vistaTV(ronda) {
    if (ronda.sinDatos) return { jugadores: {} };
    return {
      jugadores: Object.fromEntries(
        Object.entries(ronda.jugadores).map(([id, j]) => [id, { mejor: j.intentos.length ? Math.min(...j.intentos.map((x) => x.puesto)) : null, n: j.intentos.length, encontrada: Boolean(j.encontrada) }])
      ),
    };
  },

  accion(ronda, id, msg) {
    if (ronda.sinDatos) return false;
    const j = this.estadoJugador(ronda, id);
    if (j.encontrada) return false;
    const c = preparar();
    const t = this.tabla(ronda);
    const n = ++j.n;
    if (msg.a === "pista") {
      if (j.pistas >= ronda.pistas.length) return false;
      const i = t.orden[ronda.pistas[j.pistas]];
      j.pistas++;
      if (!j.intentos.some((x) => x.i === i)) j.intentos.push({ i, forma: c.datos.formas[i], puesto: t.puesto[i], sim: Math.round(t.sim[i] * 100), pista: true });
      j.ultimo = { n, ok: true, i, pista: true };
      return true;
    }
    if (msg.a !== "intento") return false;
    const i = buscar(c, msg.texto);
    if (i < 0) {
      j.ultimo = { n, ok: false, motivo: "No la conozco: prueba en singular (o el verbo en infinitivo)" };
      return true;
    }
    if (!j.intentos.some((x) => x.i === i)) j.intentos.push({ i, forma: c.datos.formas[i], puesto: t.puesto[i], sim: Math.round(Math.min(1, t.sim[i]) * 100) });
    j.ultimo = { n, ok: true, i };
    if (i === ronda.objetivo) j.encontrada = { intentos: j.intentos.filter((x) => !x.pista).length, ms: Date.now() };
    return true;
  },

  terminado(ronda, id) {
    return Boolean(ronda.jugadores[id]?.encontrada);
  },

  resultados(ronda, ids) {
    return ids.map((id) => {
      const j = ronda.jugadores[id];
      if (!j || !j.intentos.length) return { id, valor: null, texto: "No jugó" };
      const n = j.intentos.filter((x) => !x.pista).length;
      if (j.encontrada) {
        const p = j.pistas ? ` · ${j.pistas} ${j.pistas === 1 ? "pista" : "pistas"}` : "";
        return { id, valor: 1e7 - n * 1000 - j.pistas * 4000, texto: `¡La encontró! ${n} intentos${p}`, corto: `${n} intentos${p}` };
      }
      const mejor = Math.min(...j.intentos.filter((x) => !x.pista).map((x) => x.puesto), Infinity);
      if (!Number.isFinite(mejor)) return { id, valor: null, texto: "Solo pistas" };
      return { id, valor: 1e6 - mejor, texto: `Lo más cerca: puesto #${mejor + 1}`, corto: `#${mejor + 1}` };
    });
  },

  resumen(ronda) {
    if (ronda.sinDatos) return null;
    const c = preparar();
    const t = this.tabla(ronda);
    return { secreta: c.datos.formas[ronda.objetivo], cercanas: t.orden.slice(1, 11).map((i) => c.datos.formas[i]) };
  },
};
