// CONEXIONES · 16 palabras desordenadas que forman 4 grupos de 4 con algo en común (aves, términos de
// Música, palabras que esconden un animal…). Se eligen 4 y se comprueba; con 4 fallos se acaba el tablero.
// Al terminar uno sale otro. Todos reciben los mismos tableros. Gana quien encuentre más grupos.
// Ninguna palabra del tablero encaja en otro de sus grupos (se mira con TODOS sus significados).
import { cargarConexiones, cargarDefiniciones, clave } from "../lexico.js";
import { nivelDificultad } from "../util.js";

const TABLEROS = 6;
const FALLOS = 4;

// Grupos que salen de cómo se escribe la palabra (se comprueban con código).
const ANIMALES = ["gato", "perro", "oso", "toro", "pato", "rata", "mono", "leon", "vaca", "lobo", "foca", "gallo", "cabra", "pavo", "cerdo", "mula", "loro", "puma", "ganso", "pez"];
const NUMEROS = ["uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "cien", "mil"];
const COLORES_ESC = ["rojo", "azul", "verde", "gris", "rosa", "negro", "blanco", "morado"];
const CUERPO = ["mano", "pie", "ojo", "codo", "boca", "cara", "pelo", "dedo", "oreja", "nariz", "brazo", "pierna", "cuello", "diente"];
const NOTAS = ["do", "re", "mi", "fa", "sol", "la", "si"];
const sinTilde = (c) => c.normalize("NFD").replace(/[̀-ͯ]/g, "");
const escondida = (lista) => (c) => {
  const s = sinTilde(c);
  return lista.some((x) => s !== x && s.length >= x.length + 2 && s.includes(x));
};
const FORMAS = [
  { nombre: "Esconden un animal", es: escondida(ANIMALES) },
  { nombre: "Esconden un número", es: escondida(NUMEROS) },
  { nombre: "Llevan las cinco vocales", es: (c) => [..."aeiou"].every((v) => sinTilde(c).includes(v)) },
  { nombre: "Solo tienen la vocal A", es: (c) => sinTilde(c).length >= 5 && /a/.test(c) && !/[eiouáéíóúü]/.test(c) },
  { nombre: "Se leen igual al revés", es: (c) => c.length >= 3 && c === [...c].reverse().join("") },
  { nombre: "Empiezan y acaban igual", es: (c) => c.length >= 5 && sinTilde(c)[0] === sinTilde(c).at(-1) && !/^(.)\\1/.test(c) },
  { nombre: "Esconden un color", es: escondida(COLORES_ESC) },
  { nombre: "Esconden una parte del cuerpo", es: escondida(CUERPO) },
  { nombre: "Empiezan por una nota musical", es: (c) => c.length >= 5 && NOTAS.some((n) => sinTilde(c).startsWith(n)) && !NOTAS.includes(sinTilde(c)) },
  { nombre: "Llevan dos vocales iguales seguidas", es: (c) => /(aa|ee|ii|oo|uu)/.test(sinTilde(c)) && !/[wk]/.test(c) },
];

// Grupos de tema hechos a mano (más reconocibles que los de los ámbitos del diccionario).
const A_MANO = {
  "Cosas de la cocina": ["sartén", "cazo", "olla", "cuchara", "tenedor", "cuchillo", "colador", "rallador", "batidora", "cazuela"],
  "Partes de una casa": ["cocina", "salón", "baño", "tejado", "ventana", "pasillo", "terraza", "sótano", "desván", "balcón"],
  "Deportes": ["fútbol", "tenis", "golf", "rugby", "judo", "boxeo", "esquí", "ciclismo", "natación", "atletismo"],
  "Colores": ["rojo", "azul", "verde", "amarillo", "naranja", "morado", "marrón", "negro", "blanco", "gris"],
  "Juegos de mesa": ["ajedrez", "parchís", "damas", "dominó", "oca", "mus", "bingo", "dados", "naipes"],
  "Cosas del colegio": ["pizarra", "tiza", "mochila", "estuche", "lápiz", "goma", "regla", "cuaderno", "recreo", "pupitre"],
  "Se ven en el cielo": ["nube", "luna", "estrella", "cometa", "rayo", "arcoíris", "avión", "pájaro", "globo"],
  "Profesiones": ["médico", "bombero", "cartero", "pintor", "cocinero", "panadero", "maestro", "juez", "abogado", "carpintero"],
  "En la playa": ["arena", "toalla", "sombrilla", "ola", "concha", "castillo", "cubo", "pala", "bañador", "crema"],
  "Instrumentos de música": ["guitarra", "piano", "violín", "flauta", "tambor", "trompeta", "arpa", "batería", "saxofón", "acordeón"],
  "Medios de transporte": ["coche", "tren", "barco", "avión", "bicicleta", "moto", "autobús", "metro", "taxi", "tranvía"],
  "El tiempo que hace": ["lluvia", "nieve", "viento", "niebla", "granizo", "tormenta", "rayo", "calor", "frío"],
};
const TEMAS_A_MANO = Object.entries(A_MANO).map(([nombre, formas]) => {
  const palabras = formas.map((f) => [clave(f), f, 1]);
  return { nombre, tipo: "tema", mano: true, claves: new Set(palabras.map((p) => p[0])), palabras };
});

// Palabras cuyo primer significado sorprende demasiado (no se ponen en el tablero).
const RARAS = new Set(["mistico", "conejito", "champan", "maya", "enviada", "escondido", "vito", "celia", "cristina", "enrique", "napoleon", "rara", "pillo", "ganga", "reclamo", "corea", "medianoche"]);

/** ¿La palabra encaja en la categoría? (por cualquiera de sus significados, o por cómo se escribe) */
function encaja(cat, c, miembros) {
  if (cat.es) return cat.es(c);
  if (cat.mano) return cat.claves.has(c);
  return (miembros[c] ?? []).includes(cat.nombre);
}

/** Cómo de difícil es un grupo (para su color: amarillo el más fácil … lila el más difícil). */
const dificultadDe = (cat, niveles) => ({ clase: 0, tema: cat.mano ? 0.6 : 1.2, forma: 2.2 }[cat.tipo] ?? 1) + (niveles.reduce((s, n) => s + (n ?? 1), 0) / niveles.length) * 0.3;

function tablero(azar, d, datos, comunes) {
  const { categorias, miembros } = datos;
  const clases = categorias.filter((c) => c.tipo === "clase");
  // Los temas hechos a mano salen más a menudo que los del diccionario.
  const temas = [...categorias.filter((c) => c.tipo === "tema"), ...TEMAS_A_MANO, ...TEMAS_A_MANO];
  // Formas: sus palabras salen de las comunes que cumplen la regla.
  const formas = FORMAS.map((f) => ({ ...f, tipo: "forma", palabras: comunes.filter((x) => f.es(x[0])) })).filter((f) => f.palabras.length >= 8);
  // Fácil: 4 clases. Medio: 3 clases y 1 tema o forma. Difícil: 2 clases, 1 tema y 1 forma.
  const receta = [["clase", "clase", "clase", "clase"], ["clase", "clase", "clase", azar() < 0.5 ? "tema" : "forma"], ["clase", "clase", "tema", "forma"]][d + 1];
  const nivelMax = d < 0 ? 1 : 2;
  for (let intento = 0; intento < 60; intento++) {
    const elegidas = [];
    for (const tipo of receta) {
      const lista = (tipo === "clase" ? clases : tipo === "tema" ? temas : formas).filter((c) => !elegidas.includes(c));
      if (lista.length) elegidas.push(azar.elegir(lista));
    }
    if (elegidas.length < 4) continue;
    const usadas = new Set();
    const grupos = [];
    for (const cat of elegidas) {
      const otras = elegidas.filter((c) => c !== cat);
      const candidatas = azar.barajar(cat.palabras.filter(([c, , niv]) => niv <= nivelMax && !usadas.has(c) && !RARAS.has(sinTilde(c)) && !otras.some((o) => encaja(o, c, miembros))));
      if (candidatas.length < 4) break;
      // En fácil y medio, primero las palabras más comunes (las raras solo si no hay bastantes).
      if (d <= 0) candidatas.sort((a, b) => a[2] - b[2]);
      const cuatro = candidatas.slice(0, 4);
      cuatro.forEach(([c]) => usadas.add(c));
      grupos.push({ nombre: cat.nombre, palabras: cuatro.map(([c, forma]) => ({ clave: c, forma })), dif: dificultadDe(cat, cuatro.map((x) => x[2])) });
    }
    if (grupos.length < 4) continue;
    // Color por dificultad: 0 amarillo (el más fácil), 1 verde, 2 azul, 3 lila (el más difícil).
    [...grupos].sort((a, b) => a.dif - b.dif).forEach((g, k) => (g.color = k));
    const palabras = azar.barajar(grupos.flatMap((g, i) => g.palabras.map((p) => ({ ...p, g: i }))));
    return { grupos, palabras };
  }
  return null;
}

export default {
  id: "conexiones",
  nombre: "Conexiones",
  categoria: "palabras",
  duracion: 120,
  sinDiccionario: true, // trae sus propios datos
  breve: "Encuentra los 4 grupos de 4 palabras.",
  descripcion: "Hay 16 palabras que forman 4 grupos de 4 con algo en común. Elige 4 y comprueba. Con 4 fallos se acaba el tablero y sale otro. Gana quien encuentre más grupos.",

  crear({ azar, config }) {
    const d = nivelDificultad(config);
    const datos = cargarConexiones();
    // Las palabras comunes vienen con los datos (así no hace falta el diccionario).
    const todas = datos.comunes ?? cargarDefiniciones().map((x) => [x.clave, x.forma, x.nivel]);
    const comunes = todas.filter(([c, , niv]) => niv <= (d < 0 ? 1 : 2) && c.length >= 3 && c.length <= 10);
    const tableros = [];
    for (let i = 0; i < TABLEROS * 2 && tableros.length < TABLEROS; i++) {
      const t = tablero(azar, d, datos, comunes);
      if (t) tableros.push(t);
    }
    return { tableros, jugadores: {} };
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { t: 0, hallados: [], fallos: 0, ultimo: null, grupos: 0, fallosTotal: 0, historial: [] });
  },

  vistaJugador(ronda, id) {
    const j = this.estadoJugador(ronda, id);
    const t = ronda.tableros[j.t];
    if (!t) return { fin: true, grupos: j.grupos, total: ronda.tableros.length };
    const acabado = j.hallados.length === 4 || j.fallos >= FALLOS;
    return {
      t: j.t,
      total: ronda.tableros.length,
      palabras: t.palabras.map(({ clave, forma }) => ({ clave, forma })),
      hallados: j.hallados.map((g) => ({ g, color: t.grupos[g].color ?? g, nombre: t.grupos[g].nombre, claves: t.grupos[g].palabras.map((p) => p.clave) })),
      // Si se acabó el tablero sin encontrarlos todos, se enseñan los que faltaban.
      solucion: acabado ? t.grupos.map((g, i) => ({ g: i, color: g.color ?? i, nombre: g.nombre, claves: g.palabras.map((p) => p.clave) })) : null,
      fallos: j.fallos,
      maxFallos: FALLOS,
      ultimo: j.ultimo,
      acabado,
      grupos: j.grupos,
    };
  },

  vistaTV(ronda) {
    return { jugadores: Object.fromEntries(Object.entries(ronda.jugadores).map(([id, j]) => [id, j.grupos])) };
  },

  accion(ronda, id, msg) {
    const j = this.estadoJugador(ronda, id);
    const t = ronda.tableros[j.t];
    if (!t || msg.t !== j.t) return false;
    const acabado = j.hallados.length === 4 || j.fallos >= FALLOS;
    if (msg.a === "siguiente") {
      if (!acabado) return false;
      j.historial.push({ t: j.t, hallados: [...j.hallados] });
      j.t++;
      j.hallados = [];
      j.fallos = 0;
      j.ultimo = null;
      return true;
    }
    if (msg.a !== "grupo" || acabado || !Array.isArray(msg.claves) || new Set(msg.claves).size !== 4) return false;
    const de = msg.claves.map((c) => t.palabras.find((p) => p.clave === c)?.g);
    if (de.some((g) => g == null || j.hallados.includes(g))) return false;
    const cuenta = {};
    de.forEach((g) => (cuenta[g] = (cuenta[g] ?? 0) + 1));
    const max = Math.max(...Object.values(cuenta));
    const n = (j.ultimo?.n ?? 0) + 1;
    if (max === 4) {
      j.hallados.push(de[0]);
      j.grupos++;
      j.ultimo = { n, ok: true };
    } else {
      j.fallos++;
      j.fallosTotal++;
      j.ultimo = { n, ok: false, casi: max === 3 };
    }
    return true;
  },

  terminado(ronda, id) {
    return (ronda.jugadores[id]?.t ?? 0) >= ronda.tableros.length;
  },

  resultados(ronda, ids) {
    return ids.map((id) => {
      const j = ronda.jugadores[id];
      if (!j || (!j.grupos && !j.fallosTotal)) return { id, valor: null, texto: "No jugó" };
      return {
        id,
        valor: j.grupos ? j.grupos * 100 - j.fallosTotal : null,
        texto: `${j.grupos} ${j.grupos === 1 ? "grupo" : "grupos"} · ${j.fallosTotal} ${j.fallosTotal === 1 ? "fallo" : "fallos"}`,
        corto: `${j.grupos} ${j.grupos === 1 ? "grupo" : "grupos"}`,
      };
    });
  },

  resumen(ronda) {
    const t = ronda.tableros[0];
    if (!t) return null;
    // Todos los tableros que alguien llegó a jugar, con quién encontró cada grupo (para estudiarlos al final).
    const js = Object.entries(ronda.jugadores);
    const halladosEn = (j, k) => (j.t === k ? j.hallados : j.historial.find((x) => x.t === k)?.hallados ?? []);
    const jugados = Math.max(1, ...js.map(([, j]) => Math.min(ronda.tableros.length, j.t + (j.hallados.length || j.fallos ? 1 : 0))));
    const tableros = ronda.tableros.slice(0, jugados).map((tb, k) => ({
      grupos: tb.grupos.map((g, gi) => ({
        color: g.color ?? gi,
        nombre: g.nombre,
        palabras: g.palabras.map((p) => p.forma),
        por: js.filter(([, j]) => halladosEn(j, k).includes(gi)).map(([id]) => id),
      })),
    }));
    return { grupos: t.grupos.map((g, i) => ({ color: g.color ?? i, nombre: g.nombre, palabras: g.palabras.map((p) => p.forma) })), tableros };
  },
};
