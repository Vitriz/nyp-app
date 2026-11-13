// Crucigrama · TV: el tema, la rejilla vacía (con sus números) y cuántas palabras lleva cada uno.
import { h } from "../../comun/ui.js";
import { tarjetasJugadores } from "../comun/util.js";

function rejilla(d, conLetras = false) {
  const vivas = new Map();
  const numeros = new Map(d.palabras.map((p) => [`${p.r},${p.c}`, p.n]));
  for (const p of d.palabras) {
    const largo = p.largo ?? p.clave.length;
    for (let i = 0; i < largo; i++) vivas.set(`${p.r + (p.dir === "v" ? i : 0)},${p.c + (p.dir === "h" ? i : 0)}`, p.clave?.[i] ?? "");
  }
  const el = h("div.cg-rejilla.cg-tv", { style: { "--filas": d.filas, "--cols": d.cols } });
  for (let r = 0; r < d.filas; r++) {
    for (let c = 0; c < d.cols; c++) {
      const k = `${r},${c}`;
      el.append(
        vivas.has(k)
          ? h("div.cg-celda", numeros.has(k) ? h("span.cg-num", String(numeros.get(k))) : null, h("span.cg-letra", conLetras ? vivas.get(k).toUpperCase() : ""))
          : h("div.cg-celda.negra")
      );
    }
  }
  return el;
}

export function montar(cuerpo, e, ctx) {
  const d = e.datos;
  const lado = h("div.sopa-lado");
  cuerpo.append(h("div.sopa-tv.cg-escena", h("div.cg-tv-izq", h("div.etiqueta", `${d.ambito === "todos" ? "🌍 Todos los temas" : "📚 " + d.ambito} · ${d.total} palabras`), rejilla(d)), lado));
  const actualizar = tarjetasJugadores(lado, ctx, (e, id) => {
    const n = e.datos?.jugadores?.[id];
    if (n == null) return null;
    return { valor: n, extra: `de ${e.datos.total}` };
  });
  actualizar(e);
  return { actualizar };
}

/** Al acabar: el crucigrama resuelto y sus palabras. */
export function resumen(r) {
  return h(
    "div.pl-resumen.tarjeta.aparece.cg-resumen",
    { style: { animationDelay: "900ms" } },
    h("span.etiqueta", r.ambito === "todos" ? "🌍 Todos los temas" : `📚 ${r.ambito}`),
    rejilla(r, true),
    h("div.cg-soluciones", r.palabras.map((p) => h("span.pl-sol", `${p.n}${p.dir === "h" ? "→" : "↓"} ${p.forma.toUpperCase()}`)))
  );
}
