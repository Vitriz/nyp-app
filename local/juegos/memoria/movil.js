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
    // Huecos de la rejilla: en unos hay tarjeta y en otros no.
    tarjetas = [];
    const huecos = Array.from({ length: d.rejilla }, () => h("div.mem-hueco"));
    p.sitios.forEach((s, k) => {
      const t = h("button.mem-carta", { type: "button", "data-k": k }, h("span.mem-cara", p.textos[k]), h("span.mem-dorso", "?"));
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
    barra.firstChild.style.transition = `width ${d.ver}ms linear`;
    barra.firstChild.style.width = "0%";
    reiniciarAnim(tablero, "aparece");
    despues(d.ver, tapar);
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
