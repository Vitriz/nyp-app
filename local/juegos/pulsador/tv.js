// Pulsador · TV: la pregunta en grande y, cuando alguien pulsa, su nombre bien visible.
import { h, avatar } from "../../comun/ui.js";
import { tarjetasJugadores } from "../comun/util.js";

export function pintarPregunta(p) {
  if (!p) return [h("p.pul-texto", "¡Se acabaron las preguntas!")];
  const partes = [h("span.etiqueta.pul-titulo", p.titulo)];
  // Las operaciones se hacen en orden: las flechas lo dejan claro (6 → − 3 → × 3 no es 6 − 9).
  if (p.tipo === "calculo") partes.push(h("div.pul-fichas", p.pasos.flatMap((x, i) => [i ? h("span.pul-flecha", "→") : null, h("span.ficha", x)])));
  if (p.tipo === "revuelto") partes.push(h("div.pul-fichas", p.letras.map((l) => h("span.ficha", l.toUpperCase()))));
  if (p.texto) partes.push(h("p.pul-texto", p.texto));
  if (p.pista) partes.push(h("span.pul-pista.suave", p.pista));
  return partes;
}

export function montar(cuerpo, e, ctx) {
  const pregunta = h("div.pul-pregunta");
  const anterior = h("div.pul-anterior");
  const caja = h("div.pul-tv", pregunta, anterior);
  cuerpo.append(caja);
  const tarjetas = tarjetasJugadores(caja, ctx, (e, id) => {
    const d = e.datos;
    if (!d) return null;
    return { valor: d.aciertos[id] ?? 0, extra: d.bloqueados.includes(id) ? "✘" : "" };
  });
  let ultimaI = -1, ultimoPulsado = null, capa = null, anteriorVisto = -1;

  function actualizar(e) {
    const d = e.datos;
    if (!d) return;
    if (d.i !== ultimaI) {
      ultimaI = d.i;
      pregunta.replaceChildren(...pintarPregunta(d.pregunta));
      pregunta.classList.remove("aparece");
      void pregunta.offsetWidth;
      pregunta.classList.add("aparece");
    }
    if (d.anterior && d.anterior.n !== anteriorVisto) {
      anteriorVisto = d.anterior.n;
      const quien = e.jugadores.find((j) => j.id === d.anterior.quien);
      anterior.replaceChildren(
        d.anterior.ok && quien ? `✔ ${quien.nombre} acertó: ` : "Era: ",
        h("b", d.anterior.solucion.toUpperCase())
      );
    }
    const pid = d.pulsado?.id ?? null;
    if (pid !== ultimoPulsado) {
      ultimoPulsado = pid;
      capa?.remove();
      capa = null;
      const j = e.jugadores.find((x) => x.id === pid);
      if (j) {
        capa = h("div.pul-capa", h("div.caja", avatar(j), h("b", j.nombre), h("span", "¡Responde en voz alta!")));
        caja.append(capa);
        const r = capa.getBoundingClientRect();
        ctx.onda(r.left + r.width / 2, r.top + r.height / 2, 1.2);
      }
    }
    tarjetas(e);
  }

  actualizar(e);
  return { actualizar };
}
