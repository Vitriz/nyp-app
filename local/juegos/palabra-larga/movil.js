// Palabra más larga · móvil: fichas de un solo uso, deshacer, borrar todo y comprobar.
import { h, botonMantener } from "../../comun/ui.js";

export function montar(cuerpo, e, ctx) {
  const letras = e.datos.letras;
  let elegidas = []; // índices de fichas, en orden
  let ultimoVisto = e.datos.ultimo?.n ?? 0;
  let listo = e.datos.listo;

  const respuesta = h("div.pl-respuesta");
  const aviso = h("div.pl-aviso");
  const mejor = h("div.pl-mejor");
  const fichas = letras.map((l, i) =>
    h("button.ficha.pl-ficha", { type: "button", "data-i": i }, l.toUpperCase())
  );
  const tablero = h("div.pl-tablero", fichas);

  const deshacer = h("button.boton.suave.icono-juego", { type: "button", onclick: () => quitar(elegidas.length - 1), "aria-label": "Deshacer" }, "↶");
  const borrar = botonMantener("🗑", () => {
    elegidas = [];
    pintar();
  }, { clase: ".suave.icono-juego", ms: 700 });
  borrar.setAttribute("aria-label", "Mantén para borrar todo");
  const comprobar = h("button.boton.acento.pl-comprobar", { type: "button", onclick: probar }, "Comprobar ✓");
  const terminar = botonMantener("Mantén para terminar", () => {
    ctx.enviar({ a: "listo" });
    marcarListo();
  }, { clase: ".suave.pl-terminar" });

  const raiz = h(
    "div.pl",
    h("div.pl-pie", mejor, terminar),
    // Lo que escribes, justo encima de las letras.
    h("div.pl-caja.tarjeta", respuesta, aviso),
    tablero,
    h("div.fila-acciones", deshacer, borrar, comprobar)
  );
  cuerpo.append(raiz);

  tablero.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest(".pl-ficha");
    if (!b || listo) return;
    ev.preventDefault();
    const i = Number(b.dataset.i);
    if (elegidas.includes(i)) return;
    elegidas.push(i);
    navigator.vibrate?.(8);
    pintar(i);
  });
  respuesta.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest(".ficha");
    if (!b || listo) return;
    quitar(Number(b.dataset.pos));
  });

  function quitar(pos) {
    if (pos < 0 || listo) return;
    elegidas.splice(pos, 1);
    pintar();
  }

  function pintar(nueva = null) {
    respuesta.replaceChildren(
      ...elegidas.map((i, pos) =>
        h(`span.ficha${i === nueva ? ".aparece" : ""}`, { "data-pos": pos }, letras[i].toUpperCase())
      )
    );
    if (!elegidas.length) respuesta.append(h("span.pl-hueco.suave", "Toca las letras"));
    fichas.forEach((f, i) => f.classList.toggle("usada", elegidas.includes(i)));
    deshacer.disabled = !elegidas.length || listo;
    comprobar.disabled = elegidas.length < 3 || listo;
    respuesta.style.setProperty("--n", Math.max(7, elegidas.length));
  }

  function probar() {
    if (elegidas.length < 3 || listo) return;
    ctx.enviar({ a: "probar", fichas: elegidas });
    aviso.className = "pl-aviso suave";
    aviso.textContent = "Comprobando…";
  }

  function mostrarResultado(u) {
    if (u.ok) {
      aviso.className = "pl-aviso ok";
      aviso.textContent = u.mejora ? `✔ ¡${u.forma.toUpperCase()} vale! ${u.palabra.length} letras` : `✔ Vale, pero ya tenías una más larga`;
      const r = respuesta.getBoundingClientRect();
      ctx.onda(r.left + r.width / 2, r.top + r.height / 2, 1);
      navigator.vibrate?.(20);
    } else {
      aviso.className = "pl-aviso mal";
      aviso.textContent = `✘ ${u.motivo}`;
      respuesta.classList.remove("sacudir");
      void respuesta.offsetWidth;
      respuesta.classList.add("sacudir");
      navigator.vibrate?.([30, 40, 30]);
    }
  }

  function pintarMejor(m) {
    mejor.replaceChildren(
      m ? h("span", "Tu mejor: ", h("b", m.forma.toUpperCase()), ` (${m.largo})`) : h("span.suave", "Aún sin palabra válida")
    );
  }

  function marcarListo() {
    listo = true;
    raiz.classList.add("listo");
    terminar.replaceWith(h("span.pl-hecho", "✔ ¡Hecho! Esperando a los demás"));
    pintar();
  }

  pintar();
  pintarMejor(e.datos.mejor);
  if (listo) marcarListo();

  return {
    actualizar(e) {
      const d = e.datos;
      if (!d) return;
      pintarMejor(d.mejor);
      if (d.ultimo && d.ultimo.n > ultimoVisto) {
        ultimoVisto = d.ultimo.n;
        mostrarResultado(d.ultimo);
      }
      if (d.listo && !listo) marcarListo();
    },
  };
}
