// Récords de la familia (en el móvil): un identificador propio del móvil, la copia de la
// clasificación que manda PARTY y la mezcla con tus récords de ahora mismo.
import { almacen } from "./conexion.js";

/** Identificador del móvil (al azar, solo para no mezclar a dos personas con el mismo nombre). */
export function idMovil() {
  let id = almacen.leer("nyp-id");
  if (!id) {
    id = (crypto.randomUUID?.() ?? String(Math.random()).slice(2) + Date.now()).replace(/[^a-z0-9]/gi, "").slice(0, 20);
    almacen.guardar("nyp-id", id);
  }
  return id;
}

export function misRecords() {
  try {
    return JSON.parse(almacen.leer("nyp-records") ?? "{}");
  } catch {
    return {};
  }
}

/** Lo que el móvil manda a PARTY al conectarse. */
export function mensajeRecords(perfil) {
  return { t: "records", id: idMovil(), nombre: perfil.nombre, color: perfil.color, colorTexto: perfil.colorTexto, records: misRecords() };
}

export function guardarFamilia(tabla) {
  almacen.guardar("nyp-familia", JSON.stringify({ ...tabla, recibida: new Date().toISOString().slice(0, 10) }));
}

/** La clasificación guardada, con tus récords de ahora en vez de los que tenía PARTY. */
export function leerFamilia(perfil) {
  let t = null;
  try {
    t = JSON.parse(almacen.leer("nyp-familia") ?? "null");
  } catch {}
  const jugadores = { ...(t?.jugadores ?? {}) };
  jugadores[idMovil()] = { nombre: perfil.nombre, color: perfil.color, colorTexto: perfil.colorTexto, records: misRecords() };
  return { jugadores, recibida: t?.recibida ?? null };
}
