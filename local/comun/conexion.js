// Conexión WebSocket con reconexión automática y reloj sincronizado con el servidor.

/**
 * base: dirección del servidor PARTY (por defecto, el sitio del que viene este archivo;
 * desde la app instalada puede ser otro).
 */
export function conectar({ alAbrir, alMensaje, alEstadoConexion, base = new URL("../", import.meta.url).href }) {
  const origen = new URL(base);
  const proto = origen.protocol === "https:" ? "wss" : "ws";
  const url = `${proto}://${origen.host}/ws`;
  let ws = null;
  let espera = 500;
  let desfase = 0; // ms que hay que sumar a Date.now() para tener la hora del servidor
  let muestras = 0;

  let reintento = 0;
  let cerrado = false;

  function abrir() {
    clearTimeout(reintento);
    if (cerrado || (ws && ws.readyState <= 1)) return;
    ws = new WebSocket(url);
    ws.addEventListener("open", () => {
      espera = 500;
      alEstadoConexion?.(true);
      alAbrir?.();
      medirReloj();
    });
    ws.addEventListener("message", (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.t === "pong") {
        const ida = Date.now() - msg.eco;
        const estimado = msg.ahora + ida / 2 - Date.now();
        desfase = muestras++ === 0 ? estimado : desfase * 0.7 + estimado * 0.3;
        return;
      }
      if (msg.t === "estado" && muestras === 0) desfase = msg.ahora - Date.now();
      alMensaje(msg);
    });
    ws.addEventListener("close", (e) => {
      if (cerrado) return;
      alEstadoConexion?.(false);
      if (e.code === 4000) return; // otra pestaña tomó el relevo
      reintento = setTimeout(abrir, espera);
      espera = Math.min(espera * 1.6, 5000);
    });
  }

  function medirReloj() {
    for (let i = 0; i < 3; i++) setTimeout(() => enviar({ t: "ping", eco: Date.now() }), i * 400);
  }

  function enviar(msg) {
    if (ws?.readyState === 1) {
      ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  const alVolver = () => {
    if (!cerrado && document.visibilityState === "visible") {
      if (!ws || ws.readyState > 1) abrir();
      else medirReloj();
    }
  };
  document.addEventListener("visibilitychange", alVolver);

  abrir();
  return {
    enviar,
    ahora: () => Date.now() + desfase,
    /** Desconecta del todo (salir de la partida). */
    cerrar() {
      cerrado = true;
      clearTimeout(reintento);
      document.removeEventListener("visibilitychange", alVolver);
      ws?.close(1000, "salir");
    },
  };
}

/** localStorage con try/catch (modo privado, etc.). */
export const almacen = {
  leer(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  guardar(k, v) {
    try {
      v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
    } catch {}
  },
};
