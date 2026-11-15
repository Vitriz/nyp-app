// Diccionario del modo solo guardado en el móvil (IndexedDB).
// Se descarga de PARTY la primera vez que te conectas a una partida (y cuando cambia).

const BD = "nyp";
const ALMACEN = "paquete";

function abrirBD() {
  return new Promise((ok, mal) => {
    const pet = indexedDB.open(BD, 1);
    pet.onupgradeneeded = () => pet.result.createObjectStore(ALMACEN);
    pet.onsuccess = () => ok(pet.result);
    pet.onerror = () => mal(pet.error);
  });
}

async function leer(clave) {
  const bd = await abrirBD();
  return new Promise((ok, mal) => {
    const pet = bd.transaction(ALMACEN).objectStore(ALMACEN).get(clave);
    pet.onsuccess = () => ok(pet.result ?? null);
    pet.onerror = () => mal(pet.error);
  });
}

async function escribir(clave, valor) {
  const bd = await abrirBD();
  return new Promise((ok, mal) => {
    const tx = bd.transaction(ALMACEN, "readwrite");
    tx.objectStore(ALMACEN).put(valor, clave);
    tx.oncomplete = () => ok();
    tx.onerror = () => mal(tx.error);
  });
}

/** Versión del diccionario guardado en el móvil (o null si no hay). */
export async function versionGuardada() {
  try {
    return await leer("version");
  } catch {
    return null;
  }
}

/** El diccionario guardado (texto JSON), o null. */
export async function leerPaquete() {
  return leer("datos");
}

let enCurso = null;

/**
 * Comprueba si PARTY tiene un diccionario más nuevo y, si es así, lo descarga (≈3 MB).
 * alEstado(texto) informa del progreso ("descargando", "listo"...).
 */
export function actualizarPaquete(base, alEstado = () => {}) {
  enCurso ??= (async () => {
    try {
      for (let intento = 0; intento < 40; intento++) {
        const v = await (await fetch(new URL("paquete/version", base), { cache: "no-store" })).json();
        if (v.version === (await versionGuardada())) return alEstado("listo");
        if (v.listo) {
          alEstado("descargando");
          const texto = await (await fetch(new URL("paquete/datos", base), { cache: "no-store" })).text();
          JSON.parse(texto); // comprobamos que llegó entero
          await escribir("datos", texto);
          await escribir("version", v.version);
          alEstado("listo");
          return;
        }
        alEstado("preparando"); // PARTY lo está generando (solo la primera vez)
        await new Promise((r) => setTimeout(r, 5000));
      }
    } catch {
      alEstado("error");
    } finally {
      enCurso = null;
    }
  })();
  return enCurso;
}

// ------------------------------------------------------------------ diccionario incluido en la app
// La app publicada lleva el diccionario cifrado con la contraseña de la familia (local/diccionario.bin).
const DIC = new URL("../diccionario.json", import.meta.url);
const DIC_DATOS = new URL("../diccionario.bin", import.meta.url);
const CLAVE_GUARDADA = "nyp-clave-diccionario";

/** Datos del diccionario que viene con la app ({ version, iteraciones }) o null si no viene. */
export async function diccionarioIncluido() {
  try {
    const r = await fetch(DIC, { cache: "no-cache" });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/**
 * Descomprime (gzip) a texto. Con DecompressionStream si el navegador la tiene; si no (iPhone con iOS
 * anterior a 16.4), con una librería pequeña (fflate) que se baja solo en ese caso.
 */
async function descomprimir(gz) {
  if (typeof DecompressionStream !== "undefined") {
    return new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  }
  const { gunzipSync } = await import("https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js");
  return new TextDecoder().decode(gunzipSync(new Uint8Array(gz)));
}

/** Descifra un archivo cifrado de la app (sal · iv · datos) con la contraseña. Devuelve el texto o null si no vale. */
async function descifrar(url, texto, info) {
  const bin = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const sal = bin.subarray(0, 16), iv = bin.subarray(16, 28), datos = bin.subarray(28);
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(texto), "PBKDF2", false, ["deriveKey"]);
  const llave = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: sal, iterations: info.iteraciones, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  let gz;
  try {
    gz = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, llave, datos);
  } catch {
    return null; // contraseña incorrecta
  }
  return descomprimir(gz);
}

