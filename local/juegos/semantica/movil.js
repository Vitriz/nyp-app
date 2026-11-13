// Semántica · móvil: escribes una palabra (teclado propio) y sale su puesto: #1 es la secreta.
// La lista va de la más cercana a la más lejana, con un termómetro de color. Puedes pedir pistas.
import { h, confeti } from "../../comun/ui.js";
import { tecladoLetras, reiniciarAnim } from "../comun/util.js";

/** Temperatura según el puesto. */
function temperatura(p, total) {
  if (p === 0) return { e: "🎯", t: "¡ES ESTA!", c: "#6cc49a" };
  if (p <= 10) return { e: "🔥", t: "¡Ardiendo!", c: "#ff6b4a" };
  if (p <= 100) return { e: "🥵", t: "Muy caliente", c: "#ff9f43" };
  if (p <= 500) return { e: "♨️", t: "Caliente", c: "#f0c64a" };
  if (p <= 2000) return { e: "🌤️", t: "Templado", c: "#9ad1e8" };
  return { e: "🧊", t: p > total * 0.6 ? "Helado" : "Frío", c: "#7c9cf0" };
}
// Barra: llena cerca del #1, vacía lejos (escala logarítmica).
const llenado = (p, total) => Math.max(3, Math.round((1 - Math.log10(p + 1) / Math.log10(total)) * 100));

export function montar(cuerpo, e, ctx) {
  let d = e.datos;
  if (d?.sinDatos) {
    cuerpo.append(h("div.espera", h("h1", "📚"), h("p", "Este diccionario aún no tiene Semántica."), h("p.suave", "Abre la app con internet (o conéctate a PARTY) para actualizarlo.")));
    return { actualizar() {} };
  }
  let texto = "";
  let ultimoVisto = d.ultimo?.n ?? 0;
  let celebrado = Boolean(d.encontrada);

  const visor = h("div.sm-visor");
  const probar = h("button.boton.acento.sm-probar", { type: "button", onclick: enviar }, "Probar");
  const pista = h("button.boton.suave.sm-pista", { type: "button", onclick: () => ctx.enviar({ a: "pista" }) });
  const cabeza = h("div.sm-cabeza");
  const resultado = h("div.sm-resultado");
  const lista = h("div.sm-lista");
  const teclado = tecladoLetras((t) => {
    if (t === "⌫") texto = texto.slice(0, -1);
    else if (texto.length < 16) texto += t;
    pintarVisor();
  });
  // Enter también prueba (en el ordenador).
  window.addEventListener("keydown", alEnter);
  function alEnter(ev) {
    if (!cuerpo.isConnected) return window.removeEventListener("keydown", alEnter);
    if (ev.key === "Enter") enviar();
  }
  cuerpo.append(h("div.sm", cabeza, h("div.sm-escribir", visor, probar), resultado, lista, h("div.sm-pie", pista), teclado));

  function enviar() {
    if (!texto || d.encontrada) return;
    ctx.enviar({ a: "intento", texto });
    texto = "";
    pintarVisor();
  }

  function pintarVisor() {
    visor.replaceChildren(texto ? h("span", texto.toUpperCase()) : h("span.marcador", "Escribe una palabra"), h("span.cursor"));
    probar.disabled = !texto || Boolean(d.encontrada);
  }

  function fila(x, nueva = false) {
    const tp = temperatura(x.puesto, d.total);
    return h(
      `div.sm-fila${nueva ? ".nueva" : ""}${x.pista ? ".pista" : ""}`,
      { style: { "--c": tp.c } },
      h("span.sm-palabra", `${x.pista ? "💡 " : ""}${x.forma.toUpperCase()}`),
      h("span.sm-barra", h("i", { style: { width: `${llenado(x.puesto, d.total)}%` } })),
      h("span.sm-puesto", `${tp.e} #${x.puesto + 1}`)
    );
  }

  function pintar() {
    const n = d.intentos.filter((x) => !x.pista).length;
    cabeza.replaceChildren(h("span", `${n} ${n === 1 ? "intento" : "intentos"}`), h("span.suave", `#1 = la secreta · hay ${d.total.toLocaleString("es-ES")}`));
    const quedan = d.pistasMax - d.pistasUsadas;
    pista.textContent = quedan ? `💡 Pista (${quedan})` : "Sin pistas";
    pista.disabled = !quedan || Boolean(d.encontrada);
    const ultima = d.ultimo?.ok ? d.intentos.find((x) => x.i === d.ultimo.i) : null;
    if (d.encontrada) {
      resultado.replaceChildren(h("div.sm-ganado", "🎉 ¡Era ", h("b", d.secreta.toUpperCase()), `! En ${d.encontrada.intentos} intentos`));
    } else if (d.ultimo && !d.ultimo.ok) {
      resultado.replaceChildren(h("div.pl-aviso.mal", d.ultimo.motivo));
    } else if (ultima) {
      const tp = temperatura(ultima.puesto, d.total);
      resultado.replaceChildren(fila(ultima, true), h("div.sm-temp", { style: { color: tp.c } }, tp.t));
    } else resultado.replaceChildren(h("p.suave.sm-ayuda", "Prueba cualquier palabra: verás si está cerca (🔥) o lejos (🧊) del significado de la secreta."));
    const orden = [...d.intentos].sort((a, b) => a.puesto - b.puesto);
    lista.replaceChildren(...orden.map((x) => fila(x)));
  }

  pintarVisor();
  pintar();
  return {
    actualizar(e) {
      if (!e.datos) return;
      d = e.datos;
      const u = d.ultimo;
      pintar();
      pintarVisor();
      if (u && u.n !== ultimoVisto) {
        ultimoVisto = u.n;
        if (!u.ok) {
          reiniciarAnim(visor, "sacudir");
          navigator.vibrate?.([30, 40, 30]);
        } else navigator.vibrate?.(10);
      }
      if (d.encontrada && !celebrado) {
        celebrado = true;
        confeti(90);
        navigator.vibrate?.([40, 40, 120]);
      }
    },
  };
}
