// PALABRA MÁS LARGA · con las letras que salen, forma la palabra más larga que puedas.
// Cada ficha se usa una vez. Vale cualquier forma: plurales, femeninos, verbos conjugados…
import { nivelDificultad } from "../util.js";
import { clave, esValida, formaVisible, palabrasPosibles } from "../lexico.js";

const VOCALES = { a: 12.5, e: 13.7, i: 6.3, o: 8.7, u: 3.9 };
const CONSONANTES = {
  s: 8, r: 6.9, n: 6.7, d: 5.9, l: 5, c: 4.7, t: 4.6, m: 3.2, p: 2.5, b: 1.4,
  g: 1.0, v: 0.9, y: 0.6, q: 0.4, h: 0.7, f: 0.7, z: 0.5, j: 0.4, "ñ": 0.3, x: 0.2,
};
const MINIMO = 3;
// Consonantes «raras»: hacen más difícil encajar las letras.
const RARAS = ["q", "x", "z", "j", "ñ", "h", "f", "v", "y", "g", "b"];
// Por nivel: letras, vocales y cuántas consonantes raras (fácil: ninguna; difícil: al menos 2).
const NIVELES = [
  { n: 11, vocales: [5, 5, 6], raras: [0, 0] },
  { n: 10, vocales: [4, 4, 5], raras: [0, 1] },
  { n: 9, vocales: [3, 3, 4], raras: [2, 3] },
];

function sacar(azar, tabla, ya) {
  for (;;) {
    let r = azar() * Object.values(tabla).reduce((a, b) => a + b, 0);
    for (const [l, p] of Object.entries(tabla)) {
      r -= p;
      if (r <= 0) {
        const repes = ya.filter((x) => x === l).length;
        const tope = l in VOCALES ? 3 : l === "q" || l === "x" || l === "ñ" || l === "j" || l === "z" ? 1 : 2;
        if (repes < tope) return l;
        break;
      }
    }
  }
}

function generarLetras(azar, nivel) {
  const { n } = nivel;
  const objetivo = Math.min(n - 1, n >= 10 ? 8 : 7); // la mejor palabra común debe tener al menos esto
  const comunes = Object.fromEntries(Object.entries(CONSONANTES).filter(([l]) => !RARAS.includes(l)));
  let mejor = null;
  for (let intento = 0; intento < 80; intento++) {
    const nv = azar.elegir(nivel.vocales);
    const nr = azar.entero(...nivel.raras);
    const letras = [];
    for (let i = 0; i < nv; i++) letras.push(sacar(azar, VOCALES, letras));
    for (let i = 0; i < nr; i++) letras.push(sacar(azar, Object.fromEntries(RARAS.map((l) => [l, CONSONANTES[l]])), letras));
    for (let i = nv + nr; i < n; i++) letras.push(sacar(azar, nivel.raras[1] ? CONSONANTES : comunes, letras));
    if (letras.includes("q") && !letras.includes("u")) continue;
    const buenas = palabrasPosibles(letras.join(""), { soloBuenas: true });
    const largo = buenas[0]?.clave.length ?? 0;
    if (!mejor || largo > mejor.largo) mejor = { letras, largo };
    if (largo >= objetivo && buenas.length >= 25) return azar.barajar(letras);
  }
  return azar.barajar(mejor.letras);
}

