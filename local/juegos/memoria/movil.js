// Memoria fotográfica · móvil: «¡Memoriza!» con las tarjetas a la vista y una barra que se acaba;
// luego se tapan (dan la vuelta) y llega la pregunta. Tras responder se ven las soluciones y sigue.
import { h } from "../../comun/ui.js";
import { reiniciarAnim } from "../comun/util.js";

// Las mismas reglas que el servidor.
function ordenBueno(p) {
  const l = p.textos.map((t, k) => [Number(t), k]).sort((a, b) => a[0] - b[0]);
  if (p.sentido === "baja") l.reverse();
  return l.map((x) => x[1]);
}
// Colores de «¿dónde estaba el ROJO?» (los mismos que el servidor).
const COLORES_MEM = { rojo: "#e5484d", azul: "#3b82f6", verde: "#30a46c", amarillo: "#f5d90a", naranja: "#f76b15", morado: "#8e4ec6", rosa: "#e93d82", marrón: "#8d5a3b", gris: "#8b8d98", negro: "#1c1c1f", blanco: "#ffffff", celeste: "#7dd3fc" };
const COLS_REJILLA = { 4: 2, 6: 3, 9: 3, 12: 4 };
const buscadas = (p) => p.textos.map((t, k) => [Number(t), k]).filter(([v]) => (v % 2 === 0) === p.par).map((x) => x[1]);

