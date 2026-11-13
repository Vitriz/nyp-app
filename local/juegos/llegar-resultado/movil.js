// Llegar al resultado · móvil.
// Arriba el objetivo (y, al lado y más pequeño, tu mejor resultado); en medio lo que ya has hecho y
// la operación que estás montando: [número] [signo] [número] = [resultado]; abajo los números y los signos.
//  - Tocar un número lo pone en el primer hueco libre (empezando por la izquierda); tocarlo otra vez lo quita.
//  - Tocar un signo lo pone o lo cambia.
//  - Si el resultado vale, la operación sube sola a la lista y aparecen huecos nuevos.
//    Si tiene decimales (o es negativo y no se puede), sale tachado y no sube.
import { h, botonMantener } from "../../comun/ui.js";
import { reiniciarAnim } from "../comun/util.js";
import { teclasFisicas } from "../../comun/teclas.js";

const SIMBOLO = { "+": "+", "-": "−", "*": "×", "/": "÷" };

/** Resultado exacto (puede tener decimales: se enseñan, pero no se pueden usar). */
function calcular(a, op, b) {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "*") return a * b;
  if (op === "/") return b === 0 ? null : a / b;
  return null;
}
const numTexto = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100).replace(".", ",")).replace("-", "−");

export function montar(cuerpo, e, ctx) {
  const base = e.datos.numeros;
  const objetivo = e.datos.objetivo;
  const negativos = Boolean(e.datos.negativos);
  let ops = [...(e.datos.ops ?? [])];
  let huecos = [null, null]; // índices de la lista actual
  let signo = null;
  let mejorAlcanzado = e.datos.mejor ?? null; // lo mejor que llegaste a tener, aunque luego deshagas
  let subiendo = 0; // temporizador mientras una operación válida está a punto de subir

  const mejor = h("div.lr-mejor-tarjeta");
  const mejorPasos = h("div.lr-mejor-pasos");
  const aviso = h("div.lr-aviso");
  const huecoA = h("button.lr-hueco", { type: "button", "data-h": 0, "aria-label": "Primer número" });
  const huecoOp = h("button.lr-hueco.lr-hueco-op", { type: "button", "aria-label": "Signo" });
  const huecoB = h("button.lr-hueco", { type: "button", "data-h": 1, "aria-label": "Segundo número" });
  const huecoR = h("button.lr-hueco.lr-resultado", { type: "button", "aria-label": "Resultado" });
  const montaje = h("div.lr-montaje", huecoA, huecoOp, huecoB, h("span.lr-igual", "="), huecoR);
  const fichas = h("div.lr-fichas");
  const botonesOp = h(
    "div.lr-ops",
    Object.entries(SIMBOLO).map(([op, s]) => h("button.boton.lr-op", { type: "button", "data-op": op }, s))
  );
  const historial = h("div.lr-historial");
  const deshacer = h("button.boton.suave", { type: "button", onclick: () => { ops.pop(); limpiar(); enviar(); pintar(); } }, "↶ Deshacer");
  const borrar = botonMantener("Borrar todo", () => { ops = []; limpiar(); enviar(); pintar(); }, { clase: ".suave", ms: 700 });
  const centro = h("div.lr-centro", historial, montaje, aviso);

  cuerpo.append(
    h(
      "div.lr.lr2",
      h("div.lr-arriba", h("div.lr-objetivo", h("span.suave", "Objetivo"), h("span.ficha.oscura.lr-numero", String(objetivo))), mejor),
      mejorPasos,
      centro,
      h("div.lr-abajo", fichas, botonesOp, h("div.pl-botones", deshacer, borrar))
    )
  );

  /** Repite las operaciones: qué números quedan, cuáles son resultados y los pasos hechos. */
  function estado() {
    let lista = base.map((v) => ({ v }));
    const pasos = [];
    for (const o of ops) {
      const a = lista[o.a].v, b = lista[o.b].v;
      const r = calcular(a, o.op, b);
      pasos.push({ a, op: o.op, b, r });
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
      const r = calcular(a.v, o.op, b.v);
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

  function limpiar() {
    clearTimeout(subiendo);
    subiendo = 0;
    huecos = [null, null];
    signo = null;
  }

  function enviar() {
    ctx.enviar({ a: "ops", ops });
  }

  /** El resultado de lo que hay montado: { v, vale, motivo } o null si falta algo. */
  function previo(lista) {
    if (huecos[0] == null || huecos[1] == null || !signo) return null;
    const v = calcular(lista[huecos[0]].v, signo, lista[huecos[1]].v);
    if (v == null) return { v: null, vale: false, motivo: "No se puede dividir entre 0" };
    if (!Number.isInteger(v)) return { v, vale: false, motivo: "Tiene decimales: no se puede usar" };
    if (v === 0) return { v, vale: false, motivo: "Da cero: no se puede usar" };
    if (v < 0 && !negativos) return { v, vale: false, motivo: "Sale negativo: no se puede usar" };
    return { v, vale: true };
  }

  function pintarHueco(b, i, lista) {
    const x = huecos[i] != null ? lista[huecos[i]] : null;
    b.textContent = x ? numTexto(x.v) : "";
    b.classList.toggle("lleno", Boolean(x));
    b.classList.toggle("nuevo", Boolean(x?.hecho));
  }

  function pintar() {
    const { lista, pasos } = estado();
    const enHueco = new Set(huecos.filter((x) => x != null));
    fichas.replaceChildren(
      ...lista.map((x, i) =>
        h(`button.ficha.lr-ficha${x.hecho ? ".nuevo" : ""}${enHueco.has(i) ? ".puesta" : ""}`, { type: "button", "data-i": i }, numTexto(x.v))
      )
    );
    pintarHueco(huecoA, 0, lista);
    pintarHueco(huecoB, 1, lista);
    huecoOp.textContent = signo ? SIMBOLO[signo] : "";
    huecoOp.classList.toggle("lleno", Boolean(signo));
    botonesOp.querySelectorAll(".lr-op").forEach((b) => b.classList.toggle("elegida", b.dataset.op === signo));

    const p = previo(lista);
    huecoR.replaceChildren(p?.v != null ? h(`span${p.vale ? "" : ".tachado"}`, numTexto(p.v)) : "?");
    huecoR.classList.toggle("lleno", Boolean(p));
    huecoR.classList.toggle("vale", Boolean(p?.vale));
    huecoR.classList.toggle("no-vale", Boolean(p && !p.vale));
    huecoR.disabled = !p?.vale;
    aviso.className = `lr-aviso${p && !p.vale ? " mal" : p?.vale ? " ok" : ""}`;
    aviso.textContent = p ? (p.vale ? (p.v === objetivo ? "🎉 ¡Exacto!" : "✔ Vale") : p.motivo) : huecos[0] == null ? "Toca un número" : !signo ? "Elige un signo" : huecos[1] == null ? "Toca otro número" : "";
    // Si vale, la operación sube sola a la lista un momento después (para que se vea el resultado).
    clearTimeout(subiendo);
    subiendo = p?.vale ? setTimeout(usarResultado, 520) : 0;

    // Lo que ya has hecho, como fichas pequeñas.
    historial.replaceChildren(
      ...pasos.map((x) =>
        h(
          "div.lr-montaje.lr-hecha",
          h("span.lr-hueco.lleno", numTexto(x.a)),
          h("span.lr-hueco.lr-hueco-op.lleno", SIMBOLO[x.op]),
          h("span.lr-hueco.lleno", numTexto(x.b)),
          h("span.lr-igual", "="),
          h(`span.lr-hueco.lleno.lr-res-hecho${x.r === objetivo ? ".exacto" : ""}`, numTexto(x.r))
        )
      )
    );
    historial.scrollTop = historial.scrollHeight;

    const ahora = mejorLocal();
    if (ahora && (!mejorAlcanzado || ahora.dist < mejorAlcanzado.dist)) mejorAlcanzado = ahora;
    const m = mejorAlcanzado;
    mejor.replaceChildren(
      h("small", "Tu mejor"),
      h("b.encaja", m ? numTexto(m.valor) : "—"),
      h("small", m ? (m.dist === 0 ? "¡Exacto!" : `a ${numTexto(m.dist)}`) : "")
    );
    mejor.classList.toggle("exacto", m?.dist === 0);
    // Si has deshecho, se sigue viendo cómo llegaste a tu mejor resultado.
    const hechos = pasos.map((x) => `${x.a} ${SIMBOLO[x.op]} ${x.b} = ${x.r}`);
    const enPantalla = m?.pasos?.length && m.pasos.every((t) => hechos.includes(t));
    mejorPasos.replaceChildren(...(m?.pasos?.length && !enPantalla ? [h("span.suave", "Así llegaste: "), m.pasos.join(" · ")] : []));
    deshacer.disabled = !ops.length;
  }

  function tocarNumero(i) {
    if (subiendo) return; // está subiendo una operación
    const ya = huecos.indexOf(i);
    if (ya >= 0) huecos[ya] = null; // tocarlo otra vez lo quita
    else if (huecos[0] == null) huecos[0] = i;
    else if (huecos[1] == null) huecos[1] = i;
    else huecos[1] = i; // los dos llenos: cambia el segundo
    navigator.vibrate?.(8);
    pintar();
  }

  function usarResultado() {
    subiendo = 0;
    const { lista } = estado();
    const p = previo(lista);
    if (!p?.vale) {
      if (p) reiniciarAnim(montaje, "sacudir");
      return;
    }
    const desde = montaje.getBoundingClientRect().top;
    // El servidor quiere los índices de la lista de ahora (el resultado se pone al final).
    ops.push({ a: huecos[0], b: huecos[1], op: signo });
    limpiar();
    enviar();
    pintar();
    // La operación sube desde los huecos hasta su sitio en la lista; los huecos nuevos aparecen.
    const fila = historial.lastElementChild;
    if (fila && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      historial.scrollTop = historial.scrollHeight;
      const dy = desde - fila.getBoundingClientRect().top;
      fila.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 380, easing: "cubic-bezier(0.25, 0.9, 0.3, 1)" });
      montaje.animate([{ opacity: 0, transform: "translateY(0.8rem) scale(0.96)" }, { opacity: 1, transform: "none" }], { duration: 300, delay: 160, easing: "ease-out", fill: "backwards" });
    }
    const nueva = fichas.lastElementChild;
    if (nueva) reiniciarAnim(nueva, "aparece");
    navigator.vibrate?.(p.v === objetivo ? [40, 40, 100] : 15);
  }

  fichas.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest(".lr-ficha");
    if (!b) return;
    ev.preventDefault();
    tocarNumero(Number(b.dataset.i));
  });
  // Tocar un hueco con número lo vacía.
  for (const [b, i] of [[huecoA, 0], [huecoB, 1]]) {
    b.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      if (huecos[i] == null || subiendo) return;
      huecos[i] = null;
      pintar();
    });
  }
  huecoOp.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    if (subiendo) return;
    signo = null;
    pintar();
  });
  huecoR.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    if (subiendo) {
      clearTimeout(subiendo); // si tocas el resultado, sube ya
      usarResultado();
    }
  });
  botonesOp.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest(".lr-op");
    if (!b || subiendo) return;
    ev.preventDefault();
    signo = b.dataset.op; // siempre cambia el signo
    navigator.vibrate?.(6);
    pintar();
  });

  // En el ordenador: + − × ÷ con las teclas, Enter usa el resultado, ⌫ vacía el último hueco.
  teclasFisicas(fichas, (t) => {
    const ops = { "+": "+", "-": "-", "*": "*", x: "*", "/": "/", ":": "/" };
    if (ops[t]) {
      signo = ops[t];
      return pintar();
    }
    if (t === "OK") return usarResultado();
    if (t === "⌫") {
      if (huecos[1] != null) huecos[1] = null;
      else if (signo) signo = null;
      else huecos[0] = null;
      return pintar();
    }
    return false;
  });

  pintar();
  return { actualizar() {}, desmontar: () => clearTimeout(subiendo) };
}
