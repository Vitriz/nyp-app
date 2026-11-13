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

export default {
  id: "mates-fugaces",
  nombre: "Mates fugaces",
  categoria: "numeros",
  duracion: 60,
  descripcion: "Van apareciendo operaciones. Escribe el resultado y pulsa OK. Si una se te atraganta, pásala. Gana quien acierte más.",

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
    return (ronda.jugadores[id] ??= { i: 0, aciertos: 0, fallos: 0 });
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
    if (msg.a === "pasar") {
      j.i++;
      return true;
    }
    if (msg.a === "respuesta") {
      if (Number(msg.valor) === ronda.ops[j.i].r) {
        j.aciertos++;
        j.i++;
      } else {
        j.fallos++;
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
      return {
        id,
        valor: j && j.aciertos > 0 ? j.aciertos : null,
        texto: j ? `${j.aciertos} ${j.aciertos === 1 ? "acierto" : "aciertos"}${j.fallos ? ` · ${j.fallos} ${j.fallos === 1 ? "fallo" : "fallos"}` : ""}` : "No jugó",
      };
    });
  },

  resumen() {
    return null;
  },
};
