// MEMORIA FOTOGRÁFICA · se enseñan unas tarjetas unos segundos, se tapan y llega la pregunta.
// Tres tipos de prueba (se van alternando):
//  - orden:    números; hay que tocar las tarjetas tapadas de menor a mayor.
//  - pregunta: palabras; "¿dónde estaba la que significa…?" o "¿dónde estaba GATO?".
//  - cambio:   palabras; se vuelven a enseñar y una ha cambiado por otra parecida: ¿cuál?
// Todos reciben la misma serie. Gana quien acierte más (si empatan, quien respondió más rápido).
import { cargarDefiniciones } from "../lexico.js";
import { nivelDificultad } from "../util.js";

const NIVELES = [
  { tarjetas: 4, ver: 4500, rejilla: 4 },
  { tarjetas: 5, ver: 3800, rejilla: 6 },
  { tarjetas: 6, ver: 3200, rejilla: 9 },
];
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

export default {
  id: "memoria",
  nombre: "Memoria fotográfica",
  categoria: "palabras",
  duracion: 90,
  breve: "Mira las tarjetas, se tapan… ¿te acuerdas?",
  descripcion: "Se enseñan unas tarjetas unos segundos y se tapan. Luego: tócalas en orden, di dónde estaba una palabra o descubre cuál ha cambiado. Gana quien acierte más.",

  crear({ azar, config }) {
    const nivel = NIVELES[nivelDificultad(config) + 1];
    const defs = cargarDefiniciones().filter((d) => d.nivel <= 1 && d.clave.length >= 3 && d.clave.length <= 7 && d.palabras <= 9);
    // Parejas parecidas (CASA/CAZA), entre palabras comunes.
    const similares = parecidas(cargarDefiniciones().filter((d) => d.nivel <= 1 && d.clave.length >= 4 && d.clave.length <= 7));
    const conPareja = defs.filter((d) => similares(d).length);
    const tipos = azar.barajar(["orden", "pregunta", "cambio"]);
    const pruebas = [];
    for (let i = 0; i < TOTAL; i++) {
      const tipo = tipos[i % 3];
      const sitios = azar.barajar([...Array(nivel.rejilla).keys()]).slice(0, nivel.tarjetas); // dónde va cada tarjeta
      if (tipo === "orden") {
        const nums = new Set();
        while (nums.size < nivel.tarjetas) nums.add(azar.entero(1, 99));
        pruebas.push({ tipo, sitios, textos: [...nums].map(String) });
        continue;
      }
      const elegidas = [];
      const usadas = new Set();
      const k = azar.entero(0, nivel.tarjetas - 1);
      // En "cambio", la que cambia tiene que tener una parecida.
      const fija = tipo === "cambio" && conPareja.length ? azar.elegir(conPareja) : null;
      if (fija) usadas.add(fija.clave);
      while (elegidas.length < nivel.tarjetas - (fija ? 1 : 0)) {
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
        pruebas.push({ tipo, sitios, textos, pregunta: porDefinicion ? `¿Dónde estaba la palabra que significa «${elegidas[k].definicion}»?` : `¿Dónde estaba ${textos[k]}?`, respuesta: k });
      } else {
        // Una cambia por otra parecida (si no hay, por otra del mismo largo).
        const otras = similares(elegidas[k]).filter((x) => !usadas.has(x.clave));
        const nueva = otras.length ? azar.elegir(otras) : azar.elegir(defs.filter((x) => x.clave.length === elegidas[k].clave.length && !usadas.has(x.clave)));
        const despues = [...textos];
        despues[k] = nueva.forma.toUpperCase();
        pruebas.push({ tipo, sitios, textos, despues, respuesta: k });
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
      const bien = p.textos.map((t, k) => [Number(t), k]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
      ok = Array.isArray(msg.valor) && msg.valor.length === bien.length && msg.valor.every((x, n) => x === bien[n]);
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
      const detalle = j.hechas.map((ok, k) => ({ t: `${k + 1}. ${{ orden: "Orden", pregunta: "Pregunta", cambio: "Cambio" }[ronda.pruebas[k].tipo]}`, k: ok ? "bien" : "mal" }));
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
