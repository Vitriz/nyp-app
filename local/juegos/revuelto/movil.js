// Revuelto · móvil: dos definiciones con sus casillas y las letras mezcladas (de un solo uso).
// Tocas una definición para elegirla y las letras van directo a sus casillas; al llenarlas se comprueba.
import { h, botonMantener } from "../../comun/ui.js";
import { huella, reiniciarAnim, clave } from "../comun/util.js";
import { teclasFisicas, sinTilde, ES_LETRA } from "../../comun/teclas.js";

const COLORES = ["#5fb7d0", "#e7a05c"];

export function montar(cuerpo, e, ctx) {
  let d = e.datos;
  let anteriorVisto = d.anterior?.n ?? -1;
  let activa = 0; // definición en la que se está escribiendo
  let puestas = [[], []]; // índices de fichas en cada definición
  let resueltas = [null, null]; // palabra resuelta (forma) por definición
  let gastadas = new Set();
  let ordenadas = false;

  const contador = h("span.ficha", "0");
  const numero = h("span.suave");
  const tarjetas = h("div.rv-defs");
  const aviso = h("div.pl-aviso");
  const tablero = h("div.rv-letras");
  const ordenar = h("button.boton.suave.icono-juego", { type: "button", onclick: () => ((ordenadas = !ordenadas), pintarFichas()), "aria-label": "Ordenar letras" }, "A-Z");
  const deshacer = h("button.boton.suave.icono-juego", { type: "button", onclick: () => (puestas[activa].pop(), pintar()), "aria-label": "Deshacer" }, "↶");
  const borrar = botonMantener("🗑", () => ((puestas[activa] = []), pintar()), { clase: ".suave.icono-juego", ms: 600 });
  borrar.setAttribute("aria-label", "Mantén para borrar");
  const pasar = h("button.boton.suave.icono-juego", { type: "button", onclick: () => ctx.enviar({ a: "pasar", i: d.i }), "aria-label": "Pasar" }, "➜");

  cuerpo.append(
    // Lo mínimo: definiciones con sus casillas arriba; letras y botones abajo, bajo el pulgar.
    h("div.rv2", tarjetas, aviso, tablero, h("div.fila-acciones", deshacer, borrar, ordenar, pasar))
  );

  // --- toques
  tarjetas.addEventListener("pointerdown", (ev) => {
    const t = ev.target.closest(".rv-tarjeta");
    if (!t) return;
    const k = Number(t.dataset.k);
    const casilla = ev.target.closest(".rv-casilla.llena");
    if (casilla && k === activa) {
      puestas[k].splice(Number(casilla.dataset.pos), 1); // devolver esa letra
    } else if (!resueltas[k]) activa = k;
    pintar();
  });
  tablero.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest(".rv-ficha");
    if (!b) return;
    ev.preventDefault();
    const i = Number(b.dataset.i);
    const a = d.actual;
    if (!a || resueltas[activa] || enUso().has(i) || puestas[activa].length >= a.palabras[activa].largo) return;
    puestas[activa].push(i);
    navigator.vibrate?.(8);
    pintar();
    if (puestas[activa].length === a.palabras[activa].largo) comprobar(activa);
  });

  // Teclado del ordenador: letras a las casillas; ↑ ↓ o Tab cambian de definición.
  teclasFisicas(tablero, (t) => {
    const a = d.actual;
    if (!a) return false;
    if (t === "ArrowUp" || t === "ArrowDown" || t === "Tab") {
      const otra = 1 - activa;
      if (!resueltas[otra]) activa = otra;
      return pintar();
    }
    if (t === "⌫") return (puestas[activa].pop(), pintar());
    if (!ES_LETRA.test(t) || resueltas[activa] || puestas[activa].length >= a.palabras[activa].largo) return false;
    const uso = enUso();
    const i = a.letras.findIndex((l, k) => l === sinTilde(t) && !uso.has(k));
    if (i < 0) {
      const c = tarjetas.querySelector(`[data-k="${activa}"] .rv-casillas`);
      if (c) reiniciarAnim(c, "sacudir");
      return;
    }
    puestas[activa].push(i);
    pintar();
    if (puestas[activa].length === a.palabras[activa].largo) comprobar(activa);
  });

  function enUso() {
    return new Set([...gastadas, ...puestas[0], ...puestas[1]]);
  }

  function comprobar(k) {
    const a = d.actual;
    const palabra = puestas[k].map((i) => a.letras[i]).join("");
    if (huella(palabra) === a.palabras[k].h) {
      resueltas[k] = palabra;
      puestas[k].forEach((i) => gastadas.add(i));
      puestas[k] = [];
      aviso.className = "pl-aviso ok";
      aviso.textContent = `✔ ¡${palabra.toUpperCase()}!`;
      navigator.vibrate?.(20);
      ctx.enviar({ a: "respuesta", i: d.i, texto: palabra });
      activa = resueltas[1 - k] ? k : 1 - k;
      pintar();
    } else {
      aviso.className = "pl-aviso mal";
      aviso.textContent = "✘ No es esa palabra";
      const t = tarjetas.querySelector(`[data-k="${k}"] .rv-casillas`);
      if (t) reiniciarAnim(t, "sacudir");
      navigator.vibrate?.([30, 40, 30]);
    }
  }

  // --- pintar
  function nuevoRevuelto() {
    puestas = [[], []];
    resueltas = [null, null];
    gastadas = new Set();
    const a = d.actual;
    contador.textContent = d.aciertos;
    if (!a) {
      tarjetas.replaceChildren(h("p.df-texto", "¡Has terminado todos los revueltos!"));
      tablero.replaceChildren();
      return;
    }
    numero.textContent = `· revuelto ${d.i + 1}`;
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
    activa = resueltas[0] ? 1 : 0;
    pintar(true);
  }

  function pintar(animar = false) {
    pintarTarjetas(animar);
    pintarFichas();
  }

  function pintarTarjetas(animar = false) {
    const a = d.actual;
    if (!a) return;
    tarjetas.replaceChildren(
      ...a.palabras.map((p, k) => {
        const sol = resueltas[k];
        const casillas = [];
        for (let pos = 0; pos < p.largo; pos++) {
          const i = puestas[k][pos];
          const letra = sol ? clave(sol)[pos] : i != null ? a.letras[i] : null;
          casillas.push(h(`span.rv-casilla${letra ? ".llena" : ""}`, { "data-pos": pos }, letra ? letra.toUpperCase() : ""));
        }
        return h(
          `div.rv-tarjeta.tarjeta${k === activa && !sol ? ".activa" : ""}${sol ? ".resuelta" : ""}${animar ? ".aparece" : ""}`,
          { "data-k": k, style: { "--c": COLORES[k], animationDelay: `${k * 120}ms` } },
          h("div.rv-cabeza", h("span.rv-num", String(k + 1)), h("span.rv-cat", p.categoria)),
          h("p.rv-def", sol ? `✔ ${sol.toUpperCase()}` : p.definicion),
          h("div.rv-casillas", { style: { "--n": Math.max(6, p.largo) } }, casillas)
        );
      })
    );
  }

  function pintarFichas() {
    const a = d.actual;
    if (!a) return;
    const uso = enUso();
    const orden = a.letras.map((l, i) => ({ l, i }));
    if (ordenadas) orden.sort((x, y) => x.l.localeCompare(y.l, "es"));
    tablero.style.setProperty("--cols", a.letras.length > 12 ? 7 : 6);
    tablero.replaceChildren(
      ...orden.map(({ l, i }) => h(`button.ficha.rv-ficha${uso.has(i) ? ".usada" : ""}${gastadas.has(i) ? ".gastada" : ""}`, { type: "button", "data-i": i }, l.toUpperCase()))
    );
    ordenar.textContent = ordenadas ? "🔀" : "A-Z";
    deshacer.disabled = !puestas[activa].length;
  }

  nuevoRevuelto();

  return {
    actualizar(e) {
      const nuevo = e.datos;
      if (!nuevo) return;
      const cambio = nuevo.i !== d.i;
      d = nuevo;
      contador.textContent = d.aciertos;
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
        pintarTarjetas();
      }
    },
  };
}
