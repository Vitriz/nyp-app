// Batalla multijugador: los mensajes entre los móviles viajan por Firebase · Realtime Database.
// El móvil que crea la sala hace de «servidor» (ejecuta la misma sala que PARTY); los demás le mandan
// sus jugadas y reciben su vista de la partida. Todo va bajo salas/{código de 6 cifras}:
//   salas/{c}/info                  quién la creó y cuándo
//   salas/{c}/a/{cliente}/{n}       mensajes de cada móvil al anfitrión (numerados, para no desordenarse)
//   salas/{c}/e/{cliente}/estado    lo último que ese móvil debe ver (se sobrescribe)
//   salas/{c}/e/{cliente}/m/{n}     otros mensajes para ese móvil (bienvenida, fotos…)
// Reglas: herramientas/realtime.rules.json. Se usa la API REST y EventSource (sin librerías).

const BASE = "https://viccionario-nyp-default-rtdb.europe-west1.firebasedatabase.app";
const url = (ruta) => `${BASE}/${ruta}.json`;

async function pedir(ruta, metodo = "GET", datos) {
  const r = await fetch(url(ruta), { method: metodo, body: datos === undefined ? undefined : JSON.stringify(datos), headers: { "Content-Type": "application/json" } });
  if (!r.ok) throw new Error(`tiempo real ${r.status}`);
  return r.json();
}
export const leer = (ruta) => pedir(ruta);
export const poner = (ruta, datos) => pedir(ruta, "PUT", datos);
export const quitar = (ruta) => pedir(ruta, "DELETE");

/** Escucha una ruta: alCambio(ruta relativa, datos) con lo que hay y con cada cambio. Devuelve { cerrar }. */
export function escuchar(ruta, alCambio, { alAbrir, alError } = {}) {
  const es = new EventSource(url(ruta));
  const tratar = (ev) => {
    try {
      const { path, data } = JSON.parse(ev.data);
      if (ev.type === "patch") for (const [k, v] of Object.entries(data ?? {})) alCambio(`${path === "/" ? "" : path}/${k}`, v);
      else alCambio(path, data);
    } catch {}
  };
  es.addEventListener("put", tratar);
  es.addEventListener("patch", tratar);
  es.addEventListener("open", () => alAbrir?.());
  es.addEventListener("error", () => alError?.());
  return { cerrar: () => es.close() };
}

const azar = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, n * 2);
// Claves con letra delante: si fueran solo números, la base de datos podría devolverlas como lista.
const num = (n) => "n" + String(n).padStart(6, "0");
const deNum = (k) => Number(String(k).slice(1));

// ------------------------------------------------------------------ anfitrión
/** Un código de sala libre (6 cifras). */
export async function codigoLibre() {
  for (let i = 0; i < 8; i++) {
    const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
    if ((await leer(`salas/${c}/info`)) == null) return c;
  }
  throw new Error("no hay códigos libres");
}

/**
 * El móvil anfitrión atiende la sala: cada móvil que escribe en salas/{c}/a se convierte en un «socket»
 * para la sala (la misma interfaz que los WebSockets del ordenador).
 */
