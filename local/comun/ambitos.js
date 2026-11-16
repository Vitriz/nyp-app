// Temas (ámbitos) del crucigrama, con su icono. Lo usan el móvil (modo solo) y la TV (PARTY).
import { h } from "./ui.js";
import { almacen } from "./conexion.js";

export const ICONOS_AMBITO = {
  Anatomía: "🫀", Arquitectura: "🏛️", Astronomía: "🔭", Biología: "🧬", Botánica: "🌿", Cinegética: "🦌", Comercio: "🛒",
  Construcción: "🧱", Deportes: "⚽", Derecho: "⚖️", Economía: "💶", Equitación: "🐎", Esgrima: "🤺", Filosofía: "🤔",
  Física: "⚛️", Geografía: "🗺️", Geología: "🪨", Gramática: "✍️", Heráldica: "🛡️", Imprenta: "🖨️", Informática: "💻",
  Ingeniería: "⚙️", Lingüística: "🗣️", Marina: "⚓", Matemáticas: "➗", Mecánica: "🔧", Medicina: "🩺", Milicia: "🎖️",
  Música: "🎵", Pintura: "🎨", Psicología: "🧠", Química: "⚗️", Religión: "⛪", Tauromaquia: "🐂", Zoología: "🦁",
};

/** Ventana para elegir un número (p. ej. cuántas operaciones). Devuelve el número o null. */
export function elegirNumero(titulo, valores, defecto) {
  return new Promise((ok) => {
    const cerrar = (v) => (capa.remove(), ok(v));
    const capa = h(
      "div.capa-movil",
      { onclick: (ev) => ev.target === capa && cerrar(null) },
      h(
        "div.caja.tarjeta",
        h("div.records-cabeza", h("h2", titulo), h("button.icono-btn.cerrar", { type: "button", onclick: () => cerrar(null), "aria-label": "Cerrar" }, "✕")),
        h("div.elegir-numero", valores.map((v) => h(`button.boton${v === defecto ? ".acento" : ".suave"}.grande`, { type: "button", onclick: () => cerrar(v) }, String(v))))
      )
    );
    document.body.append(capa);
  });
}

/**
 * Los temas como parte de otra pantalla (sin ventana): fichas para marcar uno o varios, «Todos» y «Al azar».
 * Se recuerda lo elegido. valor(): "todos", "azar" o la lista de temas ([] = ninguno).
 */
export function selectorAmbitos(lista, alCambiar = () => {}) {
  let elegidos;
  try {
    const g = JSON.parse(almacen.leer("nyp-ambitos") ?? "null");
    elegidos = new Set(Array.isArray(g) ? g.filter((a) => lista.includes(a)) : g === "todos" || g == null ? lista : []);
  } catch {
    elegidos = new Set(lista);
  }
  let azar = almacen.leer("nyp-ambitos-azar") === "1";
  const todos = h("button.ambito-general", { type: "button", onclick: () => ((azar = false), (elegidos = new Set(elegidos.size === lista.length ? [] : lista)), pintar()) });
  const alAzar = h("button.ambito-general", { type: "button", onclick: () => ((azar = !azar), pintar()) }, "🎲 Uno al azar");
  const fichas = lista.map((a) =>
    h(
      "button.ambito",
      { type: "button", "aria-pressed": "false", onclick: () => ((azar = false), elegidos.has(a) ? elegidos.delete(a) : elegidos.add(a), pintar()) },
      h("span.ambito-marca", "✓"),
      h("span.ambito-icono", ICONOS_AMBITO[a] ?? "📚"),
      h("small", a)
    )
  );
  const valor = () => (azar ? "azar" : elegidos.size === lista.length ? "todos" : [...elegidos]);
  function pintar() {
    fichas.forEach((b, k) => b.setAttribute("aria-pressed", String(!azar && elegidos.has(lista[k]))));
    todos.textContent = elegidos.size === lista.length && !azar ? "Quitar todos" : "🌍 Todos";
    todos.setAttribute("aria-pressed", String(!azar && elegidos.size === lista.length));
    alAzar.setAttribute("aria-pressed", String(azar));
    el.classList.toggle("en-azar", azar);
    almacen.guardar("nyp-ambitos", JSON.stringify(elegidos.size === lista.length ? "todos" : [...elegidos]));
    almacen.guardar("nyp-ambitos-azar", azar ? "1" : "0");
    alCambiar(valor());
  }
  const el = h("div.selector-ambitos", h("div.ambito-generales", todos, alAzar), h("div.ambitos", fichas));
  pintar();
  return { el, valor };
}