// Las acepciones completas (datos de la RAE, para la ventana de significados) van, como el diccionario,
// cifradas con la contraseña de la familia: se descargan a la vez que él, al desbloquear con la contraseña
// (y al abrir la app, si ya estaba desbloqueada y aún no las tiene o hay versión nueva). Nunca sin contraseña.
const AC_DATOS = new URL("../acepciones.bin", import.meta.url);

/** Descarga, descifra y guarda las acepciones. true si quedaron guardadas. */
async function guardarAcepciones(texto, info) {
  const json = await descifrar(AC_DATOS, texto, info);
  if (!json) return false;
  JSON.parse(json); // comprobamos que está entero
  await escribir("acepciones", { version: info.version, texto: json });
  acepcionesEnCurso = null;
  return true;
}

/** Descifra el diccionario de la app con la contraseña y lo guarda (con sus acepciones). Devuelve true si la contraseña vale. */
export async function desbloquearDiccionario(clave, info) {
  info ??= await diccionarioIncluido();
  if (!info) throw new Error("sin-diccionario");
  const texto = String(clave).normalize("NFC").trim().toUpperCase();
  const json = await descifrar(DIC_DATOS, texto, info);
  if (!json) return false; // contraseña incorrecta
  JSON.parse(json); // comprobamos que está entero
  await escribir("datos", json);
  await escribir("version", info.version);
  try {
    localStorage.setItem(CLAVE_GUARDADA, texto);
  } catch {}
  // En la misma descarga, las acepciones (si fallan, se reintentan al abrir la app).
  await guardarAcepciones(texto, info).catch(() => false);
  return true;
}

/**
 * Al abrir la app: si ya se desbloqueó con la contraseña, pone al día el diccionario (si la app trae uno
 * más nuevo) y las acepciones (si faltan o son de otra versión). Sin contraseña guardada no hace nada.
 */
export async function actualizarIncluido() {
  const info = await diccionarioIncluido();
  if (!info) return;
  let clave = null;
  try {
    clave = localStorage.getItem(CLAVE_GUARDADA);
  } catch {}
  if (!clave) return;
  if (info.version !== (await versionGuardada())) {
    await desbloquearDiccionario(clave, info).catch(() => false);
    return;
  }
  const g = await leer("acepciones").catch(() => null);
  if (g?.version !== info.version) await guardarAcepciones(clave, info).catch(() => false);
}

// ------------------------------------------------------------------ todas las acepciones (ventana de significados)
let acepcionesEnCurso = null;

/**
 * Todas las acepciones: [[clave, [[categoría, uso, ámbito, texto], …]], …], o null si este móvil no las tiene.
 * En la app: las que se guardaron al desbloquear. En PARTY (el ordenador de casa, en la red local): sin cifrar.
 */
export function leerAcepciones() {
  acepcionesEnCurso ??= (async () => {
    try {
      const g = await leer("acepciones");
      if (g?.texto) return JSON.parse(g.texto);
    } catch {}
    if (!(await diccionarioIncluido())) {
      try {
        const r = await fetch(new URL("../paquete/acepciones", import.meta.url), { cache: "no-store" });
        if (r.ok) {
          const texto = await r.text();
          escribir("acepciones", { version: await versionGuardada(), texto }).catch(() => {});
          return JSON.parse(texto);
        }
      } catch {}
    }
    acepcionesEnCurso = null; // se vuelve a mirar la próxima vez
    return null;
  })();
  return acepcionesEnCurso;
}
