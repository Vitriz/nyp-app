// Copia en la nube (Firebase · Firestore) de cada jugador: perfil, récords, hazañas y fotos.
// Sirve para la clasificación global de la familia y para no perder nada si se borra la app.
// Se usa la API REST de Firestore (sin librerías). Los datos de configuración de Firebase son públicos
// por diseño: lo que protege la base de datos son las reglas (herramientas/firestore.rules).
//
//   jugadores/{id}              nombre, colores, sombrero, animación, foto, records (JSON), hazanas (JSON), actualizado
//   jugadores/{id}/fotos/{fid}  foto (data URL), fecha        ← historial de fotos que has usado
import { almacen } from "./conexion.js";

const PROYECTO = "viccionario-nyp";
const CLAVE = "AIzaSyBGKHGXJl1NDAICHHp55_sjqKUDBdx0w1c";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROYECTO}/databases/(default)/documents`;
const CAMPOS = ["nombre", "color", "colorTexto", "contorno", "sombrero", "animacion", "foto", "records", "hazanas", "actualizado"];
const SIN_FOTO = CAMPOS.filter((c) => c !== "foto");

// ------------------------------------------------------------------ formato de Firestore (solo textos)
const aCampos = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null).map(([k, v]) => [k, { stringValue: String(v) }]));
const deCampos = (fields = {}) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.stringValue ?? null]));

async function pedir(ruta, opciones = {}, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(`${BASE}${ruta}${ruta.includes("?") ? "&" : "?"}key=${CLAVE}`, {
      ...opciones,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(opciones.headers ?? {}) },
    });
    if (!r.ok) throw new Error(`nube ${r.status}`);
    return r.status === 204 ? null : await r.json();
  } finally {
    clearTimeout(t);
  }
}

const leerJSON = (k, def) => {
  try {
    return JSON.parse(almacen.leer(k) ?? "null") ?? def;
  } catch {
    return def;
  }
};

// ------------------------------------------------------------------ tu ficha
/** Sube tu ficha entera (perfil + récords + hazañas). Si no hay internet, no pasa nada: se vuelve a intentar luego. */
export async function subirFicha(id, perfil) {
  const ficha = {
    nombre: perfil.nombre,
    color: perfil.color,
    colorTexto: perfil.colorTexto,
    contorno: perfil.contorno ?? null,
    sombrero: perfil.sombrero ?? null,
    animacion: perfil.animacion ?? null,
    foto: perfil.foto ?? null,
    records: JSON.stringify(leerJSON("nyp-records", {})),
    hazanas: JSON.stringify(leerJSON("nyp-hazanas", {})),
    actualizado: new Date().toISOString(),
  };
  await pedir(`/jugadores/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ fields: aCampos(ficha) }) });
  almacen.guardar("nyp-nube-subida", ficha.actualizado);
  return true;
}

let pendiente = 0;
/** Igual que subirFicha, pero espera un poco (si llegan varios cambios seguidos, se sube una vez). */
export function subirLuego(id, perfil, ms = 1500) {
  clearTimeout(pendiente);
  pendiente = setTimeout(() => subirFicha(id, perfil).catch(() => {}), ms);
}

/** La ficha completa de un jugador (para recuperar tu perfil en otro móvil). */
export async function leerFicha(id) {
  const doc = await pedir(`/jugadores/${encodeURIComponent(id)}`);
  return deCampos(doc.fields);
}

// ------------------------------------------------------------------ todos (clasificación global)
/** Todos los jugadores, sin las fotos (para la clasificación). [{ id, nombre, color, records: {…}, hazanas: {…} }] */
export async function leerJugadores() {
  const r = await pedir(`:runQuery`, {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: { from: [{ collectionId: "jugadores" }], select: { fields: SIN_FOTO.map((fieldPath) => ({ fieldPath })) }, limit: 200 },
    }),
  });
  const lista = (r ?? [])
    .filter((x) => x.document)
    .map((x) => {
      const d = deCampos(x.document.fields);
      const json = (t) => {
        try {
          return JSON.parse(t ?? "{}");
        } catch {
          return {};
        }
      };
      return { ...d, id: x.document.name.split("/").pop(), records: json(d.records), hazanas: json(d.hazanas) };
    });
  // Copia para verla sin conexión.
  almacen.guardar("nyp-nube-jugadores", JSON.stringify({ lista, fecha: new Date().toISOString() }));
  return lista;
}

/** La última clasificación descargada (o null). */
export function jugadoresGuardados() {
  return leerJSON("nyp-nube-jugadores", null);
}

// ------------------------------------------------------------------ historial de fotos
export async function subirFoto(id, fid, foto) {
  await pedir(`/jugadores/${encodeURIComponent(id)}/fotos/${encodeURIComponent(fid)}`, {
    method: "PATCH",
    body: JSON.stringify({ fields: aCampos({ foto, fecha: new Date().toISOString() }) }),
  });
}

export async function leerFotos(id) {
  const r = await pedir(`/jugadores/${encodeURIComponent(id)}/fotos?pageSize=50`);
  return (r.documents ?? []).map((d) => ({ fid: d.name.split("/").pop(), ...deCampos(d.fields) }));
}

export async function borrarFoto(id, fid) {
  await pedir(`/jugadores/${encodeURIComponent(id)}/fotos/${encodeURIComponent(fid)}`, { method: "DELETE" });
}
