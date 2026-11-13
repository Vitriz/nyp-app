// Tutifruti (antes Paraulógico) · móvil: panal, palabra escrita, borrar, mezclar y comprobar.
import { h } from "../../comun/ui.js";
import { reiniciarAnim, clave } from "../comun/util.js";
import { teclasFisicas, sinTilde, ES_LETRA } from "../../comun/teclas.js";
import { crearPanal } from "./panal.js";

// Rangos según la parte de los puntos posibles (con las palabras comunes) que llevas.
export const RANGOS = [
  [0, "🌱", "Empezando"], [0.02, "🐣", "Buen comienzo"], [0.05, "🙂", "Bien"], [0.1, "😃", "Muy bien"],
  [0.18, "🤩", "Genial"], [0.3, "🚀", "Asombroso"], [0.5, "🧠", "Genio"],
];
export function rangoDe(puntos, maximo) {
  // Los panales tienen cientos de puntos posibles: los rangos se miden sobre un máximo razonable (250 como mucho).
  const base = Math.min(maximo || 0, 250);
  const f = base ? puntos / base : 0;
  let i = 0;
  while (i + 1 < RANGOS.length && f >= RANGOS[i + 1][0]) i++;
  const sig = RANGOS[i + 1];
  return { actual: RANGOS[i], siguiente: sig, faltan: sig ? Math.max(1, Math.ceil(sig[0] * base - puntos)) : 0, i };
}

export function montar(cuerpo, e, ctx) {
  let d = e.datos;
  let texto = "";
  let ultimoVisto = d.ultimo?.n ?? 0;
  let letras = [...d.letras];

  const puntos = h("span.ficha", "0");
  const cuantas = h("span.suave");
  const escrito = h("div.pg-escrito");
  const aviso = h("div.pl-aviso");
  const rango = h("div.pg-rango");
  const panal = crearPanal(
    d.centro,
    letras,
    (l) => {
      if (texto.length < 16) texto += l;
      pintar();
    },
    () => probar() // arrastrando el dedo por varias letras: al soltar se comprueba
  );
  const borrar = h("button.boton.suave.pg-borrar", { type: "button", onclick: () => { texto = texto.slice(0, -1); pintar(); } }, "⌫ Borrar");
  const mezclar = h("button.boton.suave.pg-mezclar", { type: "button", onclick: () => {
    letras = letras.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    panal.mezclar(letras);
  } }, "🔀 Mezclar");
  const comprobar = h("button.boton.acento.pl-comprobar", { type: "button", onclick: probar }, "Comprobar ✓");
  const lista = h("div.pg-lista");

  // Móvil: todo en columna. Ordenador: panal y botones a la izquierda, tus palabras a la derecha.
  cuerpo.append(
    h(
      "div.pg",
      h(
        "div.pg-izq",
        h("div.mf-cont", "Puntos", puntos, cuantas),
        rango,
        h("div.pl-caja.tarjeta", escrito, aviso),
        h("div.pg-panal", panal.el),
        h("div.pg-botones", borrar, mezclar, comprobar)
      ),
      h("div.pg-der", h("div.pg-lista-titulo", "Tus palabras"), lista)
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
    if (d.maximo) {
      const r = rangoDe(d.puntos, d.maximo);
      rango.replaceChildren(
        h("span.pg-rango-actual", `${r.actual[1]} ${r.actual[2]}`),
        h("span.pg-rango-barra", ...RANGOS.slice(1).map((x, k) => h(`i${k < r.i ? ".hecho" : ""}`, { title: x[2] }))),
        h("small", r.siguiente ? `${r.faltan} para ${r.siguiente[1]} ${r.siguiente[2]}` : "¡Rango máximo!")
      );
    }
    const n = d.encontradas.length;
    cuantas.textContent = d.ayuda
      ? `· ${n} ${n === 1 ? "palabra" : "palabras"} · quedan ${Math.max(0, d.ayuda.total - d.ayuda.halladas)} comunes`
      : `· ${n} ${n === 1 ? "palabra" : "palabras"}`;
    lista.replaceChildren(
      ...(d.encontradas.length
        ? d.encontradas.map((w) => h(`span.pg-chip${w.tuti ? ".tuti" : ""}`, h("b", w.forma.toUpperCase()), h("small", `+${w.pts}`)))
        : [h("span.suave.pg-vacia", "Aún ninguna")])
    );
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
