// LABERINTO DE CÁLCULOS · ecuaciones cruzadas (A op B = C) en horizontal y vertical.
// Algunos números vienen puestos; los huecos se rellenan con los números del banco.
// Gana quien complete más ecuaciones correctas.
import { nivelDificultad } from "../util.js";

const TAM = 9; // rejilla máxima 9×9 para que se lea bien en el móvil
const MAXV = 99;
const SIMBOLO = { "+": "+", "-": "−", "*": "×", "/": "÷" };

const clave = (r, c) => `${r},${c}`;

function operar(a, op, b) {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "*") return a * b;
  if (op === "/") return b !== 0 && a % b === 0 ? a / b : NaN;
  return NaN;
}

/** Coloca ecuaciones que se cruzan; cada una nueva comparte exactamente una casilla numérica. */
function colocarEcuaciones(azar, objetivo) {
  const celdas = new Map(); // clave -> { tipo: 'num'|'op'|'igual', ecs: [] }
  const ecs = [];
  const ocupada = (r, c) => celdas.has(clave(r, c));

  function intentar(r0, c0, dir, compartida) {
    const [dr, dc] = dir === "h" ? [0, 1] : [1, 0];
    const pos = [];
    for (let k = 0; k < 5; k++) pos.push([r0 + dr * k, c0 + dc * k]);
    if (pos.some(([r, c]) => r < 0 || c < 0 || r >= TAM || c >= TAM)) return false;
    // Antes y después de la ecuación, nada pegado.
    const antes = [r0 - dr, c0 - dc], despues = [r0 + dr * 5, c0 + dc * 5];
    if (ocupada(...antes) || ocupada(...despues)) return false;
    for (let k = 0; k < 5; k++) {
      const [r, c] = pos[k];
      const k2 = clave(r, c);
      if (k2 === compartida) continue;
      if (ocupada(r, c)) return false;
      // Vecinos perpendiculares libres (que no se formen líneas falsas).
      const vecinos = dir === "h" ? [[r - 1, c], [r + 1, c]] : [[r, c - 1], [r, c + 1]];
      if (vecinos.some(([vr, vc]) => ocupada(vr, vc))) return false;
    }
    const ec = { dir, celdas: pos.map(([r, c]) => clave(r, c)), id: ecs.length };
    pos.forEach(([r, c], k) => {
      const k2 = clave(r, c);
      const tipo = k === 1 ? "op" : k === 3 ? "igual" : "num";
      const x = celdas.get(k2) ?? { tipo, ecs: [], r, c };
      x.ecs.push(ec.id);
      celdas.set(k2, x);
    });
    ecs.push(ec);
    return true;
  }

  // Primera ecuación, más o menos centrada.
  const dir0 = azar() < 0.5 ? "h" : "v";
  intentar(dir0 === "h" ? azar.entero(1, TAM - 2) : azar.entero(0, 2), dir0 === "h" ? azar.entero(0, 2) : azar.entero(1, TAM - 2), dir0, null);

  for (let intento = 0; intento < 400 && ecs.length < objetivo; intento++) {
    const base = azar.elegir(ecs);
    const k = azar.elegir([0, 2, 4]);
    const compartida = base.celdas[k];
    if (celdas.get(compartida).ecs.length > 1) continue; // ya se cruza
    const dir = base.dir === "h" ? "v" : "h";
    const [r, c] = compartida.split(",").map(Number);
    const k2 = azar.elegir([0, 2, 4]); // posición de la casilla compartida en la nueva ecuación
    const [r0, c0] = dir === "h" ? [r, c - k2] : [r - k2, c];
    intentar(r0, c0, dir, compartida);
  }
  return { celdas, ecs };
}

