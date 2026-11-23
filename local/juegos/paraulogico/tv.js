// Tutifruti (antes Paraulógico) · TV: el panal en grande y la puntuación de cada jugador.
import { h, avatar } from "../../comun/ui.js";
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
 * El panal en grande y, encima, una barra donde se escriben solos los tutis que tenía este panal (las palabras
 * con las 7 letras): cada letra se ilumina en el panal al escribirse. Debajo, quién lo encontró, y sus puntos
 * vuelan a sus casillas; si nadie lo encontró, se dice. Al final, los puntos del resto de palabras de cada uno.
 * Las palabras se pueden tocar para ver su definición.
 */
export async function repaso({ escena, resumen, jugadores, sumar, esperar, parado, celebrar }) {
  if (!resumen?.jugadores) return;
  const panal = crearPanal(resumen.centro, resumen.letras);
  const barra = h("div.rep-barra");
  const aviso = h("div.rep-aviso");
  const quien = h("div.rep-quien");
  escena.replaceChildren(h("div.rep-pg", aviso, barra, quien, h("div.rep-panal", panal.el)));
  const hex = (l) => panal.el.querySelector(`.hex[data-l="${l}"]`);
  const avisar = (texto) => {
    aviso.textContent = texto;
    aviso.classList.remove("aparece");
    void aviso.offsetWidth;
    aviso.classList.add("aparece");
  };

  // Quién encontró cada palabra (en el orden de la sala) y cuánto valía.
  const enSala = jugadores.filter((j) => resumen.jugadores[j.id]);
  const encontrada = new Map(); // clave -> { p, quienes }
  for (const j of enSala)
    for (const p of resumen.jugadores[j.id]) {
      const x = encontrada.get(p.c) ?? { p, quienes: [] };
      x.quienes.push(j);
      encontrada.set(p.c, x);
    }
  // Los tutis del panal: todos los que se podían conseguir (los encontrados primero, para empezar con fiesta).
  const deResumen = (resumen.comunes ?? []).filter((c) => c.tuti).map((c) => ({ c: c.clave, f: c.forma }));
  const tutis = deResumen.length ? deResumen : [...encontrada.values()].filter((x) => x.p.t).map((x) => ({ c: x.p.c, f: x.p.f }));
  tutis.sort((a, b) => Number(encontrada.has(b.c)) - Number(encontrada.has(a.c)) || a.c.length - b.c.length);

  if (!tutis.length) {
    avisar("Este panal no tenía tutis");
    await esperar(1400);
  } else {
    avisar(tutis.length === 1 ? "🌈 El tuti de este panal" : `🌈 Los ${tutis.length} tutis de este panal`);
    await esperar(1000);
  }
  for (const t of tutis) {
    if (parado()) return;
    const x = encontrada.get(t.c);
    // Se escribe letra a letra, iluminando su casilla del panal, en fichas del juego.
    barra.replaceChildren();
    barra.className = "rep-barra tuti";
    barra.dataset.palabra = t.f;
    quien.replaceChildren();
    const fichas = [...t.f].map((l) => h("span.ficha.rep-ficha", l.toUpperCase()));
    barra.style.setProperty("--n", fichas.length);
    for (let k = 0; k < t.c.length; k++) {
      if (parado()) return;
      const el = hex(t.c[k]);
      el?.classList.add("ilumina");
      barra.append(fichas[k] ?? h("span.ficha.rep-ficha", t.c[k].toUpperCase()));
      await esperar(140);
      el?.classList.remove("ilumina");
    }
    if (!x) {
      // Nadie lo encontró: la palabra se queda gris.
      barra.classList.add("nadie");
      quien.replaceChildren(h("span.rep-nadie.aparece", "😮 Nadie lo encontró"));
      await esperar(1500);
      continue;
    }
    // Encontrado: las fichas brillan, se ve quién lo encontró y sus puntos vuelan a sus casillas.
    barra.classList.add("hecha", "fiesta");
    barra.append(h("span.rep-pts", `+${x.p.p}`));
    quien.replaceChildren(
      h("span.rep-quien-txt", x.quienes.length === 1 ? "Lo encontró" : "Lo encontraron"),
      ...x.quienes.map((j) => h("span.rep-quien-j.aparece", { style: { "--c": j.color } }, avatar(j), h("b", j.nombre)))
    );
    celebrar(80);
    await esperar(1100);
    await sumar(x.quienes.map((j) => j.id), x.p.p, barra.querySelector(".rep-pts"), { clase: ".tuti" });
    await esperar(700);
  }
  if (parado()) return;

  // El resto de palabras: lo que sumó cada uno sin los tutis, todo de una vez.
  const resto = enSala
    .map((j) => {
      const lista = resumen.jugadores[j.id].filter((p) => !p.t);
      return { j, n: lista.length, pts: lista.reduce((s, p) => s + p.p, 0) };
    })
    .filter((r) => r.pts > 0);
  barra.replaceChildren();
  delete barra.dataset.palabra;
  barra.className = "rep-barra";
  quien.replaceChildren();
  if (!resto.length) return;
  avisar("✍️ Y el resto de palabras de cada uno");
  quien.replaceChildren(
    ...resto.map((r) =>
      h(
        "span.rep-quien-j.rep-resto.aparece",
        { style: { "--c": r.j.color } },
        avatar(r.j),
        h("b", r.j.nombre),
        h("small", `${r.n} ${r.n === 1 ? "palabra" : "palabras"}`),
        h("span.rep-pts", `+${r.pts}`)
      )
    )
  );
  await esperar(1300);
  const chips = [...quien.children];
  await Promise.all(resto.map((r, k) => sumar([r.j.id], r.pts, chips[k]?.querySelector(".rep-pts"))));
  await esperar(500);
}

