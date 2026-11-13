// DEFINICIÓN · todos reciben la misma lista de definiciones, en el mismo orden.
// Cada palabra acertada vale 3; cada pista (desvela una letra) resta 1, sin bajar de 1.
import { clave, elegirDefiniciones } from "../lexico.js";
import { huella, nivelDificultad } from "../util.js";

const VALOR = 3;

export default {
  id: "definicion",
  nombre: "Definición",
  categoria: "palabras",
  duracion: 60,
  breve: "Adivina la palabra a partir de su definición.",
  descripcion: "Lee la definición y escribe la palabra. Cada pista desvela una letra pero resta. Gana quien sume más.",

  crear({ azar, config }) {
    const d = nivelDificultad(config);
    const palabras = elegirDefiniciones(azar, 40, [{ largoMin: 4, largoMax: 7, nivelMax: 1 }, { largoMin: 4, largoMax: 10, nivelMax: 1 }, { largoMin: 6, largoMax: 12, nivelMax: 2 }][d + 1]).map((d) => ({
      ...d,
      orden: azar.barajar([...d.clave].map((_, i) => i)), // orden en que se desvelan las letras
    }));
    return { palabras, jugadores: {} };
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { i: 0, aciertos: 0, pistas: 0, puntos: 0, reveladas: 0, anterior: null, hechas: [] });
  },

  vistaJugador(ronda, id) {
    const j = this.estadoJugador(ronda, id);
    const w = ronda.palabras[j.i];
    return {
      i: j.i,
      aciertos: j.aciertos,
      pistas: j.pistas,
      puntos: j.puntos,
      anterior: j.anterior,
      actual: w && {
        definicion: w.definicion,
        categoria: w.categoria,
        largo: w.clave.length,
        h: huella(w.clave),
        letras: w.orden.slice(0, j.reveladas).map((p) => ({ p, l: w.clave[p] })),
      },
    };
  },

  vistaTV(ronda) {
    return {
      jugadores: Object.fromEntries(Object.entries(ronda.jugadores).map(([id, j]) => [id, { valor: j.puntos, aciertos: j.aciertos }])),
    };
  },

  accion(ronda, id, msg) {
    const j = this.estadoJugador(ronda, id);
    const w = ronda.palabras[j.i];
    if (!w || msg.i !== j.i) return false;
    const siguiente = (ok) => {
      j.anterior = { n: j.i, forma: w.forma, ok };
      j.hechas.push({ t: w.forma, k: ok ? (j.reveladas ? "pista" : "bien") : "mal" });
      j.i++;
      j.reveladas = 0;
    };
    switch (msg.a) {
      case "respuesta":
        if (clave(String(msg.texto ?? "")) !== w.clave) return false;
        j.aciertos++;
        j.puntos += Math.max(1, VALOR - j.reveladas);
        siguiente(true);
        return true;
      case "pista":
        if (j.reveladas >= w.clave.length - 1) return false;
        j.reveladas++;
        j.pistas++;
        return true;
      case "pasar":
        siguiente(false);
        return true;
    }
    return false;
  },

  terminado(ronda, id) {
    return (ronda.jugadores[id]?.i ?? 0) >= ronda.palabras.length;
  },

  resultados(ronda, ids) {
    return ids.map((id) => {
      const j = ronda.jugadores[id];
      if (!j) return { id, valor: null, texto: "No jugó" };
      // La palabra en la que estaba cuando se acabó el tiempo también se enseña (sin resolver).
      const w = ronda.palabras[j.i];
      const pendiente = w ? { forma: w.forma, definicion: w.definicion } : null;
      const detalle = [...(j.hechas ?? []), ...(pendiente ? [{ t: pendiente.forma, k: "mal" }] : [])];
      const p = j.pistas ? ` · ${j.pistas} ${j.pistas === 1 ? "pista" : "pistas"}` : "";
      return { id, valor: j.puntos > 0 ? j.puntos : null, texto: `${j.aciertos} ${j.aciertos === 1 ? "acierto" : "aciertos"}${p}`, corto: `${j.puntos} ${j.puntos === 1 ? "punto" : "puntos"}`, detalle, pendiente };
    });
  },

  resumen(ronda) {
    const hasta = Math.max(4, ...Object.values(ronda.jugadores).map((j) => j.i));
    return {
      palabras: ronda.palabras.slice(0, Math.min(hasta, 6)).map((w) => ({ forma: w.forma, definicion: w.definicion })),
    };
  },
};
