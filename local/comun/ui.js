// Pequeñas utilidades de interfaz compartidas por la TV y el móvil.

/** Crea elementos: h("div.clase#id", { onclick, style }, hijos...) */
export function h(selector, props = {}, ...hijos) {
  const [, tag = "div", resto = ""] = selector.match(/^([a-z0-9-]*)(.*)$/i);
  const el = document.createElement(tag || "div");
  for (const parte of resto.match(/[.#][^.#]+/g) ?? []) {
    if (parte[0] === ".") el.classList.add(parte.slice(1));
    else el.id = parte.slice(1);
  }
  if (props && (typeof props !== "object" || props instanceof Node || Array.isArray(props))) {
    hijos.unshift(props);
    props = {};
  }
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") {
      for (const [p, val] of Object.entries(v)) {
        if (p.startsWith("--")) el.style.setProperty(p, val);
        else el.style[p] = val;
      }
    }
    else if (k === "texto") el.textContent = v;
    else if (k in el && k !== "list") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo == null || hijo === false) continue;
    el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return el;
}

/** Sustituye la pantalla visible con una transición suave. */
export function cambiarPantalla(contenedor, nueva) {
  for (const vieja of contenedor.querySelectorAll(":scope > .pantalla:not(.sale)")) {
    vieja.classList.remove("entra");
    vieja.classList.add("sale");
    vieja.addEventListener("animationend", () => vieja.remove(), { once: true });
    setTimeout(() => vieja.remove(), 600);
  }
  nueva.classList.add("pantalla", "entra");
  contenedor.append(nueva);
  // Acabada la entrada, sus elementos vuelven a sus propias animaciones.
  setTimeout(() => nueva.classList.remove("entra"), 560);
  return nueva;
}

