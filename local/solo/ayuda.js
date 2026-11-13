// Ayuda de cada juego (botón ? del selector): cómo se juega, paso a paso, y un vídeo de muestra.
// Los vídeos van en web/ayuda/videos/<id del juego>.mp4 (vertical, unos segundos, sin sonido).
// Si todavía no hay vídeo de un juego, la ventana lo dice y enseña solo los pasos.
import { h } from "../comun/ui.js";

const AYUDA = {
  "palabra-larga": {
    pasos: ["Toca las letras para formar una palabra (cada letra, una vez).", "Pulsa Comprobar: si existe, se apunta.", "Intenta otra más larga: cuenta la más larga que encuentres."],
    puntos: "Gana quien forme la palabra más larga. Valen plurales, femeninos y verbos conjugados.",
    niveles: "Fácil: 11 letras · Medio: 10 · Difícil: 9.",
  },
  definicion: {
    pasos: ["Lee la definición y fíjate en cuántas letras tiene.", "Escribe la palabra con el teclado.", "¿Atascado? Pide una pista (desvela una letra, pero resta) o pasa a la siguiente."],
    puntos: "Cada palabra acertada suma; las pistas restan. Gana quien sume más.",
    niveles: "Fácil: palabras cortas y comunes · Difícil: más largas y raras.",
  },
  sopa: {
    pasos: ["Busca las palabras de la lista en el tablero.", "Arrastra el dedo de la primera letra a la última.", "Pueden ir en horizontal, vertical, diagonal y al revés."],
    puntos: "Gana quien encuentre más palabras.",
    niveles: "Fácil: tablero de 9×9 y 6 palabras · Difícil: 12×12 y 10 palabras.",
  },
  revuelto: {
    pasos: ["Arriba tienes dos definiciones; abajo, las 12 letras de las dos palabras mezcladas.", "Escribe una de las palabras con las letras y pulsa Comprobar.", "Si te atascas, mantén ⏭ Pasar para ir al siguiente revuelto."],
    puntos: "Cada palabra encontrada cuenta 1. Gana quien encuentre más.",
    niveles: "Fácil: palabras más comunes · Difícil: más raras.",
  },
  paraulogico: {
    pasos: ["Forma palabras de 3 o más letras con las del panal.", "La letra del centro tiene que estar siempre; las demás se pueden repetir.", "Pulsa Comprobar; Mezclar cambia las letras de sitio."],
    puntos: "Cuanto más larga, más puntos. Un «tuti» (usar las 7 letras) da +10.",
    niveles: "Fácil: panal con muchas palabras y te dice cuántas quedan · Difícil: panal con pocas.",
  },
  crucigrama: {
    pasos: ["Elige un tema (Medicina, Marina, Música…) o al azar.", "Toca una casilla para elegir su palabra; arriba sale la definición. Otro toque en la misma casilla cambia entre horizontal y vertical.", "Escribe la palabra: al llenarla se comprueba sola. ◀ ▶ pasan de una definición a otra."],
    puntos: "Gana quien resuelva más palabras; si empatan, quien terminó antes.",
    niveles: "Fácil: 8 palabras, más comunes y con definiciones más largas · Difícil: 12 palabras y definiciones más cortas.",
  },
  conexiones: {
    pasos: ["Hay 16 palabras que forman 4 grupos de 4 con algo en común.", "Toca 4 palabras y pulsa Comprobar. Si 3 son del mismo grupo te avisa: «¡A una de distancia!».", "Tienes 4 fallos por tablero; al terminar sale otro. ¡Ojo con las trampas: hay palabras que parecen de otro grupo!"],
    puntos: "Gana quien encuentre más grupos (si empatan, quien falló menos).",
    niveles: "Fácil: grupos de cosas (aves, muebles…) · Difícil: también temas (Música, Medicina…) y cómo se escriben (esconden un animal…).",
  },
  semantica: {
    pasos: ["Hay una palabra secreta. Escribe cualquier palabra y pulsa Probar.", "Verás su puesto: el #1 es la secreta; cuanto más bajo, más cerca de su significado (🔥 caliente, 🧊 frío).", "Ve acercándote con palabras parecidas. Si te atascas, pide una 💡 pista."],
    puntos: "Gana quien la encuentre con menos intentos y pistas; si nadie, quien se quede más cerca.",
    niveles: "Fácil: 4 pistas · Medio: 3 · Difícil: 1.",
  },
  memoria: {
    pasos: ["Mira las tarjetas mientras se acaba la barra: luego se tapan.", "Según la prueba: tócalas de menor a mayor, di dónde estaba una palabra o descubre cuál ha cambiado.", "Responde rápido: el tiempo también cuenta si hay empate."],
    puntos: "Gana quien acierte más pruebas.",
    niveles: "Fácil: 4 tarjetas y más tiempo · Difícil: 6 tarjetas y menos tiempo.",
  },
  kenken: {
    pasos: ["En cada fila y columna van los números del 1 al N, sin repetir.", "Cada jaula (bordes gruesos) marca un número y una operación: sus números, con esa operación, tienen que dar ese número.", "Toca una casilla y luego el número. Los repetidos salen en rojo y las jaulas que cuadran, en verde."],
    puntos: "Gana quien lo resuelva antes; si nadie, quien tenga más jaulas bien.",
    niveles: "Fácil: 4×4 · Medio: 5×5 · Difícil: 6×6.",
  },
  "calculo-mental": {
    pasos: ["Aparece una operación con paréntesis: cada operación tiene su color.", "Resuélvela de cabeza, de dentro hacia fuera.", "Escribe el resultado y pulsa OK. Solo hay un intento por operación."],
    puntos: "Gana quien acierte más; si empatan, quien respondió antes.",
    niveles: "Fácil: 3 operaciones y más tiempo · Difícil: 5 y menos tiempo.",
  },
  "llegar-resultado": {
    pasos: ["Toca un número, un signo y otro número: la operación sube sola a la lista.", "Su resultado se puede volver a usar como un número más.", "Intenta llegar justo al objetivo (como mucho 5 operaciones)."],
    puntos: "Gana quien llegue exacto o, si nadie llega, quien se quede más cerca.",
    niveles: "Fácil: objetivos pequeños · Difícil: objetivos grandes y se puede pasar por negativos.",
  },
  "mates-fugaces": {
    pasos: ["Aparece una operación sencilla.", "Escribe el resultado y pulsa OK.", "Si se te atraganta, pásala y sigue."],
    puntos: "Gana quien acierte más en el tiempo.",
    niveles: "Fácil: operaciones sencillas que se complican despacio · Difícil: más difíciles desde el principio.",
  },
  laberinto: {
    pasos: ["El tablero tiene cuentas cruzadas con huecos; cada cuenta es un camino de color.", "Arrastra cada número de abajo a su hueco (o tócalo y luego el hueco).", "Las cuentas se leen de izquierda a derecha o de arriba abajo."],
    puntos: "Gana quien lo complete antes; si nadie lo completa, quien tenga más cuentas bien.",
    niveles: "Fácil: pocas cuentas y pocos huecos · Difícil: más cuentas y más huecos.",
  },
  pulsador: {
    pasos: ["Lee la pregunta en la TV (hay unos segundos para leer).", "Pulsa el botón el primero y responde en voz alta.", "El presentador dice si aciertas. Si fallas, ya no puedes pulsar en esa pregunta."],
    puntos: "Gana quien acierte más preguntas.",
    niveles: "Fácil: preguntas sencillas y más tiempo para leer · Difícil: más difíciles y menos tiempo.",
  },
};

