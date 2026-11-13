// Selector de juegos del modo solo, al estilo de las recreativas: una rueda con la lista a un lado
// y, al lado, la ficha del juego elegido. Se mueve con el dedo, la rueda del ratón o las flechas.
import { h } from "../comun/ui.js";
import { teclasFisicas } from "../comun/teclas.js";

export const ICONOS = {
  "palabra-larga": "🔠", definicion: "📖", sopa: "🔍", revuelto: "🔀", paraulogico: "🐝",
  "calculo-mental": "🧠", "llegar-resultado": "🎯", "mates-fugaces": "⚡", laberinto: "🧩", pulsador: "🔔",
};
const PASO = 3.9; // rem entre elementos de la rueda
let ultimoId = null; // al volver, la rueda sigue en el último juego

/**
 * Una píldora que gira como una rueda (de arriba a abajo): ▲ y ▼ van de una en una,
 * y también se puede arrastrar el valor con el dedo o usar la rueda del ratón.
 * alPaso(+1 | -1): pide pasar al siguiente o al anterior.
 */
function ruedaValor(icono, etiqueta, alPaso) {
  const arriba = h("button.sel-pil-flecha", { type: "button", "aria-label": `${etiqueta}: anterior` }, "▲");
  const abajo = h("button.sel-pil-flecha", { type: "button", "aria-label": `${etiqueta}: siguiente` }, "▼");
  const ventana = h("div.sel-pil-ventana", { role: "spinbutton", "aria-label": etiqueta });
  const el = h("div.sel-pildora", { title: etiqueta }, h("span.sel-pil-icono", { "aria-hidden": "true" }, icono), arriba, ventana, abajo);
  arriba.addEventListener("click", () => alPaso(-1));
  abajo.addEventListener("click", () => alPaso(1));
  let arrastre = null;
  ventana.addEventListener("pointerdown", (ev) => {
    arrastre = { y: ev.clientY, id: ev.pointerId };
    ventana.setPointerCapture(ev.pointerId);
  });
  ventana.addEventListener("pointermove", (ev) => {
    if (!arrastre || ev.pointerId !== arrastre.id) return;
    const paso = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.4;
    const dy = arrastre.y - ev.clientY; // dedo hacia arriba: el siguiente
    if (Math.abs(dy) >= paso) {
      alPaso(Math.sign(dy));
      arrastre.y = ev.clientY;
    }
  });
  const soltar = () => (arrastre = null);
  ventana.addEventListener("pointerup", soltar);
  ventana.addEventListener("pointercancel", soltar);
  let acumulado = 0;
  ventana.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      acumulado += ev.deltaY;
      if (Math.abs(acumulado) >= 40) {
        alPaso(Math.sign(acumulado));
        acumulado = 0;
      }
    },
    { passive: false }
  );
  let ultimo = null;
  return {
    el,
    /** textos: los valores ya escritos; i: el elegido. El valor rueda hacia arriba o abajo al cambiar. */
    pintar(textos, i) {
      const dir = ultimo == null || ultimo.textos !== textos.join() ? 0 : Math.sign(i - ultimo.i);
      if (ultimo && ultimo.textos === textos.join() && ultimo.i === i) return;
      ultimo = { textos: textos.join(), i };
      ventana.replaceChildren(h(`span.sel-pil-valor${dir > 0 ? ".sube" : dir < 0 ? ".baja" : ""}`, textos[i] ?? ""));
      ventana.setAttribute("aria-valuetext", textos[i] ?? "");
      arriba.disabled = i <= 0;
      abajo.disabled = i >= textos.length - 1;
    },
  };
}

export const textoSegundos = (s) => (s < 60 || s % 60 ? `${s} s` : `${s / 60} min`);

/**
 * juegos: [{ id, nombre, categoria, descripcion, duracion, bloqueado }]
 * recordDe(juego, segundos, nivel) -> { texto } | null   (sin él no hay récords, p. ej. en la TV de PARTY)
 * tiempo: { lista: [s…], de(juego) -> s, fijar(juego, s) }   (para elegir la duración; ← → también)
 * nivel: { lista: [id…], nombres: { id: texto }, de(juego) -> id, fijar(juego, id) }   (1 2 3 en el teclado)
 * textoJugar: texto del botón grande
 * alJugar(juego) / alDesbloquear(juego)
 */
function reiniciar(el, clase) {
  el.classList.remove(clase);
  void el.offsetWidth;
  el.classList.add(clase);
}