export function iniciales(nombre) {
  const partes = String(nombre).trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Dirección del servidor PARTY (para fotos); la app del móvil la cambia al conectarse. */
export const servidor = { base: new URL("../", import.meta.url).href };

/** Icono redondo del jugador: su foto o sus iniciales, con sus colores. */
// Premios de las hazañas para el avatar: un sombrero encima y/o una animación.
export const SOMBREROS = { corona: "👑", chistera: "🎩", birrete: "🎓", gorra: "🧢", lazo: "🎀" };
export const ANIMACIONES = { salto: "Salto", giro: "Giro", baile: "Baile", brillo: "Brillo" };

/** Pone el sombrero y la animación (si tiene) a un avatar ya creado. */
function vestir(el, j) {
  const s = SOMBREROS[j.sombrero];
  if (s) el.append(h("span.avatar-sombrero", { "aria-hidden": "true" }, s));
  if (ANIMACIONES[j.animacion]) el.classList.add(`anim-${j.animacion}`);
  return el;
}

export function avatar(j, extra = "") {
  const estilo = { "--c": j.color, ...(j.colorTexto ? { color: j.colorTexto } : {}), ...(j.contorno ? { "--contorno": j.contorno } : {}) };
  if (j.contorno) extra += ".con-contorno";
  if (j.foto) {
    const src = j.foto.startsWith("data:") ? j.foto : new URL(j.foto, servidor.base).href;
    // Recorte (con fondo transparente): la cabeza sale por encima del círculo de color.
    const recorte = /^data:image\/(png|webp)/.test(j.foto) || /[?&]r=1\b/.test(j.foto);
    return vestir(h(`span.avatar.con-foto${recorte ? ".con-recorte" : ""}${extra}`, { style: estilo }, h("img", { src, alt: "", draggable: false })), j);
  }
  return vestir(h(`span.avatar${extra}`, { style: estilo }, h("span.avatar-letras", iniciales(j.nombre))), j);
}

/** Banner del jugador: su icono y su nombre con su color de fondo y de letras. */
export function banner(j, extra = "") {
  return h(
    `div.banner${extra}${j.contorno ? ".con-contorno" : ""}`,
    { style: { "--fondo": j.color, "--texto": j.colorTexto ?? "#0a1b4a", ...(j.contorno ? { "--contorno": j.contorno } : {}) } },
    avatar(j),
    h("span.banner-nombre", j.nombre || "Tu nombre")
  );
}

/** Reloj circular que se actualiza solo con requestAnimationFrame. */
// Color del reloj según lo que queda: blanco → dorado → rojo.
const COLOR_RELOJ = [
  [1, [232, 241, 255]],
  [0.5, [232, 241, 255]],
  [0.25, [255, 205, 80]],
  [0, [255, 82, 82]],
];
function colorReloj(f) {
  for (let i = 1; i < COLOR_RELOJ.length; i++) {
    const [fa, ca] = COLOR_RELOJ[i - 1], [fb, cb] = COLOR_RELOJ[i];
    if (f >= fb) {
      const k = fa === fb ? 0 : (fa - f) / (fa - fb);
      return `rgb(${ca.map((v, j) => Math.round(v + (cb[j] - v) * k)).join(",")})`;
    }
  }
  return "rgb(255,82,82)";
}

export function crearReloj(ahoraServidor) {
  const R = 45, L = 2 * Math.PI * R;
  const el = h("div.reloj");
  el.innerHTML = `<svg viewBox="0 0 100 100"><circle class="pista" cx="50" cy="50" r="${R}" fill="none" stroke-width="8"/>
    <circle class="arco" cx="50" cy="50" r="${R}" fill="none" stroke-width="8" stroke-linecap="round"
    stroke-dasharray="${L}" stroke-dashoffset="0"/></svg><span class="cifra"></span>`;
  const arco = el.querySelector(".arco");
  const cifra = el.querySelector(".cifra");
  let fin = 0, total = 1, vivo = true, ultimo = null;
  function pintar() {
    if (!vivo) return;
    const resta = Math.max(0, fin - ahoraServidor());
    const seg = Math.ceil(resta / 1000);
    const f = Math.min(1, resta / total);
    arco.style.strokeDashoffset = String(L * (1 - f));
    el.style.setProperty("--reloj-c", colorReloj(f));
    if (seg !== ultimo) {
      ultimo = seg;
      cifra.textContent = seg;
      // Apuro: los últimos 10 s (o el último 15 % en pruebas cortas) late; los 5 últimos, además, tiembla.
      const apuro = seg > 0 && (seg <= 10 || f <= 0.15);
      el.classList.toggle("apuro", apuro);
      el.classList.toggle("ultimos", seg <= 5 && seg > 0);
      if (apuro) {
        el.classList.remove("tic");
        void el.offsetWidth;
        el.classList.add("tic");
      }
    }
    requestAnimationFrame(pintar);
  }
  requestAnimationFrame(pintar);
  return {
    el,
    fijar(nuevoFin, totalMs) {
      fin = nuevoFin;
      total = Math.max(1, totalMs);
    },
    parar() {
      vivo = false;
    },
  };
}

/** Botón que solo actúa si se mantiene pulsado (para "Borrar todo", "Expulsar"...). */
export function botonMantener(texto, alConfirmar, { ms = 900, clase = "" } = {}) {
  const b = h(`button.boton.mantener${clase}`, { type: "button" }, texto);
  let inicio = 0, raf = 0, reloj = 0;
  // Fin real de la pulsación (no hacemos caso de pointercancel/touchcancel: el móvil los lanza
  // al mantener el dedo quieto para abrir su menú de pulsación larga).
  const FINAL = ["pointerup", "touchend", "mouseup", "blur"];
  const cancelar = () => {
    cancelAnimationFrame(raf);
    clearTimeout(reloj);
    inicio = 0;
    b.style.setProperty("--progreso", 0);
    b.classList.remove("pulsado");
    for (const ev of FINAL) window.removeEventListener(ev, cancelar);
  };
  // La barra que se rellena es solo visual; quien confirma es el temporizador.
  const pintar = () => {
    if (!inicio) return;
    b.style.setProperty("--progreso", Math.min(1, (performance.now() - inicio) / ms));
    raf = requestAnimationFrame(pintar);
  };
  const confirmar = () => {
    cancelar();
    navigator.vibrate?.(40);
    alConfirmar();
  };
  const empezar = (e) => {
    if (inicio || b.disabled || (e.button != null && e.button > 0)) return;
    e.preventDefault();
    b.classList.add("pulsado");
    inicio = performance.now();
    raf = requestAnimationFrame(pintar);
    reloj = setTimeout(confirmar, ms);
    for (const ev of FINAL) window.addEventListener(ev, cancelar);
  };
  b.addEventListener("pointerdown", empezar);
  b.addEventListener("touchstart", (e) => (e.preventDefault(), empezar(e)), { passive: false });
  b.addEventListener("pointerleave", (e) => e.pointerType === "mouse" && cancelar());
  b.addEventListener("contextmenu", (e) => e.preventDefault());
  b.addEventListener("click", (e) => e.preventDefault());
  return b;
}

/** Cuenta atrás de 4 s: "3", "2", "1" (un segundo cada uno) y "¡YA!" el último segundo. */
export function textoCuenta(restanteMs) {
  return restanteMs > 1000 ? String(Math.max(1, Math.min(3, Math.ceil((restanteMs - 1000) / 1000)))) : "¡YA!";
}

/**
 * Lo que respondió un jugador: [{ t, k }] con k = bien | mal | pista | tuti | mejor | paso.
 * max: cuántas se enseñan como mucho (el resto, "+N").
 */
export function detalleJugador(detalle, { max = Infinity, clase = "" } = {}) {
  if (!detalle?.length) return null;
  const vistos = detalle.slice(0, max);
  const resto = detalle.length - vistos.length;
  return h(
    `div.respuestas${clase}`,
    vistos.map((x) => h(`span.det.det-${x.k ?? "bien"}`, x.k === "mal" ? "✘ " : x.k === "pista" ? "💡 " : x.k === "mejor" ? "🏆 " : "", x.t)),
    resto > 0 ? h("span.det.det-mas", `+${resto}`) : null
  );
}

/** Lo que se pinta en la cuenta atrás: los números en ficha y el ¡YA! como un rótulo que estalla. */
export function piezaCuenta(txt) {
  if (txt !== "¡YA!") return h("span.ficha.cuenta-num.aparece", txt);
  return h("span.cuenta-ya", h("span.cuenta-ya-rayos"), h("span.cuenta-ya-texto", "¡YA!"));
}

const sinMovimiento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Confeti dorado que cae por toda la pantalla (se quita solo). */
export function confeti(n = 70) {
  if (sinMovimiento()) return;
  const colores = ["#ffd34d", "#f5a623", "#fff3b0", "#5fd68e", "#5aaaf2", "#f47fb0"];
  const capa = h("div.confeti", { "aria-hidden": "true" });
  for (let i = 0; i < n; i++) {
    capa.append(
      h("i", {
        style: {
          left: `${Math.random() * 100}%`,
          background: colores[i % colores.length],
          animationDelay: `${Math.random() * 500}ms`,
          animationDuration: `${1700 + Math.random() * 1300}ms`,
          "--giro": `${(Math.random() - 0.5) * 1440}deg`,
          "--deriva": `${(Math.random() - 0.5) * 30}vw`,
          width: `${0.4 + Math.random() * 0.4}rem`,
          height: `${0.6 + Math.random() * 0.6}rem`,
        },
      })
    );
  }
  document.body.append(capa);
  setTimeout(() => capa.remove(), 3600);
}

/** Escribe `texto` en `el` haciendo que su primer número cuente desde 0. */
export function contarHasta(el, texto) {
  const m = /\d+/.exec(texto);
  el.textContent = texto;
  if (!m || sinMovimiento()) return;
  const fin = Number(m[0]);
  const t0 = performance.now(), dur = Math.min(1400, 500 + fin * 25);
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    const v = Math.round(fin * (1 - Math.pow(1 - k, 3)));
    el.textContent = texto.slice(0, m.index) + v + texto.slice(m.index + m[0].length);
    if (k < 1 && el.isConnected !== false) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

/**
 * Pasos de Llegar al resultado ("9 × 7 = 63") como filas de fichas pequeñas.
 * titulo: encima; objetivo: para marcar en verde cuando se llega.
 */
export function pasosEnFichas(titulo, pasos, objetivo = null, clase = "") {
  if (!pasos?.length) return null;
  return h(
    `div.pasos-fichas.tarjeta${clase}`,
    h("small", titulo),
    pasos.map((t) => {
      const [a, op, b, , r] = String(t).split(" ");
      return h(
        "div.lr-paso.ultimo",
        h("span.ficha.mini", a),
        h("span.lr-paso-op", op),
        h("span.ficha.mini", b),
        h("span.lr-paso-op", "="),
        h(`span.ficha.mini.res${objetivo != null && Number(r) === objetivo ? ".exacto" : ""}`, String(r).replace("-", "−"))
      );
    })
  );
}

/** Al acabar Llegar al resultado: tus pasos hasta lo más cerca y, si no llegaste, una forma de llegar. */
export function finalLlegar(resumen, detalle) {
  if (!resumen) return null;
  const mios = (detalle ?? []).map((x) => x.t);
  const ultimo = mios.at(-1)?.split(" = ")[1];
  const exacto = ultimo != null && Number(ultimo) === resumen.objetivo;
  // Lo tuyo en verde si llegaste y en rojo si no; la solución, aparte y en verde.
  return h(
    "div.final-llegar",
    pasosEnFichas(exacto ? `✔ Así llegaste a ${resumen.objetivo}` : `✘ Tus pasos: te quedaste en ${ultimo ?? "—"}`, mios, resumen.objetivo, exacto ? ".bien" : ".mal"),
    !exacto && resumen.pasos?.length
      ? pasosEnFichas(resumen.exacta ? `Una forma de llegar a ${resumen.objetivo}` : `Lo más cerca posible: ${resumen.valor}`, resumen.pasos, resumen.objetivo, ".solucion")
      : null
  );
}

/** La palabra que se quedó sin resolver al acabar el tiempo (Definición). */
export function palabraPendiente(p) {
  if (!p) return null;
  return h("div.pendiente.tarjeta", h("small", "✘ Te faltó esta"), h("b", p.forma.toUpperCase()), h("p", p.definicion));
}

// ------------------------------------------------------------------ que nada se salga de su casilla
// Las fichas crecen con su contenido; pero si una casilla tiene ancho fijo (rejillas, huecos…) y el
// número no cabe, se encoge solo el texto (la casilla mantiene su tamaño). Vale para toda la app.
const CASILLAS = ".ficha, .lr-hueco, .tecla-l, .encaja";

function encajar(el) {
  if (!el.isConnected || el.children.length > 1) return;
  let txt = el.firstElementChild;
  if (txt && (txt.tagName !== "SPAN" || txt.children.length)) return; // casillas con más cosas dentro: no se tocan
  const ancho = el.clientWidth;
  if (!ancho) return;
  if (txt) txt.style.fontSize = "";
  if (el.scrollWidth <= ancho + 1) return;
  if (!txt) {
    if (!el.textContent.trim()) return;
    txt = h("span.encaja-txt", el.textContent);
    el.replaceChildren(txt);
  }
  const cs = getComputedStyle(el);
  const libre = ancho - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const mide = txt.offsetWidth; // tamaño real (sin contar animaciones de escala)
  if (mide > libre && libre > 0) txt.style.fontSize = `${Math.max(40, Math.floor((libre / mide) * 96))}%`;
}

let pendienteEncaje = false;
function encajarTodo() {
  if (pendienteEncaje) return;
  pendienteEncaje = true;
  setTimeout(() => {
    pendienteEncaje = false;
    document.querySelectorAll(CASILLAS).forEach(encajar);
  }, 30);
}

/** Se llama una vez al arrancar la app (móvil o TV). */
export function vigilarEncaje() {
  new MutationObserver(encajarTodo).observe(document.body, { subtree: true, childList: true, characterData: true });
  addEventListener("resize", encajarTodo);
  encajarTodo();
}

/** Título del juego en fichas que flotan: NÚMEROS / y / PALABRAS. */
export function tituloJuego() {
  // --x: la columna de cada letra respecto al centro; la ola avanza de izquierda a derecha como una bandera.
  const fila = (palabra, clase) =>
    h(`div.titulo-fila.${clase}`, [...palabra].map((l, k) => h("span.ficha", { style: { "--x": k - (palabra.length - 1) / 2 } }, l)));
  return h(
    "div.titulo-nyp",
    { role: "heading", "aria-level": "1", "aria-label": "Números y Palabras" },
    fila("NÚMEROS", "titulo-numeros"),
    h("span.ficha.titulo-y", { style: { "--x": 0 } }, "Y"),
    fila("PALABRAS", "titulo-palabras")
  );
}

export function textoPuesto(p) {
  return p == null ? "–" : `${p}º`;
}
