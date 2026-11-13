// Llegar al resultado · móvil: toca un número, una operación y otro número.
// Los números usados desaparecen y el resultado aparece como número nuevo.
import { h, botonMantener } from "../../comun/ui.js";
import { reiniciarAnim } from "../comun/util.js";

const SIMBOLO = { "+": "+", "-": "−", "*": "×", "/": "÷" };

function operar(a, op, b) {
  if (op === "+") return a + b;
  if (op === "-") return a > b ? a - b : null;
  if (op === "*") return a * b;
  if (op === "/") return a % b === 0 ? a / b : null;
  return null;
}

export function montar(cuerpo, e, ctx) {
  const base = e.datos.numeros;
  const objetivo = e.datos.objetivo;
  let ops = [...(e.datos.ops ?? [])];
  let selA = null, selOp = null, nuevo = null;
  let mejorAlcanzado = e.datos.mejor ?? null; // cuenta lo mejor que hayas llegado a tener, aunque luego deshagas

  const mejor = h("div.lr-mejor");
  const mejorPasos = h("div.lr-mejor-pasos");
  const aviso = h("div.pl-aviso");
  const fichas = h("div.lr-fichas");
  const botonesOp = h(
    "div.lr-ops",
    Object.entries(SIMBOLO).map(([op, s]) => h("button.boton.lr-op", { type: "button", "data-op": op }, s))
  );
  const historial = h("div.lr-historial");
  const deshacer = h("button.boton.suave", { type: "button", onclick: () => { ops.pop(); limpiarSel(); enviar(); pintar(); } }, "↶ Deshacer");
  const borrar = botonMantener("Borrar todo", () => { ops = []; limpiarSel(); enviar(); pintar(); }, { clase: ".suave", ms: 700 });

  cuerpo.append(
    h(
      "div.lr",
      h("div.lr-objetivo", h("span.suave", "Objetivo"), h("span.ficha.oscura.lr-numero", String(objetivo))),
      h("div.lr-mejor-caja", mejor, mejorPasos),
      historial,
      aviso,
      h("div.lr-abajo", fichas, botonesOp, h("div.pl-botones", deshacer, borrar))
    )
  );

  /** Repite las operaciones para saber qué números quedan y cuáles han salido. */
  function estado() {
    let lista = base.map((v) => ({ v }));
    const pasos = [];
    for (const o of ops) {
      const a = lista[o.a].v, b = lista[o.b].v;
      const r = operar(a, o.op, b);
      pasos.push(`${a} ${SIMBOLO[o.op]} ${b} = ${r}`);
      lista = [...lista.filter((_, k) => k !== o.a && k !== o.b), { v: r, hecho: true }];
    }
    return { lista, pasos };
  }

  /** Lo más cerca que se ha llegado con las operaciones de ahora, con los pasos que llevan a ese número. */
  function mejorLocal() {
    if (!ops.length) return null;
    let m = null;
    let lista = base.map((v) => ({ v, pasos: [] }));
    const todos = [...lista];
    for (const o of ops) {
      const a = lista[o.a], b = lista[o.b];
      const r = operar(a.v, o.op, b.v);
      const nuevo = { v: r, pasos: [...a.pasos, ...b.pasos, `${a.v} ${SIMBOLO[o.op]} ${b.v} = ${r}`] };
      lista = [...lista.filter((_, k) => k !== o.a && k !== o.b), nuevo];
      todos.push(nuevo);
    }
    for (const x of todos) {
      const d = Math.abs(x.v - objetivo);
      if (!m || d < m.dist) m = { valor: x.v, dist: d, pasos: x.pasos };
    }
    return m;
  }

  function limpiarSel() {
    selA = null;
    selOp = null;
  }

  function enviar() {
    ctx.enviar({ a: "ops", ops });
  }

  function pintar() {
    const { lista, pasos } = estado();
    fichas.replaceChildren(
      ...lista.map((x, i) =>
        h(
          `button.ficha.lr-ficha${x.hecho ? ".nuevo" : ""}${i === selA ? ".elegida" : ""}${i === nuevo ? ".aparece" : ""}`,
          { type: "button", "data-i": i },
          String(x.v)
        )
      )
    );
    nuevo = null;
    botonesOp.querySelectorAll(".lr-op").forEach((b) => {
      b.classList.toggle("elegida", b.dataset.op === selOp);
      b.disabled = selA == null;
    });
    historial.replaceChildren(...pasos.map((p) => h("div", p)));
    const ahora = mejorLocal();
    if (ahora && (!mejorAlcanzado || ahora.dist < mejorAlcanzado.dist)) mejorAlcanzado = ahora;
    const m = mejorAlcanzado;
    mejor.replaceChildren(
      m ? h("span", m.dist === 0 ? "🎉 ¡Exacto!" : `Tu mejor: ${m.valor} (a ${m.dist})`) : h("span.suave", "Toca un número para empezar")
    );
    mejor.classList.toggle("exacto", m?.dist === 0);
    // Si has deshecho, se sigue viendo cómo llegaste a tu mejor resultado.
    const enPantalla = m?.pasos?.length && m.pasos.every((p) => pasos.includes(p));
    mejorPasos.replaceChildren(...(m?.pasos?.length && !enPantalla ? [h("span.suave", "Así llegaste: "), m.pasos.join(" · ")] : []));
    deshacer.disabled = !ops.length;
  }

  fichas.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest(".lr-ficha");
    if (!b) return;
    ev.preventDefault();
    const i = Number(b.dataset.i);
    navigator.vibrate?.(8);
    if (selA == null || selOp == null) {
      selA = selA === i ? null : i;
      selOp = null;
      aviso.textContent = "";
      return pintar();
    }
    if (i === selA) {
      limpiarSel(); // tocar otra vez el mismo número lo suelta
      return pintar();
    }
    const { lista } = estado();
    const r = operar(lista[selA].v, selOp, lista[i].v);
    if (r == null || r <= 0) {
      aviso.className = "pl-aviso mal";
      aviso.textContent = selOp === "/" ? "✘ La división tiene que dar exacta" : "✘ No puede dar cero ni negativo";
      selOp = null; // el primer número sigue elegido; toca otra operación
      reiniciarAnim(fichas, "sacudir");
      navigator.vibrate?.([30, 40, 30]);
      return pintar();
    }
    ops.push({ a: selA, b: i, op: selOp });
    limpiarSel();
    nuevo = lista.length - 2; // el resultado queda al final de la lista
    aviso.className = "pl-aviso";
    aviso.textContent = "";
    enviar();
    pintar();
    if (r === objetivo) navigator.vibrate?.([40, 40, 100]);
  });

  botonesOp.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest(".lr-op");
    if (!b || selA == null) return;
    ev.preventDefault();
    selOp = selOp === b.dataset.op ? null : b.dataset.op;
    pintar();
  });

  pintar();
  return { actualizar() {} };
}
