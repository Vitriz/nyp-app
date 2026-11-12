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

/** Descifra el diccionario de la app con la contraseña y lo guarda. Devuelve true si la contraseña vale. */
export async function desbloquearDiccionario(clave, info) {
  info ??= await diccionarioIncluido();
  if (!info) throw new Error("sin-diccionario");
  const bin = new Uint8Array(await (await fetch(DIC_DATOS)).arrayBuffer());
  const sal = bin.subarray(0, 16), iv = bin.subarray(16, 28), datos = bin.subarray(28);
  const texto = String(clave).normalize("NFC").trim().toUpperCase();
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(texto), "PBKDF2", false, ["deriveKey"]);
  const llave = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: sal, iterations: info.iteraciones, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  let gz;
  try {
    gz = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, llave, datos);
  } catch {
    return false; // contraseña incorrecta
  }
  const json = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  JSON.parse(json); // comprobamos que está entero
  await escribir("datos", json);
  await escribir("version", info.version);
  try {
    localStorage.setItem(CLAVE_GUARDADA, texto);
  } catch {}
  return true;
}

/** Si la app trae un diccionario más nuevo y ya se desbloqueó antes, lo actualiza sin preguntar. */
export async function actualizarIncluido() {
  const info = await diccionarioIncluido();
  if (!info || info.version === (await versionGuardada())) return;
  let clave = null;
  try {
    clave = localStorage.getItem(CLAVE_GUARDADA);
  } catch {}
  if (clave) await desbloquearDiccionario(clave, info).catch(() => false);
}