export function selectorJuegos({ juegos, recordDe = null, tiempo = null, nivel = null, textoJugar = "¡Jugar! ▶", alJugar, alDesbloquear }) {
  const conRecords = recordDe != null;
  const segundosDe = (j) => tiempo?.de(j) ?? j.duracion;
  const listaDe = (j) => (typeof tiempo?.lista === "function" ? tiempo.lista(j) : tiempo?.lista ?? [j.duracion]);
  const nivelDe = (j) => nivel?.de(j) ?? "normal";
  const ruedaTiempo = tiempo ? ruedaValor("⏱", "Tiempo", (p) => pasoTiempo(p)) : null;
  const ruedaNivel = nivel ? ruedaValor("◆", "Nivel", (p) => pasoNivel(p)) : null;
  const n = juegos.length;
  let sel = Math.max(0, juegos.findIndex((j) => j.id === ultimoId));
  const antes = new Array(n).fill(null);

  // ---- rueda
  const items = juegos.map((j, i) =>
    h(
      `button.sel-item.${j.categoria}${j.bloqueado ? ".bloqueado" : ""}`,
      { type: "button", "data-i": i, tabindex: -1 },
      h("span.sel-item-icono", j.bloqueado ? "🔒" : ICONOS[j.id] ?? "🎲"),
      h("span.sel-item-nombre", j.nombre)
    )
  );
  const rueda = h("div.sel-rueda", { role: "listbox", "aria-label": "Juegos" }, h("div.sel-guia"), items);

  // ---- ficha del juego elegido
  const ficha = h("div.sel-ficha.tarjeta");
  const contador = h("span.sel-contador");

  const recordEl = h("p.sel-record");

  /** Solo las casillas de tiempo y nivel y el récord (sin rehacer la ficha: así no se corta el arrastre). */
  function pintarAjustes() {
    const j = juegos[sel];
    const seg = segundosDe(j);
    const nv = nivelDe(j);
    if (ruedaTiempo) {
      const l = listaDe(j);
      ruedaTiempo.pintar(l.map(textoSegundos), Math.max(0, l.indexOf(seg)));
    }
    if (ruedaNivel) ruedaNivel.pintar(nivel.lista.map((x) => nivel.nombres[x]), Math.max(0, nivel.lista.indexOf(nv)));
    if (conRecords) {
      const r = recordDe(j, seg, nv);
      const donde = `${textoSegundos(seg)}${nivel ? ` · ${nivel.nombres[nv]}` : ""}`;
      recordEl.replaceChildren(
        ...(r
          ? [h("span.sel-record-copa", "🏆"), h("span", "Tu récord: "), h("b", r.texto), h("small", ` (${donde})`)]
          : [h("span.suave", `Aún sin récord en ${donde}`)])
      );
      recordEl.classList.toggle("con", Boolean(r));
      reiniciar(recordEl, "cambia");
    }
  }

  function pintarFicha() {
    const j = juegos[sel];
    const seg = segundosDe(j);
    pintarAjustes();
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
      ...(conRecords ? [recordEl] : []),
      h(
        "div.sel-ajustes",
        ruedaTiempo ? ruedaTiempo.el : h("span.sel-chip", `⏱ ${textoSegundos(seg)}`),
        ruedaNivel ? ruedaNivel.el : null
      ),
      jugar
    );
    reiniciar(ficha, "cambia");
    contador.textContent = `${sel + 1} / ${n}`;
  }

  function cambiarTiempo(s) {
    const j = juegos[sel];
    if (!tiempo || j.bloqueado || s == null) return;
    if (s === segundosDe(j)) return;
    tiempo.fijar(j, s);
    navigator.vibrate?.(5);
    pintarAjustes();
  }
  function pasoNivel(paso) {
    const j = juegos[sel];
    if (!nivel || j.bloqueado) return;
    const l = nivel.lista;
    const i = Math.max(0, Math.min(l.length - 1, l.indexOf(nivelDe(j)) + paso));
    if (l[i] === nivelDe(j)) return;
    nivel.fijar(j, l[i]);
    navigator.vibrate?.(5);
    pintarAjustes();
  }

  function pasoTiempo(paso) {
    if (!tiempo) return false;
    const l = listaDe(juegos[sel]);
    const i = l.indexOf(segundosDe(juegos[sel]));
    cambiarTiempo(l[Math.max(0, Math.min(l.length - 1, (i < 0 ? 0 : i) + paso))]);
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
    if (t === "ArrowUp") return mover(-1);
    if (t === "ArrowDown") return mover(1);
    if (t === "ArrowLeft") return tiempo ? pasoTiempo(-1) : mover(-1);
    if (t === "ArrowRight") return tiempo ? pasoTiempo(1) : mover(1);
    if (t === "PageUp") return mover(-3);
    if (t === "PageDown") return mover(3);
    if (nivel && /^[1-9]$/.test(t) && nivel.lista[Number(t) - 1]) {
      const j = juegos[sel];
      if (!j.bloqueado) nivel.fijar(j, nivel.lista[Number(t) - 1]);
      return pintarAjustes();
    }
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
      h("p.sel-ayuda", tiempo ? `↑ ↓ juego · ← → tiempo${nivel ? " · 1 2 3 nivel" : ""} · Enter para jugar` : "↑ ↓ para elegir · Enter para jugar")
    )
    )
  );
  return el;
}
