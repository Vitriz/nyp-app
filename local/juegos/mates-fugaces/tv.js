// Mates fugaces · TV: tarjeta por jugador con sus aciertos en directo.
import { h, avatar } from "../../comun/ui.js";

export function montar(cuerpo, e, ctx) {
  const rejilla = h("div.mf-rejilla");
  cuerpo.append(rejilla);
  const cartas = new Map();

  function actualizar(e) {
    const aciertos = e.datos?.aciertos ?? {};
    for (const j of e.jugadores) {
      if (!j.conectado && !(j.id in aciertos)) continue;
      let c = cartas.get(j.id);
      if (!c) {
        const num = h("span.ficha", "0");
        c = { el: h("div.mf-carta.tarjeta.aparece", avatar(j), h("span.nombre", j.nombre), num), num, valor: 0 };
        cartas.set(j.id, c);
        rejilla.append(c.el);
      }
      const v = aciertos[j.id] ?? 0;
      if (v !== c.valor) {
        c.valor = v;
        c.num.textContent = v;
        c.num.classList.remove("rebote");
        void c.num.offsetWidth;
        c.num.classList.add("rebote");
        const r = c.num.getBoundingClientRect();
        ctx.onda(r.left + r.width / 2, r.top + r.height / 2, 0.6);
      }
      c.el.querySelector(".avatar").classList.toggle("desconectado", !j.conectado);
    }
  }

  actualizar(e);
  return { actualizar };
}
