// PULSADOR · la TV muestra una pregunta; el primero que pulsa responde en voz alta
// y el presentador decide desde su mando si acierta (✔) o falla (✘).
// Si falla, ese jugador ya no puede pulsar en esa pregunta y los demás sí.
import { elegirDefiniciones, clave } from "../lexico.js";

// Batalla (sin presentador): quien pulsa tiene unos segundos para escribir la respuesta y se comprueba sola.
const PARA_RESPONDER = 5000;
const SIN_PULSAR = 30000; // si nadie pulsa en este tiempo, se pasa a la siguiente pregunta
const normal = (t) => clave(String(t ?? "").trim());
import { nivelDificultad } from "../util.js";

// Según el nivel (fácil, medio, difícil): segundos para leer, palabras y largo de las cuentas.
const LECTURA = [4000, 3000, 2000];
const PALABRAS = [{ largoMin: 4, largoMax: 6, nivelMax: 1 }, { largoMin: 4, largoMax: 9, nivelMax: 1 }, { largoMin: 6, largoMax: 11, nivelMax: 2 }];
const OPS_CUENTA = [[2, 2], [3, 3], [4, 5]];

function cadenaCalculo(azar, d = 0) {
  let v = azar.entero(2, 12);
  const pasos = [String(v)];
  const n = azar.entero(...OPS_CUENTA[d + 1]);
  for (let k = 0; k < n; k++) {
    const opciones = [["+", azar.entero(2, 15)]];
    if (v > 3) opciones.push(["−", azar.entero(2, Math.min(v - 1, 12))]);
    if (v <= 30) opciones.push(["×", azar.entero(2, 4)]);
    const divs = [2, 3, 4, 5].filter((d) => v % d === 0 && v / d >= 2);
    if (divs.length && v > 3) opciones.push(["÷", azar.elegir(divs)]);
    // Sin pasos que se repitan (+2 y +3) ni que se anulen (× 4 y ÷ 4).
    const prev = pasos.length > 1 ? pasos.at(-1).split(" ") : null;
    const inversa = { "+": "−", "−": "+", "×": "÷", "÷": "×" };
    const buenas = opciones.filter(([o, m]) => !prev || (o !== prev[0] && !(o === inversa[prev[0]] && String(m) === prev[1])));
    const [op, n] = azar.elegir(buenas.length ? buenas : opciones);
    v = op === "+" ? v + n : op === "−" ? v - n : op === "×" ? v * n : v / n;
    pasos.push(`${op} ${n}`);
  }
  return { pasos, r: v };
}

