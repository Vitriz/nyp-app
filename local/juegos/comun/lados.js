// Ventana de juego común en horizontal (ordenador, tableta o móvil girado): a la izquierda, la información
// de la partida (marcador, listas, pistas, definiciones…); a la derecha, lo que se usa para jugar (tablero,
// fichas, teclado, botones). En vertical todo vuelve a su orden de siempre, en una sola columna.
//
// No se rehace nada: las mismas piezas (con sus eventos) se cambian de sitio al girar la pantalla.
import { h } from "../../comun/ui.js";

export const HORIZONTAL = "(orientation: landscape) and (min-width: 700px) and (min-aspect-ratio: 5/4)";

/**
 * raiz: el contenedor del juego (ya montado, con todas sus piezas como hijos directos).
 * info: las piezas que van a la izquierda (el resto, a la derecha, en el mismo orden).
 */
export function dosLados(raiz, info) {
  const orden = [...raiz.children];
  const izq = h("div.lado-info");
  const der = h("div.lado-juego");
  const mq = matchMedia(HORIZONTAL);
  const esInfo = new Set(info.filter(Boolean));
  let enDos = null; // cómo está ahora (null: aún sin colocar)
  const soltar = () => {
    mq.removeEventListener("change", aplicar);
    removeEventListener("resize", aplicar);
    removeEventListener("orientationchange", aplicar);
  };
  const aplicar = () => {
    // El juego ya se cerró: deja de escuchar.
    if (!raiz.isConnected && enDos !== null) return soltar();
    const dos = mq.matches && esInfo.size > 0;
    if (dos === enDos) return; // (al cambiar de tamaño sin girar, nada que mover)
    enDos = dos;
    if (dos) {
      izq.replaceChildren(...orden.filter((el) => esInfo.has(el)));
      der.replaceChildren(...orden.filter((el) => !esInfo.has(el)));
      raiz.replaceChildren(izq, der);
      raiz.classList.add("dos-lados");
    } else {
      raiz.replaceChildren(...orden);
      raiz.classList.remove("dos-lados");
    }
  };
  // Al girar el móvil o cambiar el tamaño de la ventana (algunos navegadores no avisan del cambio de «media»).
  mq.addEventListener("change", aplicar);
  addEventListener("resize", aplicar);
  addEventListener("orientationchange", aplicar);
  aplicar();
  return raiz;
}

/**
 * Igual, pero las piezas de la izquierda pueden ser elementos o selectores (de hijos directos de raiz).
 * Sin piezas: los datos y la leyenda de los puzles (.puzle-datos, .pc-leyenda).
 */
export function lados(raiz, ...piezas) {
  if (!piezas.length) piezas = [".puzle-datos", ".pc-leyenda"];
  const hijos = [...raiz.children];
  const info = piezas.flatMap((p) => (typeof p === "string" ? hijos.filter((el) => el.matches(p)) : [p]));
  return dosLados(raiz, info);
}
