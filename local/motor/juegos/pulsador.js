// PULSADOR · la TV muestra una pregunta; el primero que pulsa responde en voz alta
// y el presentador decide desde su mando si acierta (✔) o falla (✘).
// Si falla, ese jugador ya no puede pulsar en esa pregunta y los demás sí.
import { elegirDefiniciones } from "../lexico.js";

const LECTURA = 3000; // ms para leer cada pregunta antes de poder pulsar

function cadenaCalculo(azar) {
  let v = azar.entero(2, 12);
  const pasos = [String(v)];
  for (let k = 0; k < 3; k++) {
    const opciones = [["+", azar.entero(2, 15)]];
    if (v > 3) opciones.push(["−", azar.entero(1, Math.min(v - 1, 12))]);
    if (v <= 30) opciones.push(["×", azar.entero(2, 4)]);
    const divs = [2, 3, 4, 5].filter((d) => v % d === 0);
    if (divs.length && v > 3) opciones.push(["÷", azar.elegir(divs)]);
    const [op, n] = azar.elegir(opciones);
    v = op === "+" ? v + n : op === "−" ? v - n : op === "×" ? v * n : v / n;
    pasos.push(`${op} ${n}`);
  }
  return { pasos, r: v };
}

function preguntas(azar, tipos, n) {
  const defs = elegirDefiniciones(azar, n * 2, { largoMin: 4, largoMax: 9, nivelMax: 1 });
  const lista = [];
  for (let k = 0; k < n; k++) {
    const tipo = tipos[k % tipos.length];
    if (tipo === "calculo") {
      const c = cadenaCalculo(azar);
      lista.push({ tipo, titulo: "Cálculo mental", pasos: c.pasos, solucion: String(c.r) });
    } else {
      const d = defs.pop();
      if (!d) continue;
      if (tipo === "definicion") {
        lista.push({ tipo, titulo: "¿Qué palabra es?", texto: d.definicion, pista: `${d.categoria} · ${d.clave.length} letras`, solucion: d.forma });
      } else {
        let letras;
        do letras = azar.barajar([...d.clave]); while (letras.join("") === d.clave && d.clave.length > 1);
        lista.push({ tipo, titulo: "Revuelto", letras, texto: d.definicion, solucion: d.forma });
      }
    }
  }
  return azar.barajar(lista);
}

export default {
  id: "pulsador",
  nombre: "Pulsador",
  categoria: "pulsador",
  duracion: 180,
  descripcion: "El primero que pulse responde en voz alta. El presentador dice si acierta. Si fallas, ya no puedes pulsar en esa pregunta.",

  crear({ azar, config, inicio = Date.now() }) {
    const tipos = config?.pulsadorTipos?.length ? config.pulsadorTipos : ["definicion", "calculo", "revuelto"];
    return { preguntas: preguntas(azar, azar.barajar(tipos), 40), i: 0, abre: inicio + LECTURA, pulsado: null, bloqueados: [], anterior: null, aciertos: {} };
  },

  publica(ronda) {
    const p = ronda.preguntas[ronda.i];
    if (!p) return null;
    const { solucion, ...resto } = p;
    return resto;
  },

  vistaJugador(ronda, id) {
    return {
      i: ronda.i,
      abre: ronda.abre,
      pregunta: this.publica(ronda),
      pulsado: ronda.pulsado,
      bloqueado: ronda.bloqueados.includes(id),
      anterior: ronda.anterior,
      aciertos: ronda.aciertos[id] ?? 0,
    };
  },

  vistaTV(ronda) {
    return {
      i: ronda.i,
      abre: ronda.abre,
      pregunta: this.publica(ronda),
      pulsado: ronda.pulsado,
      bloqueados: ronda.bloqueados,
      anterior: ronda.anterior,
      aciertos: ronda.aciertos,
    };
  },

  vistaMando(ronda) {
    return { solucion: ronda.preguntas[ronda.i]?.solucion ?? null };
  },

  accion(ronda, id, msg) {
    if (msg.a !== "pulsar" || ronda.pulsado || ronda.bloqueados.includes(id) || !ronda.preguntas[ronda.i] || Date.now() < ronda.abre - 150) return false;
    ronda.pulsado = { id, t: Date.now() };
    return true;
  },

  accionHost(ronda, msg) {
    const p = ronda.preguntas[ronda.i];
    if (!p) return false;
    const siguiente = (quien, ok) => {
      ronda.anterior = { n: ronda.i, solucion: p.solucion, quien, ok };
      ronda.i++;
      ronda.abre = Date.now() + LECTURA;
      ronda.pulsado = null;
      ronda.bloqueados = [];
    };
    switch (msg.sub) {
      case "correcto":
        if (!ronda.pulsado) return false;
        ronda.aciertos[ronda.pulsado.id] = (ronda.aciertos[ronda.pulsado.id] ?? 0) + 1;
        siguiente(ronda.pulsado.id, true);
        return true;
      case "fallo":
        if (!ronda.pulsado) return false;
        ronda.bloqueados.push(ronda.pulsado.id);
        ronda.pulsado = null;
        return true;
      case "saltar":
        siguiente(null, false);
        return true;
    }
    return false;
  },

  terminado() {
    return false;
  },

  resultados(ronda, ids) {
    return ids.map((id) => {
      const n = ronda.aciertos[id] ?? 0;
      return { id, valor: n > 0 ? n : null, texto: `${n} ${n === 1 ? "acierto" : "aciertos"}` };
    });
  },

  resumen() {
    return null;
  },
};
