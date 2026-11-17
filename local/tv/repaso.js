// Repaso animado de los resultados (pantalla grande / modo espectador). Antes de la tabla con todos los datos,
// se cuenta la partida poco a poco: a la izquierda una casilla por jugador con sus puntos (empiezan en 0) y en
// el centro la escena de cada juego. Los puntos salen volando hacia las casillas de quien los ganó y se suman
// al llegar: así no se sabe quién gana hasta el final. Luego se anuncia al ganador y llegan las estadísticas.
//
// Cada juego puede tener su propio repaso (export repaso en juegos/<id>/tv.js); si no, se usa el general:
// el resultado de cada jugador, del último al primero.
import { h, avatar, confeti } from "../comun/ui.js";

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const movimientoReducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * e: el estado de la sala (fase resultados); modulo: el de juegos/<id>/tv.js (o null); alTerminar(): sigue a
 * las estadísticas. Devuelve { el, desmontar }.
 */
export function pantallaRepaso({ e, modulo, cabecera, alTerminar }) {
  const resultados = [...(e.resultados ?? [])];
  let parado = false;
  // ---- casillas de los jugadores (izquierda)
  const casillas = new Map();
  const porLlegada = [...resultados].sort((a, b) => (e.jugadores ?? []).findIndex((j) => j.id === a.id) - (e.jugadores ?? []).findIndex((j) => j.id === b.id));
  const marcadores = h(
    "div.rep-marcadores",
    porLlegada.map((r) => {
      const num = h("b.rep-puntos", "0");
      const el = h("div.rep-casilla.tarjeta", { style: { "--c": r.color } }, avatar(r), h("span.rep-nombre", r.nombre), num);
      casillas.set(r.id, { el, num, valor: 0 });
      return el;
    })
  );
  const escena = h("div.rep-escena");
  const saltar = h("button.boton.suave.rep-saltar", { type: "button", onclick: () => terminar() }, "Saltar ⏭");
  const el = h("section.repaso", cabecera(`Resultados · ${e.juego?.nombre ?? ""}`), h("div.rep-cuerpo", marcadores, escena), h("footer.pie.rep-pie", saltar));

  // (Las casillas van siempre en el mismo orden, el de llegada: nadie adivina el ganador por la posición.)

  /** Suma puntos a unos jugadores: «+n» sale de `desde` y vuela a cada casilla; al llegar, se suma. */
  async function sumar(ids, puntos, desde, { clase = "" } = {}) {
    if (parado || !puntos) return;
    const origen = desde?.getBoundingClientRect?.();
    await Promise.all(
      ids.map(async (id, k) => {
        const c = casillas.get(id);
        if (!c) return;
        const destino = c.num.getBoundingClientRect();
        const ficha = h(`span.rep-vuela${clase}`, `+${puntos}`);
        document.body.append(ficha);
        const x0 = origen ? origen.left + origen.width / 2 : innerWidth / 2, y0 = origen ? origen.top + origen.height / 2 : innerHeight / 2;
        const x1 = destino.left + destino.width / 2, y1 = destino.top + destino.height / 2;
        const dura = movimientoReducido() ? 1 : 650 + k * 90;
        const anim = ficha.animate?.(
          [
            { transform: `translate(${x0}px, ${y0}px) translate(-50%, -50%) scale(1.15)`, opacity: 1 },
            { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 60}px) translate(-50%, -50%) scale(1)`, opacity: 1, offset: 0.5 },
            { transform: `translate(${x1}px, ${y1}px) translate(-50%, -50%) scale(0.6)`, opacity: 0.2 },
          ],
          { duration: dura, easing: "cubic-bezier(0.45, 0, 0.25, 1)", fill: "forwards" }
        );
        // (si la pantalla no se está pintando, la animación no avanza: no se espera más de la cuenta)
        await Promise.race([anim?.finished ?? esperar(dura), esperar(dura + 150)]).catch(() => {});
        ficha.remove();
        c.valor += puntos;
        c.num.textContent = String(c.valor);
        c.el.classList.remove("suma");
        void c.el.offsetWidth;
        c.el.classList.add("suma");
      })
    );
  }

  /** El ganador: su casilla brilla, con corona, y se anuncia en el centro. */
  async function anunciarGanador() {
    const valores = [...casillas.values()].map((c) => c.valor);
    const max = Math.max(0, ...valores);
    // Con puntos del repaso, gana quien más sumó; si no (o empatan a 0), el puesto 1 de los resultados.
    const ganadores = max > 0 ? resultados.filter((r) => casillas.get(r.id)?.valor === max) : resultados.filter((r) => r.puesto === 1);
    if (!ganadores.length) return;
    for (const r of ganadores) casillas.get(r.id)?.el.classList.add("ganador");
    for (const c of casillas.values()) if (!c.el.classList.contains("ganador")) c.el.classList.add("apagada");
    escena.replaceChildren(
      h(
        "div.rep-ganador.aparece",
        h("div.rep-ganador-avatares", ganadores.map((r) => avatar(r))),
        h("span.rep-ganador-copa", "🏆"),
        h("h2", ganadores.length > 1 ? `¡Empate! ${ganadores.map((r) => r.nombre).join(" y ")}` : `¡Gana ${ganadores[0].nombre}!`)
      )
    );
    confeti?.(120);
    await esperar(3200);
  }

  async function correr() {
    try {
      if (modulo?.repaso) await modulo.repaso({ escena, resumen: e.resumen, resultados, jugadores: e.jugadores ?? [], sumar, esperar: (ms) => (parado ? Promise.resolve() : esperar(ms)), parado: () => parado, celebrar: (n = 60) => confeti?.(n) });
      else await repasoGeneral();
      if (!parado) await anunciarGanador();
    } catch {}
    terminar();
  }

  /** Repaso general: del último al primero, el resultado de cada uno y sus puntos de la ronda. */
  async function repasoGeneral() {
    const orden = [...resultados].sort((a, b) => (b.puesto ?? 99) - (a.puesto ?? 99));
    for (const r of orden) {
      if (parado) return;
      const tarjeta = h(
        "div.rep-tarjeta.tarjeta.aparece",
        { style: { "--c": r.color } },
        avatar(r),
        h("b.rep-tarjeta-nombre", r.nombre),
        h("p.rep-tarjeta-texto", r.texto ?? ""),
        r.detalle?.length ? h("div.rep-tarjeta-chips", r.detalle.slice(0, 12).map((d) => h(`span.pg-chip.${d.k ?? "bien"}`, d.t))) : null
      );
      escena.replaceChildren(tarjeta);
      await esperar(1500);
      await sumar([r.id], r.puntos ?? 0, tarjeta.querySelector(".rep-tarjeta-texto"));
      await esperar(500);
    }
  }

  let terminado = false;
  function terminar() {
    if (terminado) return;
    terminado = true;
    parado = true;
    document.querySelectorAll(".rep-vuela").forEach((x) => x.remove());
    alTerminar();
  }

  setTimeout(correr, 600);
  return {
    el,
    desmontar() {
      parado = true;
      terminado = true;
      document.querySelectorAll(".rep-vuela").forEach((x) => x.remove());
    },
  };
}
