// Selector de juegos del modo solo, al estilo de las recreativas: una rueda con la lista a un lado
// y, al lado, la ficha del juego elegido. Se mueve con el dedo, la rueda del ratón o las flechas.
import { h, textoSegundos } from "../comun/ui.js";
import { teclasFisicas } from "../comun/teclas.js";
import { ventanaAyuda } from "./ayuda.js";

export const ICONOS = {
  "palabra-larga": "🔠", definicion: "📖", sopa: "🔍", revuelto: "🔀", paraulogico: "🐝", crucigrama: "✏️", conexiones: "🔗", semantica: "🔥", memoria: "📸", kenken: "🔢",
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
  // Izquierda ▼ baja (menos tiempo, más fácil); derecha ▲ sube.
  const arriba = h("button.sel-pil-flecha", { type: "button", "aria-label": `${etiqueta}: bajar` }, "▼");
  const abajo = h("button.sel-pil-flecha", { type: "button", "aria-label": `${etiqueta}: subir` }, "▲");
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
    pintar(textos, i, animar = false) {
      const dir = !animar || ultimo == null || ultimo.textos !== textos.join() ? 0 : Math.sign(i - ultimo.i);
      if (ultimo && ultimo.textos === textos.join() && ultimo.i === i) return;
      ultimo = { textos: textos.join(), i };
      ventana.replaceChildren(h(`span.sel-pil-valor${dir > 0 ? ".sube" : dir < 0 ? ".baja" : ""}`, textos[i] ?? ""));
      ventana.setAttribute("aria-valuetext", textos[i] ?? "");
      arriba.disabled = i <= 0;
      abajo.disabled = i >= textos.length - 1;
    },
  };
}

/** El récord en pocas palabras (los antiguos no tenían versión corta). */
export const textoRecord = (r) => r?.corto ?? String(r?.texto ?? "").replace(/^Completo en /, "").replace(/^¡Exacto! en /, "");

export { textoSegundos };

/**
 * juegos: [{ id, nombre, categoria, descripcion, duracion, bloqueado }]
 * recordDe(juego, segundos, nivel) -> { texto } | null   (sin él no hay récords, p. ej. en la TV de PARTY)
 * tiempo: { lista: [s…], de(juego) -> s, fijar(juego, s) }   (para elegir la duración; ← → también)
 * nivel: { lista: [id…], nombres: { id: texto }, de(juego) -> id, fijar(juego, id) }   (1 2 3 en el teclado)
 * conAyuda: botón ? con la ventana de ayuda del juego (en el móvil)
 * textoJugar: texto del botón grande
 * alJugar(juego) / alDesbloquear(juego)
 */
