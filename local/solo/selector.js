// Selector de juegos del modo solo, al estilo de las recreativas: una rueda con la lista a un lado
// y, al lado, la ficha del juego elegido. Se mueve con el dedo, la rueda del ratón o las flechas.
import { h, textoSegundos } from "../comun/ui.js";
import { teclasFisicas } from "../comun/teclas.js";
import { ventanaAyuda } from "./ayuda.js";

export const ICONOS = {
  "palabra-larga": "🔠", definicion: "📖", sopa: "🔍", revuelto: "🔀", paraulogico: "🐝", crucigrama: "✏️", conexiones: "🔗", semantica: "🔥", memoria: "📸", kenken: "🔢",
  "calculo-mental": "🧠", "llegar-resultado": "🎯", "mates-fugaces": "⚡", laberinto: "🧩", pulsador: "🔔", hilo: "🧵", coronas: "👑", parcelas: "📐", culebras: "🐍",
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

/** Al lado del perfil en los resultados: el icono y el nombre del juego, y sus ajustes en dos chips. */
export function infoPartida(juego, segundos, nivel) {
  return h(
    "div.info-partida",
    h("span.info-partida-ico", ICONOS[juego.id] ?? "🎲"),
    h(
      "div.info-partida-txt",
      h("b", juego.nombre),
      h("div.info-partida-chips", h("span", `⏱ ${textoSegundos(segundos)}`), nivel ? h("span", `◆ ${nivel}`) : null)
    )
  );
}

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
  // En pantalla ancha (ordenador) sobra sitio: todas las opciones a la vista, con su etiqueta, y un clic para elegir.
  const segTiempo = tiempo ? h("div.sel-seg-opciones", { role: "radiogroup", "aria-label": "Tiempo" }) : null;
  const segNivel = nivel ? h("div.sel-seg-opciones", { role: "radiogroup", "aria-label": "Nivel" }) : null;
  const segmentos =
    tiempo || nivel
      ? h(
          "div.sel-segmentos",
          tiempo ? h("div.sel-seg-fila", h("span.sel-seg-etiqueta", "⏱ Tiempo"), segTiempo) : null,
          nivel ? h("div.sel-seg-fila", h("span.sel-seg-etiqueta", "◆ Nivel"), segNivel) : null
        )
      : null;
  function pintarSegmentos(caja, valores, textos, actual, alElegir, extra = () => ({})) {
    caja.replaceChildren(
      ...valores.map((v, k) =>
        h(
          `button.sel-seg${v === actual ? ".elegido" : ""}`,
          { type: "button", role: "radio", "aria-checked": String(v === actual), onclick: () => alElegir(v), ...extra(v) },
          textos[k]
        )
      )
    );
  }
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
  // Cuántos juegos caben por encima y por debajo del elegido (la lista llega tan abajo como haya sitio).
  let alcance = 3.5;
  new ResizeObserver(() => {
    const px = parseFloat(getComputedStyle(document.documentElement).fontSize) * PASO;
    const nuevo = rueda.clientHeight ? Math.max(2.5, Math.min(n / 2, rueda.clientHeight / 2 / px)) : 3.5;
    if (Math.abs(nuevo - alcance) > 0.05) {
      alcance = nuevo;
      colocar();
    }
  }).observe(rueda);

  // ---- cuadrícula: solo los iconos, todos a la vista (se alterna con la rueda)
  const casillas = juegos.map((j, i) =>
    h(
      `button.sel-casilla.${j.categoria}${j.bloqueado ? ".bloqueado" : ""}`,
      // Tocar una casilla solo la elige; se juega con el botón de abajo (así no se empieza sin querer).
      { type: "button", "data-i": i, title: j.nombre, "aria-label": j.nombre, onclick: () => ir(i, false) },
      h("span", j.bloqueado ? "🔒" : ICONOS[j.id] ?? "🎲"),
      h("small.sel-casilla-nombre", j.nombre) // solo en pantalla ancha
    )
  );
  const cuadricula = h("div.sel-cuadricula", { role: "listbox", "aria-label": "Juegos" }, casillas);
  let vista = "rueda";
  try {
    if (localStorage.getItem("nyp-vista-juegos") === "cuadricula") vista = "cuadricula";
  } catch {}
  const botonVista = h("button.sel-vista-btn", { type: "button", onclick: () => cambiarVista() });
  // 🎲 Un juego al azar: la ruleta gira sola (o en la cuadrícula se van iluminando casillas) hasta pararse en uno.
  const botonDado = h("button.sel-vista-btn.sel-dado", { type: "button", title: "Un juego al azar", "aria-label": "Elegir un juego al azar", onclick: () => sortear() }, h("span.dado-cara", "🎲"));
  let sorteando = false;
  function sortear() {
    if (sorteando || n < 2) return;
    sorteando = true;
    botonDado.classList.add("girando");
    let destino = Math.floor(Math.random() * (n - 1));
    if (destino >= sel) destino++;
    const final = () => {
      sorteando = false;
      botonDado.classList.remove("girando");
      navigator.vibrate?.([20, 40, 60]);
    };
    if (vista === "cuadricula") {
      // Casillas que se iluminan al azar, cada vez más despacio, sin enseñar su ficha; la última es la elegida.
      const saltos = 12;
      let k = 0, previa = -1, espera = 45;
      const paso = () => {
        casillas.forEach((c) => c.classList.remove("sorteo"));
        if (k === saltos) {
          ir(destino, false);
          casillas[destino].classList.add("sorteo-fin");
          setTimeout(() => casillas[destino].classList.remove("sorteo-fin"), 900);
          return final();
        }
        let i;
        do i = Math.floor(Math.random() * n);
        while (i === previa || (k === saltos - 1 && i === destino));
        previa = i;
        casillas[i].classList.add("sorteo");
        navigator.vibrate?.(4);
        k++;
        espera *= 1.13;
        setTimeout(paso, espera);
      };
      return paso();
    }
    // Ruleta: una vuelta y lo que falte hasta el elegido, frenando solo al final (≈2 s).
    const total = (((destino - sel) % n) + n) % n + n;
    let hechos = 0;
    const paso = () => {
      if (hechos === total) {
        fichaLuego(0);
        return final();
      }
      mover(1, { espera: null });
      hechos++;
      const t = hechos / total;
      setTimeout(paso, 28 + 210 * t ** 4); // muy deprisa casi todo el rato; frena en los últimos
    };
    paso();
  }
  function cambiarVista(v = vista === "rueda" ? "cuadricula" : "rueda", guardar = true) {
    vista = v;
    rueda.classList.toggle("oculto", vista !== "rueda");
    cuadricula.classList.toggle("oculto", vista !== "cuadricula");
    jugarAbajo.classList.toggle("oculto", vista !== "cuadricula");
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

  // En la cuadrícula, el botón de jugar va abajo (con el nombre del juego elegido).
  const jugarAbajo = h("button.boton.acento.grande.sel-jugar-abajo", { type: "button", onclick: () => elegir() });

  // ---- ficha del juego elegido
  const ficha = h("div.sel-ficha.tarjeta");
  // Siempre del mismo ancho: el de «18 / 18» (el número de juegos con todas sus cifras).
  const contador = h("span.sel-contador", { style: { "--cifras": String(n).length } });

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
    if (segTiempo) pintarSegmentos(segTiempo, listaDe(j), listaDe(j).map(textoSegundos), seg, (s) => cambiarTiempo(s));
    if (segNivel)
      pintarSegmentos(segNivel, nivel.lista, nivel.lista.map((x) => nivel.nombres[x]), nv, (x) => {
        if (juegos[sel].bloqueado || x === nivelDe(juegos[sel])) return;
        nivel.fijar(juegos[sel], x);
        navigator.vibrate?.(5);
        pintarAjustes(true);
      }, (x) => ({ "data-nv": x }));
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
    icono.classList.add(j.categoria); // la casilla del icono, con el color de su categoría
    // (sin huecos «null»: replaceChildren escribiría la palabra)
    ficha.replaceChildren(
      ...[
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
      // En el ordenador cabe la explicación completa.
      j.descripcion && j.breve ? h("p.sel-desc-larga", j.descripcion) : null,
      ...(conRecords ? [recordEl] : []),
      h(
        "div.sel-ajustes",
        ruedaTiempo ? ruedaTiempo.el : h("span.sel-chip", `⏱ ${textoSegundos(seg)}`),
        ruedaNivel ? ruedaNivel.el : null
      ),
      segmentos,
      jugar,
      ].filter(Boolean)
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
    jugarAbajo.classList.toggle("bloqueado", Boolean(j.bloqueado));
    jugarAbajo.replaceChildren(h("span.sel-jugar-icono", j.bloqueado ? "🔓" : "▶"), h("span.sel-jugar-nombre", j.bloqueado ? `Desbloquear ${j.nombre}` : `Jugar · ${j.nombre}`));
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
      const ac = Math.min(a, 3.2);
      el.style.transform = `translate(${(ac * ac * 0.5).toFixed(2)}rem, calc(-50% + ${d * PASO}rem)) scale(${1 - Math.min(a, 4) * 0.045})`;
      // Los lejanos se leen (como poco ~55 %) y solo se desvanecen al salir por los bordes de la lista.
      const borde = alcance - 0.5;
      el.style.opacity = String(a <= borde ? Math.max(0.55, 1 - a * 0.12) : Math.max(0, (0.55 * (alcance + 0.1 - a)) / 0.6));
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
  // espera: 0 = ya; null = todavía no (la lista sigue girando: la ficha se pinta cuando se pare).
  function fichaLuego(espera) {
    clearTimeout(fichaPendiente);
    if (espera === null) return void (contador.textContent = `${sel + 1} / ${n}`);
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
  // Inercia: al soltar deprisa, la rueda sigue girando de uno en uno y va frenando hasta pararse.
  let inercia = null;
  function pararInercia() {
    if (!inercia) return false;
    cancelAnimationFrame(inercia);
    inercia = null;
    rueda.classList.remove("arrastrando");
    return true;
  }
  function lanzar(vel, pos) {
    pararInercia();
    vel = Math.max(-0.045, Math.min(0.045, vel)); // pasos por ms (como mucho, unos 45 juegos por segundo)
    let t = performance.now();
    rueda.classList.add("arrastrando");
    const fin = () => {
      inercia = null;
      rueda.classList.remove("arrastrando");
      colocar(0); // encaja en el más cercano, con su rebote
      fichaLuego(0);
    };
    const paso = (ahora) => {
      const dt = Math.min(40, ahora - t);
      t = ahora;
      vel *= Math.pow(0.996, dt); // rozamiento: cada vez más despacio
      pos += vel * dt;
      const entero = Math.round(pos);
      pos -= entero;
      if (entero) mover(entero, { desfase: pos, espera: null }); // la ficha, solo en el juego donde se pare
      else colocar(pos);
      if (Math.abs(vel) < 0.0025) return fin();
      inercia = requestAnimationFrame(paso);
    };
    inercia = requestAnimationFrame(paso);
  }

  rueda.addEventListener("pointerdown", (ev) => {
    const atrapada = pararInercia(); // tocar mientras gira la frena (y no elige nada)
    arrastre = { y0: ev.clientY, base: 0, movido: atrapada, id: ev.pointerId, px: pasoPx(), muestras: [[ev.timeStamp, ev.clientY]], desfase: 0 };
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
    arrastre.desfase = pasos - entero;
    mover(entero, { desfase: pasos - entero, espera: 140 });
  });
  const soltar = (ev) => {
    if (!arrastre) return;
    const { movido, muestras, px, desfase } = arrastre;
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
    if (Math.abs(v) > 0.004) return lanzar(v, desfase);
    rueda.classList.remove("arrastrando");
    colocar(0);
    fichaLuego(0);
  };
  rueda.addEventListener("pointerup", soltar);
  rueda.addEventListener("pointercancel", soltar);

  // Rueda del ratón: cada «clic» de la rueda (≈100 px) es un juego, pero la lista no salta: se desliza
  // suavemente hacia donde vas (también con el trackpad, que manda muchos movimientos pequeños).
  let objetivo = 0, actual = 0, animRueda = null, ajuste = null;
  function empujar(pasos) {
    pararInercia();
    objetivo = Math.max(-8, Math.min(8, objetivo + pasos));
    clearTimeout(ajuste);
    ajuste = setTimeout(() => (objetivo = Math.round(objetivo)), 130); // al parar, encaja en un juego
    if (animRueda) return;
    rueda.classList.add("arrastrando");
    let t = performance.now();
    const paso = (ahora) => {
      const dt = Math.min(50, ahora - t);
      t = ahora;
      actual += (objetivo - actual) * (1 - Math.exp(-dt / 75));
      const entero = Math.round(actual);
      if (entero) {
        actual -= entero;
        objetivo -= entero;
        mover(entero, { desfase: actual, espera: null });
      } else colocar(actual);
      if (Math.abs(objetivo - actual) < 0.004 && objetivo === Math.round(objetivo)) {
        animRueda = null;
        actual = objetivo = 0;
        rueda.classList.remove("arrastrando");
        colocar(0);
        fichaLuego(0);
        return;
      }
      animRueda = requestAnimationFrame(paso);
    };
    animRueda = requestAnimationFrame(paso);
  }
  rueda.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      const dy = ev.deltaMode === 1 ? ev.deltaY * 33 : ev.deltaMode === 2 ? ev.deltaY * 300 : ev.deltaY;
      empujar(dy / 100);
    },
    { passive: false }
  );

  // ---- teclado del ordenador
  teclasFisicas(rueda, (t) => {
    pararInercia();
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

  // Atajos del teclado (solo con ratón y pantalla ancha): cada tecla dibujada como una ficha, en casillas iguales.
  const atajos = h(
    "div.sel-ayuda",
    [
      [["↑", "↓"], "Juego"],
      ...(tiempo ? [[["←", "→"], "Tiempo"]] : []),
      ...(nivel ? [[["1", "2", "3"], "Nivel"]] : []),
      ...(conAyuda ? [[["?"], "Ayuda"]] : []),
      [["Enter"], "Jugar"],
    ].map(([teclas, texto]) => h("span.sel-atajo", h("span.sel-atajo-teclas", ...teclas.map((t) => h("kbd", t))), h("small", texto)))
  );

  const el = h(
    "div.sel-caja",
    h(
    "div.sel",
    h("div.sel-lado", ficha, atajos),
    h(
      "div.sel-lista",
      h("div.sel-titulo", h("span.sel-titulo-texto", "Elige juego"), h("span.sel-titulo-der", contador, botonDado, botonVista)),
      rueda,
      cuadricula,
      jugarAbajo,
    )
    )
  );
  return el;
}