/** Rellena valores: cada ecuación nueva solo tiene un número ya fijado (el que comparte). */
function asignarValores(azar, celdas, ecs) {
  const valor = new Map();
  for (const ec of ecs) {
    const [ka, , kb, , kc] = ec.celdas;
    const fijo = [ka, kb, kc].findIndex((k) => valor.has(k)); // 0=A, 1=B, 2=C, -1 ninguno
    const v = fijo >= 0 ? valor.get([ka, kb, kc][fijo]) : null;
    let ok = null;
    for (const op of azar.barajar(["+", "-", "*", "/"])) {
      ok = probar(op, fijo, v);
      if (ok) {
        ok.op = op;
        break;
      }
    }
    if (!ok) return null;
    valor.set(ka, ok.a);
    valor.set(kb, ok.b);
    valor.set(kc, ok.c);
    ec.op = ok.op;
    celdas.get(ec.celdas[1]).op = ok.op;
  }
  return valor;

  function probar(op, fijo, v) {
    const E = azar.entero;
    for (let t = 0; t < 30; t++) {
      let a, b, c;
      if (fijo === -1 || fijo === 0) a = fijo === 0 ? v : E(2, 30);
      if (fijo === 1) b = v;
      if (fijo === 2) c = v;
      if (op === "+") {
        if (c != null) { if (c < 3) return null; a = E(1, c - 1); b = c - a; }
        else if (a != null) { b = E(1, 30); c = a + b; }
        else { a = E(1, 30); c = a + b; }
      } else if (op === "-") {
        if (c != null) { b = E(1, 20); a = c + b; }
        else if (a != null) { if (a < 2) return null; b = E(1, a - 1); c = a - b; }
        else { a = b + E(1, 30); c = a - b; }
      } else if (op === "*") {
        if (c != null) {
          const divs = [2, 3, 4, 5, 6, 7, 8, 9].filter((d) => c % d === 0 && c / d >= 2);
          if (!divs.length) return null;
          b = azar.elegir(divs); a = c / b;
        } else if (a != null) { b = E(2, 9); c = a * b; }
        else { a = E(2, 12); c = a * b; }
      } else {
        if (c != null) { b = E(2, 9); a = c * b; }
        else if (a != null) {
          const divs = [2, 3, 4, 5, 6, 7, 8, 9].filter((d) => a % d === 0);
          if (!divs.length) return null;
          b = azar.elegir(divs); c = a / b;
        } else { b = b ?? E(2, 9); c = E(2, 12); a = b * c; }
      }
      if ([a, b, c].every((x) => Number.isInteger(x) && x >= 0 && x <= MAXV) && operar(a, op, b) === c) return { a, b, c };
    }
    return null;
  }
}

function generar(azar, d = 0) {
  for (let intento = 0; intento < 80; intento++) {
    const { celdas, ecs } = colocarEcuaciones(azar, [5, 7, 9][d + 1]);
    if (ecs.length < [4, 5, 6][d + 1]) continue;
    const valores = asignarValores(azar, celdas, ecs);
    if (!valores) continue;
    // Huecos: aproximadamente la mitad de los números, al menos uno por ecuación.
    const nums = [...valores.keys()];
    const huecos = new Set(azar.barajar(nums).slice(0, Math.round(nums.length * [0.35, 0.5, 0.65][d + 1])));
    for (const ec of ecs) {
      const propios = [ec.celdas[0], ec.celdas[2], ec.celdas[4]];
      if (!propios.some((k) => huecos.has(k))) huecos.add(azar.elegir(propios));
    }
    return { celdas, ecs, valores, huecos };
  }
  return null;
}

