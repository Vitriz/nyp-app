// Hilo · móvil: arrastra desde el 1 y pasa por los números en orden hasta llenar el tablero.
// Volver hacia atrás por el mismo hilo lo deshace; tocar cualquier punto del hilo lo corta ahí.
import { h, botonMantener, confeti } from "../../comun/ui.js";
import { seguirDedo, avisoBreve } from "../comun/trazo.js";
import { crearTablero } from "./rejilla.js";

export function montar(cuerpo, e, ctx) {
  const d = e.datos;
  const n = d.n, total = n * n;
  const numeros = new Map(d.numeros);
  const muros = new Set(d.muros);
  const ultimo = Math.max(...numeros.values());
  const inicio = [...numeros].find(([, v]) => v === 1)[0];
  let camino = d.camino?.length ? [...d.camino] : [inicio];
  let acabado = Boolean(d.resuelto);
  let enviado = JSON.stringify(camino);

  const tablero = crearTablero(d);
  const aviso = h("div.pl-aviso.suave", "Arrastra desde el 1 y pasa por todas las casillas");
  const decir = avisoBreve(aviso);
  const cuentaNum = h("b", "");
  const cuentaCas = h("b", "");
  const deshacer = h("button.boton.suave", { type: "button", onclick: () => cambiar(camino.slice(0, Math.max(1, camino.length - 1)), true) }, "↶ Deshacer");
  const borrar = botonMantener("Empezar de nuevo", () => cambiar([inicio], true), { clase: ".suave", ms: 600 });
  cuerpo.append(
    h(
      "div.hilo-pantalla",
      h("div.puzle-datos", h("span", "Siguiente ", cuentaNum), h("span", "Casillas ", cuentaCas)),
      h("div.puzle-zona", tablero.el),
      aviso,
      h("div.puzle-botones", deshacer, borrar)
    )
  );

  const ady = (a, b) => ((Math.abs(a - b) === 1 && Math.floor(a / n) === Math.floor(b / n)) || Math.abs(a - b) === n) && !muros.has(a < b ? `${a}-${b}` : `${b}-${a}`);
  const siguienteNum = (c) => c.filter((k) => numeros.has(k)).length + 1;

  function pintar() {
    const sig = siguienteNum(camino);
    cuentaNum.textContent = sig > ultimo ? "✔" : String(sig);
    cuentaCas.textContent = `${camino.length}/${total}`;
    tablero.pintar(camino, { completo: acabado });
    deshacer.disabled = acabado || camino.length < 2;
  }

  function enviar() {
    const t = JSON.stringify(camino);
    if (t === enviado) return;
    enviado = t;
    ctx.enviar({ a: "camino", c: camino });
  }

  function cambiar(nuevo, mandar = false) {
    if (acabado) return;
    camino = nuevo;
    pintar();
    if (camino.length === total && siguienteNum(camino) > ultimo) {
      acabado = true;
      pintar();
      enviar();
      navigator.vibrate?.([30, 50, 90]);
      confeti?.();
      decir("¡Completo!", "bien", 0);
      return;
    }
    if (mandar) enviar();
  }

  /** Intentar ir a la casilla k desde la punta del hilo. */
  function ir(k) {
    const i = camino.indexOf(k);
    if (i >= 0) {
      // Volver atrás por el hilo: se corta en esa casilla.
      if (i < camino.length - 1) {
        navigator.vibrate?.(4);
        cambiar(camino.slice(0, i + 1));
      }
      return;
    }
    const punta = camino[camino.length - 1];
    if (!ady(punta, k)) return;
    const num = numeros.get(k);
    if (num != null && num !== siguienteNum(camino)) {
      decir(`Primero el ${siguienteNum(camino)}`, "mal");
      return;
    }
    if (num === ultimo && camino.length + 1 < total) {
      decir(`El ${ultimo} es el final: antes pasa por todas las casillas`, "mal");
      return;
    }
    navigator.vibrate?.(5);
    cambiar([...camino, k]);
  }

  seguirDedo(tablero.el, n, n, {
    empezar(k) {
      if (acabado) return false;
      const i = camino.indexOf(k);
      if (i >= 0) {
        if (i < camino.length - 1) cambiar(camino.slice(0, i + 1));
        return true;
      }
      // Tocar una casilla junto a la punta también vale.
      ir(k);
      return camino[camino.length - 1] === k;
    },
    mover: ir,
    soltar: () => enviar(),
    cancelar: () => enviar(),
  });

  pintar();
  return {
    actualizar(e) {
      if (e.datos?.resuelto && !acabado) {
        acabado = true;
        pintar();
      }
    },
    desmontar() {},
  };
}