/**
 * Pantalla para elegir los temas de la partida: uno, varios o todos (o uno al azar).
 * Devuelve "todos", "azar", una lista de temas, o null si se cierra.
 */
export function elegirAmbito(lista) {
  return new Promise((ok) => {
    let elegidos;
    try {
      const g = JSON.parse(almacen.leer("nyp-ambitos") ?? "null");
      elegidos = new Set(Array.isArray(g) ? g.filter((a) => lista.includes(a)) : g === "todos" ? lista : []);
    } catch {
      elegidos = new Set();
    }
    // Lo que se eligió con la versión anterior (un solo tema), solo si nunca se ha guardado una selección.
    const viejo = almacen.leer("nyp-ambito");
    if (almacen.leer("nyp-ambitos") == null && lista.includes(viejo)) elegidos.add(viejo);

    const cerrar = (v) => {
      capa.remove();

      ok(v);
    };
    const jugar = h("button.boton.acento.grande.ambito-jugar", { type: "button", onclick: () => cerrar(elegidos.size === lista.length ? "todos" : [...elegidos]) });
    const todos = h("button.boton.suave.ambito-todos", { type: "button", onclick: () => ((elegidos = new Set(elegidos.size === lista.length ? [] : lista)), pintar()) });
    const fichas = lista.map((a) =>
      h(
        "button.ambito",
        { type: "button", "aria-pressed": "false", onclick: () => (elegidos.has(a) ? elegidos.delete(a) : elegidos.add(a), pintar()) },
        h("span.ambito-marca", "✓"),
        h("span.ambito-icono", ICONOS_AMBITO[a] ?? "📚"),
        h("small", a)
      )
    );
    function pintar() {
      fichas.forEach((b, k) => b.setAttribute("aria-pressed", String(elegidos.has(lista[k]))));
      // La selección se guarda en cuanto cambia (también si luego cierras la ventana o eliges uno al azar).
      almacen.guardar("nyp-ambitos", JSON.stringify(elegidos.size === lista.length ? "todos" : [...elegidos]));
      const n = elegidos.size;
      todos.textContent = n === lista.length ? "Quitar todos" : "🌍 Elegir todos";
      jugar.disabled = !n;
      jugar.textContent = !n ? "Elige al menos un tema" : n === lista.length ? "¡Jugar con todos los temas! ▶" : n === 1 ? `¡Jugar con ${[...elegidos][0]}! ▶` : `¡Jugar con ${n} temas! ▶`;
    }
    const capa = h(
      "div.capa-movil.capa-ambitos",
      { onclick: (ev) => ev.target === capa && cerrar(null) },
      h(
        "div.caja.tarjeta",
        h("div.records-cabeza", h("h2", "📚 Elige los temas"), h("button.icono-btn.cerrar", { type: "button", onclick: () => cerrar(null), "aria-label": "Cerrar" }, "✕")),
        h("p.ambito-ayuda", "Toca uno o varios: la partida mezcla palabras de todos los que marques."),
        h("div.ambito-generales", todos, h("button.boton.suave.ambito-azar", { type: "button", onclick: () => cerrar("azar") }, "🎲 Uno al azar")),
        h("div.ambitos", fichas),
        jugar
      )
    );
    pintar();
    document.body.append(capa);
  });
}

