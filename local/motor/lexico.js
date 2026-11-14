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
let conexiones = { categorias: [], miembros: {} };
let semantica = null;
let indiceAcepciones = null; // clave -> [{ texto, tipo?, ambito? }]
// Semántica y Conexiones traen sus propios datos (motor/datos/…): no necesitan el diccionario.
let propios = null;
let datosPropios = null;

/** Carga los datos de Semántica y Conexiones que vienen con la app (una vez). */
export function cargarDatosJuegos() {
  return (propios ??= Promise.all(
    ["semantica", "conexiones"].map((n) =>
      fetch(new URL(`./datos/${n}.json`, import.meta.url))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    )
  ).then(([s, c]) => {
    datosPropios = { semantica: s, conexiones: c };
  }));
}

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
  indiceAcepciones = null;
  conexiones = p.conexiones ?? { categorias: [], miembros: {} };
  semantica = p.semantica ?? null;
}

export function cargarSemantica() {
  return datosPropios?.semantica ?? semantica;
}

export function cargarConexiones() {
  return datosPropios?.conexiones ?? conexiones;
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

// Terminaciones para encontrar la forma del diccionario de una palabra conjugada o en plural
// (cuidases → cuidar, escocidas → escocer, perras → perro). Sin tildes: así son las claves.
const TERM_AR = "o as a amos ais an aba abas abamos abais aban e aste o asteis aron ara aras aramos arais aran ase ases asemos aseis asen are ares aremos areis aren aria arias ariamos ariais arian es emos eis en ad ando ado ada ados adas ar".split(" ");
const TERM_ER = "o es e emos eis en ia ias iamos iais ian i iste io imos isteis ieron iera ieras ieramos ierais ieran iese ieses iesemos ieseis iesen ere eras era eremos ereis eran eria erias eriamos eriais erian a as amos ais an ed iendo yendo ido ida idos idas er".split(" ");
const TERM_IR = "o es e imos is en ia ias iamos iais ian i iste io isteis ieron iera ieras ieramos ierais ieran iese ieses iesemos ieseis iesen ire iras ira iremos ireis iran iria irias iriamos iriais irian a as amos ais an id iendo yendo ido ida idos idas ir".split(" ");

/** Posibles formas del diccionario de una clave (de más a menos probable). */
function candidatasLema(c, otraVez = true) {
  const out = [];
  const poner = (x) => x.length >= 2 && x !== c && !out.includes(x) && out.push(x);
  // Plurales y femeninos.
  if (c.endsWith("ces")) poner(c.slice(0, -3) + "z");
  if (c.endsWith("es")) poner(c.slice(0, -2));
  if (c.endsWith("s")) poner(c.slice(0, -1));
  if (c.endsWith("as")) poner(c.slice(0, -2) + "o");
  if (c.endsWith("a")) poner(c.slice(0, -1) + "o");
  // Verbos: la raíz + -ar, -er o -ir (también con los cambios c/qu, g/gu, z/c).
  for (const [lista, inf] of [[TERM_AR, "ar"], [TERM_ER, "er"], [TERM_IR, "ir"]]) {
    for (const t of lista) {
      if (!c.endsWith(t) || c.length - t.length < 2) continue;
      const raiz = c.slice(0, c.length - t.length);
      poner(raiz + inf);
      if (raiz.endsWith("qu")) poner(raiz.slice(0, -2) + "c" + inf);
      if (raiz.endsWith("gu")) poner(raiz.slice(0, -2) + "g" + inf);
      if (raiz.endsWith("c") && inf === "ar") poner(raiz.slice(0, -1) + "z" + inf);
      if (raiz.endsWith("j")) poner(raiz.slice(0, -1) + "g" + inf);
      if (raiz.endsWith("z") && inf !== "ar") poner(raiz.slice(0, -1) + "c" + inf);
    }
  }
  // Un plural de algo que viene de un verbo (asedios → asedio → asediar).
  if (otraVez && c.endsWith("s")) for (const x of candidatasLema(c.slice(0, -1), false)) poner(x);
  return out;
}

/**
 * Lo que dice el diccionario de una palabra (para la ventana que se abre al tocarla en los resultados):
 * su definición general y las de cada ámbito (Marina, Música…). Si es una forma conjugada o en plural,
 * las de su forma del diccionario. { forma, valida, lema, lista }.
 */
export function acepciones(texto) {
  const c = clave(texto);
  if (!indiceAcepciones) {
    indiceAcepciones = new Map();
    const poner = (k, x) => {
      const l = indiceAcepciones.get(k) ?? [];
      if (!l.some((y) => y.texto === x.texto)) l.push(x);
      indiceAcepciones.set(k, l);
    };
    for (const d of definiciones) poner(d.clave, { texto: d.definicion, tipo: d.categoria });
    for (const [ambito, lista] of Object.entries(crucigrama ?? {})) for (const [k, , , def] of lista) poner(k, { texto: def, ambito });
  }
  const forma = formas[c] ?? texto;
  const valida = esValida(c);
  if (indiceAcepciones.has(c)) return { forma, valida, lema: null, lista: indiceAcepciones.get(c) };
  const lema = candidatasLema(c).find((x) => indiceAcepciones.has(x));
  return { forma, valida, lema: lema ? formas[lema] ?? lema : null, lista: lema ? indiceAcepciones.get(lema) : [] };
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
