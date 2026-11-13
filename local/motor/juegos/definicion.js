// DEFINICIÓN · todos reciben la misma lista de definiciones, en el mismo orden.
// Cada palabra acertada vale 3; cada pista (desvela una letra) resta 1, sin bajar de 1.
import { clave, elegirDefiniciones } from "../lexico.js";
import { huella, nivelDificultad } from "../util.js";
import { AMBITOS, palabrasDeTema } from "./crucigrama.js";

const VALOR = 3;
// Racha: desde el 3.º acierto seguido sin pistas, cada acierto suma +1 extra.
const RACHA = 3;
const LIMITES = [{ largoMin: 4, largoMax: 7, nivelMax: 1 }, { largoMin: 4, largoMax: 10, nivelMax: 1 }, { largoMin: 6, largoMax: 12, nivelMax: 2 }];

export default {
  id: "definicion",
  nombre: "Definición",
  categoria: "palabras",
  duracion: 60,
  breve: "Adivina la palabra a partir de su definición.",
  descripcion: "Lee la definición y escribe la palabra. Cada acierto vale 3; cada pista desvela una letra pero resta 1. Desde el 3.º acierto seguido sin pistas, +1 por racha. Gana quien sume más.",
  ambitos: AMBITOS,
  ambitoDefecto: "todos",

  crear({ azar, config }) {
    const d = nivelDificultad(config);
    const lim = LIMITES[d + 1];
    let lista = null;
    let ambito = "todos";
    // Con tema: sus palabras (definiciones cortas). Si hay pocas, se completa con las de siempre.
    if (config?.ambito && config.ambito !== "todos") {
      const t = palabrasDeTema(azar, config.ambito);
      ambito = t.ambito;
      const aptas = t.lista.filter((x) => x.clave.length >= lim.largoMin && x.clave.length <= lim.largoMax + 2 && x.palabras <= 18 && (d > 0 || x.nivel <= 2));
      if (aptas.length >= 12) lista = azar.barajar(aptas).slice(0, 40).map((x) => ({ ...x, categoria: t.ambito }));
    }
    lista ??= elegirDefiniciones(azar, 40, lim);
    const palabras = lista.map((x) => ({
      ...x,
      orden: azar.barajar([...x.clave].map((_, i) => i)), // orden en que se desvelan las letras
    }));
    return { palabras, ambito, jugadores: {} };
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { i: 0, aciertos: 0, pistas: 0, puntos: 0, reveladas: 0, anterior: null, hechas: [], racha: 0, mejorRacha: 0 });
  },

  vistaJugador(ronda, id) {
    const j = this.estadoJugador(ronda, id);
    const w = ronda.palabras[j.i];
    return {
      i: j.i,
      aciertos: j.aciertos,
      pistas: j.pistas,
      puntos: j.puntos,
      racha: j.racha ?? 0,
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
        // Racha de aciertos sin pistas: desde el 3.º seguido, +1.
        j.racha = j.reveladas ? 0 : (j.racha ?? 0) + 1;
        j.mejorRacha = Math.max(j.mejorRacha ?? 0, j.racha);
        j.puntos += Math.max(1, VALOR - j.reveladas) + (j.racha >= RACHA ? 1 : 0);
        siguiente(true);
        j.anterior.racha = j.racha;
        return true;
      case "pista":
        if (j.reveladas >= w.clave.length - 1) return false;
        j.reveladas++;
        j.pistas++;
        return true;
      case "pasar":
        j.racha = 0;
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
