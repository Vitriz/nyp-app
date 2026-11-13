// REVUELTO · dos definiciones y las 12 letras de las dos palabras mezcladas.
// Todos reciben la misma serie de revueltos. Cada palabra encontrada cuenta 1.
// No se dice ni el tipo de palabra ni su largo: solo que entre las dos suman 12 letras.
import { clave, elegirDefiniciones } from "../lexico.js";
import { huella, nivelDificultad } from "../util.js";

export default {
  id: "revuelto",
  nombre: "Revuelto",
  categoria: "palabras",
  duracion: 90,
  descripcion: "Las 12 letras de dos palabras están mezcladas. Lee las dos definiciones, escribe una de las palabras y comprueba. Cada letra se usa una vez.",

  crear({ azar, config }) {
    const d = nivelDificultad(config);
    // Las dos palabras suman siempre 12 letras: así las fichas ocupan siempre lo mismo.
    const pares = [[[5, 7], [6, 6]], [[4, 8], [5, 7], [6, 6]], [[4, 8], [5, 7], [6, 6]]][d + 1];
    const defs = elegirDefiniciones(azar, 160, { largoMin: 4, largoMax: 8, nivelMax: d > 0 ? 2 : 1 });
    const porLargo = new Map();
    for (const x of defs) porLargo.set(x.clave.length, [...(porLargo.get(x.clave.length) ?? []), x]);
    const revueltos = [];
    for (let intento = 0; revueltos.length < 20 && intento < 300; intento++) {
      const [la, lb] = azar.elegir(pares);
      const A = porLargo.get(la), B = porLargo.get(lb);
      if (!A?.length || !B?.length || (la === lb && A.length < 2)) continue;
      const a = A.pop(), b = B.pop();
      if (a.clave === b.clave) continue;
      revueltos.push({ palabras: azar.barajar([a, b]), letras: azar.barajar([...(a.clave + b.clave)]) });
    }
    return { revueltos, jugadores: {} };
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { i: 0, resueltas: [false, false], aciertos: 0, anterior: null, hechas: [] });
  },

  vistaJugador(ronda, id) {
    const j = this.estadoJugador(ronda, id);
    const r = ronda.revueltos[j.i];
    return {
      i: j.i,
      aciertos: j.aciertos,
      anterior: j.anterior,
      actual: r && {
        letras: r.letras,
        // Sin tipo de palabra ni largo: solo la definición y la huella para comprobar al momento.
        palabras: r.palabras.map((p, k) => ({
          definicion: p.definicion,
          h: huella(p.clave),
          resuelta: j.resueltas[k] ? p.forma : null,
        })),
      },
    };
  },

  vistaTV(ronda) {
    return {
      jugadores: Object.fromEntries(Object.entries(ronda.jugadores).map(([id, j]) => [id, j.aciertos])),
    };
  },

  accion(ronda, id, msg) {
    const j = this.estadoJugador(ronda, id);
    const r = ronda.revueltos[j.i];
    if (!r || msg.i !== j.i) return false;
    const siguiente = () => {
      j.anterior = { n: j.i, formas: r.palabras.map((p) => p.forma), resueltas: [...j.resueltas] };
      j.hechas.push(...r.palabras.map((p, k) => ({ t: p.forma, ok: j.resueltas[k] })));
      j.i++;
      j.resueltas = [false, false];
    };
    if (msg.a === "pasar") {
      siguiente();
      return true;
    }
    if (msg.a !== "respuesta") return false;
    const c = clave(String(msg.texto ?? ""));
    const k = r.palabras.findIndex((p, idx) => !j.resueltas[idx] && p.clave === c);
    if (k < 0) return false;
    j.resueltas[k] = true;
    j.aciertos++;
    if (j.resueltas.every(Boolean)) siguiente();
    return true;
  },

  terminado(ronda, id) {
    return (ronda.jugadores[id]?.i ?? 0) >= ronda.revueltos.length;
  },

  resultados(ronda, ids) {
    return ids.map((id) => {
      const j = ronda.jugadores[id];
      if (!j || (j.i === 0 && !j.aciertos)) return { id, valor: null, texto: "No jugó" };
      const r = ronda.revueltos[j.i];
      const enCurso = r ? r.palabras.filter((_, k) => j.resueltas[k]).map((p) => ({ t: p.forma, ok: true })) : [];
      const detalle = [...(j.hechas ?? []), ...enCurso].map((x) => ({ t: x.t, k: x.ok ? "bien" : "mal" }));
      return { id, valor: j.aciertos > 0 ? j.aciertos : null, texto: `${j.aciertos} ${j.aciertos === 1 ? "palabra" : "palabras"}`, detalle };
    });
  },

  resumen(ronda) {
    const hasta = Math.max(2, ...Object.values(ronda.jugadores).map((j) => j.i + 1));
    return {
      palabras: ronda.revueltos.slice(0, Math.min(hasta, 3)).flatMap((r) => r.palabras.map((p) => ({ forma: p.forma, definicion: p.definicion }))),
    };
  },
};
