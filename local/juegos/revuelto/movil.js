// Revuelto · móvil: arriba las dos definiciones (y el botón de pasar, que hay que mantener),
// en medio una sola línea donde escribir y abajo las 12 letras mezcladas (de un solo uso).
// No se sabe el largo ni el tipo de palabra: escribes y das a comprobar.
import { h, botonMantener } from "../../comun/ui.js";
import { huella, reiniciarAnim, clave } from "../comun/util.js";
import { teclasFisicas, sinTilde, ES_LETRA } from "../../comun/teclas.js";

const COLORES = ["#5fb7d0", "#e7a05c"];

export function montar(cuerpo, e, ctx) {
  let d = e.datos;
  let anteriorVisto = d.anterior?.n ?? -1;
  let puestas = []; // índices de las fichas escritas en la línea
  let resueltas = [null, null]; // palabra resuelta (forma) por definición
  let gastadas = new Set();
  let ordenadas = false;

  // Cabecera: una sola casilla con las palabras que llevas de todas las que hay (0 / 40).
  const cuenta = h("b");
  const marcas = h("div.rv-marcas", h("span.rv-chip.ok", h("small", "Palabras"), cuenta));
  const pasar = botonMantener("⏭ Pasar", () => ctx.enviar({ a: "pasar", i: d.i }), { clase: ".suave.rv-pasar", ms: 800 });
  pasar.setAttribute("title", "Mantén pulsado para pasar a otro revuelto");
  const tarjetas = h("div.rv-defs");
  const linea = h("div.rv-linea");
  const aviso = h("div.pl-aviso");
  const tablero = h("div.rv-letras");
  const ordenar = h("button.boton.suave.icono-juego", { type: "button", onclick: () => ((ordenadas = !ordenadas), pintarFichas()), "aria-label": "Ordenar letras" }, "A-Z");
  const deshacer = h("button.boton.suave.icono-juego", { type: "button", onclick: () => (puestas.pop(), pintar()), "aria-label": "Deshacer" }, "↶");
  const borrar = botonMantener("🗑", () => ((puestas = []), pintar()), { clase: ".suave.icono-juego", ms: 600 });
  borrar.setAttribute("aria-label", "Mantén para borrar");
  const comprobarBtn = h("button.boton.acento.pl-comprobar", { type: "button", onclick: () => comprobar() }, "✓ Comprobar");

  cuerpo.append(
    h(
      "div.rv2.rv3",
      h("div.rv-arriba", h("div.rv-cabecera", marcas, pasar), tarjetas),
      h("div.rv-medio", linea, aviso),
      h("div.rv-abajo", tablero, h("div.fila-acciones", deshacer, borrar, ordenar, comprobarBtn))
    )
  );

  // --- toques: una letra va a la línea; tocar una letra de la línea la devuelve
  tablero.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest(".rv-ficha");
    if (!b) return;
    ev.preventDefault();
    const i = Number(b.dataset.i);
    if (!d.actual || enUso().has(i)) return;
    puestas.push(i);
    navigator.vibrate?.(8);
    aviso.textContent = "";
    pintar();
  });
  linea.addEventListener("pointerdown", (ev) => {
    const c = ev.target.closest(".rv-escrita");
    if (!c) return;
    ev.preventDefault();
    puestas.splice(Number(c.dataset.pos), 1);
    pintar();
  });

  // Teclado del ordenador: letras, ⌫ y Enter para comprobar.
  teclasFisicas(tablero, (t) => {
    const a = d.actual;
    if (!a) return false;
    if (t === "⌫") return (puestas.pop(), pintar());
    if (t === "OK") return comprobar();
    if (!ES_LETRA.test(t)) return false;
    const uso = enUso();
    const i = a.letras.findIndex((l, k) => l === sinTilde(t) && !uso.has(k));
    if (i < 0) return reiniciarAnim(linea, "sacudir");
    puestas.push(i);
    aviso.textContent = "";
    pintar();
  });

  function enUso() {
    return new Set([...gastadas, ...puestas]);
  }

  function comprobar() {
    const a = d.actual;
    if (!a || !puestas.length) return;
    const palabra = puestas.map((i) => a.letras[i]).join("");
    const k = a.palabras.findIndex((p, idx) => !resueltas[idx] && huella(palabra) === p.h);
    if (k >= 0) {
      resueltas[k] = palabra;
      puestas.forEach((i) => gastadas.add(i));
      puestas = [];
      aviso.className = "pl-aviso ok";
      aviso.textContent = `✔ ¡${palabra.toUpperCase()}!`;
      navigator.vibrate?.(20);
      ctx.enviar({ a: "respuesta", i: d.i, texto: palabra });
      pintar();
      const t = tarjetas.querySelector(`[data-k="${k}"]`);
      if (t) reiniciarAnim(t, "acierto");
    } else {
      aviso.className = "pl-aviso mal";
      aviso.textContent = "✘ No es ninguna de las dos";
      reiniciarAnim(linea, "sacudir");
      navigator.vibrate?.([30, 40, 30]);
    }
  }

  // --- pintar
  function nuevoRevuelto() {
    puestas = [];
    resueltas = [null, null];
    gastadas = new Set();
    const a = d.actual;
    if (!a) {
      tarjetas.replaceChildren(h("p.df-texto", "¡Has terminado todos los revueltos!"));
      tablero.replaceChildren();
      linea.replaceChildren();
      pasar.disabled = true;
      return;
    }
    pintarMarcas();
    // Si volvemos a entrar con una palabra ya resuelta, apartamos sus letras.
    a.palabras.forEach((p, k) => {
      if (!p.resuelta) return;
      resueltas[k] = p.resuelta;
      const libres = a.letras.map((_, i) => i).filter((i) => !gastadas.has(i));
      for (const ch of clave(p.resuelta)) {
        const j = libres.findIndex((i) => a.letras[i] === ch);
        if (j >= 0) gastadas.add(libres.splice(j, 1)[0]);
      }
    });
    pintar(true);
  }

  function pintarMarcas() {
    cuenta.textContent = `${d.aciertos} / ${d.totalPalabras ?? (d.total ?? 20) * 2}`;
  }

  function pintar(animar = false) {
    pintarTarjetas(animar);
    pintarLinea();
    pintarFichas();
  }

  function pintarTarjetas(animar = false) {
    const a = d.actual;
    if (!a) return;
    tarjetas.replaceChildren(
      ...a.palabras.map((p, k) => {
        const sol = resueltas[k];
        return h(
          // Letra más pequeña cuanto más larga es la definición: así se lee entera, sin cortarse.
          `div.rv-tarjeta.tarjeta${sol ? ".resuelta" : ""}${animar ? ".aparece" : ""}${p.definicion.length > 110 ? ".muy-larga" : p.definicion.length > 70 ? ".larga" : ""}`,
          { "data-k": k, style: { "--c": COLORES[k], animationDelay: `${k * 120}ms` } },
          h("span.rv-num", sol ? "✔" : String(k + 1)),
          h("div.rv-texto", h("p.rv-def", p.definicion), sol ? h("b.rv-sol", sol.toUpperCase()) : null)
        );
      })
    );
  }

  function pintarLinea() {
    const a = d.actual;
    if (!a) return;
    linea.replaceChildren(
      ...(puestas.length
        ? puestas.map((i, pos) => h("span.ficha.rv-escrita", { "data-pos": pos }, a.letras[i].toUpperCase()))
        : [h("span.rv-marcador", resueltas.every(Boolean) ? "¡Las dos!" : "Toca las letras para escribir")]),
    );
    comprobarBtn.disabled = !puestas.length;
    deshacer.disabled = !puestas.length;
  }

  function pintarFichas() {
    const a = d.actual;
    if (!a) return;
    const uso = enUso();
    const orden = a.letras.map((l, i) => ({ l, i }));
    if (ordenadas) orden.sort((x, y) => x.l.localeCompare(y.l, "es"));
    tablero.replaceChildren(
      ...orden.map(({ l, i }) => h(`button.ficha.rv-ficha${uso.has(i) ? ".usada" : ""}${gastadas.has(i) ? ".gastada" : ""}`, { type: "button", "data-i": i }, l.toUpperCase()))
    );
    ordenar.textContent = ordenadas ? "🔀" : "A-Z";
  }

  nuevoRevuelto();

  return {
    actualizar(e) {
      const nuevo = e.datos;
      if (!nuevo) return;
      const cambio = nuevo.i !== d.i;
      d = nuevo;
      if (d.anterior && d.anterior.n > anteriorVisto) {
        anteriorVisto = d.anterior.n;
        const an = d.anterior;
        const todas = an.resueltas.every(Boolean);
        aviso.className = `pl-aviso ${todas ? "ok" : ""}`;
        aviso.textContent = todas ? "✔ ¡Revuelto resuelto!" : `Eran: ${an.formas.map((f) => f.toUpperCase()).join(" y ")}`;
      }
      if (cambio) nuevoRevuelto();
      else if (d.actual) {
        // El servidor confirma con la palabra con tildes.
        d.actual.palabras.forEach((p, k) => p.resuelta && (resueltas[k] = p.resuelta));
        pintarMarcas();
        pintarTarjetas();
      }
    },
  };
}
