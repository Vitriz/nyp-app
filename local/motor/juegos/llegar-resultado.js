// LLEGAR AL RESULTADO · con 6 números y + − × ÷, acércate todo lo posible al objetivo.
// Cada número se usa una vez; los resultados intermedios deben ser enteros positivos.
// Gana quien quede más cerca (los exactos empatan).

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

function generar(azar) {
  let mejor = null;
  for (let intento = 0; intento < 30; intento++) {
    const grandes = azar.barajar([25, 50, 75, 100]).slice(0, azar.entero(1, 2));
    const peques = [];
    while (peques.length < 6 - grandes.length) {
      const n = azar.entero(1, 10);
      if (peques.filter((x) => x === n).length < 2) peques.push(n);
    }
    const numeros = azar.barajar([...peques, ...grandes]);
    const objetivo = azar.entero(101, 999);
    const sol = resolver(numeros, objetivo);
    if (!mejor || sol.dist < mejor.sol.dist) mejor = { numeros, objetivo, sol };
    if (sol.dist === 0) break;
  }
  return mejor;
}

export default {
  id: "llegar-resultado",
  nombre: "Llegar al resultado",
  categoria: "numeros",
  duracion: 60,
  descripcion: "Combina los números con + − × ÷ para llegar al número objetivo. Cada número se usa una vez. Si nadie llega, gana quien se acerque más.",

  crear({ azar }) {
    const g = generar(azar);
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
    let lista = [...ronda.numeros];
    const vistos = [...lista];
    for (const o of msg.ops) {
      const { a, b, op } = o ?? {};
      if (!Number.isInteger(a) || !Number.isInteger(b) || a === b || a >= lista.length || b >= lista.length) return false;
      const r = operar(lista[a], op, lista[b]);
      if (r == null || r <= 0) return false;
      lista = [...lista.filter((_, k) => k !== a && k !== b), r];
      vistos.push(r);
    }
    j.ops = msg.ops;
    if (msg.ops.length) {
      for (const v of vistos) {
        const dist = Math.abs(v - ronda.objetivo);
        if (!j.mejor || dist < j.mejor.dist) j.mejor = { valor: v, dist };
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
      return { id, valor: -m.dist, texto: m.dist === 0 ? `¡Exacto! ${m.valor}` : `${m.valor} (a ${m.dist})` };
    });
  },

  resumen(ronda) {
    return { objetivo: ronda.objetivo, numeros: ronda.numeros, pasos: ronda.solucion.pasos, exacta: ronda.solucion.dist === 0, valor: ronda.solucion.valor };
  },
};
