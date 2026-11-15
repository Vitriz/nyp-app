// Palabras que se pueden tocar en los resultados de los juegos de palabras: se abre una ventana flotante
// con lo que dice el diccionario (se cierra tocando fuera). Las palabras van en fichas grandes y
// separadas para que no sea fácil tocar la de al lado.
import { h } from "./ui.js";

const TIPOS = { noun: "Sustantivo", adjective: "Adjetivo", verb: "Verbo", adverb: "Adverbio" };

let lexico = null;
/** El diccionario del móvil (si aún no está abierto, se abre con el paquete guardado). */
async function diccionario() {
  lexico ??= await import("../motor/lexico.js");
  if (!lexico.listo?.()) {
    try {
      const { leerPaquete } = await import("../solo/paquete.js");
      const texto = await leerPaquete();
      if (texto) lexico.preparar(JSON.parse(texto));
    } catch {}
  }
  if (!lexico.listo?.() || !lexico.acepciones) return null;
  // Todas las acepciones (la primera vez se bajan; luego ya están en el móvil).
  if (!completas && lexico.fijarAcepciones) {
    try {
      const { leerAcepciones } = await import("../solo/paquete.js");
      const l = await leerAcepciones();
      if (l) {
        lexico.fijarAcepciones(l);
        completas = true;
      }
    } catch {}
  }
  return lexico;
}
let completas = false;

/** Saca la palabra de un texto de resultado: «DESAFÍOS · 8», «✘ casa»… (o null si no es una palabra). */
export function palabraDe(texto) {
  const t = String(texto ?? "").replace(/^[^\p{L}]+/u, "").trim();
  const m = t.match(/^\p{L}{2,}/u);
  if (!m) return null;
  const resto = t.slice(m[0].length).trim();
  return !resto || /^[·:(✓✔\d]/.test(resto) ? m[0] : null;
}

/** Ventana con las acepciones de una palabra. */
export async function verPalabra(palabra) {
  const lista = h("div.dicc-lista", h("p.suave", completas ? "Buscando…" : "Abriendo el diccionario…"));
  const cerrar = () => {
    capa.remove();
    document.removeEventListener("keydown", tecla);
  };
  const tecla = (ev) => ev.key === "Escape" && cerrar();
  const titulo = h("h2.dicc-palabra", palabra.toUpperCase());
  const capa = h(
    "div.capa-movil.capa-dicc",
    { onclick: (ev) => ev.target === capa && cerrar() },
    h("div.caja.tarjeta.dicc-caja", { role: "dialog", "aria-label": `Significado de ${palabra}` }, h("div.records-cabeza", titulo, h("button.icono-btn.cerrar", { type: "button", onclick: cerrar, "aria-label": "Cerrar" }, "✕")), lista)
  );
  document.body.append(capa);
  document.addEventListener("keydown", tecla);
  const lx = await diccionario();
  if (!capa.isConnected) return;
  if (!lx) return lista.replaceChildren(h("p.suave", "El diccionario no está disponible en este dispositivo."));
  const r = lx.acepciones(palabra);
  titulo.textContent = String(r.forma ?? palabra).toUpperCase();
  if (!r.lista.length) {
    lista.replaceChildren(h("p.suave", r.valida ? "✔ Palabra válida. No tenemos su definición guardada." : "No aparece en el diccionario del juego."));
    return;
  }
  // Cada acepción en su tarjeta: número, de qué tipo o ámbito es y el texto.
  lista.replaceChildren(
    ...(r.lema ? [h("p.dicc-lema", "Forma de ", h("b", r.lema.toUpperCase()))] : []),
    h(
      "div.dicc-acepciones",
      r.lista.map((x, i) =>
        h(
          "div.dicc-acepcion",
          h(
            "div.dicc-cab",
            h("span.dicc-num", String(i + 1)),
            x.tipo ? h("span.dicc-etiqueta", TIPOS[x.tipo] ?? x.tipo) : null,
            x.ambito ? h("span.dicc-etiqueta.ambito", x.ambito) : null,
            x.uso ? h("span.dicc-etiqueta.uso", x.uso) : null
          ),
          h("p.dicc-texto", x.texto)
        )
      )
    )
  );
}

/**
 * Hace tocables las palabras de una zona de resultados (fichas .pg-chip, respuestas .det, la palabra que
 * faltó…). Se puede llamar sobre la pantalla entera: solo reacciona a lo que de verdad es una palabra.
 */
export function palabrasTocables(zona) {
  const SELECTOR = "[data-palabra], .pg-chip, .det, .pendiente b, .final-dato-valor.es-palabra";
  const marcar = () =>
    zona.querySelectorAll(SELECTOR).forEach((el) => {
      if (el.classList.contains("tocable") || el.classList.contains("no-palabra")) return;
      const p = el.dataset.palabra ?? palabraDe(el.textContent);
      if (!p) return el.classList.add("no-palabra");
      el.dataset.palabra = p;
      el.classList.add("tocable");
      el.setAttribute("role", "button");
      el.tabIndex = 0;
      el.title = `Ver qué significa «${p.toLowerCase()}»`;
    });
  marcar();
  // Lo que se añada después (p. ej. al desplegar más respuestas) también.
  new MutationObserver(marcar).observe(zona, { childList: true, subtree: true });
  const abrir = (ev) => {
    const el = ev.target.closest?.(".tocable[data-palabra]");
    if (!el || !zona.contains(el)) return;
    ev.preventDefault();
    verPalabra(el.dataset.palabra);
  };
  zona.addEventListener("click", abrir);
  zona.addEventListener("keydown", (ev) => (ev.key === "Enter" || ev.key === " ") && abrir(ev));
  return zona;
}
