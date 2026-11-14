// Conexiones · móvil: arriba los grupos ya encontrados (en franjas de color), en medio las palabras que
// quedan (4 por fila) y abajo Mezclar / Quitar / Comprobar. Los fallos que quedan, en corazones.
import { h } from "../../comun/ui.js";
import { reiniciarAnim } from "../comun/util.js";
import { textoCasilla, franjaGrupo } from "./piezas.js";

export function montar(cuerpo, e, ctx) {
  let d = e.datos;
  let elegidas = new Set();
  // El panel de palabras es fijo: cada palabra se queda en su casilla (las acertadas dejan su hueco).
  let orden = d.palabras.map((p) => p.clave);
  let avanzado = -1; // tablero que ya se pasó solo (al completarlo)
  let ultimoVisto = d.ultimo?.n ?? 0;
  let tVisto = d.t;

  const cabeza = h("div.cx-cabeza");
  const hallados = h("div.cx-hallados");
  const rejilla = h("div.cx-rejilla");
  const aviso = h("div.pl-aviso");
  const mezclar = h("button.boton.suave", { type: "button", "aria-label": "Mezclar", title: "Mezclar", onclick: () => mezclarQuedan() }, "🔀");
  const quitar = h("button.boton.suave", { type: "button", onclick: () => ((elegidas = new Set()), pintar()) }, "Quitar");
  const comprobar = h("button.boton.acento.pl-comprobar", { type: "button", onclick: enviar }, "✓ Comprobar");
  const siguiente = h("button.boton.acento.grande.oculto", { type: "button", onclick: () => ctx.enviar({ a: "siguiente", t: d.t }) }, "Siguiente tablero ▶");
  const botones = h("div.cx-botones", mezclar, quitar, comprobar);
  cuerpo.append(h("div.cx", cabeza, hallados, rejilla, aviso, botones, siguiente));

  function barajar(l) {
    const a = [...l];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Mezcla solo las palabras que quedan, entre sus propias casillas. */
  function mezclarQuedan() {
    const fuera = new Set(d.hallados.flatMap((g) => g.claves));
    const sitios = orden.map((c, i) => (fuera.has(c) ? -1 : i)).filter((i) => i >= 0);
    const nuevas = barajar(sitios.map((i) => orden[i]));
    orden = [...orden];
    sitios.forEach((i, k) => (orden[i] = nuevas[k]));
    pintar();
  }

  const enGrupo = () => new Set((d.solucion ?? d.hallados).flatMap((g) => g.claves));
  function quedan() {
    const fuera = new Set(d.hallados.flatMap((g) => g.claves));
    let lista = d.palabras.filter((p) => !fuera.has(p.clave));
    return lista;
  }

  rejilla.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest(".cx-palabra");
    if (!b || d.acabado) return;
    ev.preventDefault();
    const c = b.dataset.c;
    if (elegidas.has(c)) elegidas.delete(c);
    else if (elegidas.size < 4) elegidas.add(c);
    navigator.vibrate?.(6);
    pintar();
  });

  function enviar() {
    if (elegidas.size !== 4 || d.acabado) return;
    ctx.enviar({ a: "grupo", t: d.t, claves: [...elegidas] });
  }

  function pintar() {
    if (d.fin) {
      cabeza.textContent = "";
      hallados.replaceChildren();
      rejilla.replaceChildren(
        d.total
          ? h("div.espera", h("h1", "🏁"), h("p", `¡Has terminado todos los tableros! ${d.grupos} ${d.grupos === 1 ? "grupo" : "grupos"}.`))
          : h("div.espera", h("h1", "📚"), h("p", "No hay tableros de Conexiones."), h("p.suave", "Abre la app con internet para actualizarla."))
      );
      [botones, siguiente, aviso].forEach((x) => x.classList.add("oculto"));
      return;
    }
    const corazones = "❤️".repeat(Math.max(0, d.maxFallos - d.fallos)) + "🤍".repeat(Math.min(d.maxFallos, d.fallos));
    cabeza.replaceChildren(h("span", `Tablero ${d.t + 1} de ${d.total}`), h("span.cx-fallos", { title: "Fallos que te quedan" }, corazones), h("span.cx-grupos", `🏆 ${d.grupos}`));
    const forma = Object.fromEntries(d.palabras.map((p) => [p.clave, p.forma]));
    const lista = d.acabado ? d.solucion : d.hallados;
    // Arriba, siempre 4 sitios: los grupos encontrados y huecos para los que faltan.
    hallados.replaceChildren(
      ...lista.map((g) => franjaGrupo(g.nombre, g.claves.map((c) => forma[c]), g.color ?? g.g, { perdido: !d.hallados.some((x) => x.g === g.g) })),
      ...Array.from({ length: Math.max(0, 4 - lista.length) }, (_, k) => h("div.cx-hueco", h("span", `Grupo ${lista.length + k + 1}`)))
    );
    const fuera = new Set(d.acabado ? d.palabras.map((p) => p.clave) : d.hallados.flatMap((g) => g.claves));
    if (orden.length !== d.palabras.length) orden = d.palabras.map((p) => p.clave);
    rejilla.replaceChildren(
      ...orden.map((c) =>
        fuera.has(c)
          ? h("span.cx-palabra.usada", { "aria-hidden": "true" })
          : h(`button.cx-palabra${elegidas.has(c) ? ".elegida" : ""}`, { type: "button", "data-c": c }, textoCasilla(forma[c]))
      )
    );
    comprobar.disabled = elegidas.size !== 4;
    // Tablero completo: se pasa solo al siguiente. Si se acabaron los fallos, se ven los grupos y se pasa con el botón.
    const completo = d.acabado && d.hallados.length === 4;
    botones.classList.toggle("oculto", d.acabado);
    siguiente.classList.toggle("oculto", !d.acabado || completo);
    if (completo && avanzado !== d.t) {
      avanzado = d.t;
      const t = d.t;
      setTimeout(() => d.t === t && !d.fin && ctx.enviar({ a: "siguiente", t }), 1300);
    }
    if (d.acabado) {
      aviso.className = "pl-aviso";
      aviso.textContent = d.hallados.length === 4 ? "🎉 ¡Tablero completo!" : "Se acabaron los fallos: estos eran los grupos";
    }
  }

  pintar();
  return {
    actualizar(e) {
      if (!e.datos) return;
      d = e.datos;
      if (d.t !== tVisto) {
        tVisto = d.t;
        elegidas = new Set();
        orden = d.palabras.map((p) => p.clave);
        aviso.textContent = "";
      }
      const u = d.ultimo;
      if (u && u.n !== ultimoVisto) {
        ultimoVisto = u.n;
        if (u.ok) {
          elegidas = new Set();
          aviso.className = "pl-aviso ok";
          aviso.textContent = "✔ ¡Grupo!";
          navigator.vibrate?.(25);
        } else {
          aviso.className = "pl-aviso mal";
          aviso.textContent = u.casi ? "¡A una de distancia!" : "✘ No es un grupo";
          navigator.vibrate?.([30, 40, 30]);
          reiniciarAnim(rejilla, "sacudir");
        }
      }
      pintar();
      if (u?.ok) {
        const ultimo = hallados.querySelector(".cx-grupo:last-child");
        if (ultimo) reiniciarAnim(ultimo, "aparece");
      }
      void enGrupo;
    },
  };
}
