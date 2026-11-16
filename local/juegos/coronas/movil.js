// Coronas · móvil: un toque pone ✕, dos ponen la corona, tres la quitan. Arrastrando el dedo se van
// poniendo ✕ por donde pasa (o se quitan, si empezaste en una ✕). Las coronas que chocan salen en rojo.
import { h, botonMantener, confeti } from "../../comun/ui.js";
import { seguirDedo, avisoBreve } from "../comun/trazo.js";
import { crearTablero, choques } from "./rejilla.js";
import { dosLados, lados } from "../comun/lados.js";

export function montar(cuerpo, e, ctx) {
  const d = e.datos;
  const n = d.n;
  let marcas = d.marcas?.length ? [...d.marcas] : new Array(n * n).fill(0);
  let acabado = Boolean(d.resuelto);
  const historia = [];
  let enviado = JSON.stringify(marcas);

  const tablero = crearTablero(d);
  const aviso = h("div.pl-aviso.suave", "Una 👑 en cada fila, columna y color, sin tocarse");
  const decir = avisoBreve(aviso);
  const cuenta = h("b", "");
  const deshacer = h("button.boton.suave", { type: "button", onclick: () => historia.length && cambiar(historia.pop(), true, false) }, "↶ Deshacer");
  const borrar = botonMantener("Borrar todo", () => cambiar(new Array(n * n).fill(0), true), { clase: ".suave", ms: 600 });
  // Pistas (solo): ponen una pieza de la solución. quedanPistas: null si no hay (Batalla).
  let quedanPistas = d.quedanPistas ?? null;
  let pistasVistas = (d.pistas ?? []).length;
  const pista = h("button.boton.suave", { type: "button", onclick: () => !acabado && quedanPistas && ctx.enviar({ a: "pista" }) });
  const pintarPista = () => {
    pista.textContent = `💡 Pista · ${quedanPistas}`;
    pista.disabled = acabado || !quedanPistas;
  };

  cuerpo.append(
    lados(
      h(
        "div.cor-pantalla",
        h("div.puzle-datos", h("span", "Coronas ", cuenta)),
        h("div.puzle-zona", tablero.el),
        aviso,
        h("div.puzle-botones", deshacer, borrar, quedanPistas != null ? pista : null)
      )
    )
  );

  function pintar() {
    const coronas = marcas.flatMap((m, k) => (m === 2 ? [k] : []));
    const malas = choques(n, d.zona, coronas);
    tablero.pintar(marcas, malas);
    cuenta.textContent = `${coronas.length}/${n}`;
    deshacer.disabled = acabado || !historia.length;
    tablero.el.classList.toggle("completo", acabado);
    if (quedanPistas != null) pintarPista();
    return { coronas, malas };
  }

  function enviar() {
    const t = JSON.stringify(marcas);
    if (t === enviado) return;
    enviado = t;
    ctx.enviar({ a: "marcas", m: marcas });
  }

  function cambiar(nuevo, mandar = true, guardar = true) {
    if (acabado) return;
    if (guardar) historia.push(marcas);
    if (historia.length > 200) historia.shift();
    marcas = nuevo;
    const { coronas, malas } = pintar();
    if (coronas.length === n && !malas.size) {
      acabado = true;
      pintar();
      enviar();
      navigator.vibrate?.([30, 50, 90]);
      confeti?.();
      decir("¡Resuelto!", "bien", 0);
      return;
    }
    if (malas.size && coronas.length) decir("Esas coronas chocan", "mal", 1400);
    if (mandar) enviar();
  }

  // Toque: ciclo vacío → ✕ → corona → vacío. Arrastre: pinta ✕ (o las borra si empezaste en una ✕).
  let modo = null, antes = null, inicioK = -1;
  seguirDedo(tablero.el, n, n, {
    empezar(k) {
      if (acabado) return false;
      inicioK = k;
      antes = marcas;
      modo = marcas[k] === 1 ? "quitar" : marcas[k] === 0 ? "poner" : null;
      return true;
    },
    mover(k) {
      if (!modo) return;
      const nuevo = [...marcas];
      // Al empezar a arrastrar, la primera casilla también cuenta.
      for (const x of [inicioK, k]) {
        if (modo === "poner" && nuevo[x] === 0) nuevo[x] = 1;
        if (modo === "quitar" && nuevo[x] === 1) nuevo[x] = 0;
      }
      if (nuevo.some((m, i) => m !== marcas[i])) {
        navigator.vibrate?.(3);
        marcas = nuevo;
        pintar();
      }
    },
    soltar(k, seMovio) {
      if (!seMovio) {
        const nuevo = [...marcas];
        nuevo[inicioK] = (nuevo[inicioK] + 1) % 3;
        navigator.vibrate?.(nuevo[inicioK] === 2 ? 12 : 5);
        cambiar(nuevo);
      } else if (antes) {
        // El arrastre entero se deshace de una vez.
        const hecho = marcas;
        marcas = antes;
        cambiar(hecho);
      }
      antes = null;
      modo = null;
    },
    cancelar() {
      if (antes) {
        marcas = antes;
        pintar();
      }
      antes = null;
      modo = null;
    },
  });

  pintar();
  return {
    actualizar(e) {
      if (e.datos?.quedanPistas != null) quedanPistas = e.datos.quedanPistas;
      // Una pista nueva: el servidor ya puso la corona; se toma su tablero (y se puede deshacer).
      if ((e.datos?.pistas ?? []).length > pistasVistas) {
        pistasVistas = e.datos.pistas.length;
        enviado = JSON.stringify(e.datos.marcas);
        cambiar([...e.datos.marcas], false);
        decir("💡 Ahí va una corona", "bien", 1400);
      }
      pintar();
      if (e.datos?.resuelto && !acabado) {
        acabado = true;
        pintar();
      }
    },
    desmontar() {},
  };
}
