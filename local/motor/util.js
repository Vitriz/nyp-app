// Utilidades compartidas del servidor.

/** Tiempos de las pruebas (en segundos). 0 = sin límite. */
export const TIEMPOS = [30, 45, 60, 120, 0]; // (sin 90 s)
/** Sin límite: la ronda dura hasta que todos acaban (con un tope muy largo por si acaso). */
export const SIN_LIMITE_MS = 12 * 3600 * 1000;
export const msDuracion = (s) => (s > 0 ? s * 1000 : SIN_LIMITE_MS);

/** Generador pseudoaleatorio reproducible (mulberry32). */
/** Dificultad de la partida: -1 fácil, 0 normal, 1 difícil. */
export function nivelDificultad(config) {
  return { facil: -1, normal: 0, dificil: 1 }[config?.dificultad] ?? 0;
}

/**
 * Reglas de «Jugar solo» (sin reloj, o con contrarreloj): cuántos fallos acaban la partida, cuántas veces se
 * puede pasar y cuántas pistas hay, por nivel [fácil, medio, difícil]. null = sin límite (en fácil, en los
 * tableros, no se pierde por fallos). En Batalla (con varios jugadores) no hay límites: manda el reloj.
 */
export const REGLAS_SOLO = {
  definicion: { fallos: [2, 2, 2], pases: [3, 2, 1], pistas: [3, 2, 1] },
  revuelto: { fallos: [5, 4, 3], pases: [3, 2, 1], pistas: [3, 2, 1] },
  sopa: { fallos: [null, 10, 6], pistas: [3, 2, 1] },
  crucigrama: { fallos: [null, 10, 6], pistas: [5, 3, 1] },
  conexiones: { fallos: [null, 8, 4] },
  memoria: { fallos: [5, 3, 2] },
  "mates-fugaces": { fallos: [5, 3, 2], pases: [3, 2, 1] },
  // Puzles: pistas que colocan una pieza de la solución (no se pierde por fallos).
  kenken: { pistas: [3, 2, 1] },
  coronas: { pistas: [3, 2, 1] },
  parcelas: { pistas: [3, 2, 1] },
  hilo: { pistas: [3, 2, 1] },
  laberinto: { pistas: [3, 2, 1] },
  culebras: { fallos: [null, 10, 6], pistas: [3, 2, 1] },
};

/** Las reglas de un juego en esta partida: { fallos, pases, pistas } (null = sin límite). Fuera del modo solo, {}. */
export function reglasSolo(juego, config) {
  const r = config?.solo ? REGLAS_SOLO[juego] : null;
  if (!r) return {};
  const i = nivelDificultad(config) + 1;
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v[i]]));
}

/** ¿Queda alguna? (límite null o sin definir = sin límite) */
export const quedan = (limite, usadas) => limite == null || usadas < limite;
/** Cuántas quedan (o null si no hay límite). */
export const restan = (limite, usadas) => (limite == null ? null : Math.max(0, limite - usadas));

export function crearAzar(semilla = Date.now()) {
  let a = semilla >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.entero = (min, max) => min + Math.floor(r() * (max - min + 1));
  r.elegir = (lista) => lista[Math.floor(r() * lista.length)];
  r.barajar = (lista) => {
    const l = [...lista];
    for (let i = l.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [l[i], l[j]] = [l[j], l[i]];
    }
    return l;
  };
  return r;
}

/**
 * Ordena resultados y asigna puestos. Los empates comparten puesto (1, 1, 3…).
 * entradas: [{ id, valor, texto }]; valor null = no participó.
 */
export function clasificar(entradas, { mayorEsMejor = true } = {}) {
  const validas = entradas.filter((e) => e.valor != null);
  const sin = entradas.filter((e) => e.valor == null);
  validas.sort((a, b) => (mayorEsMejor ? b.valor - a.valor : a.valor - b.valor));
  let puesto = 0;
  validas.forEach((e, i) => {
    if (i === 0 || e.valor !== validas[i - 1].valor) puesto = i + 1;
    e.puesto = puesto;
  });
  sin.forEach((e) => (e.puesto = null));
  return [...validas, ...sin];
}

export function limpiarNombre(texto) {
  return String(texto ?? "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 14);
}

/** Huella corta de una palabra (FNV-1a). El móvil compara huellas para responder al instante sin recibir la solución en claro. */
export function huella(texto) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}