export default {
  id: "palabra-larga",
  nombre: "Palabra más larga",
  categoria: "palabras",
  duracion: 45,
  breve: "Forma la palabra más larga con las letras.",
  descripcion: "Forma la palabra más larga que puedas con las letras. Cada letra se usa una vez. Valen plurales, femeninos y verbos conjugados.",

  crear({ azar, config, inicio = Date.now() }) {
    const nivel = { ...NIVELES[nivelDificultad(config) + 1] };
    if (config?.letrasPalabraLarga) nivel.n = config.letrasPalabraLarga;
    return { letras: generarLetras(azar, nivel), inicio, jugadores: {} };
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { mejor: null, ultimo: null, intentos: 0, listo: false, validas: [] });
  },

  vistaJugador(ronda, id) {
    const j = this.estadoJugador(ronda, id);
    return { letras: ronda.letras, mejor: j.mejor, ultimo: j.ultimo, listo: j.listo };
  },

  vistaTV(ronda) {
    return {
      letras: ronda.letras,
      jugadores: Object.fromEntries(
        Object.entries(ronda.jugadores).map(([id, j]) => [id, { largo: j.mejor?.largo ?? 0, listo: j.listo }])
      ),
    };
  },

  accion(ronda, id, msg) {
    const j = this.estadoJugador(ronda, id);
    if (msg.a === "listo") {
      j.listo = true;
      return true;
    }
    if (msg.a !== "probar" || j.listo || !Array.isArray(msg.fichas)) return false;
    const fichas = msg.fichas;
    if (fichas.length > ronda.letras.length || new Set(fichas).size !== fichas.length) return false;
    if (!fichas.every((f) => Number.isInteger(f) && f >= 0 && f < ronda.letras.length)) return false;
    const c = fichas.map((f) => ronda.letras[f]).join("");
    j.intentos++;
    let ok = false, motivo = "";
    if (c.length < MINIMO) motivo = `Mínimo ${MINIMO} letras`;
    else if (!esValida(clave(c))) motivo = "No está en el diccionario";
    else ok = true;
    j.ultimo = { n: j.intentos, palabra: c, ok, motivo, forma: ok ? formaVisible(c) : null };
    if (ok && !j.validas.includes(c)) j.validas.push(c);
    // Se apunta cuándo la encontró: a igual largo, gana quien llegó antes.
    if (ok && (!j.mejor || c.length > j.mejor.largo)) j.mejor = { clave: c, forma: formaVisible(c), largo: c.length, ms: Math.max(0, Date.now() - (ronda.inicio ?? Date.now())) };
    if (ok) j.ultimo.mejora = j.mejor.clave === c;
    return true;
  },

  terminado(ronda, id) {
    return Boolean(ronda.jugadores[id]?.listo);
  },

  resultados(ronda, ids) {
    return ids.map((id) => {
      const j = ronda.jugadores[id];
      if (!j) return { id, valor: null, texto: "No jugó" };
      if (!j.mejor) return { id, valor: null, texto: "Sin palabra válida" };
      const detalle = [...(j.validas ?? [])]
        .sort((a, b) => b.length - a.length)
        .map((c) => ({ t: `${formaVisible(c)} · ${c.length}`, k: c === j.mejor.clave ? "mejor" : "bien" }));
      // Valor: el largo, y en los decimales lo pronto que la encontró (desempate).
      const valor = j.mejor.largo + 0.99 * (1 - Math.min(j.mejor.ms ?? 3.6e6, 3.6e6) / 3.6e6);
      return { id, valor, texto: `${j.mejor.forma.toUpperCase()} · ${j.mejor.largo}`, corto: `${j.mejor.forma.toUpperCase()} · ${j.mejor.largo}`, detalle };
    });
  },

  resumen(ronda) {
    const buenas = palabrasPosibles(ronda.letras.join(""), { soloBuenas: true });
    const todas = palabrasPosibles(ronda.letras.join(""));
    const max = todas[0]?.clave.length ?? 0;
    const mejores = buenas.slice(0, 6).map((c) => ({ forma: formaVisible(c.clave), largo: c.clave.length }));
    // Si la más larga de todas es una palabra rara y más larga que las comunes, la enseñamos aparte.
    const rara = todas[0] && max > (buenas[0]?.clave.length ?? 0)
      ? { forma: formaVisible(todas[0].clave), largo: max }
      : null;
    return { letras: ronda.letras, mejores, rara, total: todas.length };
  },
};