export default {
  id: "laberinto",
  nombre: "Laberinto de cálculos",
  categoria: "numeros",
  duracion: 120,
  breve: "Coloca los números para que cuadren las cuentas.",
  descripcion: "Completa las operaciones cruzadas con los números del banco. Cada operación se lee de izquierda a derecha o de arriba abajo.",

  crear({ azar, config, inicio = Date.now() }) {
    const g = generar(azar, nivelDificultad(config));
    const lista = [...g.celdas.values()];
    const r0 = Math.min(...lista.map((x) => x.r)), c0 = Math.min(...lista.map((x) => x.c));
    const filas = Math.max(...lista.map((x) => x.r)) - r0 + 1;
    const cols = Math.max(...lista.map((x) => x.c)) - c0 + 1;
    const rejilla = lista.map((x) => {
      const k = clave(x.r, x.c);
      return {
        k,
        r: x.r - r0,
        c: x.c - c0,
        tipo: x.tipo,
        texto: x.tipo === "op" ? SIMBOLO[x.op] : x.tipo === "igual" ? "=" : g.huecos.has(k) ? null : String(g.valores.get(k)),
      };
    });
    const banco = azar.barajar([...g.huecos].map((k) => g.valores.get(k)));
    return {
      filas, cols, rejilla, banco,
      ecs: g.ecs.map((e) => ({ celdas: e.celdas, op: e.op })),
      valores: Object.fromEntries(g.valores),
      huecos: [...g.huecos],
      inicio,
      jugadores: {},
    };
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { puestos: {}, correctas: 0 });
  },

  vistaJugador(ronda, id) {
    const j = this.estadoJugador(ronda, id);
    return { filas: ronda.filas, cols: ronda.cols, rejilla: ronda.rejilla, banco: ronda.banco, ecs: ronda.ecs.map((e) => e.celdas), puestos: j.puestos };
  },

  vistaTV(ronda) {
    return {
      filas: ronda.filas, cols: ronda.cols, rejilla: ronda.rejilla, ecs: ronda.ecs.map((e) => e.celdas),
      total: this.contables(ronda).length,
      jugadores: Object.fromEntries(Object.entries(ronda.jugadores).map(([id, j]) => [id, j.correctas])),
    };
  },

  /** Ecuaciones que tienen algún hueco (las ya completas de serie no cuentan). */
  contables(ronda) {
    const huecos = new Set(ronda.huecos);
    return ronda.ecs.filter((e) => [e.celdas[0], e.celdas[2], e.celdas[4]].some((k) => huecos.has(k)));
  },

  accion(ronda, id, msg) {
    if (msg.a !== "colocar" || typeof msg.puestos !== "object" || !msg.puestos) return false;
    const huecos = new Set(ronda.huecos);
    const puestos = {};
    const disponibles = [...ronda.banco];
    for (const [k, v] of Object.entries(msg.puestos)) {
      if (!huecos.has(k)) return false;
      const i = disponibles.indexOf(Number(v));
      if (i < 0) return false; // no puede usar números que no están en el banco
      disponibles.splice(i, 1);
      puestos[k] = Number(v);
    }
    const j = this.estadoJugador(ronda, id);
    j.puestos = puestos;
    const total = this.contables(ronda).length;
    const val = (k) => (huecos.has(k) ? puestos[k] : ronda.valores[k]);
    j.correctas = this.contables(ronda).filter((e) => {
      const [a, b, c] = [val(e.celdas[0]), val(e.celdas[2]), val(e.celdas[4])];
      return a != null && b != null && c != null && operar(a, e.op, b) === c;
    }).length;
    // El récord del laberinto es el menor tiempo: se apunta cuándo lo completaste.
    if (j.correctas === total && j.ms == null) j.ms = Math.max(0, Date.now() - (ronda.inicio ?? Date.now()));
    return true;
  },

  terminado(ronda, id) {
    return (ronda.jugadores[id]?.correctas ?? 0) === this.contables(ronda).length;
  },

  resultados(ronda, ids) {
    const total = this.contables(ronda).length;
    return ids.map((id) => {
      const j = ronda.jugadores[id];
      if (!j || !Object.keys(j.puestos).length) return { id, valor: null, texto: "No jugó" };
      // Completo: cuanto antes, mejor (siempre por encima de quien no lo completó).
      if (j.ms != null) {
        const t = `${(j.ms / 1000).toFixed(1).replace(".", ",")} s`;
        return { id, valor: 1e7 - j.ms, texto: `⏱ ${t}`, corto: t };
      }
      return { id, valor: j.correctas > 0 ? j.correctas : null, texto: `${j.correctas} de ${total} operaciones`, corto: `${j.correctas}/${total} cuentas` };
    });
  },

  resumen(ronda) {
    return { filas: ronda.filas, cols: ronda.cols, ecs: ronda.ecs.map((e) => e.celdas), rejilla: ronda.rejilla.map((x) => ({ ...x, texto: x.texto ?? String(ronda.valores[x.k]), hueco: x.texto == null })) };
  },
};
