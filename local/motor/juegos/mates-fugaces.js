// MATES FUGACES · operaciones rápidas con resultado entero entre 0 y 999.
// Todos reciben la misma serie, en el mismo orden. Gana quien acierte más.
import { nivelDificultad } from "../util.js";

const SIMBOLO = { "+": "+", "-": "−", "*": "×", "/": "÷" };

function operacion(azar, nivel) {
  const tipo = azar.elegir(nivel < 1 ? ["+", "-"] : ["+", "-", "*", "/"]);
  let a, b, r;
  switch (tipo) {
    case "+": {
      const max = [20, 60, 150, 450][nivel];
      a = azar.entero(2, max);
      b = azar.entero(2, Math.min(max, 999 - a));
      r = a + b;
      break;
    }
    case "-": {
      const max = [30, 100, 300, 999][nivel];
      a = azar.entero(5, max);
      b = azar.entero(1, a);
      r = a - b;
      break;
    }
    case "*": {
      const [ma, mb] = [[10, 10], [10, 10], [12, 12], [25, 9]][nivel];
      a = azar.entero(2, ma);
      b = azar.entero(2, mb);
      if (azar() < 0.5) [a, b] = [b, a];
      r = a * b;
      break;
    }
    case "/": {
      const [mq, md] = [[10, 10], [10, 10], [12, 12], [30, 9]][nivel];
      b = azar.entero(2, md);
      r = azar.entero(1, mq);
      a = b * r;
      break;
    }
  }
  return { texto: `${a} ${SIMBOLO[tipo]} ${b}`, r };
}

/**
 * Todas las operaciones que salieron, con su resultado: verde si la acertaste a la primera, amarilla si
 * fallaste antes de acertar, roja si la pasaste y azul la última (la que estaba en pantalla al acabar).
 */
function resumenOps(ronda, j) {
  const lista = (j.hist ?? []).map((x) => ({ t: `${ronda.ops[x.i].texto} = ${ronda.ops[x.i].r}`, k: x.pasada ? "pasada" : x.f ? "fallo" : "bien" }));
  const actual = ronda.ops[j.i];
  if (actual && (lista.length || j.fallosOp)) lista.push({ t: `${actual.texto} = ${actual.r}`, k: "actual" });
  return lista;
}

export default {
  id: "mates-fugaces",
  nombre: "Mates fugaces",
  categoria: "numeros",
  duracion: 60,
  breve: "Resuelve operaciones rápidas, una tras otra.",
  descripcion: "Van apareciendo operaciones. Escribe el resultado y pulsa OK. Si una se te atraganta, pásala. Cada acierto suma 1 y cada fallo resta ½. Gana quien sume más.",

  crear({ azar, config }) {
    // Fácil: sumas y restas más tiempo y techo más bajo; difícil: empieza más arriba y sube antes.
    const d = nivelDificultad(config);
    const [base, cada, techo] = [[0, 10, 2], [0, 6, 3], [1, 4, 3]][d + 1];
    const ops = [];
    for (let i = 0; i < 200; i++) ops.push(operacion(azar, Math.min(techo, base + Math.floor(i / cada))));
    return { ops, jugadores: {} };
  },

  // El estado de cada jugador vive en ronda.jugadores[id].
  estadoJugador(ronda, id) {
    // hist: lo que pasó con cada operación (acertada a la primera, con fallos o pasada).
    return (ronda.jugadores[id] ??= { i: 0, aciertos: 0, fallos: 0, fallosOp: 0, hist: [] });
  },

  vistaJugador(ronda, id) {
    const j = this.estadoJugador(ronda, id);
    // Se envían también las soluciones para que la respuesta sea instantánea en el móvil.
    return { ops: ronda.ops, i: j.i, aciertos: j.aciertos };
  },

  vistaTV(ronda) {
    return {
      aciertos: Object.fromEntries(Object.entries(ronda.jugadores).map(([id, j]) => [id, j.aciertos])),
    };
  },

  accion(ronda, id, msg) {
    const j = this.estadoJugador(ronda, id);
    if (msg.i !== j.i || j.i >= ronda.ops.length) return false;
    j.hist ??= [];
    if (msg.a === "pasar") {
      j.hist.push({ i: j.i, f: j.fallosOp ?? 0, pasada: true });
      j.fallosOp = 0;
      j.i++;
      return true;
    }
    if (msg.a === "respuesta") {
      if (Number(msg.valor) === ronda.ops[j.i].r) {
        j.hist.push({ i: j.i, f: j.fallosOp ?? 0 });
        j.fallosOp = 0;
        j.aciertos++;
        j.i++;
      } else {
        j.fallos++;
        j.fallosOp = (j.fallosOp ?? 0) + 1;
      }
      return true;
    }
    return false;
  },

  terminado(ronda, id) {
    return (ronda.jugadores[id]?.i ?? 0) >= ronda.ops.length;
  },

  resultados(ronda, ids) {
    return ids.map((id) => {
      const j = ronda.jugadores[id];
      // Cada fallo resta medio punto: así no compensa probar números al azar.
      return {
        id,
        valor: j && j.aciertos > 0 ? j.aciertos - j.fallos * 0.5 : null,
        corto: j ? `${j.aciertos} ${j.aciertos === 1 ? "acierto" : "aciertos"}` : "",
        texto: j ? `${j.aciertos} ${j.aciertos === 1 ? "acierto" : "aciertos"}${j.fallos ? ` · ${j.fallos} ${j.fallos === 1 ? "fallo" : "fallos"}` : ""}` : "No jugó",
        detalle: j ? resumenOps(ronda, j) : null,
      };
    });
  },

  resumen() {
    return null;
  },
};
