// Pantalla final del modo solo: casillas con los datos de la partida, distintas para cada juego.
import { h } from "../comun/ui.js";
import { crearRejilla } from "../juegos/kenken/rejilla.js";
import { rangoDe } from "../juegos/paraulogico/movil.js";
import { crearRejilla as rejillaLaberinto } from "../juegos/laberinto/rejilla.js";
import { crearTablero as tableroHilo } from "../juegos/hilo/rejilla.js";
import { crearTablero as tableroCoronas } from "../juegos/coronas/rejilla.js";
import { crearTablero as tableroParcelas } from "../juegos/parcelas/rejilla.js";
import { crearTablero as tableroCulebras, COLORES as COLORES_CULEBRAS } from "../juegos/culebras/rejilla.js";
import { crearTablero as tableroSopa, COLORES_SOPA } from "../juegos/sopa/tablero.js";

/** KenKen: ¿cada casilla tiene el número de la solución? (si lo resolvió, todo vale) */
const kkBien = (j, ronda) => ronda.solucion.map((v, k) => j.ms != null || j.valores[k] === v);
function kkJaulasBien(j, ronda) {
  const v = j.valores;
  return ronda.jaulas.filter((jj) => {
    const x = jj.celdas.map((k) => v[k]);
    if (x.some((y) => !y)) return false;
    if (!jj.op) return x[0] === jj.objetivo;
    if (jj.op === "+") return x.reduce((a, b) => a + b, 0) === jj.objetivo;
    if (jj.op === "×") return x.reduce((a, b) => a * b, 1) === jj.objetivo;
    const [a, b] = [Math.max(...x), Math.min(...x)];
    return jj.op === "−" ? a - b === jj.objetivo : a / b === jj.objetivo;
  }).length;
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
// Con décimas, como el récord (42,8 s; 1:05,3).
const reloj = (ms) => {
  const d = Math.max(0, Math.round(ms / 100)); // décimas
  const s = Math.floor(d / 10), dec = d % 10;
  return s < 60 ? `${s},${dec} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")},${dec}`;
};
const media = (ms, n) => (n ? `${(ms / n / 1000).toFixed(1).replace(".", ",")} s` : "—");
const porcentaje = (a, b) => (b ? `${Math.round((a / b) * 100)} %` : "—");
const tonoPct = (a, b) => (!b ? undefined : a / b >= 0.5 ? "bien" : "mal");

/** Casillas de cada juego: [icono, etiqueta, valor, tono?]  (tono: "oro" | "bien" | "mal") */
const POR_JUEGO = {
  "palabra-larga": (j) => [
    ["🏅", "Mejor", j.mejor ? j.mejor.forma.toUpperCase() : "—", "oro"],
    ["📏", "Letras", j.mejor?.largo ?? 0],
    ["✅", "Válidas", j.validas?.length ?? 0, "bien"],
    ["✍️", "Intentos", j.intentos ?? 0],
  ],
  definicion: (j) => [
    ["✅", "Aciertos", j.aciertos, "bien"],
    ["⭐", "Puntos", j.puntos, "oro"],
    ["💡", "Pistas", j.pistas],
    ...(j.fallos ? [["❌", "Fallos", j.fallos, "mal"]] : []),
  ],
  sopa: (j, ronda) => [
    ["🔍", "Encontradas", `${j.encontradas.length} / ${ronda.palabras.length}`, "oro"],
    ["⏳", "Faltaron", ronda.palabras.length - j.encontradas.length, j.encontradas.length === ronda.palabras.length ? "bien" : "mal"],
    ...(j.fallos ? [["❌", "Fallos", j.fallos, "mal"]] : []),
    ...(j.pistas?.length ? [["💡", "Pistas", j.pistas.length]] : []),
  ],
  revuelto: (j, ronda) => {
    const hechas = j.hechas ?? [];
    let completos = 0;
    for (let k = 0; k + 1 < hechas.length; k += 2) if (hechas[k].ok && hechas[k + 1].ok) completos++;
    return [
      ["🔤", "Palabras", `${j.aciertos} / ${ronda.revueltos.length * 2}`, "oro"],
      ["🧩", "Completos", completos, "bien"],
      ["⏭", "Pasados", Math.max(0, j.i - completos)],
      ...(j.ms != null ? [["⏱", "Tiempo", reloj(j.ms)]] : []),
    ];
  },
  paraulogico: (j) => [
    ["⭐", "Puntos", j.puntos, "oro"],
    ["🔤", "Palabras", j.encontradas.length, "bien"],
    ["📏", "Larga", j.encontradas.reduce((m, w) => Math.max(m, String(w.forma ?? w.clave ?? w).length), 0) || "—"],
  ],
  crucigrama: (j, ronda) => {
    const n = Object.keys(j.resueltas ?? {}).length;
    return [
      ["✏️", "Palabras", `${n} / ${ronda.palabras.length}`, "oro"],
      ["⏳", "Faltaron", ronda.palabras.length - n, n === ronda.palabras.length ? "bien" : "mal"],
      ...(j.fallos ? [["❌", "Fallos", j.fallos, "mal"]] : []),
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
      j.encontrada ? ["🎯", "Secreta", "¡Encontrada!", "bien"] : ["🔥", "Cerca", Number.isFinite(mejor) ? `#${mejor + 1}` : "—", "oro"],
      ["✍️", "Intentos", intentos.length],
      ["💡", "Pistas", j.pistas],
    ];
  },
  memoria: (j) => [
    ["✅", "Aciertos", j.aciertos, "oro"],
    ["🃏", "Pruebas", j.i],
    ["🎯", "Acierto", porcentaje(j.aciertos, j.i), tonoPct(j.aciertos, j.i)],
    ["⚡", "Media", media(j.ms, j.i)],
  ],
  "calculo-mental": (j, ronda) => {
    const r = j.respuestas.filter(Boolean);
    const ok = r.filter((x) => x.ok);
    return [
      ["✅", "Aciertos", `${ok.length} / ${ronda.cadenas.length}`, "oro"],
      ["❌", "Fallos", r.length - ok.length, r.length - ok.length ? "mal" : "bien"],
      ["⚡", "Media", media(ok.reduce((s, x) => s + x.ms, 0), ok.length)],
    ];
  },
  "llegar-resultado": (j, ronda) => [
    ["🎯", "Objetivo", ronda.objetivo, "oro"],
    ["🔢", "Tuyo", j.mejor?.valor ?? "—"],
    ["📐", "Distancia", j.mejor ? (j.mejor.dist === 0 ? "¡Exacto!" : j.mejor.dist) : "—", j.mejor?.dist === 0 ? "bien" : undefined],
    ["🧮", "Operaciones", j.mejor?.pasos?.length ?? j.ops?.length ?? 0],
  ],
  "mates-fugaces": (j) => [
    ["✅", "Aciertos", j.aciertos, "oro"],
    ["❌", "Fallos", j.fallos, j.fallos ? "mal" : "bien"],
    ["🎯", "Acierto", porcentaje(j.aciertos, j.aciertos + j.fallos), tonoPct(j.aciertos, j.aciertos + j.fallos)],
  ],
  laberinto: (j) => [
    ["✅", "Cuentas", j.correctas, "oro"],
    ["🧩", "Puestas", Object.keys(j.puestos ?? {}).length],
    ...(j.ms != null ? [["⏱", "Tiempo", reloj(j.ms), "bien"]] : []),
  ],
  kenken: (j, ronda) => {
    const bien = kkBien(j, ronda).filter(Boolean).length;
    return [
      ["✅", "Casillas", `${bien} / ${ronda.n * ronda.n}`, "oro"],
      ["🧮", "Zonas", `${kkJaulasBien(j, ronda)} / ${ronda.jaulas.length}`],
      ...(j.ms != null ? [["⏱", "Tiempo", reloj(j.ms), "bien"]] : []),
    ];
  },
  hilo: (j, ronda) => [
    ["🔢", "Números", `${Math.max(1, numerosPasados(j.camino, ronda))} / ${ronda.ultimo}`, "oro"],
    ["🧵", "Casillas", `${j.camino.length} / ${ronda.n * ronda.n}`],
    ...(j.ms != null ? [["⏱", "Tiempo", reloj(j.ms), "bien"]] : []),
  ],
  coronas: (j, ronda) => {
    const sol = new Set(ronda.solucion);
    const puestas = j.marcas.filter((x) => x === 2).length;
    return [
      ["👑", "Coronas", `${j.marcas.filter((x, k) => x === 2 && sol.has(k)).length} / ${ronda.n}`, "oro"],
      ["✕", "Marcas", j.marcas.filter((x) => x === 1).length],
      ...(j.ms != null ? [["⏱", "Tiempo", reloj(j.ms), "bien"]] : [["📍", "Puestas", puestas]]),
    ];
  },
  parcelas: (j, ronda) => {
    const t = tableroParcelas(ronda);
    const bien = j.rects.filter((x) => t.valida(x) >= 0).length;
    return [
      ["📐", "Parcelas", `${bien} / ${ronda.pistas.length}`, "oro"],
      ["✏️", "Dibujados", j.rects.length],
      ...(j.ms != null ? [["⏱", "Tiempo", reloj(j.ms), "bien"]] : []),
    ];
  },
  culebras: (j, ronda) => [
    ["🐍", "Palabras", `${j.encontradas.length} / ${ronda.palabras.length}`, "oro"],
    ["✍️", "Intentos", j.intentos],
    ...(j.ms != null ? [["⏱", "Tiempo", reloj(j.ms), "bien"]] : [["⏳", "Faltaron", ronda.palabras.length - j.encontradas.length, "mal"]]),
  ],
};

const numerosPasados = (camino, ronda) => {
  const nums = new Map(ronda.numeros);
  return camino.filter((k) => nums.has(k)).length;
};

/** Puzles nuevos: la solución al final (si lo resolviste, así quedó). */
function finalPuzle(meta, ronda, j) {
  const resuelto = j.ms != null;
  let t = null, pie = null;
  if (meta.id === "hilo") {
    t = tableroHilo(ronda);
    t.pintar(ronda.solucion, { completo: true });
  } else if (meta.id === "coronas") {
    t = tableroCoronas(ronda);
    t.pintar(Array.from({ length: ronda.n * ronda.n }, (_, k) => (ronda.solucion.includes(k) ? 2 : 0)));
  } else if (meta.id === "parcelas") {
    t = tableroParcelas(ronda);
    t.pintar(ronda.solucion);
  } else if (meta.id === "culebras") {
    t = tableroCulebras(ronda);
    t.pintar(ronda.palabras.map((p, i) => ({ celdas: p.celdas, color: COLORES_CULEBRAS[i % COLORES_CULEBRAS.length] })));
    const tuyas = new Set(j.encontradas);
    pie = h("div.final-chips", ronda.palabras.map((p, i) => h(`span.pg-chip${tuyas.has(i) ? ".bien" : ".falta"}`, (p.forma ?? p.clave).toUpperCase())));
  } else return null;
  // Sin recuadro y lo más grande posible; si no lo resolviste, se avisa de que es la solución.
  return h("div.final-puzle", resuelto ? null : h("small.final-seccion", "La solución"), t.el, pie);
}

/** Las casillas de datos de la partida (o null si el juego no tiene). */
export function casillasFinal(meta, ronda, j) {
  let filas = [];
  try {
    filas = POR_JUEGO[meta.id]?.(j, ronda) ?? [];
  } catch {
    filas = [];
  }
  // Con 3 casillas o más, todas en una sola fila (--n columnas).
  return h(
    `div.final-datos${filas.length >= 3 ? ".en-fila" : ""}`,
    { style: { "--n": filas.length } },
    filas.map(([ico, etq, val, tono], k) =>
      h(
        `div.final-dato${tono ? `.${tono}` : ""}`,
        { style: { animationDelay: `${250 + k * 70}ms` } },
        // El título arriba (destacado) y debajo el dato con su icono.
        h("small.final-dato-etq", etq),
        h("div.final-dato-cuerpo", h("span.final-dato-ico", ico), h("b.final-dato-valor", String(val)))
      )
    )
  );
}

/** Algo más que enseñar al final (de momento, la solución del KenKen marcando lo que tenías bien). */
export function extraFinal(meta, ronda, j) {
  if (meta.id === "paraulogico") return finalTutifruti(ronda, j);
  if (meta.id === "mates-fugaces") return finalMates(ronda, j);
  if (meta.id === "laberinto") return finalLaberinto(ronda, j);
  if (meta.id === "sopa") return finalSopa(ronda, j);
  if (meta.id === "crucigrama") return finalCrucigrama(ronda, j);
  if (["hilo", "coronas", "parcelas", "culebras"].includes(meta.id)) return finalPuzle(meta, ronda, j);
  if (meta.id !== "kenken" || !ronda?.solucion) return null;
  const rejilla = crearRejilla(ronda);
  rejilla.poner(ronda.solucion);
  const bien = kkBien(j, ronda);
  rejilla.celdas.forEach((c, k) => {
    c.disabled = true;
    if (!j.valores[k]) return; // vacía: se ve la solución, sin marcar
    c.classList.add(bien[k] ? "sol-bien" : "sol-mal");
    if (!bien[k]) c.append(h("span.kk-tuyo", String(j.valores[k])));
  });
  return h(
    "div.final-kk.tarjeta",
    h("small", j.ms != null ? "¡Resuelto! Así quedó el tablero" : "La solución"),
    rejilla.el,
    h("div.kk-leyenda", h("span", h("i", { style: { background: "#9be0bd" } }), "Lo tenías bien"), h("span", h("i", { style: { background: "#f6b1a8" } }), "Lo tenías mal (tachado, tu número)"))
  );
}

/** Laberinto: la solución completa; lo que pusiste bien en verde y lo que no, en rojo (tachado, tu número). */
function finalLaberinto(ronda, j) {
  if (!ronda?.valores) return null;
  const r = rejillaLaberinto({ filas: ronda.filas, cols: ronda.cols, rejilla: ronda.rejilla, ecs: ronda.ecs.map((e) => e.celdas) }, { conHuecos: false });
  const huecos = new Set(ronda.huecos);
  const nodos = [...r.el.children].filter((n) => !n.classList.contains("lab-camino"));
  for (const x of ronda.rejilla) {
    if (!huecos.has(x.k)) continue;
    const n = nodos.find((el) => el.style.gridRow === String(x.r + 1) && el.style.gridColumn === String(x.c + 1));
    if (!n) continue;
    const sol = ronda.valores[x.k];
    const tuyo = j.puestos?.[x.k];
    n.textContent = String(sol);
    n.classList.add("lleno", "era-hueco", tuyo == null ? "sol-vacia" : Number(tuyo) === Number(sol) ? "sol-bien" : "sol-mal");
    if (tuyo != null && Number(tuyo) !== Number(sol)) n.append(h("span.lab-tuyo", String(tuyo)));
  }
  return h(
    "div.final-kk.final-lab.tarjeta",
    h("small", j.ms != null ? "¡Completo! Así quedó" : "La solución"),
    r.el,
    h("div.kk-leyenda", h("span", h("i", { style: { background: "#9be0bd" } }), "Lo tenías bien"), h("span", h("i", { style: { background: "#f6b1a8" } }), "Lo tenías mal (tachado, tu número)"))
  );
}

/** Sopa: el tablero con dónde estaba cada palabra (las tuyas, con su color; las que faltaron, en discontinua). */
function finalSopa(ronda, j) {
  if (!ronda?.tablero) return null;
  const t = tableroSopa(ronda.tablero);
  const tuyas = new Set((j.encontradas ?? []).map((e) => e.k));
  ronda.palabras.forEach((p, k) => t.marcar(p.r0, p.c0, p.r1, p.c1, tuyas.has(k) ? COLORES_SOPA[k % COLORES_SOPA.length] : "#ffffff", { falta: !tuyas.has(k) }));
  const chips = ronda.palabras.map((p, k) =>
    h(`span.sopa-chip${tuyas.has(k) ? ".hecha" : ".falta"}`, { style: { "--c": COLORES_SOPA[k % COLORES_SOPA.length] } }, p.forma.toUpperCase())
  );
  const todas = tuyas.size === ronda.palabras.length;
  return h(
    "div.final-puzle.final-sopa",
    h("small.final-seccion", todas ? "¡Todas! Así quedó la sopa" : "Dónde estaba cada palabra"),
    h("div.final-sopa-tablero", t.el),
    h("div.final-chips.sopa-lista", chips),
    todas ? null : h("div.kk-leyenda", h("span", "Con color: las encontraste"), h("span", "Blanca y discontinua: faltó"))
  );
}

/** Crucigrama: resuelto entero; tus palabras en verde y las que faltaron, en rojo (con sus letras). */
function finalCrucigrama(ronda, j) {
  if (!ronda?.palabras?.length) return null;
  const estado = new Map(); // casilla → "bien" si alguna palabra tuya pasa por ella
  const letra = new Map();
  const numeros = new Map(ronda.palabras.map((p) => [`${p.r},${p.c}`, p.n]));
  ronda.palabras.forEach((p, k) => {
    for (let i = 0; i < p.clave.length; i++) {
      const c = `${p.r + (p.dir === "v" ? i : 0)},${p.c + (p.dir === "h" ? i : 0)}`;
      letra.set(c, p.clave[i]);
      if (j.resueltas?.[k]) estado.set(c, "bien");
      else if (!estado.has(c)) estado.set(c, "falta");
    }
  });
  const el = h("div.cg-rejilla.cg-final", { style: { "--filas": ronda.filas, "--cols": ronda.cols } });
  for (let r = 0; r < ronda.filas; r++)
    for (let c = 0; c < ronda.cols; c++) {
      const k = `${r},${c}`;
      el.append(
        letra.has(k)
          ? h(`div.cg-celda.${estado.get(k) === "bien" ? "sol-bien" : "sol-falta"}`, numeros.has(k) ? h("span.cg-num", String(numeros.get(k))) : null, h("span.cg-letra", letra.get(k).toUpperCase()))
          : h("div.cg-celda.negra")
      );
    }
  const n = Object.keys(j.resueltas ?? {}).length;
  return h(
    "div.final-puzle.final-cg",
    h("small.final-seccion", n === ronda.palabras.length ? "¡Completo! Así quedó" : "La solución"),
    el,
    n === ronda.palabras.length ? null : h("div.kk-leyenda", h("span", h("i", { style: { background: "#9be0bd" } }), "Lo resolviste"), h("span", h("i", { style: { background: "#f6b1a8" } }), "Faltó"))
  );
}

/**
 * Mates fugaces: cada operación en su ficha grande, en orden. Verde: a la primera; dorada: acertada tras fallar;
 * discontinua: pasada; roja: la que estabas haciendo al acabar (la que te hizo perder o la que no terminaste).
 */
function finalMates(ronda, j) {
  if (!ronda?.ops || !j) return null;
  const fichas = (j.hist ?? []).map((x) => {
    const op = ronda.ops[x.i];
    const clase = x.pasada ? "pasada" : x.f ? "tras-fallo" : "bien";
    const ico = x.pasada ? "⏭" : x.f ? "!" : "✔";
    const nota = x.pasada ? "Pasada" : x.f ? `Tras ${x.f} ${x.f === 1 ? "fallo" : "fallos"}` : null;
    return h(`div.op-ficha.${clase}`, h("span.op-ficha-ico", ico), h("span.op-ficha-txt", `${op.texto} = ${op.r}`, nota ? h("small", nota) : null));
  });
  // La que quedó a medias: si fallaste en ella, en rojo (y así se ve cuál era la respuesta).
  const actual = ronda.ops[j.i];
  if (actual && (fichas.length || j.fallosOp)) {
    const fallada = (j.fallosOp ?? 0) > 0;
    fichas.push(
      h(
        `div.op-ficha.${fallada ? "fallada" : "pasada"}`,
        h("span.op-ficha-ico", fallada ? "✘" : "…"),
        h("span.op-ficha-txt", `${actual.texto} = ${actual.r}`, h("small", fallada ? `La fallaste${j.fallosOp > 1 ? ` ${j.fallosOp} veces` : ""}` : "Sin terminar"))
      )
    );
  }
  if (!fichas.length) return null;
  const leyenda = (color, txt) => h("span", h("i", { style: { background: color } }), txt);
  return h(
    "div.final-ops",
    h("small.final-seccion", `Tus operaciones (${fichas.length})`),
    h("div.final-ops-lista", fichas),
    h("div.final-ops-leyenda", leyenda("#6cc49a", "A la primera"), leyenda("#f0c64a", "Tras fallar"), leyenda("#8fa3cf", "Pasada"), leyenda("#ff7a6e", "Fallada"))
  );
}

/** Tutifruti: rango alcanzado, las palabras acertadas y las comunes que faltaron. */
function finalTutifruti(ronda, j) {
  if (!ronda?.comunes) return null;
  const tuyas = new Set(j.encontradas.map((e) => e.clave));
  const r = rangoDe(j.puntos, ronda.maximo);
  const faltan = ronda.comunes.filter((c) => !tuyas.has(c)).sort((a, b) => b.length - a.length || a.localeCompare(b, "es"));
  const chip = (c, k) => h(`span.pg-chip${k}`, c.toUpperCase());
  const esTuti = (c) => new Set(c).size === 7;
  return h(
    "div.final-palabras.tarjeta",
    h("div.final-rango", h("span.pg-rango-actual", `${r.actual[1]} ${r.actual[2]}`), h("small", `${j.puntos} de ${ronda.maximo} puntos posibles`)),
    h("small", `✔ Acertadas (${j.encontradas.length})`),
    h("div.final-chips", j.encontradas.map((e) => chip(e.forma, e.tuti ? ".tuti" : ".bien"))),
    h("small", `Te faltaron (${faltan.length})`),
    // Agrupadas por largo (de las más largas a las más cortas): se repasan mucho mejor que en un montón.
    h(
      "div.final-faltan",
      [...new Set(faltan.map((c) => c.length))].map((n) =>
        h(
          "div.grupo-largo",
          h("div.grupo-largo-n", h("b", String(n)), h("small", "letras")),
          h("div.final-chips.faltan", faltan.filter((c) => c.length === n).map((c) => chip(c, esTuti(c) ? ".tuti.falta" : ".falta")))
        )
      )
    )
  );
}

/**
 * ¿Partida ganada? (para las estadísticas) En los puzles y juegos con meta, haberla completado; en los
 * de puntuación, haber hecho algo que cuente.
 */
const COMPLETAR = new Set(["sopa", "revuelto", "kenken", "laberinto", "hilo", "coronas", "parcelas", "culebras"]);
export function ganoPartida(meta, r, ronda, j) {
  try {
    if (COMPLETAR.has(meta.id)) return j?.ms != null;
    if (meta.id === "crucigrama") return Object.keys(j?.resueltas ?? {}).length === ronda.palabras.length;
    if (meta.id === "semantica") return Boolean(j?.encontrada);
    if (meta.id === "llegar-resultado") return j?.mejor?.dist === 0;
    if (meta.id === "conexiones") return (j?.fallosTotal ?? 0) < 4 && (j?.grupos ?? 0) > 0;
  } catch {}
  return r?.valor != null && r.valor > 0;
}

export { plural };