function preguntas(azar, tipos, n, d = 0) {
  const defs = elegirDefiniciones(azar, n * 2, PALABRAS[d + 1]);
  const lista = [];
  for (let k = 0; k < n; k++) {
    const tipo = tipos[k % tipos.length];
    if (tipo === "calculo") {
      const c = cadenaCalculo(azar, d);
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
  duracion: 120,
  breve: "Pulsa el primero y responde.",
  descripcion: "El primero que pulse responde. En PARTY lo dice en voz alta y el presentador decide; en una Batalla tiene 5 segundos para escribirlo. Si fallas, pierdes un punto y ya no puedes pulsar en esa pregunta.",

  crear({ azar, config, inicio = Date.now() }) {
    const tipos = config?.pulsadorTipos?.length ? config.pulsadorTipos : ["definicion", "calculo", "revuelto"];
    const d = nivelDificultad(config);
    const lectura = LECTURA[d + 1];
    return { preguntas: preguntas(azar, azar.barajar(tipos), 40, d), lectura, i: 0, abre: inicio + lectura, pulsado: null, bloqueados: [], anterior: null, aciertos: {}, fallos: {}, auto: Boolean(config?.pulsadorAuto), vistos: [] };
  },

  /** En Batalla la sala nos refresca a menudo (para la cuenta de 5 s y para pasar de pregunta solos). */
  tic(config) {
    return config?.pulsadorAuto ? 400 : 0;
  },

  /** Batalla: se acabó el tiempo para responder, o nadie pulsa, o ya han fallado todos → se sigue solo. */
  revisar(ronda) {
    if (!ronda.auto || !ronda.preguntas[ronda.i]) return;
    const ahora = Date.now();
    if (ronda.pulsado && ahora > ronda.pulsado.hasta) this.fallar(ronda, ronda.pulsado.id, null);
    const todos = ronda.vistos.length && ronda.vistos.every((id) => ronda.bloqueados.includes(id));
    if (!ronda.pulsado && (todos || ahora > ronda.abre + SIN_PULSAR)) this.siguiente(ronda, null, false);
  },

  siguiente(ronda, quien, ok, texto = null) {
    const p = ronda.preguntas[ronda.i];
    ronda.anterior = { n: ronda.i, solucion: p.solucion, quien, ok, texto };
    ronda.i++;
    ronda.abre = Date.now() + (ronda.lectura ?? 3000);
    ronda.pulsado = null;
    ronda.bloqueados = [];
  },

  fallar(ronda, id, texto) {
    // Fallar resta un punto (así no se pulsa a lo loco) y ya no puede pulsar en esta pregunta.
    ronda.fallos[id] = (ronda.fallos[id] ?? 0) + 1;
    ronda.bloqueados.push(id);
    ronda.pulsado = null;
    ronda.ultimoFallo = { id, texto, n: (ronda.ultimoFallo?.n ?? 0) + 1 };
  },

  publica(ronda) {
    const p = ronda.preguntas[ronda.i];
    if (!p) return null;
    const { solucion, ...resto } = p;
    return resto;
  },

  vistaJugador(ronda, id) {
    if (!ronda.vistos.includes(id)) ronda.vistos.push(id);
    this.revisar(ronda);
    return {
      auto: ronda.auto,
      ultimoFallo: ronda.ultimoFallo ?? null,
      fallos: ronda.fallos[id] ?? 0,
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
    this.revisar(ronda);
    return {
      i: ronda.i,
      abre: ronda.abre,
      pregunta: this.publica(ronda),
      pulsado: ronda.pulsado,
      bloqueados: ronda.bloqueados,
      anterior: ronda.anterior,
      aciertos: ronda.aciertos,
      fallos: ronda.fallos ?? {},
    };
  },

  vistaMando(ronda) {
    return { solucion: ronda.preguntas[ronda.i]?.solucion ?? null };
  },

  accion(ronda, id, msg) {
    this.revisar(ronda);
    if (msg.a === "responder") {
      // Batalla: la respuesta escrita de quien pulsó (un intento).
      const p = ronda.preguntas[ronda.i];
      if (!ronda.auto || !p || ronda.pulsado?.id !== id) return false;
      const ok = p.tipo === "calculo" ? Number(String(msg.texto ?? "").replace(",", ".")) === Number(p.solucion) : normal(msg.texto) === normal(p.solucion);
      if (ok) {
        ronda.aciertos[id] = (ronda.aciertos[id] ?? 0) + 1;
        this.siguiente(ronda, id, true, String(msg.texto ?? ""));
      } else this.fallar(ronda, id, String(msg.texto ?? "").slice(0, 30));
      return true;
    }
    if (msg.a !== "pulsar" || ronda.pulsado || ronda.bloqueados.includes(id) || !ronda.preguntas[ronda.i] || Date.now() < ronda.abre - 150) return false;
    ronda.pulsado = { id, t: Date.now(), hasta: ronda.auto ? Date.now() + PARA_RESPONDER : null };
    return true;
  },

  accionHost(ronda, msg) {
    const p = ronda.preguntas[ronda.i];
    if (!p) return false;
    const siguiente = (quien, ok) => {
      ronda.anterior = { n: ronda.i, solucion: p.solucion, quien, ok };
      ronda.i++;
      ronda.abre = Date.now() + (ronda.lectura ?? 3000);
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
        // Fallar resta un punto (así no se pulsa a lo loco).
        ronda.fallos = ronda.fallos ?? {};
        ronda.fallos[ronda.pulsado.id] = (ronda.fallos[ronda.pulsado.id] ?? 0) + 1;
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
      const f = ronda.fallos?.[id] ?? 0;
      const puntos = n - f;
      const txtFallos = f ? ` · ${f} ${f === 1 ? "fallo" : "fallos"}` : "";
      return { id, valor: n || f ? puntos : null, texto: `${puntos} ${Math.abs(puntos) === 1 ? "punto" : "puntos"} (${n} ${n === 1 ? "acierto" : "aciertos"}${txtFallos})`, corto: `${puntos} pts` };
    });
  },

  resumen() {
    return null;
  },
};
