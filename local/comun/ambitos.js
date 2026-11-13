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

/** Ventana para elegir tema, al azar o de todos los temas. Devuelve el tema, "azar", "todos" o null si se cierra. */
export function elegirAmbito(lista) {
  return new Promise((ok) => {
    const ultimo = almacen.leer("nyp-ambito");
    const cerrar = (v) => {
      capa.remove();
      if (v) almacen.guardar("nyp-ambito", v);
      ok(v);
    };
    const capa = h(
      "div.capa-movil.capa-ambitos",
      { onclick: (ev) => ev.target === capa && cerrar(null) },
      h(
        "div.caja.tarjeta",
        h("div.records-cabeza", h("h2", "📚 Elige el tema"), h("button.icono-btn", { type: "button", onclick: () => cerrar(null), "aria-label": "Cerrar" }, "✕")),
        h(
          "div.ambito-generales",
          h("button.boton.acento.ambito-azar", { type: "button", onclick: () => cerrar("todos") }, "🌍 Todos los temas"),
          h("button.boton.suave.ambito-azar", { type: "button", onclick: () => cerrar("azar") }, "🎲 Un tema al azar")
        ),
        h(
          "div.ambitos",
          lista.map((a) =>
            h(`button.ambito${a === ultimo ? ".ultimo" : ""}`, { type: "button", onclick: () => cerrar(a) }, h("span.ambito-icono", ICONOS_AMBITO[a] ?? "📚"), h("small", a))
          )
        )
      )
    );
    document.body.append(capa);
  });
}
