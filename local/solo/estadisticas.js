// Estadísticas (tus partidas de «Jugar solo») y Clasificación (los récords de todos, desde la nube).
// Las dos se filtran igual: tiempo y nivel (y, en la clasificación, el juego), con «Todos» para ver
// el total de todas las modalidades.
import { h, TIEMPOS } from "../comun/ui.js";
import { almacen } from "../comun/conexion.js";
import { ICONOS, textoRecord, textoSegundos } from "./selector.js";
import { leerJugadores, jugadoresGuardados } from "../comun/nube.js";
import { leerFamilia, idMovil } from "../comun/familia.js";

export const NIVELES = ["facil", "normal", "dificil"];
export const NOMBRES_NIVEL = { facil: "Fácil", normal: "Medio", dificil: "Difícil" };
const TODOS = "*";

const leerJSON = (k, def) => {
  try {
    return JSON.parse(almacen.leer(k) ?? "null") ?? def;
  } catch {
    return def;
  }
};

// ------------------------------------------------------------------ partidas jugadas (en el móvil)
// nyp-estadisticas: { "juego@segundos@nivel": { j: jugadas, g: ganadas } }
const ESTADISTICAS = "nyp-estadisticas";

/** Apunta una partida de «Jugar solo» (ganada o no). */
export function apuntarPartida(meta, ganada) {
  const e = leerJSON(ESTADISTICAS, {});
  const k = `${meta.id}@${meta.duracion ?? 0}@${meta.dificultad ?? "normal"}`;
  const x = (e[k] ??= { j: 0, g: 0 });
  x.j++;
  if (ganada) x.g++;
  almacen.guardar(ESTADISTICAS, JSON.stringify(e));
}

/** Clave de récord → { id, seg, nivel }. Las antiguas ("juego") son del tiempo normal del juego, nivel medio. */
function leerClave(k, juegos) {
  const [id, seg, nivel = "normal"] = k.split("@");
  if (seg == null) return { id, seg: juegos.find((j) => j.id === id)?.duracion ?? null, nivel: "normal" };
  return { id, seg: Number(seg), nivel };
}
const encaja = (x, seg, nv) => (seg === TODOS || x.seg === seg) && (nv === TODOS || x.nivel === nv);
const modalidad = (x) => `${textoSegundos(x.seg)} · ${NOMBRES_NIVEL[x.nivel] ?? x.nivel}`;

/** El mejor récord de una persona en un juego para los filtros (con su modalidad, por si es «Todos»). */
function mejorDe(records, juego, seg, nv, juegos) {
  let mejor = null;
  for (const [k, r] of Object.entries(records ?? {})) {
    if (!r || typeof r.valor !== "number") continue;
    const x = leerClave(k, juegos);
    if (x.id !== juego.id || !encaja(x, seg, nv)) continue;
    if (!mejor || r.valor > mejor.r.valor) mejor = { r, ...x };
  }
  return mejor;
}

// ------------------------------------------------------------------ filtros (iguales en las dos ventanas)
function filtros(estado, alCambiar, { conJuego = null } = {}) {
  const caja = h("div.records-filtros");
  const fila = (etq, valores, actual, texto, fijar, clase = "") =>
    h(
      `div.records-filtro${clase}`,
      h("span.etiqueta", etq),
      h(
        "div.records-opciones",
        valores.map((v) => h(`button.records-op${v === actual ? ".elegida" : ""}`, { type: "button", onclick: () => (fijar(v), alCambiar()) }, texto(v)))
      )
    );
  const tiempo = (v) => (v === TODOS ? "Todos" : !v ? "∞" : v < 60 || v % 60 ? `${v}s` : `${v / 60}m`);
  function pintar() {
    caja.replaceChildren(
      ...(conJuego
        ? [fila("Juego", [TODOS, ...conJuego.map((j) => j.id)], estado.juego, (v) => (v === TODOS ? "Todos" : ICONOS[v] ?? "🎲"), (v) => (estado.juego = v), ".juegos")]
        : []),
      fila("Tiempo", [TODOS, ...TIEMPOS], estado.seg, tiempo, (v) => (estado.seg = v)),
      fila("Nivel", [TODOS, ...NIVELES], estado.nv, (v) => (v === TODOS ? "Todos" : NOMBRES_NIVEL[v]), (v) => (estado.nv = v))
    );
    // El juego elegido, a la vista (la fila se desplaza de lado).
    caja.querySelector(".juegos .elegida")?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }
  return { el: caja, pintar };
}

