// Diccionario de juego en el MÓVIL (modo solo). Misma interfaz que lexico.js,
// con los datos del paquete que el móvil descargó de PARTY. Se sirve como /motor/lexico.js.
import {
  LETRAS, clave, contar, indiceLetra, mascaraDe, letrasDeMascara,
  crearCandidatas, buscarPosibles, buscarDeConjunto, contarPalabras, escogerDefiniciones, pangramasDe,
} from "./lexico-base.js";

export { LETRAS, clave, contar, indiceLetra, mascaraDe, letrasDeMascara };

let validas = null; // Set de claves
let buenasPorClave = null;
let formas = {};
let definiciones = [];
let candidatas = null;
let pangramas = null;
let crucigrama = {};

/** Carga el paquete (objeto ya descomprimido). */
export function preparar(p) {
  const lista = p.claves.split("\n");
  validas = new Set(lista);
  buenasPorClave = { lista, buenas: p.buenas };
  formas = p.formas ?? {};
  definiciones = p.definiciones.map(([c, forma, nivel, categoria, definicion]) => ({
    clave: c, forma, nivel, categoria, definicion, palabras: contarPalabras(definicion),
  }));
  candidatas = null;
  pangramas = null;
  crucigrama = p.crucigrama ?? {};
}

export function cargarCrucigrama() {
  return crucigrama;
}

export function listo() {
  return Boolean(validas);
}

export function esValida(c) {
  return validas?.has(c) ?? false;
}

export function formaVisible(c) {
  return formas[c] ?? c;
}

export function cargarCandidatas() {
  if (candidatas) return candidatas;
  const { lista, buenas } = buenasPorClave;
  const entradas = [];
  for (let i = 0; i < lista.length; i++) {
    const c = lista[i];
    if (c.length >= 3 && c.length <= 14) entradas.push([c, buenas[i] === "1"]);
  }
  candidatas = crearCandidatas(entradas, entradas.length);
  return candidatas;
}

export function palabrasPosibles(letras, opciones) {
  return buscarPosibles(cargarCandidatas(), letras, opciones);
}

export function palabrasDeConjunto(mascara, bitCentro) {
  return buscarDeConjunto(cargarCandidatas(), mascara, bitCentro);
}

export function cargarDefiniciones() {
  return definiciones;
}

export function elegirDefiniciones(azar, n, opciones) {
  return escogerDefiniciones(definiciones, azar, n, opciones);
}

export function pangramasPosibles() {
  return (pangramas ??= pangramasDe(definiciones));
}