export function atenderSala(codigo, sala, { nombre } = {}) {
  const raiz = `salas/${codigo}`;
  poner(`${raiz}/info`, { creada: Date.now(), anfitrion: nombre ?? "" }).catch(() => {});
  const clientes = new Map(); // id -> { ws, esperado, pendientes }

  function crearSocket(cid) {
    const manejadores = {};
    let enCurso = null, siguiente = null, nm = 0;
    // El estado se sobrescribe (solo importa el último); si hay uno enviándose, se guarda el más nuevo.
    const enviarEstado = (msg) => {
      if (enCurso) return void (siguiente = msg);
      enCurso = poner(`${raiz}/e/${cid}/estado`, msg)
        .catch(() => {})
        .finally(() => {
          enCurso = null;
          if (siguiente) {
            const m = siguiente;
            siguiente = null;
            enviarEstado(m);
          }
        });
    };
    const ws = {
      readyState: 1,
      on: (ev, fn) => (manejadores[ev] = fn),
      send: (texto) => {
        const msg = JSON.parse(texto);
        if (msg.t === "estado") enviarEstado(msg);
        else poner(`${raiz}/e/${cid}/m/${num(nm++)}`, msg).catch(() => {});
      },
      ping() {},
      terminate() {},
      close() {},
      recibir: (msg) => manejadores.message?.(JSON.stringify(msg)),
    };
    sala.conectar(ws);
    return ws;
  }

  function llega(cid, n, msg) {
    let c = clientes.get(cid);
    if (!c) clientes.set(cid, (c = { ws: crearSocket(cid), esperado: 0, pendientes: new Map() }));
    c.pendientes.set(n, msg);
    // En orden: aunque lleguen desordenados, se tratan 0, 1, 2…
    while (c.pendientes.has(c.esperado)) {
      const m = c.pendientes.get(c.esperado);
      c.pendientes.delete(c.esperado++);
      c.ws.recibir(m);
    }
  }

  const escucha = escuchar(`${raiz}/a`, (ruta, datos) => {
    const partes = ruta.split("/").filter(Boolean);
    if (!partes.length) {
      for (const [cid, msgs] of Object.entries(datos ?? {})) for (const [n, m] of Object.entries(msgs ?? {})) llega(cid, deNum(n), m);
    } else if (partes.length === 1) {
      for (const [n, m] of Object.entries(datos ?? {})) llega(partes[0], deNum(n), m);
    } else if (datos) llega(partes[0], deNum(partes[1]), datos);
  });

  return {
    cerrar() {
      escucha.cerrar();
      quitar(raiz).catch(() => {});
    },
  };
}

// ------------------------------------------------------------------ jugadores
/**
 * Conexión de un jugador con la sala de una Batalla (misma interfaz que conectar() de conexion.js):
 * { enviar, ahora, cerrar }.
 */
export function conectarBatalla({ codigo, alAbrir, alMensaje, alEstadoConexion }) {
  const raiz = `salas/${codigo}`;
  const cid = azar(6);
  let n = 0, desfase = 0, muestras = 0, abierto = false, cerrado = false;
  const vistos = new Set();
  const entregar = (msg) => {
    if (!msg || cerrado) return;
    if (msg.t === "pong") {
      const ida = Date.now() - msg.eco;
      const estimado = msg.ahora + ida / 2 - Date.now();
      desfase = muestras++ === 0 ? estimado : desfase * 0.7 + estimado * 0.3;
      return;
    }
    if (msg.t === "estado" && muestras === 0) desfase = msg.ahora - Date.now();
    alMensaje(msg);
  };
  const otros = (lista) => {
    for (const [k, m] of Object.entries(lista ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
      if (vistos.has(k)) continue;
      vistos.add(k);
      entregar(m);
    }
  };
  const escucha = escuchar(
    `${raiz}/e/${cid}`,
    (ruta, datos) => {
      if (ruta === "/" || ruta === "") {
        otros(datos?.m);
        if (datos?.estado) entregar(datos.estado);
      } else if (ruta === "/estado") entregar(datos);
      else if (ruta === "/m") otros(datos);
      else if (ruta.startsWith("/m/")) otros({ [ruta.slice(3)]: datos });
    },
    {
      alAbrir: () => {
        alEstadoConexion?.(true);
        if (abierto) return;
        abierto = true;
        alAbrir?.();
        for (let i = 0; i < 3; i++) setTimeout(() => enviar({ t: "ping", eco: Date.now() }), 300 + i * 500);
      },
      alError: () => alEstadoConexion?.(false),
    }
  );
  function enviar(msg) {
    if (cerrado) return false;
    poner(`${raiz}/a/${cid}/${num(n++)}`, msg).catch(() => {});
    return true;
  }
  return {
    enviar,
    ahora: () => Date.now() + desfase,
    cerrar() {
      cerrado = true;
      escucha.cerrar();
      quitar(`${raiz}/e/${cid}`).catch(() => {});
    },
  };
}

/** Conexión del propio anfitrión con su sala (en el mismo móvil, sin internet de por medio). */
export function conectarLocal(sala, { alAbrir, alMensaje }) {
  const manejadores = {};
  const ws = {
    readyState: 1,
    on: (ev, fn) => (manejadores[ev] = fn),
    send: (texto) => setTimeout(() => alMensaje(JSON.parse(texto)), 0),
    ping() {},
    terminate() {},
    close() {},
  };
  sala.conectar(ws);
  setTimeout(() => alAbrir?.(), 0);
  return {
    enviar: (msg) => (manejadores.message?.(JSON.stringify(msg)), true),
    ahora: () => Date.now(),
    cerrar() {},
  };
}