function hoja(titulo, ...hijos) {
  const cerrar = () => capa.remove();
  const capa = h(
    "div.capa-movil.capa-records",
    { onclick: (ev) => ev.target === capa && cerrar() },
    h("div.caja.tarjeta", h("div.records-cabeza", h("h2", titulo), h("button.icono-btn.cerrar", { type: "button", onclick: cerrar, "aria-label": "Cerrar" }, "✕")), ...hijos)
  );
  document.body.append(capa);
  return capa;
}

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)} %` : "—");

// ------------------------------------------------------------------ estadísticas
/** Tus partidas: en total y en cada juego (jugadas, ganadas, perdidas y el récord) para los filtros. */
export function ventanaEstadisticas(juegos, { seg = TODOS, nv = TODOS } = {}) {
  const estado = { seg, nv };
  const records = leerJSON("nyp-records", {});
  const partidas = leerJSON(ESTADISTICAS, {});
  const lista = h("div.records-lista");
  const f = filtros(estado, pintar);

  function cuenta(id) {
    let j = 0, g = 0;
    for (const [k, x] of Object.entries(partidas)) {
      const c = leerClave(k, juegos);
      if ((id == null || c.id === id) && encaja(c, estado.seg, estado.nv)) (j += x.j), (g += x.g);
    }
    return { j, g, p: j - g };
  }

  function pintar() {
    f.pintar();
    const total = cuenta(null);
    const conRecord = juegos.filter((jg) => mejorDe(records, jg, estado.seg, estado.nv, juegos)).length;
    const dato = (etq, valor, clase = "") => h(`div.est-dato${clase}`, h("small", etq), h("b", String(valor)));
    const filas = juegos
      .map((jg) => ({ jg, c: cuenta(jg.id), m: mejorDe(records, jg, estado.seg, estado.nv, juegos) }))
      .sort((a, b) => b.c.j - a.c.j || (b.m ? 1 : 0) - (a.m ? 1 : 0));
    lista.replaceChildren(
      h(
        "div.est-resumen",
        dato("Partidas", total.j),
        dato("Ganadas", total.g, ".bien"),
        dato("Perdidas", total.p, ".mal"),
        dato("Récords", `${conRecord}/${juegos.length}`, ".oro")
      ),
      ...(total.j ? [h("div.est-barra", { title: `${pct(total.g, total.j)} ganadas` }, h("i", { style: { width: pct(total.g, total.j).replace(" ", "") } }))] : []),
      ...filas.map(({ jg, c, m }, i) =>
        h(
          `div.est-fila${c.j || m ? "" : ".sin"}`,
          { style: { animationDelay: `${40 + i * 25}ms` } },
          h("span.ico", ICONOS[jg.id] ?? "🎲"),
          h("b.est-nombre", jg.nombre),
          h(
            "div.est-cifras",
            h("span", h("small", "Jugadas"), h("b", String(c.j))),
            h("span.bien", h("small", "Ganadas"), h("b", String(c.g))),
            h("span.mal", h("small", "Perdidas"), h("b", String(c.p)))
          ),
          h(
            "div.est-record",
            h("small", "🏆 Récord"),
            h("b", m ? textoRecord(m.r) : "—"),
            m && (estado.seg === TODOS || estado.nv === TODOS) ? h("span", modalidad(m)) : null
          )
        )
      )
    );
  }
  pintar();
  hoja("📊 Estadísticas", f.el, lista);
}

// ------------------------------------------------------------------ clasificación
/** Los récords de toda la familia (de la nube): por juego, tiempo y nivel, o el total de todo. */
export function ventanaClasificacion(juegos, perfil, { seg = TODOS, nv = TODOS, juego = TODOS } = {}) {
  const estado = { seg, nv, juego };
  const lista = h("div.records-lista");
  const nota = h("p.familia-nota");
  const f = filtros(estado, pintar, { conJuego: juegos });

  function gente() {
    const nube = jugadoresGuardados();
    const yoId = idMovil();
    const g = nube?.lista?.length ? Object.fromEntries(nube.lista.map((p) => [p.id, p])) : leerFamilia(perfil).jugadores;
    g[yoId] = { ...(g[yoId] ?? {}), nombre: perfil.nombre, color: perfil.color, records: leerJSON("nyp-records", {}) };
    const fecha = nube?.fecha ? new Date(nube.fecha) : null;
    nota.textContent = fecha
      ? `☁️ Actualizada ${fecha.toLocaleDateString("es-ES")} ${fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
      : "☁️ Conéctate a internet para ver los récords de todos.";
    return { g, yoId };
  }

  function ranking(jg, { g, yoId }) {
    return Object.entries(g)
      .map(([pid, p]) => ({ p, m: mejorDe(p.records, jg, estado.seg, estado.nv, juegos), yo: pid === yoId }))
      .filter((x) => x.m)
      .sort((a, b) => b.m.r.valor - a.m.r.valor);
  }

  function podio(filas, max) {
    const todos = estado.seg === TODOS || estado.nv === TODOS;
    return h(
      "ol.familia-podio",
      filas.slice(0, max).map((x, k, arr) => {
        const puesto = filas.findIndex((y) => y.m.r.valor === x.m.r.valor);
        return h(
          `li${x.yo ? ".yo" : ""}`,
          h("span.medalla", ["🥇", "🥈", "🥉"][puesto] ?? `${puesto + 1}º`),
          h("span.familia-nombre", { style: { "--c": x.p.color ?? "#5fb7d0" } }, x.p.nombre ?? "—", todos ? h("small.familia-modo", modalidad(x.m)) : null),
          h("span.familia-marca", textoRecord(x.m.r))
        );
      })
    );
  }

  function pintar() {
    f.pintar();
    const datos = gente();
    const elegidos = estado.juego === TODOS ? juegos : juegos.filter((j) => j.id === estado.juego);
    const bloques = [];
    for (const jg of elegidos) {
      const filas = ranking(jg, datos);
      if (!filas.length && estado.juego === TODOS) continue;
      bloques.push(
        h(
          "div.familia-juego",
          { style: { animationDelay: `${40 + bloques.length * 40}ms` } },
          h("div.familia-titulo", h("span.ico", ICONOS[jg.id] ?? "🎲"), h("b", jg.nombre)),
          filas.length ? podio(filas, estado.juego === TODOS ? 5 : 50) : h("p.suave", "Nadie tiene récord todavía con estos filtros.")
        )
      );
    }
    lista.replaceChildren(nota, ...(bloques.length ? bloques : [h("p.suave", "Nadie tiene récord todavía con estos filtros.")]));
  }
  pintar();
  const capa = hoja("🏆 Clasificación", f.el, lista);
  // Se descarga la clasificación actual de la nube y se repinta.
  leerJugadores()
    .then(() => capa.isConnected && pintar())
    .catch(() => {});
}
