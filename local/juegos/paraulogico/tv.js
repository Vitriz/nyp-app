// Tutifruti (antes Paraulógico) · TV: el panal en grande y la puntuación de cada jugador.
import { h } from "../../comun/ui.js";
import { tarjetasJugadores } from "../comun/util.js";
import { crearPanal } from "./panal.js";

export function montar(cuerpo, e, ctx) {
  const panal = crearPanal(e.datos.centro, e.datos.letras);
  const lado = h("div.sopa-lado");
  cuerpo.append(h("div.sopa-tv", h("div.pg-tv-panal", panal.el), lado));
  const actualizar = tarjetasJugadores(lado, ctx, (e, id) => {
    const j = e.datos?.jugadores?.[id];
    return j && { valor: j.puntos, extra: `${j.n} pal.` };
  });
  actualizar(e);
  return { actualizar };
}

export function resumen(r) {
  const panal = crearPanal(r.centro, r.letras);
  return h(
    "div.pl-resumen.tarjeta.aparece.sopa-resumen",
    { style: { animationDelay: "900ms" } },
    h("div.pg-mini", panal.el),
    h(
      "div.columna",
      h("span.etiqueta", `Había ${r.total} palabras comunes`),
      r.tutis.length ? h("div.pl-soluciones", h("span.suave", "Con las 7:"), r.tutis.map((t) => h("span.pl-sol", t.toUpperCase()))) : null,
      h("div.pl-soluciones", h("span.suave", "Largas:"), r.largas.map((t) => h("span.pl-sol", t.toUpperCase())))
    )
  );
}

// ------------------------------------------------------------------ repaso animado (al acabar)
/**
 * El panal en grande y, encima, una barra donde se escriben solas las palabras que encontrasteis: cada letra se
 * ilumina en el panal al escribirse. Al acabar una palabra, sus puntos vuelan a las casillas de quienes la
 * encontraron. Orden: los tutis (con fiesta), las que encontrasteis todos y luego las demás, de las más cortas a
 * las más largas y, en cada largo, primero las del primer jugador, luego las del segundo…
 */
export async function repaso({ escena, resumen, jugadores, sumar, esperar, parado, celebrar }) {
  if (!resumen?.jugadores) return;
  const panal = crearPanal(resumen.centro, resumen.letras);
  const barra = h("div.rep-barra");
  const aviso = h("div.rep-aviso");
  escena.replaceChildren(h("div.rep-pg", aviso, barra, h("div.rep-panal", panal.el)));
  const hex = (l) => panal.el.querySelector(`.hex[data-l="${l}"]`);

  // Cada palabra, con quién la encontró (en el orden de la sala).
  const ids = jugadores.map((j) => j.id).filter((id) => resumen.jugadores[id]);
  const palabras = new Map();
  for (const id of ids)
    for (const p of resumen.jugadores[id]) {
      const x = palabras.get(p.c) ?? { ...p, quienes: [] };
      x.quienes.push(id);
      palabras.set(p.c, x);
    }
  const todas = [...palabras.values()];
  const tutis = todas.filter((p) => p.t);
  const deTodos = ids.length > 1 ? todas.filter((p) => !p.t && p.quienes.length === ids.length).sort((a, b) => a.c.length - b.c.length) : [];
  const vistas = new Set([...tutis, ...deTodos].map((p) => p.c));
  const resto = [];
  const largos = [...new Set(todas.map((p) => p.c.length))].sort((a, b) => a - b);
  for (const n of largos)
    for (const id of ids)
      for (const p of resumen.jugadores[id]) {
        if (p.c.length !== n || vistas.has(p.c)) continue;
        vistas.add(p.c);
        resto.push(palabras.get(p.c));
      }
  const orden = [...tutis.map((p) => ({ p, fase: "tuti" })), ...deTodos.map((p) => ({ p, fase: "todos" })), ...resto.map((p) => ({ p, fase: "resto" }))];
  if (!orden.length) {
    aviso.textContent = "Nadie encontró ninguna palabra";
    return esperar(1500);
  }
  // Cuanto más palabras, más deprisa (que el repaso no dure más de un minuto).
  const porPalabra = Math.max(450, Math.min(1500, 55000 / orden.length));
  let faseVista = null;
  for (const { p, fase } of orden) {
    if (parado()) return;
    if (fase !== faseVista) {
      faseVista = fase;
      aviso.textContent = fase === "tuti" ? "🌈 ¡Los tutis!" : fase === "todos" ? "🤝 Las que encontrasteis todos" : "✍️ Y las de cada uno";
      aviso.classList.remove("aparece");
      void aviso.offsetWidth;
      aviso.classList.add("aparece");
      await esperar(fase === "tuti" ? 900 : 600);
    }
    // Se escribe letra a letra, iluminando su casilla del panal.
    barra.replaceChildren();
    barra.className = `rep-barra${p.t ? " tuti" : ""}`;
    const porLetra = Math.max(60, (porPalabra * 0.6) / p.c.length);
    for (const l of p.c) {
      if (parado()) return;
      const x = hex(l);
      x?.classList.add("ilumina");
      barra.append(h("span.rep-letra", l.toUpperCase()));
      await esperar(porLetra);
      x?.classList.remove("ilumina");
    }
    // La palabra como se escribe de verdad (con tildes) y sus puntos, que vuelan a quien la encontró.
    barra.replaceChildren(h("span.rep-palabra", p.f.toUpperCase()), h("span.rep-pts", `+${p.p}`));
    if (p.t) {
      celebrar(80);
      barra.classList.add("fiesta");
      await esperar(700);
    }
    await sumar(p.quienes, p.p, barra.querySelector(".rep-pts"), { clase: p.t ? ".tuti" : "" });
    await esperar(porPalabra * 0.15);
  }
  barra.replaceChildren();
}

// ------------------------------------------------------------------ estadísticas (después del repaso)
/** Todas las palabras de cada jugador, en columnas (una por jugador) y agrupadas por largo. */
export function estadisticas(e) {
  const r = e.resumen;
  if (!r?.jugadores) return null;
  const orden = [...(e.resultados ?? [])].sort((a, b) => (a.puesto ?? 99) - (b.puesto ?? 99));
  return h(
    "div.pg-stats",
    orden.map((res) => {
      const lista = r.jugadores[res.id] ?? [];
      const largos = [...new Set(lista.map((p) => p.c.length))].sort((a, b) => b - a);
      return h(
        "div.pg-stats-col.tarjeta",
        { style: { "--c": res.color } },
        h("div.pg-stats-cab", h("span.pg-stats-puesto", res.puesto ? `${res.puesto}º` : "—"), h("b", res.nombre), h("span.pg-stats-pts", `${lista.reduce((s, p) => s + p.p, 0)} pts`)),
        lista.length
          ? largos.map((n) =>
              h(
                "div.pg-stats-grupo",
                h("small", `${n} letras`),
                h("div.pg-stats-chips", lista.filter((p) => p.c.length === n).map((p) => h(`span.pg-chip${p.t ? ".tuti" : ".bien"}`, p.f.toUpperCase())))
              )
            )
          : h("p.suave", "Ninguna palabra")
      );
    })
  );
}
