// Pantalla de opciones de una partida (modo solo), entre la lista de juegos y la partida.
// A la izquierda (arriba en el móvil): el vídeo de muestra y cómo se juega. A la derecha (abajo): lo que se
// elige antes de empezar —nivel y temas al jugar; tiempo y nivel con contrarreloj— y el botón para empezar.
import { h } from "../comun/ui.js";
import { selectorAmbitos } from "../comun/ambitos.js";
import { AYUDA, videoAyuda } from "./ayuda.js";

const NOMBRES_NIVEL = { facil: "Fácil", normal: "Medio", dificil: "Difícil" };
const TIEMPOS_CRONO = [30, 45, 60, 120];
const texto = (s) => (s < 60 ? `${s} s` : `${s / 60} min`);

/**
 * juego: { id, nombre, ambitos? }; modo: "normal" | "crono"; icono: emoji del juego.
 * valores: { nivel, tiempo, operaciones } (lo último elegido); reglas(nivel): { fallos, pistas, pases } del juego.
 * alJugar({ dificultad, duracion, ambito, operaciones }); alVolver(). barra: la barra de arriba de la pantalla.
 * Devuelve { el, desmontar }.
 */
export function pantallaOpciones({ juego, modo, icono, valores, reglas = () => ({}), barra, alJugar, alVolver }) {
  const crono = modo === "crono";
  const a = AYUDA[juego.id] ?? { pasos: [], puntos: "", niveles: "" };
  let nivel = valores.nivel ?? "normal";
  let tiempo = TIEMPOS_CRONO.includes(valores.tiempo) ? valores.tiempo : 60;
  let operaciones = valores.operaciones ?? 8;
  let ambito = null;

  // ---- izquierda: cómo se juega
  const { el: video, video: v } = videoAyuda(juego.id);
  const info = h(
    "div.op-info",
    h("div.op-cabeza", h("span.op-icono", icono), h("div.op-titulos", h(`span.op-modo${crono ? ".crono" : ""}`, crono ? "⏱ Contrarreloj" : "▶ Partida"), h("h1.op-nombre", juego.nombre))),
    video,
    h("ol.op-pasos", a.pasos.map((p) => h("li", p))),
    a.puntos ? h("p.op-linea", h("b", "🏆 "), a.puntos) : null
  );

  // ---- derecha: opciones
  const grupo = (titulo, ...hijos) => h("div.op-grupo", h("h2.op-grupo-titulo", titulo), ...hijos);
  const segmentos = (valoresLista, actual, textoDe, alElegir, clase = "") =>
    h(
      `div.op-segmentos${clase}`,
      { role: "radiogroup" },
      valoresLista.map((x) =>
        h(`button.op-seg${x === actual ? ".elegido" : ""}`, { type: "button", role: "radio", "aria-checked": String(x === actual), "data-v": x, onclick: () => alElegir(x) }, textoDe(x))
      )
    );
  const reglasEl = h("p.op-reglas");
  function pintarReglas() {
    const r = reglas(nivel) ?? {};
    const partes = [];
    if (r.fallos != null) partes.push(`❤️ ${r.fallos} ${r.fallos === 1 ? "fallo" : "fallos"} y se acaba`);
    else if ("fallos" in r) partes.push("❤️ sin límite de fallos");
    if (r.pistas != null) partes.push(`💡 ${r.pistas} ${r.pistas === 1 ? "pista" : "pistas"}`);
    if (r.pases != null) partes.push(`⏭ ${r.pases} ${r.pases === 1 ? "pase" : "pases"}`);
    reglasEl.textContent = partes.join(" · ");
    reglasEl.hidden = !partes.length;
  }
  const cajaNivel = h("div");
  const pintarNivel = () =>
    cajaNivel.replaceChildren(
      segmentos(["facil", "normal", "dificil"], nivel, (x) => NOMBRES_NIVEL[x], (x) => ((nivel = x), pintarNivel(), pintarReglas()), ".niveles")
    );
  const cajaTiempo = h("div");
  const pintarTiempo = () => cajaTiempo.replaceChildren(segmentos(TIEMPOS_CRONO, tiempo, texto, (x) => ((tiempo = x), pintarTiempo())));
  const cajaOps = h("div");
  const pintarOps = () => cajaOps.replaceChildren(segmentos([5, 8, 12, 16, 20], operaciones, String, (x) => ((operaciones = x), pintarOps())));

  const jugar = h(`button.boton.grande.op-jugar${crono ? ".crono" : ".acento"}`, { type: "button", onclick: empezar });
  const temas = juego.ambitos?.length
    ? selectorAmbitos(juego.ambitos, (val) => {
        ambito = val;
        const n = Array.isArray(val) ? val.length : 1;
        jugar.disabled = !n;
        jugar.textContent = !n ? "Elige al menos un tema" : crono ? `⏱ ¡Empezar! (${texto(tiempo)})` : "¡Jugar! ▶";
      })
    : null;

  const opciones = h(
    "div.op-opciones",
    crono ? grupo("⏱ Tiempo", cajaTiempo) : null,
    grupo("◆ Nivel", cajaNivel, a.niveles ? h("small.op-nota", a.niveles) : null, reglasEl),
    // Cálculo mental sin reloj: cuántas operaciones (con contrarreloj, las que dé tiempo).
    juego.id === "calculo-mental" && !crono ? grupo("🧠 Operaciones", cajaOps) : null,
    temas ? grupo("📚 Temas", h("small.op-nota", "Marca uno o varios: la partida mezcla palabras de todos."), temas.el) : null
  );
  const pie = h("div.op-pie", h("button.boton.suave.op-volver", { type: "button", onclick: () => alVolver() }, "← Volver"), jugar);

  function empezar() {
    if (jugar.disabled) return;
    alJugar({ dificultad: nivel, duracion: crono ? tiempo : 0, ambito: temas ? temas.valor() : undefined, operaciones: juego.id === "calculo-mental" && !crono ? operaciones : undefined });
  }
  // En el ordenador: Enter empieza y Esc vuelve.
  const tecla = (ev) => {
    if (ev.target.closest?.("input, textarea")) return;
    if (ev.key === "Enter") (ev.preventDefault(), empezar());
    else if (ev.key === "Escape") (ev.preventDefault(), alVolver());
  };

  pintarNivel();
  pintarTiempo();
  pintarOps();
  pintarReglas();
  if (!temas) jugar.textContent = crono ? "⏱ ¡Empezar!" : "¡Jugar! ▶";
  else temas.valor() && (jugar.textContent = crono ? `⏱ ¡Empezar! (${texto(tiempo)})` : "¡Jugar! ▶");
  // El texto del botón con el tiempo elegido también cambia al elegir otro tiempo.
  if (crono) cajaTiempo.addEventListener("click", () => queueMicrotask(() => !jugar.disabled && (jugar.textContent = `⏱ ¡Empezar! (${texto(tiempo)})`)));
  if (crono && !temas) jugar.textContent = `⏱ ¡Empezar! (${texto(tiempo)})`;

  const el = h(`section.pantalla-opciones${crono ? ".en-crono" : ""}`, barra, h("div.op-cuerpo", info, h("div.op-lado", opciones, pie)));
  addEventListener("keydown", tecla);
  return {
    el,
    desmontar() {
      removeEventListener("keydown", tecla);
      v.pause();
    },
  };
}
