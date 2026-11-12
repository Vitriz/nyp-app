// Catálogo de juegos. Los que aún no tienen implementación aparecen como "próximamente".
import matesFugaces from "./mates-fugaces.js";
import palabraLarga from "./palabra-larga.js";
import definicion from "./definicion.js";
import sopa from "./sopa.js";
import revuelto from "./revuelto.js";
import paraulogico from "./paraulogico.js";
import calculoMental from "./calculo-mental.js";
import llegarResultado from "./llegar-resultado.js";
import laberinto from "./laberinto.js";
import pulsador from "./pulsador.js";

/*
 Interfaz de un juego (servidor):
   id, nombre, categoria ('palabras'|'numeros'), duracion (s), descripcion
   crear({ azar, config })            -> ronda (estado privado del servidor)
   vistaJugador(ronda, id)            -> datos para el móvil de ese jugador
   vistaTV(ronda)                     -> datos para la TV mientras se juega
   accion(ronda, id, msg)             -> true si cambió algo
   terminado(ronda, id)               -> true si ese jugador ya no puede hacer más
   resultados(ronda, ids)             -> [{ id, valor, texto }]  (valor mayor = mejor; null = no jugó)
   resumen(ronda)                     -> datos para enseñar la solución en la TV (o null)
*/

const implementados = Object.fromEntries(
  [matesFugaces, palabraLarga, definicion, sopa, revuelto, paraulogico, calculoMental, llegarResultado, laberinto, pulsador].map((j) => [j.id, j])
);

const catalogo = [
  { id: "palabra-larga", nombre: "Palabra más larga", categoria: "palabras", duracion: 45 },
  { id: "definicion", nombre: "Definición", categoria: "palabras", duracion: 60 },
  { id: "sopa", nombre: "Sopa de letras", categoria: "palabras", duracion: 90 },
  { id: "revuelto", nombre: "Revuelto", categoria: "palabras", duracion: 60 },
  { id: "paraulogico", nombre: "Paraulógico", categoria: "palabras", duracion: 120 },
  { id: "calculo-mental", nombre: "Cálculo mental", categoria: "numeros", duracion: 30 },
  { id: "llegar-resultado", nombre: "Llegar al resultado", categoria: "numeros", duracion: 60 },
  { id: "mates-fugaces", nombre: "Mates fugaces", categoria: "numeros", duracion: 60 },
  { id: "laberinto", nombre: "Laberinto de cálculos", categoria: "numeros", duracion: 120 },
  { id: "pulsador", nombre: "Pulsador", categoria: "pulsador", duracion: 180 },
];

export function listaJuegos() {
  return catalogo.map((j) => ({
    ...j,
    duracion: implementados[j.id]?.duracion ?? j.duracion,
    descripcion: implementados[j.id]?.descripcion ?? "",
    disponible: Boolean(implementados[j.id]),
  }));
}

export function obtenerJuego(id) {
  return implementados[id] ?? null;
}

export function juegosDisponibles() {
  return Object.keys(implementados);
}
