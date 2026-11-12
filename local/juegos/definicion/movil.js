// Definición · móvil: definición, casillas de la palabra, pistas y teclado de letras.
import { h } from "../../comun/ui.js";
import { huella, tecladoLetras, reiniciarAnim } from "../comun/util.js";

export function montar(cuerpo, e, ctx) {
  let d = e.datos;
  let escritas = []; // letras escritas por el jugador (sin contar las desveladas)
  let bloqueado = false;
  let anteriorVisto = d.anterior?.n ?? -1;

  const contador = h("span.ficha", "0");
  const numero = h("span.suave");
  const categoria = h("div.df-cat.suave");
  const texto = h("p.df-texto");
  const casillas = h("div.df-casillas");
  const aviso = h("div.df-aviso");
  const pista = h("button.boton.suave", { type: "button", onclick: pedirPista }, "💡 Pista (−1)");
  const pasar = h("button.boton.suave", { type: "button", onclick: () => !bloqueado && ctx.enviar({ a: "pasar", i: d.i }) }, "Pasar ➜");
  const teclado = tecladoLetras(teclear);

  cuerpo.append(
    h(
      "div.df",
      h("div.df-tarjeta.tarjeta", categoria, texto),
      casillas,
      aviso,
      h("div.pl-botones", pista, pasar),
      teclado
    )
  );

  function reveladas() {
    return new Map((d.actual?.letras ?? []).map((x) => [x.p, x.l]));
  }

  function pintarPalabra(animar = true) {
    const a = d.actual;
    contador.textContent = d.aciertos;
    if (!a) {
      categoria.textContent = "";
      texto.textContent = "¡Has llegado al final de la lista!";
      casillas.replaceChildren();
      teclado.classList.add("oculto");
      pista.disabled = pasar.disabled = true;
      return;
    }
    numero.textContent = `· palabra ${d.i + 1}`;
    categoria.textContent = `${a.categoria} · ${a.largo} letras`;
    texto.textContent = a.definicion;
    if (animar) reiniciarAnim(texto, "aparece");
    pintarCasillas();
  }

  function pintarCasillas() {
    const a = d.actual;
    if (!a) return;
    const fijas = reveladas();
    const libres = a.largo - fijas.size;
    escritas = escritas.slice(0, libres);
    let k = 0;
    const celdas = [];
    for (let p = 0; p < a.largo; p++) {
      if (fijas.has(p)) celdas.push(h("span.ficha.fija", fijas.get(p).toUpperCase()));
      else {
        const l = escritas[k++];
        celdas.push(h(`span.ficha${l ? "" : ".vacia"}`, l ? l.toUpperCase() : " "));
      }
    }
    casillas.style.setProperty("--n", Math.max(6, a.largo));
    casillas.replaceChildren(...celdas);
    pista.disabled = fijas.size >= a.largo - 1 || bloqueado;
  }

  function palabraCompleta() {
    const a = d.actual;
    const fijas = reveladas();
    let k = 0, out = "";
    for (let p = 0; p < a.largo; p++) out += fijas.has(p) ? fijas.get(p) : escritas[k++] ?? "";
    return out;
  }

  function teclear(t) {
    const a = d.actual;
    if (!a || bloqueado) return;
    const libres = a.largo - reveladas().size;
    if (t === "⌫") escritas.pop();
    else if (escritas.length < libres) escritas.push(t);
    pintarCasillas();
    if (escritas.length === libres) comprobar();
  }

  function comprobar() {
    const palabra = palabraCompleta();
    if (huella(palabra) === d.actual.h) {
      bloqueado = true;
      casillas.classList.add("bien");
      navigator.vibrate?.(20);
      ctx.enviar({ a: "respuesta", i: d.i, texto: palabra });
    } else {
      reiniciarAnim(casillas, "sacudir");
      navigator.vibrate?.([30, 40, 30]);
    }
  }

  function pedirPista() {
    if (bloqueado || !d.actual) return;
    ctx.enviar({ a: "pista", i: d.i });
  }

  function mostrarAnterior(an) {
    aviso.className = `df-aviso ${an.ok ? "ok" : ""}`;
    aviso.textContent = an.ok ? `✔ ${an.forma.toUpperCase()}` : `Era: ${an.forma.toUpperCase()}`;
    reiniciarAnim(aviso, "aparece");
  }

  pintarPalabra(false);

  return {
    actualizar(e) {
      const nuevo = e.datos;
      if (!nuevo) return;
      const cambio = nuevo.i !== d.i;
      d = nuevo;
      if (d.anterior && d.anterior.n > anteriorVisto) {
        anteriorVisto = d.anterior.n;
        mostrarAnterior(d.anterior);
      }
      if (cambio) {
        escritas = [];
        bloqueado = false;
        casillas.classList.remove("bien");
        pintarPalabra();
      } else {
        contador.textContent = d.aciertos;
        if (!bloqueado) pintarCasillas();
      }
    },
  };
}
