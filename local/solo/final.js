// Pantalla final del modo solo: casillas con los datos de la partida, distintas para cada juego.
import { h } from "../comun/ui.js";

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const reloj = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const media = (ms, n) => (n ? `${(ms / n / 1000).toFixed(1).replace(".", ",")} s` : "—");
const porcentaje = (a, b) => (b ? `${Math.round((a / b) * 100)} %` : "—");
const tonoPct = (a, b) => (!b ? undefined : a / b >= 0.5 ? "bien" : "mal");

/** Casillas de cada juego: [icono, etiqueta, valor, tono?]  (tono: "oro" | "bien" | "mal") */
const POR_JUEGO = {
  "palabra-larga": (j) => [
    ["🏅", "Mejor palabra", j.mejor ? j.mejor.forma.toUpperCase() : "—", "oro"],
    ["📏", "Letras", j.mejor?.largo ?? 0],
    ["✅", "Válidas", j.validas?.length ?? 0, "bien"],
    ["✍️", "Intentos", j.intentos ?? 0],
  ],
  definicion: (j) => [
    ["✅", "Aciertos", j.aciertos, "bien"],
    ["⭐", "Puntos", j.puntos, "oro"],
    ["💡", "Pistas", j.pistas],
  ],
  sopa: (j, ronda) => [
    ["🔍", "Encontradas", `${j.encontradas.length} / ${ronda.palabras.length}`, "oro"],
    ["⏳", "Faltaron", ronda.palabras.length - j.encontradas.length, j.encontradas.length === ronda.palabras.length ? "bien" : "mal"],
  ],
  revuelto: (j, ronda) => {
    const hechas = j.hechas ?? [];
    let completos = 0;
    for (let k = 0; k + 1 < hechas.length; k += 2) if (hechas[k].ok && hechas[k + 1].ok) completos++;
    return [
      ["🔤", "Palabras", `${j.aciertos} / ${ronda.revueltos.length * 2}`, "oro"],
      ["🧩", "Revueltos completos", completos, "bien"],
      ["⏭", "Pasados", Math.max(0, j.i - completos)],
      ...(j.ms != null ? [["⏱", "Tiempo", reloj(j.ms)]] : []),
    ];
  },
  paraulogico: (j) => [
    ["⭐", "Puntos", j.puntos, "oro"],
    ["🔤", "Palabras", j.encontradas.length, "bien"],
    ["📏", "La más larga", j.encontradas.reduce((m, w) => Math.max(m, String(w.forma ?? w.clave ?? w).length), 0) || "—"],
  ],
  crucigrama: (j, ronda) => {
    const n = Object.keys(j.resueltas ?? {}).length;
    return [
      ["✏️", "Palabras", `${n} / ${ronda.palabras.length}`, "oro"],
      ["⏳", "Faltaron", ronda.palabras.length - n, n === ronda.palabras.length ? "bien" : "mal"],
      ...(n === ronda.palabras.length && j.ultimo ? [["⏱", "Tiempo", reloj(j.ultimo)]] : []),
    ];
  },
  conexiones: (j, ronda) => [
    ["🔗", "Grupos", j.grupos, "oro"],
    ["❌", "Fallos", j.fallosTotal, j.fallosTotal ? "mal" : "bien"],
    ["🗂️", "Tableros", Math.min(ronda.tableros.length, j.t + (j.hallados.length || j.fallos ? 1 : 0))],
  ],
  semantica: (j) => {
    const intentos = j.intentos.filter((x) => !x.pista);
    const mejor = Math.min(...intentos.map((x) => x.puesto), Infinity);
    return [
      j.encontrada ? ["🎯", "Palabra secreta", "¡Encontrada!", "bien"] : ["🔥", "Lo más cerca", Number.isFinite(mejor) ? `#${mejor + 1}` : "—", "oro"],
      ["✍️", "Intentos", intentos.length],
      ["💡", "Pistas", j.pistas],
    ];
  },
  memoria: (j) => [
    ["✅", "Aciertos", j.aciertos, "oro"],
    ["🃏", "Pruebas", j.i],
    ["🎯", "Acierto", porcentaje(j.aciertos, j.i), tonoPct(j.aciertos, j.i)],
    ["⚡", "Respuesta media", media(j.ms, j.i)],
  ],
  "calculo-mental": (j, ronda) => {
    const r = j.respuestas.filter(Boolean);
    const ok = r.filter((x) => x.ok);
    return [
      ["✅", "Aciertos", `${ok.length} / ${ronda.cadenas.length}`, "oro"],
      ["❌", "Fallos", r.length - ok.length, r.length - ok.length ? "mal" : "bien"],
      ["⚡", "Respuesta media", media(ok.reduce((s, x) => s + x.ms, 0), ok.length)],
    ];
  },
  "llegar-resultado": (j, ronda) => [
    ["🎯", "Objetivo", ronda.objetivo, "oro"],
    ["🔢", "Tu número", j.mejor?.valor ?? "—"],
    ["📐", "Distancia", j.mejor ? (j.mejor.dist === 0 ? "¡Exacto!" : j.mejor.dist) : "—", j.mejor?.dist === 0 ? "bien" : undefined],
    ["🧮", "Operaciones", j.mejor?.pasos?.length ?? j.ops?.length ?? 0],
  ],
  "mates-fugaces": (j) => [
    ["✅", "Aciertos", j.aciertos, "oro"],
    ["❌", "Fallos", j.fallos, j.fallos ? "mal" : "bien"],
    ["🎯", "Acierto", porcentaje(j.aciertos, j.aciertos + j.fallos), tonoPct(j.aciertos, j.aciertos + j.fallos)],
  ],
  laberinto: (j) => [
    ["✅", "Cuentas bien", j.correctas, "oro"],
    ["🧩", "Casillas puestas", Object.keys(j.puestos ?? {}).length],
    ...(j.ms != null ? [["⏱", "Tiempo", reloj(j.ms), "bien"]] : []),
  ],
  kenken: (j, ronda) => [
    ["🔢", "Tablero", `${ronda.n} × ${ronda.n}`],
    ["✏️", "Casillas", `${j.valores.filter(Boolean).length} / ${ronda.n * ronda.n}`, "oro"],
    ...(j.ms != null ? [["⏱", "Tiempo", reloj(j.ms), "bien"]] : []),
  ],
};

/** Las casillas de datos de la partida (o null si el juego no tiene). */
export function casillasFinal(meta, ronda, j) {
  let filas = [];
  try {
    filas = POR_JUEGO[meta.id]?.(j, ronda) ?? [];
  } catch {
    filas = [];
  }
  return h(
    "div.final-datos",
    filas.map(([ico, etq, val, tono], k) =>
      h(`div.final-dato${tono ? `.${tono}` : ""}`, { style: { animationDelay: `${250 + k * 70}ms` } }, h("span.final-dato-ico", ico), h("b.final-dato-valor", String(val)), h("small", etq))
    )
  );
}

export { plural };
