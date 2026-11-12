// Paraulógico · móvil: panal, palabra escrita, borrar, mezclar y comprobar.
import { h } from "../../comun/ui.js";
import { reiniciarAnim, clave } from "../comun/util.js";
import { teclasFisicas, sinTilde, ES_LETRA } from "../../comun/teclas.js";
import { crearPanal } from "./panal.js";

export function montar(cuerpo, e, ctx) {
  let d = e.datos;
  let texto = "";
  let ultimoVisto = d.ultimo?.n ?? 0;
  let letras = [...d.letras];

  const puntos = h("span.ficha", "0");
  const cuantas = h("span.suave");
  const escrito = h("div.pg-escrito");
  const aviso = h("div.pl-aviso");
  const panal = crearPanal(d.centro, letras, (l) => {
    if (texto.length < 16) texto += l;
    pintar();
  });
  const borrar = h("button.boton.suave", { type: "button", onclick: () => { texto = texto.slice(0, -1); pintar(); } }, "⌫ Borrar");
  const mezclar = h("button.boton.suave", { type: "button", onclick: () => {
    letras = letras.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    panal.mezclar(letras);
  } }, "🔀 Mezclar");
  const comprobar = h("button.boton.acento.pl-comprobar", { type: "button", onclick: probar }, "Comprobar ✓");
  const lista = h("div.pg-lista");

  cuerpo.append(
    h(
      "div.pg",
      h("div.mf-cont", "Puntos", puntos, cuantas),
      h("div.pl-caja.tarjeta", escrito, aviso),
      h("div.pg-panal", panal.el),
      h("div.pg-botones", borrar, mezclar),
      comprobar,
      lista
    )
  );

  // Teclado del ordenador: solo valen las letras del panal.
  teclasFisicas(escrito, (t) => {
    if (t === "⌫") return ((texto = texto.slice(0, -1)), pintar());
    if (t === "OK") return probar();
    if (!ES_LETRA.test(t)) return false;
    const l = [d.centro, ...letras].find((x) => clave(x) === sinTilde(t));
    if (!l) return reiniciarAnim(escrito, "sacudir");
    if (texto.length < 16) texto += l;
    pintar();
  });

  function pintar() {
    escrito.replaceChildren(
      ...[...texto].map((l) => h(`span${l === d.centro ? ".central" : ""}`, l.toUpperCase())),
      h("span.cursor", "")
    );
    comprobar.disabled = texto.length < 3;
  }

  function pintarLista() {
    puntos.textContent = d.puntos;
    const n = d.encontradas.length;
    cuantas.textContent = `· ${n} ${n === 1 ? "palabra" : "palabras"}`;
    lista.replaceChildren(...d.encontradas.map((w) => h(`span.pg-chip${w.tuti ? ".tuti" : ""}`, w.forma.toUpperCase())));
  }

  function probar() {
    if (texto.length < 3) return;
    ctx.enviar({ a: "probar", texto });
    texto = "";
    pintar();
    aviso.className = "pl-aviso suave";
    aviso.textContent = "Comprobando…";
  }

  function mostrar(u) {
    if (u.ok) {
      aviso.className = "pl-aviso ok";
      aviso.textContent = u.tuti ? `🎉 ¡TUTI! ${u.forma.toUpperCase()} +${u.pts}` : `✔ ${u.forma.toUpperCase()} +${u.pts}`;
      reiniciarAnim(puntos, "rebote");
      navigator.vibrate?.(u.tuti ? [40, 40, 80] : 20);
    } else {
      aviso.className = "pl-aviso mal";
      aviso.textContent = `✘ ${u.palabra.toUpperCase()}: ${u.motivo}`;
      reiniciarAnim(escrito, "sacudir");
      navigator.vibrate?.([30, 40, 30]);
    }
  }

  pintar();
  pintarLista();

  return {
    actualizar(e) {
      if (!e.datos) return;
      d = e.datos;
      pintarLista();
      if (d.ultimo && d.ultimo.n > ultimoVisto) {
        ultimoVisto = d.ultimo.n;
        mostrar(d.ultimo);
      }
    },
  };
}
