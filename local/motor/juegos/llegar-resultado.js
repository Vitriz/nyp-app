// LLEGAR AL RESULTADO · con 6 números y + − × ÷, acércate todo lo posible al objetivo.
// Cada número se usa una vez; los resultados intermedios deben ser enteros positivos.
// Gana quien quede más cerca (los exactos empatan).
import { nivelDificultad } from "../util.js";

const SIMBOLO = { "+": "+", "-": "−", "*": "×", "/": "÷" };

export function operar(a, op, b) {
  switch (op) {
    case "+": return a + b;
    case "-": return a > b ? a - b : null;
    case "*": return a * b;
    case "/": return b > 0 && a % b === 0 ? a / b : null;
  }
  return null;
}

/**
 * Busca la mejor forma de llegar al objetivo. Prueba primero con pocos pasos (búsqueda por
 * profundidad creciente), así la solución que se enseña es la más corta y fácil de seguir.
 */
export function resolver(numeros, objetivo) {
  let mejor = { valor: null, dist: Infinity, pasos: [] };
  for (const n of numeros) {
    if (Math.abs(n - objetivo) < mejor.dist) mejor = { valor: n, dist: Math.abs(n - objetivo), pasos: [] };
  }
  for (let limite = 1; limite < numeros.length && mejor.dist > 0; limite++) {
    const vistos = new Set();
    const buscar = (lista, pasos) => {
      const clave = [...lista].sort((a, b) => a - b).join(",");
      if (vistos.has(clave)) return;
      vistos.add(clave);
      for (let i = 0; i < lista.length; i++) {
        for (let j = 0; j < lista.length; j++) {
          if (i === j) continue;
          const a = lista[i], b = lista[j];
          for (const op of ["+", "-", "*", "/"]) {
            if ((op === "+" || op === "*") && i > j) continue; // conmutativas: una vez basta
            if ((op === "*" || op === "/") && (b === 1 || a === 1)) continue;
            const r = operar(a, op, b);
            if (r == null || r === 0 || r > 5000) continue;
            const paso = `${a} ${SIMBOLO[op]} ${b} = ${r}`;
            const d = Math.abs(r - objetivo);
            if (d < mejor.dist) mejor = { valor: r, dist: d, pasos: [...pasos, paso] };
            if (mejor.dist === 0) return;
            const resto = lista.filter((_, k) => k !== i && k !== j);
            if (resto.length && pasos.length + 1 < limite) buscar([...resto, r], [...pasos, paso]);
            if (mejor.dist === 0) return;
          }
        }
      }
    };
    buscar(numeros, []);
  }
  return mejor;
}

/** Números de partida: 1 o 2 grandes y el resto pequeños. */
function numerosAlAzar(azar) {
  const grandes = azar.barajar([25, 50, 75, 100]).slice(0, azar.entero(1, 2));
  const peques = [];
  while (peques.length < 6 - grandes.length) {
    const n = azar.entero(1, 10);
    if (peques.filter((x) => x === n).length < 2) peques.push(n);
  }
  return azar.barajar([...peques, ...grandes]);
}

/** Un objetivo que seguro se puede alcanzar: combinando los números al azar hasta caer en el rango. */
function objetivoAlcanzable(azar, numeros, [min, max]) {
  for (let intento = 0; intento < 400; intento++) {
    let lista = [...numeros];
    while (lista.length > 1) {
      const [i, j] = azar.barajar(lista.map((_, k) => k)).slice(0, 2);
      const r = operar(lista[i], azar.elegir(["+", "-", "*", "/"]), lista[j]);
      if (r == null || r === 0 || r > 5000) continue;
      lista = [...lista.filter((_, k) => k !== i && k !== j), r];
      if (r >= min && r <= max) return r;
    }
  }
  return null;
}

