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
export const SOMBREROS = { corona: "👑", chistera: "🎩", birrete: "🎓", gorra: "🧢", lazo: "🎀", estrella: "⭐", pamela: "👒", flor: "🌸", gafas: "🕶️", casco: "🪖" };
export const ANIMACIONES = { salto: "Salto", giro: "Giro", baile: "Baile", brillo: "Brillo" };

/** Pone el sombrero y la animación (si tiene) a un avatar ya creado. */
function vestir(el, j) {
  const s = SOMBREROS[j.sombrero];
  if (s) el.append(h("span.avatar-sombrero", { "aria-hidden": "true" }, s));
  if (ANIMACIONES[j.animacion]) el.classList.add(`anim-${j.animacion}`);
  return el;
}

/** Batalla multijugador: fotos de los jugadores que llegaron aparte (id → data URL). */
export const fotosMemoria = {};

export function avatar(j, extra = "") {
  const estilo = { "--c": j.color, ...(j.colorTexto ? { color: j.colorTexto } : {}), ...(j.contorno ? { "--contorno": j.contorno } : {}) };
  if (j.contorno) extra += ".con-contorno";
  // «mem:id:versión»: foto de una Batalla, guardada en fotosMemoria (si aún no ha llegado, iniciales).
  if (j.foto?.startsWith("mem:")) j = { ...j, foto: fotosMemoria[j.foto.split(":")[1]] ?? null };
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

/**
 * Banner que no se rehace al cambiar de pantalla: uno solo, fijo encima de todo, que se coloca sobre el
 * «hueco» que deja cada pantalla y se abre (píldora con el nombre) o se cierra (círculo con tu icono).
 * Así su animación nunca vuelve a empezar y no hay saltos entre la lista, el juego y el resultado.
 *   const fijo = bannerFijo(yo);  h("div.barra-sup", fijo.hueco("abierto" | "cerrado"))  …  fijo.colocar()
 */
export function bannerFijo(j) {
  let ban = banner(j);
  const claveDe = (x) => [x.nombre, x.color, x.colorTexto, x.contorno, x.foto, x.sombrero, x.animacion].join("|");
  let clave = claveDe(j);
  const capa = h("div.barra-sup.banner-fijo.sin-transicion.oculto-fijo", { "aria-hidden": "true" }, ban);
  document.body.append(capa);
  let medidas = null;
  let estado = "abierto";
  let puesto = false;
  function medir() {
    capa.classList.add("sin-transicion");
    capa.classList.remove("cerrado");
    const abierto = [ban.offsetWidth, ban.offsetHeight];
    // El nombre se encoge desde su ancho real: así el cierre es un solo movimiento, sin pausa al principio.
    const nombre = ban.querySelector(".banner-nombre");
    capa.style.setProperty("--nombre-ancho", `${Math.ceil(nombre?.scrollWidth ?? 0) + 2}px`);
    capa.classList.add("cerrado");
    const cerrado = [ban.offsetWidth, ban.offsetHeight];
    capa.classList.toggle("cerrado", estado === "cerrado");
    void ban.offsetWidth;
    if (puesto) capa.classList.remove("sin-transicion");
    return { abierto, cerrado };
  }
  function colocar() {
    const huecos = document.querySelectorAll(".pantalla:not(.sale) .hueco-banner");
    const hueco = huecos[huecos.length - 1];
    if (!hueco) return capa.classList.add("oculto-fijo");
    const r = hueco.getBoundingClientRect();
    estado = hueco.dataset.estado;
    capa.classList.toggle("cerrado", estado === "cerrado");
    capa.style.left = `${r.left}px`;
    capa.style.top = `${r.top + r.height / 2}px`;
    capa.classList.remove("oculto-fijo");
    if (!puesto) {
      puesto = true;
      void capa.offsetWidth;
      capa.classList.remove("sin-transicion");
    }
  }
  const alCambiarTamano = () => {
    capa.classList.add("sin-transicion");
    colocar();
    void capa.offsetWidth;
    capa.classList.remove("sin-transicion");
  };
  window.addEventListener("resize", alCambiarTamano);
  return {
    el: capa,
    /** El sitio que el banner ocupa en la barra de una pantalla. */
    hueco(e = "abierto") {
      medidas ??= medir();
      const [w, hh] = medidas[e] ?? medidas.abierto;
      return h("span.hueco-banner", { "data-estado": e, style: { width: `${w}px`, height: `${hh}px` } });
    },
    colocar,
    /** Si cambia el perfil (nombre, colores, foto…), se rehace el banner (solo entonces) y se recolocan los huecos. */
    actualizar(nuevo) {
      const k = claveDe(nuevo);
      if (k === clave) return;
      clave = k;
      const otro = banner(nuevo);
      ban.replaceWith(otro);
      ban = otro;
      medidas = medir();
      for (const hu of document.querySelectorAll(".hueco-banner")) {
        const [w, hh] = medidas[hu.dataset.estado] ?? medidas.abierto;
        Object.assign(hu.style, { width: `${w}px`, height: `${hh}px` });
      }
      colocar();
    },
    quitar() {
      window.removeEventListener("resize", alCambiarTamano);
      capa.remove();
    },
  };
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

/** Tiempos de las pruebas (s). 0 = sin límite (como en servidor/util.js). */
export const TIEMPOS = [30, 45, 60, 90, 120, 0];
export const SIN_LIMITE_MS = 12 * 3600 * 1000;
export const msDuracion = (s) => (s > 0 ? s * 1000 : SIN_LIMITE_MS);
/** «30 s», «2 min», «∞». */
export const textoSegundos = (s) => (!s ? "∞" : s < 60 || s % 60 ? `${s} s` : `${s / 60} min`);

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
    // Sin límite: el reloj se queda lleno con «∞».
    if (total >= SIN_LIMITE_MS / 2) {
      if (ultimo !== "∞") {
        ultimo = "∞";
        cifra.textContent = "∞";
        arco.style.strokeDashoffset = "0";
        el.style.setProperty("--reloj-c", colorReloj(1));
        el.classList.add("sin-limite");
        el.classList.remove("apuro", "ultimos", "tic");
      }
      return requestAnimationFrame(pintar);
    }
    el.classList.remove("sin-limite");
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
    // Los pasos van apareciendo uno detrás de otro, como si se resolviera delante de ti.
    pasos.map((t, k) => {
      const [a, op, b, , r] = String(t).split(" ");
      return h(
        "div.lr-paso.ultimo.paso-animado",
        { style: { animationDelay: `${300 + k * 450}ms` } },
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

/**
 * El puesto, igual en todas las pantallas: medalla de oro, plata o bronce (sin número dentro) para el
 * podio y el número para el resto. empate: «=2º» cuando se comparte; sinPuntos: «–» si nadie ha puntuado.
 */
export function rango(p, { empate = false } = {}) {
  if (p == null) return h("span.rango.sin", "–");
  if (p <= 3) return h(`span.rango.medalla.m${p}`, { title: `${empate ? "Empate · " : ""}${p}º`, "aria-label": `${p}º${empate ? " (empate)" : ""}` }, empate ? h("i.rango-igual", "=") : null);
  return h("span.rango.num", `${empate ? "=" : ""}${p}º`);
}

export function textoPuesto(p) {
  return p == null ? "–" : `${p}º`;
}