export function selectorJuegos({ juegos, recordDe = null, tiempo = null, nivel = null, conAyuda = false, textoJugar = "¡Jugar! ▶", alJugar, alDesbloquear }) {
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
      h("span.sel-item-nombre", j.nombre),
      // En el móvil, el botón de jugar va en el propio juego elegido (tocarlo otra vez también juega).
      h("span.sel-item-jugar", { "aria-hidden": "true" }, j.bloqueado ? "🔓 Abrir" : "▶ Jugar")
    )
  );
  const rueda = h("div.sel-rueda", { role: "listbox", "aria-label": "Juegos" }, h("div.sel-guia"), items);

  // ---- cuadrícula: solo los iconos, todos a la vista (se alterna con la rueda)
  const casillas = juegos.map((j, i) =>
    h(
      `button.sel-casilla.${j.categoria}${j.bloqueado ? ".bloqueado" : ""}`,
      { type: "button", "data-i": i, title: j.nombre, "aria-label": j.nombre, onclick: () => ir(i) },
      h("span", j.bloqueado ? "🔒" : ICONOS[j.id] ?? "🎲"),
      h("span.sel-casilla-jugar", { "aria-hidden": "true" }, "▶")
    )
  );
  const cuadricula = h("div.sel-cuadricula", { role: "listbox", "aria-label": "Juegos" }, casillas);
  let vista = "rueda";
  try {
    if (localStorage.getItem("nyp-vista-juegos") === "cuadricula") vista = "cuadricula";
  } catch {}
  const botonVista = h("button.sel-vista-btn", { type: "button", onclick: () => cambiarVista() });
  function cambiarVista(v = vista === "rueda" ? "cuadricula" : "rueda", guardar = true) {
    vista = v;
    rueda.classList.toggle("oculto", vista !== "rueda");
    cuadricula.classList.toggle("oculto", vista !== "cuadricula");
    botonVista.textContent = vista === "rueda" ? "▦" : "☰";
    botonVista.title = vista === "rueda" ? "Ver todos en cuadrícula" : "Ver como ruleta";
    botonVista.setAttribute("aria-label", botonVista.title);
    if (guardar) {
      try {
        localStorage.setItem("nyp-vista-juegos", vista);
      } catch {}
      navigator.vibrate?.(5);
      if (vista === "cuadricula") casillas[sel].scrollIntoView({ block: "nearest" });
    }
  }

  // ---- ficha del juego elegido
  const ficha = h("div.sel-ficha.tarjeta");
  const contador = h("span.sel-contador");

  const recordEl = h("p.sel-record");

  /** Solo las casillas de tiempo y nivel y el récord (sin rehacer la ficha: así no se corta el arrastre). */
  function pintarAjustes(animar = false) {
    const j = juegos[sel];
    const seg = segundosDe(j);
    const nv = nivelDe(j);
    if (ruedaTiempo) {
      const l = listaDe(j);
      ruedaTiempo.pintar(l.map(textoSegundos), Math.max(0, l.indexOf(seg)), animar);
    }
    if (ruedaNivel) ruedaNivel.pintar(nivel.lista.map((x) => nivel.nombres[x]), Math.max(0, nivel.lista.indexOf(nv)), animar);
    if (conRecords) {
      const r = recordDe(j, seg, nv);
      // Siempre una sola línea y lo mínimo: el tiempo y el nivel ya se ven elegidos debajo.
      const fecha = r?.fecha ? r.fecha.slice(8, 10) + "/" + r.fecha.slice(5, 7) : "";
      recordEl.replaceChildren(
        h("span.sel-record-copa", "🏆"),
        h("span.sel-record-etiqueta", "Récord"),
        h("b.sel-record-valor", r ? textoRecord(r) : "—"),
        ...(fecha ? [h("small.sel-record-fecha", fecha)] : [])
      );
      recordEl.classList.toggle("con", Boolean(r));
    }
  }

  let animAltura = null;
  function pintarFicha() {
    const antes = ficha.isConnected ? ficha.getBoundingClientRect().height : 0;
    animAltura?.cancel();
    const j = juegos[sel];
    const seg = segundosDe(j);
    pintarAjustes();
    const jugar = h(
      `button.boton.acento.grande.sel-jugar${j.bloqueado ? ".bloqueado" : ""}`,
      { type: "button", onclick: () => elegir() },
      j.bloqueado ? "🔒 Desbloquear" : textoJugar
    );
    // El icono del juego es también el botón de ayuda (con un ? en la esquina).
    const icono = conAyuda
      ? h(
          "button.sel-icono.con-ayuda",
          { type: "button", onclick: () => ventanaAyuda(j, ICONOS[j.id]), "aria-label": `Cómo se juega a ${j.nombre}`, title: "Cómo se juega" },
          ICONOS[j.id] ?? "🎲",
          h("span.sel-icono-ayuda", { "aria-hidden": "true" }, "?")
        )
      : h("span.sel-icono", ICONOS[j.id] ?? "🎲");
    ficha.replaceChildren(
      h(
        "div.sel-cabeza",
        icono,
        h(
          "div.sel-cabeza-textos",
          h("span.sel-cat", { palabras: "Palabras", numeros: "Números", pulsador: "Pulsador" }[j.categoria] ?? ""),
          // El tamaño de letra se ajusta al largo del nombre: siempre se lee entero.
          h("h2.sel-nombre", { style: { "--letras": Math.max(8, j.nombre.length) } }, j.nombre)
        )
      ),
      // Siempre una frase corta: así la ficha mide lo mismo con todos los juegos (lo demás, en el ?).
      h("p.sel-desc", typeof j.breve === "string" && j.breve ? j.breve : j.descripcion),
      ...(conRecords ? [recordEl] : []),
      h(
        "div.sel-ajustes",
        ruedaTiempo ? ruedaTiempo.el : h("span.sel-chip", `⏱ ${textoSegundos(seg)}`),
        ruedaNivel ? ruedaNivel.el : null
      ),
      jugar
    );
    // La caja pasa de su altura anterior a la nueva con suavidad; el contenido no parpadea.
    const despues = ficha.getBoundingClientRect().height;
    if (antes && Math.abs(antes - despues) > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      animAltura = ficha.animate([{ height: `${antes}px` }, { height: `${despues}px` }], { duration: 240, easing: "cubic-bezier(0.25, 0.8, 0.3, 1)" });
      const esta = animAltura;
      ficha.style.overflow = "hidden"; // solo mientras cambia de tamaño (si no, recorta la sombra de ¡Jugar!)
      esta.onfinish = esta.oncancel = () => {
        if (animAltura !== esta) return;
        animAltura = null;
        ficha.style.overflow = "";
      };
      // Por si el navegador no pinta (pantalla en segundo plano): nunca se queda a medias.
      setTimeout(() => esta.playState !== "finished" && esta.cancel(), 320);
    }
    contador.textContent = `${sel + 1} / ${n}`;
  }

  function cambiarTiempo(s) {
    const j = juegos[sel];
    if (!tiempo || j.bloqueado || s == null) return;
    if (s === segundosDe(j)) return;
    tiempo.fijar(j, s);
    navigator.vibrate?.(5);
    pintarAjustes(true);
  }
  function pasoNivel(paso) {
    const j = juegos[sel];
    if (!nivel || j.bloqueado) return;
    const l = nivel.lista;
    const i = Math.max(0, Math.min(l.length - 1, l.indexOf(nivelDe(j)) + paso));
    if (l[i] === nivelDe(j)) return;
    nivel.fijar(j, l[i]);
    navigator.vibrate?.(5);
    pintarAjustes(true);
  }

  function pasoTiempo(paso) {
    if (!tiempo) return false;
    const l = listaDe(juegos[sel]);
    const i = l.indexOf(segundosDe(juegos[sel]));
    cambiarTiempo(l[Math.max(0, Math.min(l.length - 1, (i < 0 ? 0 : i) + paso))]);
  }

  /** desfase: fracción de paso que lleva el dedo (la rueda sigue al dedo sin esperar al siguiente juego). */
  function colocar(desfase = 0) {
    items.forEach((el, i) => {
      // Distancia al elegido, dando la vuelta (la rueda no tiene fin).
      let d0 = (((i - sel) % n) + n) % n;
      if (d0 > n / 2) d0 -= n;
      const salto = antes[i] != null && Math.abs(d0 - antes[i]) > 1;
      antes[i] = d0;
      const d = d0 - desfase;
      const a = Math.abs(d);
      el.style.transition = salto ? "none" : "";
      el.style.transform = `translate(${(a * a * 0.55).toFixed(2)}rem, calc(-50% + ${d * PASO}rem)) scale(${1 - Math.min(a, 4) * 0.05})`;
      el.style.opacity = a > 3.5 ? "0" : String(1 - a * 0.16);
      el.style.zIndex = String(10 - a);
      el.classList.toggle("elegido", d0 === 0);
      el.setAttribute("aria-selected", String(d0 === 0));
    });
    casillas.forEach((el, i) => {
      el.classList.toggle("elegido", i === sel);
      el.setAttribute("aria-selected", String(i === sel));
    });
  }

  // Rehacer la ficha cuesta (sobre todo en iPhone): mientras giras deprisa, se espera a que pares un momento.
  let fichaPendiente = null;
  function fichaLuego(espera) {
    clearTimeout(fichaPendiente);
    if (!espera) return pintarFicha();
    contador.textContent = `${sel + 1} / ${n}`;
    fichaPendiente = setTimeout(pintarFicha, espera);
  }

  function mover(paso, { desfase = 0, espera = 0 } = {}) {
    if (!paso) return colocar(desfase);
    sel = (((sel + paso) % n) + n) % n;
    ultimoId = juegos[sel].id;
    navigator.vibrate?.(5);
    colocar(desfase);
    fichaLuego(espera);
  }

  function ir(i, jugarSiElegido = true) {
    if (i === sel) return jugarSiElegido ? elegir() : undefined;
    mover(i - sel);
  }

  function elegir() {
    const j = juegos[sel];
    ultimoId = j.id;
    (j.bloqueado ? alDesbloquear : alJugar)(j);
  }

  // ---- dedo / ratón: la rueda sigue al dedo; al soltar sigue girando un poco (inercia) y encaja.
  let arrastre = null;
  const pasoPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) * PASO;
  rueda.addEventListener("pointerdown", (ev) => {
    arrastre = { y0: ev.clientY, base: 0, movido: false, id: ev.pointerId, px: pasoPx(), muestras: [[ev.timeStamp, ev.clientY]] };
    rueda.setPointerCapture(ev.pointerId);
  });
  rueda.addEventListener("pointermove", (ev) => {
    if (!arrastre || ev.pointerId !== arrastre.id) return;
    if (!arrastre.movido && Math.abs(ev.clientY - arrastre.y0) > 8) {
      arrastre.movido = true;
      rueda.classList.add("arrastrando");
    }
    if (!arrastre.movido) return;
    arrastre.muestras.push([ev.timeStamp, ev.clientY]);
    if (arrastre.muestras.length > 6) arrastre.muestras.shift();
    const pasos = (arrastre.y0 - ev.clientY) / arrastre.px - arrastre.base; // dedo hacia arriba: los siguientes
    const entero = Math.round(pasos);
    arrastre.base += entero;
    mover(entero, { desfase: pasos - entero, espera: 140 });
  });
  const soltar = (ev) => {
    if (!arrastre) return;
    const { movido, muestras, px } = arrastre;
    arrastre = null;
    rueda.classList.remove("arrastrando");
    if (!movido) {
      if (ev.type === "pointercancel") return;
      // pointer capture: buscamos qué hay bajo el dedo
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".sel-item");
      if (el) ir(Number(el.dataset.i));
      return;
    }
    // Inercia: según la velocidad de los últimos movimientos, unos pasos más.
    const [t0, y0] = muestras[0], [t1, y1] = muestras.at(-1);
    const v = t1 - t0 > 12 && ev.timeStamp - t1 < 100 ? (y0 - y1) / px / (t1 - t0) : 0; // pasos por ms
    const extra = Math.max(-6, Math.min(6, Math.round(v * 220)));
    mover(extra, { espera: 0 });
    if (!extra) fichaLuego(0);
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
      return pintarAjustes(true);
    }
    if (conAyuda && (t === "?" || t === "h")) return ventanaAyuda(juegos[sel], ICONOS[juegos[sel].id]);
    if (t === "OK" || t === " ") return elegir();
    return false;
  });

  colocar();
  pintarFicha();
  cambiarVista(vista, false);

  const el = h(
    "div.sel-caja",
    h(
    "div.sel",
    h("div.sel-lado", ficha),
    h(
      "div.sel-lista",
      h("div.sel-titulo", h("span", "Elige juego"), h("span.sel-titulo-der", contador, botonVista)),
      rueda,
      cuadricula,
      h("p.sel-ayuda", tiempo ? `↑ ↓ juego · ← → tiempo${nivel ? " · 1 2 3 nivel" : ""}${conAyuda ? " · ? ayuda" : ""} · Enter para jugar` : "↑ ↓ para elegir · Enter para jugar")
    )
    )
  );
  return el;
}
