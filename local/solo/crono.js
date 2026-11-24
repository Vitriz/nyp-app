// Contrarreloj (modo solo): cada juego tiene su tiempo según el nivel, para que la prueba esté pensada para
// él (un KenKen difícil necesita más tiempo que unas Mates fugaces fáciles). Segundos: [fácil, medio, difícil].
const TIEMPO_CRONO = {
  "palabra-larga": [60, 75, 90],
  definicion: [60, 75, 90],
  sopa: [120, 150, 180],
  revuelto: [90, 120, 150],
  paraulogico: [120, 150, 180],
  crucigrama: [240, 300, 360],
  conexiones: [120, 150, 180],
  semantica: [180, 240, 300],
  culebras: [90, 120, 180],
  memoria: [90, 120, 150],
  "calculo-mental": [60, 75, 90],
  "llegar-resultado": [60, 90, 120],
  "mates-fugaces": [45, 60, 75],
  laberinto: [90, 120, 180],
  kenken: [90, 150, 240],
  hilo: [60, 90, 150],
  coronas: [90, 150, 210],
  parcelas: [90, 150, 210],
};
const NIVEL = { facil: 0, normal: 1, dificil: 2 };

/** Segundos del contrarreloj de un juego en un nivel. */
export function tiempoCrono(id, nivel = "normal") {
  return (TIEMPO_CRONO[id] ?? [60, 90, 120])[NIVEL[nivel] ?? 1];
}
