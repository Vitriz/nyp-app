// Selector de juegos del modo solo, al estilo de las recreativas: una rueda con la lista a un lado
// y, al lado, la ficha del juego elegido. Se mueve con el dedo, la rueda del ratón o las flechas.
import { h } from "../comun/ui.js";
import { teclasFisicas } from "../comun/teclas.js";

const ICONOS = {
  "palabra-larga": "🔠", definicion: "📖", sopa: "🔍", revuelto: "🔀", paraulogico: "🐝",
  "calculo-mental": "🧠", "llegar-resultado": "🎯", "mates-fugaces": "⚡", laberinto: "🧩", pulsador: "🔔",
};
const PASO = 3.9; // rem entre elementos de la rueda
let ultimoId = null; // al volver, la rueda sigue en el último juego

/**
 * juegos: [{ id, nombre, categoria, descripcion, duracion, bloqueado }]
 * records: { id: { texto } } (o null: sin récords, p. ej. en la TV de PARTY)
 * textoJugar: texto del botón grande
 * alJugar(juego) / alDesbloquear(juego)
 */
export function selectorJuegos({ juegos, records = null, textoJugar = "¡Jugar! ▶", alJugar, alDesbloquear }) {
  records ??= {};
  const conRecords = arguments[0].records != null;
  const n = juegos.length;
  let sel = Math.max(0, juegos.findIndex((j) => j.id === ultimoId));
  const antes = new Array(n).fill(null);

  // ---- rueda
  const items = juegos.map((j, i) =>
    h(
      `button.sel-item.${j.categoria}${j.bloqueado ? ".bloqueado" : ""}`,
      { type: "button", "data-i": i, tabindex: -1 },
      h("span.sel-item-icono", j.bloqueado ? "🔒" : ICONOS[j.id] ?? "🎲"),
      h("span.sel-item-nombre", j.nombre),
      records[j.id] ? h("span.sel-item-copa", "🏆") : null
    )
  );
  const rueda = h("div.sel-rueda", { role: "listbox", "aria-label": "Juegos" }, h("div.sel-guia"), items);

  // ---- ficha del juego elegido
  const ficha = h("div.sel-ficha.tarjeta");
  const contador = h("span.sel-contador");

  function pintarFicha() {
    const j = juegos[sel];
    const r = records[j.id];
    const jugar = h(
      `button.boton.acento.grande.sel-jugar${j.bloqueado ? ".bloqueado" : ""}`,
      { type: "button", onclick: () => elegir() },
      j.bloqueado ? "🔒 Desbloquear" : textoJugar
    );
    ficha.replaceChildren(
      h(
        "div.sel-cabeza",
        h("span.sel-icono", ICONOS[j.id] ?? "🎲"),
        h("div", h("span.sel-cat", { palabras: "Palabras", numeros: "Números", pulsador: "Pulsador" }[j.categoria] ?? ""), h("h2.sel-nombre", j.nombre))
      ),
      h("p.sel-desc", j.descripcion),
      h(
        "div.sel-datos",
        h("div.sel-dato", h("small", "Tiempo"), h("b", `${j.duracion} s`)),
        conRecords ? h("div.sel-dato.record", h("small", "Tu récord"), h("b", r ? `🏆 ${r.texto}` : "—")) : h("div.sel-dato", h("small", "Tipo"), h("b", j.categoria === "palabras" ? "Palabras" : j.categoria === "pulsador" ? "Pulsador" : "Números"))
      ),
      jugar
    );
    ficha.classList.remove("cambia");
    void ficha.offsetWidth;
    ficha.classList.add("cambia");
    contador.textContent = `${sel + 1} / ${n}`;
  }

  function colocar() {
    items.forEach((el, i) => {
      // Distancia al elegido, dando la vuelta (la rueda no tiene fin).
      let d = (((i - sel) % n) + n) % n;
      if (d > n / 2) d -= n;
      const salto = antes[i] != null && Math.abs(d - antes[i]) > 1;
      antes[i] = d;
      const a = Math.abs(d);
      el.style.transition = salto ? "none" : "";
      el.style.transform = `translate(${(a * a * 0.55).toFixed(2)}rem, calc(-50% + ${d * PASO}rem)) scale(${1 - Math.min(a, 4) * 0.05})`;
      el.style.opacity = a > 3.5 ? "0" : String(1 - a * 0.16);
      el.style.zIndex = String(10 - a);
      el.classList.toggle("elegido", d === 0);
      el.setAttribute("aria-selected", String(d === 0));
    });
  }

  function mover(paso) {
    if (!paso) return;
    sel = (((sel + paso) % n) + n) % n;
    ultimoId = juegos[sel].id;
    navigator.vibrate?.(5);
    colocar();
    pintarFicha();
  }

  function ir(i) {
    if (i === sel) return elegir();
    mover(i - sel);
  }

  function elegir() {
    const j = juegos[sel];
    ultimoId = j.id;
    (j.bloqueado ? alDesbloquear : alJugar)(j);
  }

  // ---- dedo / ratón: arrastrar la rueda; tocar un juego lo elige
  let arrastre = null;
  rueda.addEventListener("pointerdown", (ev) => {
    arrastre = { y: ev.clientY, y0: ev.clientY, movido: false, id: ev.pointerId };
    rueda.setPointerCapture(ev.pointerId);
  });
  rueda.addEventListener("pointermove", (ev) => {
    if (!arrastre || ev.pointerId !== arrastre.id) return;
    const paso = parseFloat(getComputedStyle(document.documentElement).fontSize) * PASO * 0.8;
    const dy = arrastre.y - ev.clientY;
    if (Math.abs(ev.clientY - arrastre.y0) > 8) arrastre.movido = true;
    if (Math.abs(dy) >= paso) {
      mover(Math.trunc(dy / paso));
      arrastre.y -= Math.trunc(dy / paso) * paso;
    }
  });
  const soltar = (ev) => {
    if (!arrastre) return;
    const toque = !arrastre.movido;
    arrastre = null;
    if (!toque || ev.type === "pointercancel") return;
    // pointer capture: buscamos qué hay bajo el dedo
    const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".sel-item");
    if (el) ir(Number(el.dataset.i));
  };
  rueda.addEventListener("pointerup", soltar);
  rueda.addEventListener("pointercancel", soltar);

  let acumulado = 0;
  rueda.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      acumulado += ev.deltaY;
      if (Math.abs(acumulado) >= 40) {
        mover(Math.sign(acumulado));
        acumulado = 0;
      }
    },
    { passive: false }
  );

  // ---- teclado del ordenador
  teclasFisicas(rueda, (t) => {
    if (t === "ArrowUp" || t === "ArrowLeft") return mover(-1);
    if (t === "ArrowDown" || t === "ArrowRight") return mover(1);
    if (t === "PageUp") return mover(-3);
    if (t === "PageDown") return mover(3);
    if (t === "OK" || t === " ") return elegir();
    return false;
  });

  colocar();
  pintarFicha();

  const el = h(
    "div.sel-caja",
    h(
    "div.sel",
    h("div.sel-lado", ficha),
    h(
      "div.sel-lista",
      h("div.sel-titulo", h("span", "Elige juego"), contador),
      rueda,
      h("p.sel-ayuda", "↑ ↓ para elegir · Enter para jugar")
    )
    )
  );
  return el;
}
