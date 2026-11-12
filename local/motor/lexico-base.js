// Lógica del diccionario que no depende de dónde estén los datos.
// La usan el ordenador (lexico.js, con SQLite) y el móvil en modo solo (lexico-navegador.js).

export const LETRAS = "abcdefghijklmnñopqrstuvwxyz";
const INDICE = Object.fromEntries([...LETRAS].map((l, i) => [l, i]));
const N = LETRAS.length;

/** Convierte cualquier texto a clave de juego: minúsculas, sin tildes, conserva la ñ. */
export function clave(texto) {
  let out = "";
  for (const ch of String(texto).toLowerCase()) out += ch === "ñ" ? "ñ" : ch.normalize("NFD")[0];
  return out;
}

export function contar(texto) {
  const v = new Uint8Array(N);
  for (const ch of texto) {
    const i = INDICE[ch];
    if (i === undefined) return null;
    v[i]++;
  }
  return v;
}

export function indiceLetra(l) {
  return INDICE[l];
}

export function mascaraDe(texto) {
  let m = 0;
  for (const ch of texto) m |= 1 << INDICE[ch];
  return m;
}

export function letrasDeMascara(m) {
  return [...LETRAS].filter((_, i) => m & (1 << i));
}

export function bits(m) {
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
}

// ------------------------------------------------------------------ candidatas
/**
 * Índice en arrays planos (poca memoria) para buscar palabras por letras.
 * entradas: iterable de [clave, buena] con claves de 3 a 14 letras.
 */
export function crearCandidatas(entradas, total) {
  const claves = [];
  const buenas = new Uint8Array(total);
  const cuentas = new Uint8Array(total * N);
  const mascaras = new Uint32Array(total);
  for (const [c, buena] of entradas) {
    const v = contar(c);
    if (!v) continue;
    const k = claves.length;
    let m = 0;
    for (let i = 0; i < N; i++) if (v[i]) m |= 1 << i;
    cuentas.set(v, k * N);
    mascaras[k] = m;
    buenas[k] = buena ? 1 : 0;
    claves.push(c);
  }
  return { claves, buenas, cuentas, mascaras, N };
}

/** Todas las claves que se pueden formar con esas letras (cada ficha una vez). */
export function buscarPosibles(cands, letras, { soloBuenas = false } = {}) {
  const disp = contar(letras);
  let mDisp = 0;
  for (let i = 0; i < N; i++) if (disp[i]) mDisp |= 1 << i;
  const { claves, buenas, cuentas, mascaras } = cands;
  const n = letras.length;
  const res = [];
  for (let k = 0; k < claves.length; k++) {
    if ((mascaras[k] & ~mDisp) !== 0) continue;
    if (claves[k].length > n || (soloBuenas && !buenas[k])) continue;
    let cabe = true;
    for (let i = 0, base = k * N; i < N; i++) {
      if (cuentas[base + i] > disp[i]) {
        cabe = false;
        break;
      }
    }
    if (cabe) res.push({ clave: claves[k], buena: buenas[k] === 1 });
  }
  return res.sort((a, b) => b.clave.length - a.clave.length || a.clave.localeCompare(b.clave, "es"));
}

/** Palabras formadas solo con las letras de la máscara y que contienen la central. */
export function buscarDeConjunto(cands, mascara, bitCentro) {
  const { claves, buenas, mascaras } = cands;
  const todas = [], comunes = [];
  for (let k = 0; k < claves.length; k++) {
    const m = mascaras[k];
    if ((m & ~mascara) !== 0 || !(m & bitCentro)) continue;
    todas.push(claves[k]);
    if (buenas[k]) comunes.push(claves[k]);
  }
  return { todas, comunes };
}

// ------------------------------------------------------------------ definiciones
export const CATEGORIA = { noun: "Sustantivo", adjective: "Adjetivo", verb: "Verbo", adverb: "Adverbio" };

/** Raíz que no debe aparecer en la definición (para no regalar la palabra). */
function raiz(c) {
  const n = c.length <= 5 ? c.length - 1 : c.length - 3;
  return c.slice(0, Math.max(3, n));
}

/** Deja la definición corta: primera frase y, si es larga, solo las primeras partes. */
export function recortar(desc) {
  desc = desc.replace(/\s+/g, " ").trim();
  const punto = desc.indexOf(". ");
  if (punto > 0) desc = desc.slice(0, punto); // nos quedamos con la primera frase
  if (desc.length <= 95) return desc;
  const trozos = desc.split(/, | y (?=[a-záéíóú])/);
  let out = trozos[0];
  for (let i = 1; i < trozos.length && out.length < 55; i++) {
    if (/[\d(‖]/.test(trozos[i]) || (out + ", " + trozos[i]).length > 95) break;
    out += ", " + trozos[i];
  }
  return out.length < desc.length ? out + "…" : out;
}

export function definicionBuena(c, desc) {
  if (!desc || desc.length < 12 || desc.length > 130) return false;
  if (!/^[A-ZÁÉÍÓÚÑ¿¡]/.test(desc)) return false; // en minúscula suelen ser remisiones ("flor de Jamaica")
  if (/[‖()\d=]|V\.|\bU\. /.test(desc)) return false;
  return !clave(desc).includes(raiz(c));
}

export function contarPalabras(texto) {
  return texto.split(/\s+/).filter(Boolean).length;
}

/**
 * Elige n palabras distintas con su definición. Prioriza definiciones cortas (pocas palabras)
 * para que se lean de un vistazo y quepan en 2-3 líneas.
 */
export function escogerDefiniciones(defs, azar, n, { largoMin = 4, largoMax = 9, nivelMax = 1, categorias = null, sinÑ = false, maxPalabras = 12 } = {}) {
  const base = defs.filter(
    (d) => d.nivel <= nivelMax && d.clave.length >= largoMin && d.clave.length <= largoMax &&
      (!categorias || categorias.includes(d.categoria)) && (!sinÑ || !d.clave.includes("ñ"))
  );
  // Primero las cortas; si no hay bastantes, aflojamos poco a poco.
  let pool = [];
  for (const limite of [maxPalabras, maxPalabras + 4, Infinity]) {
    // Las recortadas ("…") cuentan como más largas: mejor una definición completa.
    pool = base.filter((d) => d.palabras + (d.definicion.endsWith("…") ? 8 : 0) <= limite);
    if (pool.length >= n * 4) break;
  }
  const res = [];
  const usadas = new Set();
  for (let intento = 0; res.length < n && intento < n * 50 && pool.length; intento++) {
    const d = azar.elegir(pool);
    if (usadas.has(d.clave)) continue;
    usadas.add(d.clave);
    res.push(d);
  }
  return res;
}

/** Palabras base comunes (con definición) que usan exactamente 7 letras distintas. */
export function pangramasDe(defs) {
  return defs.map((d) => ({ clave: d.clave, forma: d.forma, mascara: mascaraDe(d.clave) })).filter((d) => bits(d.mascara) === 7);
}
