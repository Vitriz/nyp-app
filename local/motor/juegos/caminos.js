// Utilidades de cuadrícula compartidas por Hilo y Culebras: caminos que pasan por todas las casillas.

/** Vecinas (arriba, abajo, izquierda, derecha) de cada casilla de una cuadrícula filas×cols. */
export function vecinasDe(filas, cols) {
  const v = [];
  for (let k = 0; k < filas * cols; k++) {
    const r = Math.floor(k / cols), c = k % cols;
    const l = [];
    if (r > 0) l.push(k - cols);
    if (r < filas - 1) l.push(k + cols);
    if (c > 0) l.push(k - 1);
    if (c < cols - 1) l.push(k + 1);
    v.push(l);
  }
  return v;
}

/**
 * Un camino al azar que pasa una vez por cada casilla (camino hamiltoniano).
 * Se parte de un zigzag y se «muerde» muchas veces: se elige un extremo, una vecina suya y se da la
 * vuelta al trozo que queda entre ambas. Así sale un camino serpenteante y distinto cada vez.
 */
export function caminoCompleto(azar, filas, cols, pasos = 40) {
  const total = filas * cols;
  const vec = vecinasDe(filas, cols);
  let camino = [];
  for (let r = 0; r < filas; r++) for (let c = 0; c < cols; c++) camino.push(r * cols + (r % 2 ? cols - 1 - c : c));
  const pos = new Array(total);
  const indexar = () => camino.forEach((k, i) => (pos[k] = i));
  indexar();
  for (let it = 0; it < total * pasos; it++) {
    // Siempre por el final (si toca el principio, se da la vuelta entero).
    if (azar() < 0.5) {
      camino.reverse();
      indexar();
    }
    const fin = camino[total - 1];
    const x = azar.elegir(vec[fin]);
    const i = pos[x];
    if (i === total - 2) continue;
    // p0..pi, p_fin, ..., p_(i+1)
    const cola = camino.slice(i + 1).reverse();
    camino = camino.slice(0, i + 1).concat(cola);
    for (let j = i + 1; j < total; j++) pos[camino[j]] = j;
  }
  return camino;
}

export const claveMuro = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
