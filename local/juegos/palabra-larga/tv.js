// Palabra más larga · TV: las letras en grande y cómo va cada jugador (sin desvelar palabras).
import { h, avatar } from "../../comun/ui.js";

export function montar(cuerpo, e, ctx) {
  const letras = h(
    "div.pl-letras-tv",
    e.datos.letras.map((l, i) => h("span.ficha", { style: { animationDelay: `${i * 70}ms` } }, l.toUpperCase()))
  );
  const rejilla = h("div.mf-rejilla");
  cuerpo.append(h("div.pl-tv", letras, rejilla));
  const cartas = new Map();

  function actualizar(e) {
    const js = e.datos?.jugadores ?? {};
    for (const j of e.jugadores) {
      if (!j.conectado && !(j.id in js)) continue;
      let c = cartas.get(j.id);
      if (!c) {
        const num = h("span.ficha", "–");
        const estado = h("span.pl-estado");
        c = { el: h("div.mf-carta.tarjeta.aparece", avatar(j), h("span.nombre", j.nombre), estado, num), num, estado, largo: 0 };
        cartas.set(j.id, c);
        rejilla.append(c.el);
      }
      const d = js[j.id] ?? { largo: 0, listo: false };
      if (d.largo !== c.largo) {
        c.largo = d.largo;
        c.num.textContent = d.largo || "–";
        c.num.classList.remove("rebote");
        void c.num.offsetWidth;
        c.num.classList.add("rebote");
        const r = c.num.getBoundingClientRect();
        ctx.onda(r.left + r.width / 2, r.top + r.height / 2, 0.7);
      }
      c.estado.textContent = d.listo ? "✔ listo" : "";
      c.el.querySelector(".avatar").classList.toggle("desconectado", !j.conectado);
    }
  }

  actualizar(e);
  return { actualizar };
}

/** Bloque para la pantalla de resultados: las mejores palabras que se podían formar. */
export function resumen(r) {
  return h(
    "div.pl-resumen.tarjeta.aparece",
    { style: { animationDelay: "900ms" } },
    h("span.etiqueta", "Se podía formar"),
    h(
      "div.pl-soluciones",
      r.mejores.map((m) => h("span.pl-sol", m.forma.toUpperCase(), h("small", ` ${m.largo}`))),
      r.rara ? h("span.pl-sol.rara", r.rara.forma.toUpperCase(), h("small", ` ${r.rara.largo} · poco común`)) : null
    )
  );
}