// ------------------------------------------------------------------ estadísticas (después del repaso)
/**
 * Todas las palabras de cada jugador, en columnas (una por jugador) y agrupadas por largo; debajo, las que se
 * podían encontrar y no encontró nadie. Todas se pueden tocar para ver su definición.
 */
export function estadisticas(e) {
  const r = e.resumen;
  if (!r?.jugadores) return null;
  const orden = [...(e.resultados ?? [])].sort((a, b) => (a.puesto ?? 99) - (b.puesto ?? 99));
  const vistas = new Set(Object.values(r.jugadores).flatMap((l) => l.map((p) => p.c)));
  const faltan = (r.comunes ?? []).filter((c) => !vistas.has(c.clave));
  const largosFaltan = [...new Set(faltan.map((c) => c.clave.length))].sort((a, b) => b - a);
  return h(
    "div.pg-stats-todo",
    h(
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
                  h("div.pg-stats-chips", lista.filter((p) => p.c.length === n).map((p) => h(`span.pg-chip${p.t ? ".tuti" : ".bien"}`, { "data-palabra": p.f }, p.f.toUpperCase())))
                )
              )
            : h("p.suave", "Ninguna palabra")
        );
      })
    ),
    faltan.length
      ? h(
          "div.pg-faltan.tarjeta",
          h("div.pg-faltan-cab", h("b", "🔎 Nadie encontró estas"), h("span.suave", `${faltan.length} de ${r.total ?? vistas.size + faltan.length} palabras · toca una para ver qué significa`)),
          h(
            "div.pg-faltan-grupos",
            largosFaltan.map((n) =>
              h(
                "div.pg-stats-grupo",
                h("small", `${n} letras`),
                h("div.pg-stats-chips", faltan.filter((c) => c.clave.length === n).map((c) => h(`span.pg-chip.falta${c.tuti ? ".tuti" : ""}`, { "data-palabra": c.forma }, c.forma.toUpperCase())))
              )
            )
          )
        )
      : null
  );
}
