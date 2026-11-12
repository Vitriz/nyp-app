// Revuelto · TV: palabras encontradas por cada jugador; al final, las soluciones.
import { h } from "../../comun/ui.js";
import { tarjetasJugadores } from "../comun/util.js";
export { resumen } from "../definicion/tv.js";

export function montar(cuerpo, e, ctx) {
  cuerpo.append(h("p.descripcion.tv-ayuda", "Cada uno resuelve sus revueltos en el móvil: dos definiciones, letras mezcladas."));
  const actualizar = tarjetasJugadores(cuerpo, ctx, (e, id) => {
    const n = e.datos?.jugadores?.[id];
    return n == null ? null : { valor: n };
  });
  actualizar(e);
  return { actualizar };
}