export function montar(cuerpo, e, ctx) {
  const d = e.datos;
  let i = d.i ?? 0;
  let aciertos = d.aciertos ?? 0;
  let vivo = true;
  const relojes = new Set();
  const despues = (ms, fn) => {
    const t = setTimeout(() => {
      relojes.delete(t);
      if (vivo) fn();
    }, ms);
    relojes.add(t);
  };

  const cols = d.rejilla <= 4 ? 2 : 3;
  const titulo = h("div.mem-titulo");
  const barra = h("div.mem-barra", h("i"));
  const tablero = h("div.mem-tablero", { style: { "--cols": cols } });
  const pregunta = h("div.mem-pregunta");
  const marcador = h("span.ficha", String(aciertos));
  // La pregunta va arriba, justo debajo del título (no al fondo de la pantalla).
  cuerpo.append(h("div.mem", h("div.mf-cont", "Aciertos", marcador), titulo, barra, pregunta, tablero));

  let tarjetas = []; // por cada tarjeta: elemento
  let huecosVacios = []; // en «¿dónde había un hueco?», los sitios vacíos tapados
  let estado = null; // { p, fase, tocadas, t0 }

  function prueba() {
    const p = d.pruebas[i];
    if (!p) {
      titulo.textContent = "¡Has hecho todas las pruebas!";
      tablero.replaceChildren();
      pregunta.replaceChildren();
      return;
    }
    estado = { p, fase: "ver", tocadas: [], t0: 0 };
    // Cada prueba trae su rejilla (va creciendo: cada 4 pruebas, una tarjeta más).
    const rej = p.rejilla ?? d.rejilla;
    tablero.style.setProperty("--cols", COLS_REJILLA[rej] ?? (rej <= 4 ? 2 : 3));
    // Huecos de la rejilla: en unos hay tarjeta y en otros no.
    tarjetas = [];
    huecosVacios = [];
    const huecos = Array.from({ length: rej }, (_, s) => h("div.mem-hueco", { "data-s": s }));
    p.sitios.forEach((s, k) => {
      const color = p.tipo === "colores" ? COLORES_MEM[p.textos[k]] : null;
      const cara = color ? h("span.mem-cara.mem-color", { style: { "--color": color }, "aria-label": p.textos[k] }) : h("span.mem-cara", p.textos[k]);
      const t = h("button.mem-carta", { type: "button", "data-k": k, "data-s": s }, cara, h("span.mem-dorso", "?"));
      huecos[s].replaceWith(t);
      huecos[s] = t;
      tarjetas[k] = t;
    });
    tablero.replaceChildren(...huecos);
    titulo.textContent = "👀 ¡Memoriza!";
    pregunta.replaceChildren();
    barra.classList.remove("oculta");
    barra.firstChild.style.transition = "none";
    barra.firstChild.style.width = "100%";
    void barra.offsetWidth;
    const ver = p.ver ?? d.ver;
    barra.firstChild.style.transition = `width ${ver}ms linear`;
    barra.firstChild.style.width = "0%";
    reiniciarAnim(tablero, "aparece");
    despues(ver, tapar);
  }

  function tapar() {
    const p = estado.p;
    estado.fase = "responder";
    estado.t0 = performance.now();
    barra.classList.add("oculta");
    tarjetas.forEach((t) => t.classList.add("tapada"));
    if (p.tipo === "orden") {
      titulo.textContent = p.sentido === "baja" ? "🔢 Tócalas de mayor a menor" : "🔢 Tócalas de menor a mayor";
    } else if (p.tipo === "paridad") {
      titulo.textContent = p.par ? "🎲 Toca todos los PARES" : "🎲 Toca todos los IMPARES";
    } else if (p.tipo === "colores") {
      titulo.textContent = "🎨 ¿Dónde estaba?";
      pregunta.replaceChildren(h("p", p.pregunta));
    } else if (p.tipo === "vacia") {
      titulo.textContent = "🕳️ ¿Dónde había un hueco?";
      // Los sitios vacíos también se tapan: hay que acordarse de cuál no tenía tarjeta.
      [...tablero.children].forEach((el) => {
        if (!el.classList.contains("mem-hueco")) return;
        const t = h("button.mem-carta.tapada", { type: "button", "data-s": el.dataset.s }, h("span.mem-cara", ""), h("span.mem-dorso", "?"));
        el.replaceWith(t);
        huecosVacios.push(t);
      });
    } else if (p.tipo === "pregunta") {
      titulo.textContent = "❓ Pregunta";
      pregunta.replaceChildren(h("p", p.pregunta));
    } else {
      titulo.textContent = "🔍 ¿Cuál ha cambiado?";
      // Se vuelven a ver, pero una es distinta.
      despues(450, () => {
        tarjetas.forEach((t, k) => {
          t.firstChild.textContent = p.despues[k];
          t.classList.remove("tapada");
        });
      });
    }
  }

  tablero.addEventListener("pointerdown", (ev) => {
    const t = ev.target.closest(".mem-carta");
    if (!t || estado?.fase !== "responder") return;
    ev.preventDefault();
    const k = Number(t.dataset.k);
    const p = estado.p;
    if (p.tipo === "vacia") {
      const s = Number(t.dataset.s);
      return responder(s, p.vacios.includes(s));
    }
    if (Number.isNaN(k)) return;
    if (p.tipo === "orden") {
      if (estado.tocadas.includes(k)) return;
      estado.tocadas.push(k);
      t.classList.remove("tapada");
      const bien = ordenBueno(p);
      const n = estado.tocadas.length - 1;
      if (bien[n] !== k) return responder(estado.tocadas, false, bien);
      t.classList.add("bien");
      navigator.vibrate?.(8);
      if (estado.tocadas.length === bien.length) responder(estado.tocadas, true, bien);
    } else if (p.tipo === "paridad") {
      if (estado.tocadas.includes(k)) return;
      estado.tocadas.push(k);
      t.classList.remove("tapada");
      const bien = buscadas(p);
      if (!bien.includes(k)) return responder(estado.tocadas, false);
      t.classList.add("bien");
      navigator.vibrate?.(8);
      if (estado.tocadas.length === bien.length) responder(estado.tocadas, true);
    } else responder(k, k === p.respuesta);
  });

  function responder(valor, ok, orden = null) {
    const p = estado.p;
    estado.fase = "visto";
    ctx.enviar({ a: "respuesta", i, valor, ms: Math.round(performance.now() - estado.t0) });
    if (ok) aciertos++;
    marcador.textContent = String(aciertos);
    navigator.vibrate?.(ok ? 20 : [30, 40, 30]);
    titulo.textContent = ok ? "✔ ¡Bien!" : "✘ ¡Casi!";
    // Se descubre todo: la buena en verde (y en el orden, el número de orden).
    if (p.tipo === "vacia") {
      // Se destapa todo: los huecos de verdad, en verde; si tocaste una tarjeta, en rojo.
      tarjetas.forEach((t) => t.classList.remove("tapada"));
      huecosVacios.forEach((t) => {
        t.classList.remove("tapada");
        t.classList.add("bien", "mem-vacia");
      });
      if (!ok) tablero.querySelector(`[data-s="${valor}"]`)?.classList.add("mal");
      reiniciarAnim(titulo, "aparece");
      i++;
      return despues(ok ? 900 : 1700, prueba);
    }
    tarjetas.forEach((t, k) => {
      t.classList.remove("tapada");
      if (p.tipo === "cambio") t.firstChild.textContent = k === p.respuesta ? `${p.textos[k]} → ${p.despues[k]}` : p.textos[k];
      if (p.tipo === "paridad") {
        t.classList.toggle("bien", buscadas(p).includes(k));
        if (!ok && k === valor.at(-1)) t.classList.add("mal");
        return;
      }
      if (p.tipo !== "orden") t.classList.toggle("bien", k === p.respuesta);
      if (p.tipo !== "orden" && k === valor && !ok) t.classList.add("mal");
    });
    if (p.tipo === "orden" && !ok) {
      const ultima = tarjetas[valor.at(-1)];
      ultima.classList.add("mal");
      orden.forEach((k, n) => tarjetas[k].setAttribute("data-orden", String(n + 1)));
    }
    reiniciarAnim(titulo, "aparece");
    i++;
    despues(ok ? 900 : 1700, prueba);
  }

  prueba();
  return {
    actualizar() {},
    desmontar() {
      vivo = false;
      relojes.forEach(clearTimeout);
    },
  };
}
