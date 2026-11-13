// Hazañas: los logros más difíciles de cada juego (modo solo). Se comprueban al acabar cada partida
// y se guardan en el móvil con la fecha en que se consiguieron. Para añadir una, basta con sumarla a la lista.
import { h } from "../comun/ui.js";
import { almacen } from "../comun/conexion.js";

/**
 * comprobar({ meta, r, j, ronda }) → true si se ha conseguido.
 *   meta: el juego (con duracion y dificultad); r: el resultado; j: el estado del jugador en la ronda; ronda: la partida.
 */
export const HAZANAS = [
  {
    id: "llegar-directo", juego: "llegar-resultado", icono: "🎯", nombre: "Directo al grano",
    desc: "Llega exacto al objetivo con 2 cálculos o menos, en Difícil.",
    comprobar: ({ meta, j }) => meta.dificultad === "dificil" && j?.mejor?.dist === 0 && (j.mejor.pasos?.length ?? 9) <= 2,
  },
  {
    id: "tutifruti-panal", juego: "paraulogico", icono: "🍯", nombre: "Panal completo",
    desc: "Encuentra todas las palabras comunes de un panal.",
    comprobar: ({ j, ronda }) => ronda?.comunes?.length > 0 && ronda.comunes.every((c) => j?.encontradas?.some((e) => e.clave === c)),
  },
  {
    id: "larga-todas", juego: "palabra-larga", icono: "🔠", nombre: "Sin dejar letra",
    desc: "Forma una palabra que use todas las letras.",
    comprobar: ({ j, ronda }) => Boolean(j?.mejor) && j.mejor.largo === ronda?.letras?.length,
  },
  {
    id: "definicion-sin-pistas", juego: "definicion", icono: "📖", nombre: "Sin chuleta",
    desc: "Acierta 6 palabras en una partida sin pedir ninguna pista.",
    comprobar: ({ j }) => (j?.aciertos ?? 0) >= 6 && !j.pistas,
  },
  {
    id: "sopa-halcon", juego: "sopa", icono: "🦅", nombre: "Ojo de halcón",
    desc: "Encuentra todas las palabras de la sopa en Difícil.",
    comprobar: ({ meta, j, ronda }) => meta.dificultad === "dificil" && j?.encontradas?.length === ronda?.palabras?.length,
  },
  {
    id: "revuelto-diez", juego: "revuelto", icono: "🧶", nombre: "Desenredador",
    desc: "Encuentra 10 palabras en una sola partida.",
    comprobar: ({ j }) => (j?.aciertos ?? 0) >= 10,
  },
  {
    id: "calculo-perfecto", juego: "calculo-mental", icono: "🧠", nombre: "Calculadora humana",
    desc: "Acierta todas las operaciones en Difícil.",
    comprobar: ({ meta, j, ronda }) => meta.dificultad === "dificil" && ronda?.cadenas?.length > 0 && ronda.cadenas.every((_, k) => j?.respuestas?.[k]?.ok),
  },
  {
    id: "mates-sin-fallo", juego: "mates-fugaces", icono: "⚡", nombre: "Sin un fallo",
    desc: "Acierta 20 operaciones en una partida sin fallar ninguna.",
    comprobar: ({ j }) => (j?.aciertos ?? 0) >= 20 && !j.fallos,
  },
  {
    id: "laberinto-rapido", juego: "laberinto", icono: "⏱️", nombre: "Contrarreloj",
    desc: "Completa el laberinto en Difícil en menos de 60 segundos.",
    comprobar: ({ meta, j }) => meta.dificultad === "dificil" && j?.ms != null && j.ms < 60000,
  },
];

export function leerHazanas() {
  try {
    return JSON.parse(almacen.leer("nyp-hazanas") ?? "{}");
  } catch {
    return {};
  }
}

/** Al acabar una partida: las hazañas nuevas que se han conseguido (y quedan guardadas). */
export function comprobarHazanas(meta, r, ronda, id) {
  const hechas = leerHazanas();
  const j = ronda?.jugadores?.[id];
  const nuevas = [];
  for (const x of HAZANAS) {
    if (x.juego !== meta.id || hechas[x.id]) continue;
    let ok = false;
    try {
      ok = Boolean(x.comprobar({ meta, r, j, ronda }));
    } catch {}
    if (ok) {
      hechas[x.id] = new Date().toISOString().slice(0, 10);
      nuevas.push(x);
    }
  }
  if (nuevas.length) almacen.guardar("nyp-hazanas", JSON.stringify(hechas));
  return nuevas;
}

/** Tarjeta para la pantalla final cuando se consigue una. */
export function tarjetaHazanas(nuevas) {
  if (!nuevas?.length) return null;
  return h(
    "div.hazana-nueva",
    nuevas.map((x) => h("div.hazana-fila", h("span.hazana-medalla", x.icono), h("div", h("small", "🎖️ ¡Hazaña conseguida!"), h("b", x.nombre), h("p", x.desc))))
  );
}

/** Ventana con todas las hazañas: conseguidas (con fecha) y por conseguir. */
export function ventanaHazanas(juegos, iconos) {
  const hechas = leerHazanas();
  const nombre = Object.fromEntries(juegos.map((j) => [j.id, j.nombre]));
  const lista = HAZANAS.filter((x) => nombre[x.juego]);
  const total = lista.filter((x) => hechas[x.id]).length;
  const cerrar = () => {
    capa.remove();
    removeEventListener("keydown", tecla, true);
  };
  const tecla = (ev) => {
    if (ev.key === "Escape") {
      ev.preventDefault();
      ev.stopPropagation();
      cerrar();
    }
  };
  const capa = h(
    "div.capa-movil.capa-records.capa-hazanas",
    { onclick: (ev) => ev.target === capa && cerrar() },
    h(
      "div.caja.tarjeta",
      h(
        "div.records-cabeza",
        h("h2", "🎖️ Hazañas"),
        h("span.hazanas-cuenta", `${total} / ${lista.length}`),
        h("button.icono-btn", { type: "button", onclick: cerrar, "aria-label": "Cerrar" }, "✕")
      ),
      h("p.familia-nota", "Los retos más difíciles de cada juego. ¿Te atreves?"),
      h(
        "div.records-lista",
        lista
          .sort((a, b) => Boolean(hechas[b.id]) - Boolean(hechas[a.id]))
          .map((x, i) => {
            const f = hechas[x.id];
            return h(
              `div.hazana${f ? ".hecha" : ""}`,
              { style: { animationDelay: `${60 + i * 40}ms` } },
              h("span.hazana-medalla", f ? x.icono : "🔒"),
              h("div.hazana-textos", h("b", x.nombre), h("small", `${iconos?.[x.juego] ?? ""} ${nombre[x.juego]}`), h("p", x.desc)),
              f ? h("span.hazana-fecha", `✔ ${f.slice(8, 10)}/${f.slice(5, 7)}`) : null
            );
          })
      )
    )
  );
  addEventListener("keydown", tecla, true);
  document.body.append(capa);
}