/** Abre la ventana de ayuda del juego. icono: el emoji del juego. */
export function ventanaAyuda(juego, icono = "🎲") {
  const a = AYUDA[juego.id] ?? { pasos: [], puntos: "", niveles: "" };
  const video = h("video.ayuda-video", { muted: true, loop: true, playsInline: true, autoplay: true, preload: "metadata" });
  video.setAttribute("playsinline", "");
  const caja = h("div.ayuda-video-caja", video);
  // Sin vídeo todavía: se queda un recuadro que lo explica.
  video.addEventListener("error", () => caja.replaceChildren(h("div.ayuda-sin-video", h("span", "🎬"), h("small", "Vídeo de muestra en preparación"))), { once: true });
  video.src = new URL(`../ayuda/videos/${juego.id}.mp4`, import.meta.url).href;

  const cerrar = () => {
    video.pause();
    capa.remove();
    removeEventListener("keydown", tecla, true);
  };
  const tecla = (ev) => {
    if (ev.key === "Escape" || ev.key === "?") {
      ev.preventDefault();
      ev.stopPropagation();
      cerrar();
    }
  };
  const capa = h(
    "div.capa-movil.capa-ayuda",
    { onclick: (ev) => ev.target === capa && cerrar() },
    h(
      "div.caja.tarjeta",
      { role: "dialog", "aria-label": `Cómo se juega a ${juego.nombre}` },
      h("div.ayuda-cabeza", h("span.ayuda-icono", icono), h("h2", juego.nombre), h("button.icono-btn", { type: "button", onclick: cerrar, "aria-label": "Cerrar" }, "✕")),
      caja,
      h("ol.ayuda-pasos", a.pasos.map((p, i) => h("li", { style: { animationDelay: `${120 + i * 70}ms` } }, p))),
      a.puntos ? h("p.ayuda-linea", h("b", "🏆 "), a.puntos) : null,
      a.niveles ? h("p.ayuda-linea", h("b", "◆ "), a.niveles) : null,
      h("button.boton.acento.grande", { type: "button", onclick: cerrar }, "¡Entendido!")
    )
  );
  addEventListener("keydown", tecla, true);
  document.body.append(capa);
}
