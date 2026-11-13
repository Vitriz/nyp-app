// KenKen · móvil: la cuadrícula y debajo los números del 1 al N. Tocas una casilla y luego el número.
// Los repetidos en fila o columna se marcan en rojo, y la cuenta de cada jaula se pone verde cuando cuadra.
import { h, confeti } from "../../comun/ui.js";
import { teclasFisicas, marcarTecla } from "../../comun/teclas.js";
import { crearRejilla } from "./rejilla.js";

// Las mismas reglas que el servidor (para avisar al momento).
function jaulaBien(j, v) {
  const x = j.celdas.map((k) => v[k]);
  if (x.some((y) => !y)) return null; // aún no está llena
  if (!j.op) return x[0] === j.objetivo;
  if (j.op === "+") return x.reduce((a, b) => a + b, 0) === j.objetivo;
  if (j.op === "×") return x.reduce((a, b) => a * b, 1) === j.objetivo;
  const [a, b] = [Math.max(...x), Math.min(...x)];
  return j.op === "−" ? a - b === j.objetivo : a / b === j.objetivo;
}

const AYUDA = "Los números de cada zona, con su signo, dan su resultado";

export function montar(cuerpo, e, ctx) {
  const d = e.datos;
  const n = d.n;
  const valores = [...(d.valores ?? new Array(n * n).fill(0))];
  let sel = valores.findIndex((v) => !v);
  if (sel < 0) sel = 0;
  let acabado = Boolean(d.resuelto);

  const rejilla = crearRejilla(d);
  const aviso = h("div.pl-aviso.suave", AYUDA);
  const teclas = [...Array.from({ length: n }, (_, i) => String(i + 1)), "⌫"];
  const teclado = h(
    "div.kk-teclado",
    { style: { "--cols": Math.min(teclas.length, 7) } },
    teclas.map((t) => h(`button.boton${t === "⌫" ? ".suave" : ""}.kk-tecla`, { type: "button", "data-t": t }, t))
  );
  cuerpo.append(h("div.kk-pantalla", h("div.kk-zona", rejilla.el), aviso, teclado));

  rejilla.el.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest(".kk-celda");
    if (!b) return;
    ev.preventDefault();
    sel = Number(b.dataset.k);
    pintar();
  });
  teclado.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest("[data-t]");
    if (!b) return;
    ev.preventDefault();
    pulsar(b.dataset.t);
  });
  // En el ordenador: números, ⌫ y las flechas para moverse.
  teclasFisicas(teclado, (t) => {
    if (/^[1-9]$/.test(t) && Number(t) <= n) {
      marcarTecla(teclado, t);
      return pulsar(t);
    }
    if (t === "⌫") return pulsar(t);
    const mov = { ArrowUp: -n, ArrowDown: n, ArrowLeft: -1, ArrowRight: 1 }[t];
    if (mov) {
      sel = Math.max(0, Math.min(n * n - 1, sel + mov));
      return pintar();
    }
    return false;
  });

  function pulsar(t) {
    if (acabado) return;
    valores[sel] = t === "⌫" ? 0 : Number(t);
    navigator.vibrate?.(6);
    // Tras escribir, a la siguiente casilla vacía de la misma fila (si la hay).
    if (t !== "⌫") {
      const fila = Math.floor(sel / n);
      for (let c = (sel % n) + 1; c < n; c++) if (!valores[fila * n + c]) { sel = fila * n + c; break; }
    }
    ctx.enviar({ a: "valores", v: valores });
    pintar();
  }

  function pintar() {
    rejilla.poner(valores);
    const choca = new Set();
    for (let i = 0; i < n; i++) {
      for (const linea of [[...Array(n)].map((_, j) => i * n + j), [...Array(n)].map((_, j) => j * n + i)]) {
        const vistos = new Map();
        for (const k of linea) if (valores[k]) vistos.set(valores[k], [...(vistos.get(valores[k]) ?? []), k]);
        for (const ks of vistos.values()) if (ks.length > 1) ks.forEach((k) => choca.add(k));
      }
    }
    const estado = new Map();
    d.jaulas.forEach((j) => {
      const ok = jaulaBien(j, valores);
      j.celdas.forEach((k) => estado.set(k, ok));
    });
    rejilla.celdas.forEach((c, k) => {
      c.classList.toggle("sel", k === sel && !acabado);
      c.classList.toggle("choca", choca.has(k));
      c.classList.toggle("jaula-bien", estado.get(k) === true);
      c.classList.toggle("jaula-mal", estado.get(k) === false);
    });
    const lleno = valores.every(Boolean);
    const todo = lleno && !choca.size && d.jaulas.every((j) => jaulaBien(j, valores));
    if (todo && !acabado) {
      acabado = true;
      confeti(70);
      navigator.vibrate?.([40, 40, 120]);
    }
    rejilla.el.classList.toggle("resuelto", acabado);
    if (acabado) rejilla.celdas.forEach((c) => c.classList.remove("sel"));
    aviso.className = `pl-aviso${acabado ? " ok" : choca.size ? " mal" : ""}`;
    aviso.textContent = acabado ? "🎉 ¡Resuelto!" : choca.size ? "Hay números repetidos en una fila o columna" : lleno ? "Alguna zona no cuadra" : AYUDA;
  }

  pintar();
  return {
    actualizar(e) {
      if (e.datos?.resuelto) acabado = true;
    },
  };
}
