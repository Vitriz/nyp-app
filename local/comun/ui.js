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
  return nueva;
}

export function iniciales(nombre) {
  const partes = String(nombre).trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Dirección del servidor PARTY (para fotos); la app del móvil la cambia al conectarse. */
export const servidor = { base: new URL("../", import.meta.url).href };

/** Icono redondo del jugador: su foto o sus iniciales, con sus colores. */
export function avatar(j, extra = "") {
  const estilo = { "--c": j.color, ...(j.colorTexto ? { color: j.colorTexto } : {}), ...(j.contorno ? { "--contorno": j.contorno } : {}) };
  if (j.contorno) extra += ".con-contorno";
  if (j.foto) {
    const src = j.foto.startsWith("data:") ? j.foto : new URL(j.foto, servidor.base).href;
    return h(`span.avatar.con-foto${extra}`, { style: estilo }, h("img", { src, alt: "", draggable: false }));
  }
  return h(`span.avatar${extra}`, { style: estilo }, iniciales(j.nombre));
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
    arco.style.strokeDashoffset = String(L * (1 - Math.min(1, resta / total)));
    if (seg !== ultimo) {
      ultimo = seg;
      cifra.textContent = seg;
      el.classList.toggle("ultimos", seg <= 5 && seg > 0);
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

export function textoPuesto(p) {
  return p == null ? "–" : `${p}º`;
}
