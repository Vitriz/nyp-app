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
  breve: "Separa las letras mezcladas en dos palabras.",
  descripcion: "Las letras de dos palabras están mezcladas (en difícil sobran 2). Lee las definiciones y escríbelas. Cada palabra vale 2; si pides su largo, 1. En grupo, pasar resta 1.",

  crear({ azar, config, inicio = Date.now() }) {
    const d = nivelDificultad(config);
    // Las dos palabras suman 12 letras. Fácil: largos parecidos y palabras muy comunes. Medio: cualquier
    // reparto, comunes. Difícil: palabras menos comunes y 2 letras de más que no sirven (señuelos).
    const pares = [[[5, 7], [6, 6]], [[4, 8], [5, 7], [6, 6]], [[4, 8], [5, 7], [6, 6]]][d + 1];
    const defs = elegirDefiniciones(azar, 160, { largoMin: 4, largoMax: 8, nivelMax: d > 0 ? 2 : 1 });
    const SENUELOS = "aeiosrnlctdmp";
    const porLargo = new Map();
    for (const x of defs) porLargo.set(x.clave.length, [...(porLargo.get(x.clave.length) ?? []), x]);
    const revueltos = [];
    for (let intento = 0; revueltos.length < 20 && intento < 300; intento++) {
      const [la, lb] = azar.elegir(pares);
      const A = porLargo.get(la), B = porLargo.get(lb);
      if (!A?.length || !B?.length || (la === lb && A.length < 2)) continue;
      const a = A.pop(), b = B.pop();
      if (a.clave === b.clave) continue;
      const extra = d > 0 ? [azar.elegir([...SENUELOS]), azar.elegir([...SENUELOS])] : [];
      revueltos.push({ palabras: azar.barajar([a, b]), letras: azar.barajar([...(a.clave + b.clave), ...extra]) });
    }
    // En PARTY, pasar resta un punto (para que no compense saltarse revueltos).
    return { revueltos, inicio, penalizaPasar: !config?.solo, jugadores: {} };
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { i: 0, resueltas: [false, false], aciertos: 0, anterior: null, hechas: [], puntos: 0, pistas: 0, pasados: 0, largos: [false, false] });
  },

  vistaJugador(ronda, id) {
    const j = this.estadoJugador(ronda, id);
    const r = ronda.revueltos[j.i];
    return {
      i: j.i,
      total: ronda.revueltos.length,
      totalPalabras: ronda.revueltos.length * 2,
      aciertos: j.aciertos,
      puntos: j.puntos ?? 0,
      penalizaPasar: Boolean(ronda.penalizaPasar),
      anterior: j.anterior,
      actual: r && {
        letras: r.letras,
        // Sin tipo de palabra ni largo: solo la definición y la huella para comprobar al momento.
        palabras: r.palabras.map((p, k) => ({
          definicion: p.definicion,
          h: huella(p.clave),
          resuelta: j.resueltas[k] ? p.forma : null,
          largo: j.largos?.[k] ? p.clave.length : null, // pista: cuántas letras tiene
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
      j.largos = [false, false];
    };
    if (msg.a === "pasar") {
      if (!j.resueltas.every(Boolean)) {
        j.pasados = (j.pasados ?? 0) + 1;
        if (ronda.penalizaPasar) j.puntos = (j.puntos ?? 0) - 1;
      }
      siguiente();
      return true;
    }
    if (msg.a === "pista") {
      // Dice el largo de la primera palabra sin resolver (y sin pista); esa palabra valdrá 1 en vez de 2.
      const k = r.palabras.findIndex((_, idx) => !j.resueltas[idx] && !j.largos[idx]);
      if (k < 0) return false;
      j.largos[k] = true;
      j.pistas = (j.pistas ?? 0) + 1;
      return true;
    }
    if (msg.a !== "respuesta") return false;
    const c = clave(String(msg.texto ?? ""));
    const k = r.palabras.findIndex((p, idx) => !j.resueltas[idx] && p.clave === c);
    if (k < 0) return false;
    j.resueltas[k] = true;
    j.aciertos++;
    j.puntos = (j.puntos ?? 0) + (j.largos[k] ? 1 : 2);
    // Todas las palabras: se apunta cuánto tardó (el récord es «¡COMPLETO!» y el tiempo).
    if (j.aciertos === ronda.revueltos.length * 2) j.ms = Math.max(0, Date.now() - (ronda.inicio ?? Date.now()));
    if (j.resueltas.every(Boolean)) siguiente();
    return true;
  },

  terminado(ronda, id) {
    return (ronda.jugadores[id]?.i ?? 0) >= ronda.revueltos.length;
  },

  resultados(ronda, ids) {
    return ids.map((id) => {
      const j = ronda.jugadores[id];
      if (!j) return { id, valor: null, texto: "No jugó" };
      const r = ronda.revueltos[j.i];
      // El revuelto en el que estaba: las resueltas en verde y las que faltaban, en rojo.
      const enCurso = r ? r.palabras.map((p, k) => ({ t: p.forma, ok: j.resueltas[k] })) : [];
      const detalle = [...(j.hechas ?? []), ...enCurso].map((x) => ({ t: x.t, k: x.ok ? "bien" : "mal" }));
      const total = ronda.revueltos.length * 2;
      if (j.ms != null) {
        const s = Math.round(j.ms / 1000);
        const tiempo = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
        // Completo: gana siempre a cualquier cuenta de palabras; entre completos, el más rápido.
        return { id, valor: 1e7 - j.ms, texto: `¡COMPLETO! en ${tiempo}`, corto: `¡COMPLETO! ${tiempo}`, detalle };
      }
      // Puntos: 2 por palabra (1 si pidió su largo); en PARTY, −1 por revuelto pasado.
      const extra = [j.pistas ? `${j.pistas} ${j.pistas === 1 ? "pista" : "pistas"}` : "", ronda.penalizaPasar && j.pasados ? `${j.pasados} ${j.pasados === 1 ? "pasado" : "pasados"}` : ""].filter(Boolean).join(" · ");
      return { id, valor: j.aciertos > 0 ? j.puntos ?? j.aciertos : null, texto: `${j.aciertos} / ${total} palabras${extra ? ` · ${extra}` : ""}`, corto: `${j.aciertos} / ${total}`, detalle };
    });
  },

  resumen(ronda) {
    const hasta = Math.max(2, ...Object.values(ronda.jugadores).map((j) => j.i + 1));
    return {
      palabras: ronda.revueltos.slice(0, Math.min(hasta, 3)).flatMap((r) => r.palabras.map((p) => ({ forma: p.forma, definicion: p.definicion }))),
    };
  },
};
