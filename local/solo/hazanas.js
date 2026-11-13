// Hazañas: los logros más difíciles de cada juego (modo solo). Se comprueban al acabar cada partida
// y se guardan en el móvil con la fecha en que se consiguieron. Para añadir una, basta con sumarla a la lista.
import { h, confeti, SOMBREROS, ANIMACIONES } from "../comun/ui.js";
import { almacen } from "../comun/conexion.js";

/**
 * comprobar({ meta, r, j, ronda }) → true si se ha conseguido.
 *   meta: el juego (con duracion y dificultad); r: el resultado; j: el estado del jugador en la ronda; ronda: la partida.
 */
export const HAZANAS = [
  {
    id: "llegar-directo", juego: "llegar-resultado", icono: "🎯", nombre: "Directo al grano", premio: { sombrero: "corona" },
    desc: "Llega exacto al objetivo con 2 cálculos o menos, en Difícil.",
    comprobar: ({ meta, j }) => meta.dificultad === "dificil" && j?.mejor?.dist === 0 && (j.mejor.pasos?.length ?? 9) <= 2,
  },
  {
    id: "tutifruti-panal", juego: "paraulogico", icono: "🍯", nombre: "Panal completo", premio: { animacion: "baile" },
    desc: "Encuentra todas las palabras comunes de un panal.",
    comprobar: ({ j, ronda }) => ronda?.comunes?.length > 0 && ronda.comunes.every((c) => j?.encontradas?.some((e) => e.clave === c)),
  },
  {
    id: "larga-todas", juego: "palabra-larga", icono: "🔠", nombre: "Sin dejar letra", premio: { sombrero: "birrete" },
    desc: "Forma una palabra que use todas las letras.",
    comprobar: ({ j, ronda }) => Boolean(j?.mejor) && j.mejor.largo === ronda?.letras?.length,
  },
  {
    id: "definicion-sin-pistas", juego: "definicion", icono: "📖", nombre: "Sin chuleta", premio: { sombrero: "chistera" },
    desc: "Acierta 6 palabras en una partida sin pedir ninguna pista.",
    comprobar: ({ j }) => (j?.aciertos ?? 0) >= 6 && !j.pistas,
  },
  {
    id: "sopa-halcon", juego: "sopa", icono: "🦅", nombre: "Ojo de halcón", premio: { animacion: "brillo" },
    desc: "Encuentra todas las palabras de la sopa en Difícil.",
    comprobar: ({ meta, j, ronda }) => meta.dificultad === "dificil" && j?.encontradas?.length === ronda?.palabras?.length,
  },
  {
    id: "revuelto-diez", juego: "revuelto", icono: "🧶", nombre: "Desenredador", premio: { sombrero: "gorra" },
    desc: "Encuentra 10 palabras en una sola partida.",
    comprobar: ({ j }) => (j?.aciertos ?? 0) >= 10,
  },
  {
    id: "calculo-perfecto", juego: "calculo-mental", icono: "🧠", nombre: "Calculadora humana", premio: { animacion: "giro" },
    desc: "Acierta todas las operaciones en Difícil.",
    comprobar: ({ meta, j, ronda }) => meta.dificultad === "dificil" && ronda?.cadenas?.length > 0 && ronda.cadenas.every((_, k) => j?.respuestas?.[k]?.ok),
  },
  {
    id: "mates-sin-fallo", juego: "mates-fugaces", icono: "⚡", nombre: "Sin un fallo", premio: { animacion: "salto" },
    desc: "Acierta 20 operaciones en una partida sin fallar ninguna.",
    comprobar: ({ j }) => (j?.aciertos ?? 0) >= 20 && !j.fallos,
  },
  {
    id: "laberinto-rapido", juego: "laberinto", icono: "⏱️", nombre: "Contrarreloj", premio: { sombrero: "lazo" },
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

/** Texto del premio: "👑 Corona" o "✨ Animación Baile". */
export function textoPremio(premio) {
  if (premio?.sombrero) return `${SOMBREROS[premio.sombrero]} ${premio.sombrero[0].toUpperCase()}${premio.sombrero.slice(1)}`;
  if (premio?.animacion) return `✨ Animación «${ANIMACIONES[premio.animacion]}»`;
  return "";
}

/** Premios ganados: { sombreros: Set, animaciones: Set } (y de qué hazaña sale cada uno). */
export function premiosGanados() {
  const hechas = leerHazanas();
  const sombreros = new Set(), animaciones = new Set();
  for (const x of HAZANAS) {
    if (!hechas[x.id]) continue;
    if (x.premio?.sombrero) sombreros.add(x.premio.sombrero);
    if (x.premio?.animacion) animaciones.add(x.premio.animacion);
  }
  return { sombreros, animaciones };
}

/** Qué hazaña da cada premio (para decir cómo se consigue). */
export function hazanaDe(tipo, id) {
  return HAZANAS.find((x) => x.premio?.[tipo] === id) ?? null;
}

/** Fanfarria de trompetas, hecha en el momento (sin archivos de sonido). */
function fanfarria() {
  try {
    const A = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = A.currentTime + 0.05;
    const notas = [[523, 0, 0.14], [523, 0.15, 0.14], [523, 0.3, 0.14], [659, 0.45, 0.32], [523, 0.8, 0.16], [659, 0.97, 0.16], [784, 1.14, 0.7]];
    for (const [f, ini, dur] of notas) {
      for (const [mult, vol] of [[1, 0.16], [2, 0.05], [3, 0.03]]) {
        const o = A.createOscillator(), g = A.createGain();
        o.type = "sawtooth";
        o.frequency.value = f * mult;
        g.gain.setValueAtTime(0, t0 + ini);
        g.gain.linearRampToValueAtTime(vol, t0 + ini + 0.03);
        g.gain.setValueAtTime(vol, t0 + ini + dur - 0.05);
        g.gain.linearRampToValueAtTime(0, t0 + ini + dur);
        const filtro = A.createBiquadFilter();
        filtro.type = "lowpass";
        filtro.frequency.value = 2400;
        o.connect(filtro).connect(g).connect(A.destination);
        o.start(t0 + ini);
        o.stop(t0 + ini + dur + 0.02);
      }
    }
    setTimeout(() => A.close?.(), 2600);
  } catch {}
}

/** ¡Hazaña! Trompetas, la medalla que salta, confeti y el premio que desbloquea. */
export function celebrarHazanas(nuevas) {
  if (!nuevas?.length) return;
  const x = nuevas[0];
  fanfarria();
  navigator.vibrate?.([80, 60, 80, 60, 200]);
  confeti(140);
  setTimeout(() => confeti(90), 900);
  const cerrar = () => {
    capa.classList.add("se-va");
    setTimeout(() => capa.remove(), 300);
    if (nuevas.length > 1) setTimeout(() => celebrarHazanas(nuevas.slice(1)), 350);
  };
  const capa = h(
    "div.celebracion",
    { onclick: (ev) => ev.target === capa && cerrar() },
    h("span.trompeta.izq", "🎺"),
    h("span.trompeta.der", "🎺"),
    h(
      "div.celebracion-caja",
      h("div.celebracion-rayos"),
      h("div.celebracion-titulo", "¡HAZAÑA!"),
      h("div.celebracion-medalla", x.icono),
      h("b.celebracion-nombre", x.nombre),
      h("p.celebracion-desc", x.desc),
      x.premio ? h("div.celebracion-premio", h("small", "🎁 Has desbloqueado"), h("b", textoPremio(x.premio)), h("small", "Póntelo en tu perfil, pestaña Premios")) : null,
      h("button.boton.acento.grande", { type: "button", onclick: cerrar }, "¡Genial!")
    )
  );
  document.body.append(capa);
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
              h("div.hazana-textos", h("b", x.nombre), h("small", `${iconos?.[x.juego] ?? ""} ${nombre[x.juego]}`), h("p", x.desc), x.premio ? h("small.hazana-premio", `🎁 ${textoPremio(x.premio)}`) : null),
              f ? h("span.hazana-fecha", `✔ ${f.slice(8, 10)}/${f.slice(5, 7)}`) : null
            );
          })
      )
    )
  );
  addEventListener("keydown", tecla, true);
  document.body.append(capa);
}
