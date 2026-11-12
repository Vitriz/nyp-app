// REVUELTO · dos definiciones y las letras de las dos palabras mezcladas.
// Todos reciben la misma serie de revueltos. Cada palabra encontrada cuenta 1.
import { clave, elegirDefiniciones } from "../lexico.js";
import { huella } from "../util.js";

export default {
  id: "revuelto",
  nombre: "Revuelto",
  categoria: "palabras",
  duracion: 90,
  descripcion: "Las letras de dos palabras están mezcladas. Lee las dos definiciones y encuentra las palabras. Cada letra se usa una vez.",

  crear({ azar }) {
    const defs = elegirDefiniciones(azar, 40, { largoMin: 4, largoMax: 7, nivelMax: 1 });
    const revueltos = [];
    for (let k = 0; k + 1 < defs.length; k += 2) {
      const [a, b] = [defs[k], defs[k + 1]];
      revueltos.push({ palabras: [a, b], letras: azar.barajar([...(a.clave + b.clave)]) });
    }
    return { revueltos, jugadores: {} };
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { i: 0, resueltas: [false, false], aciertos: 0, anterior: null });
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
        palabras: r.palabras.map((p, k) => ({
          definicion: p.definicion,
          categoria: p.categoria,
          largo: p.clave.length,
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
      return { id, valor: j.aciertos > 0 ? j.aciertos : null, texto: `${j.aciertos} ${j.aciertos === 1 ? "palabra" : "palabras"}` };
    });
  },

  resumen(ronda) {
    const hasta = Math.max(2, ...Object.values(ronda.jugadores).map((j) => j.i + 1));
    return {
      palabras: ronda.revueltos.slice(0, Math.min(hasta, 3)).flatMap((r) => r.palabras.map((p) => ({ forma: p.forma, definicion: p.definicion }))),
    };
  },
};