function generar(azar, d = 0) {
  const rango = [[50, 300], [101, 999], [300, 999]][d + 1];
  let mejor = null;
  for (let intento = 0; intento < 30; intento++) {
    const numeros = numerosAlAzar(azar);
    const objetivo = azar.entero(...rango);
    const sol = resolver(numeros, objetivo);
    if (!mejor || sol.dist < mejor.sol.dist) mejor = { numeros, objetivo, sol };
    if (sol.dist === 0) return mejor;
  }
  // Siempre tiene que haber forma de llegar: si no ha salido, buscamos un objetivo que sí se pueda.
  for (let intento = 0; intento < 50; intento++) {
    const numeros = numerosAlAzar(azar);
    const objetivo = objetivoAlcanzable(azar, numeros, rango);
    if (objetivo == null) continue;
    const sol = resolver(numeros, objetivo);
    if (sol.dist === 0) return { numeros, objetivo, sol };
  }
  return mejor;
}

export default {
  id: "llegar-resultado",
  nombre: "Llegar al resultado",
  categoria: "numeros",
  duracion: 60,
  descripcion: "Combina los números con + − × ÷ para llegar al número objetivo. Cada número se usa una vez. Si nadie llega, gana quien se acerque más.",

  crear({ azar, config }) {
    const g = generar(azar, nivelDificultad(config));
    return { numeros: g.numeros, objetivo: g.objetivo, solucion: g.sol, jugadores: {} };
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { ops: [], mejor: null });
  },

  vistaJugador(ronda, id) {
    const j = this.estadoJugador(ronda, id);
    return { numeros: ronda.numeros, objetivo: ronda.objetivo, ops: j.ops, mejor: j.mejor };
  },

  vistaTV(ronda) {
    return {
      numeros: ronda.numeros,
      objetivo: ronda.objetivo,
      jugadores: Object.fromEntries(Object.entries(ronda.jugadores).map(([id, j]) => [id, j.mejor?.dist ?? null])),
    };
  },

  /** Repite las operaciones del jugador desde los números iniciales y comprueba que son válidas. */
  accion(ronda, id, msg) {
    if (msg.a !== "ops" || !Array.isArray(msg.ops) || msg.ops.length > 5) return false;
    const j = this.estadoJugador(ronda, id);
    // Cada número lleva los pasos que lo han formado (así se guarda cómo se llegó al mejor).
    let lista = ronda.numeros.map((v) => ({ v, pasos: [] }));
    const vistos = [...lista];
    for (const o of msg.ops) {
      const { a, b, op } = o ?? {};
      if (!Number.isInteger(a) || !Number.isInteger(b) || a === b || a >= lista.length || b >= lista.length) return false;
      const r = operar(lista[a].v, op, lista[b].v);
      if (r == null || r <= 0) return false;
      const nuevo = { v: r, pasos: [...lista[a].pasos, ...lista[b].pasos, `${lista[a].v} ${SIMBOLO[op]} ${lista[b].v} = ${r}`] };
      lista = [...lista.filter((_, k) => k !== a && k !== b), nuevo];
      vistos.push(nuevo);
    }
    j.ops = msg.ops;
    if (msg.ops.length) {
      for (const x of vistos) {
        const dist = Math.abs(x.v - ronda.objetivo);
        if (!j.mejor || dist < j.mejor.dist || (dist === j.mejor.dist && x.pasos.length < (j.mejor.pasos?.length ?? 0) && x.pasos.length)) j.mejor = { valor: x.v, dist, pasos: x.pasos };
      }
    }
    return true;
  },

  terminado(ronda, id) {
    return ronda.jugadores[id]?.mejor?.dist === 0;
  },

  resultados(ronda, ids) {
    return ids.map((id) => {
      const m = ronda.jugadores[id]?.mejor;
      if (!m) return { id, valor: null, texto: "No jugó" };
      const detalle = (m.pasos ?? []).map((t) => ({ t, k: "paso" }));
      return { id, valor: -m.dist, texto: m.dist === 0 ? `¡Exacto! ${m.valor}` : `${m.valor} (a ${m.dist})`, detalle };
    });
  },

  resumen(ronda) {
    return { objetivo: ronda.objetivo, numeros: ronda.numeros, pasos: ronda.solucion.pasos, exacta: ronda.solucion.dist === 0, valor: ronda.solucion.valor };
  },
};
