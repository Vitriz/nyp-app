// Service worker de la carcasa: guarda la app entera para que abra al instante y sin internet.
// El juego (local/) vive en "nyp-juego-local": viene con la app y PARTY lo actualiza al jugar en grupo.
// La build (herramientas/preparar-carcasa.js) pone aquí una huella de los archivos: si cambia algo,
// el móvil instala la versión nueva.
const VERSION = "b53ae2ef9c";
const CACHE = "nyp-carcasa-v3-" + VERSION;
// Cada versión guarda el juego aparte: así nunca se mezclan archivos de dos versiones.
const CACHE_LOCAL = "nyp-juego-local-" + VERSION;
const BASICOS = ["./", "index.html", "cargador.js", "manifest.webmanifest", "iconos/icono.svg", "iconos/icono-192.png", "iconos/icono-512.png"];

// Los datos grandes (Semántica y Conexiones, ~6 MB) se guardan aparte, por su huella: si no han
// cambiado desde la versión anterior, no se vuelven a descargar.
const CACHE_DATOS = "nyp-datos";

async function guardarJuego() {
  // ?v= evita que el CDN de GitHub dé un archivo de la versión anterior justo después de publicar.
  const lista = await (await fetch("local/archivos.json?v=" + VERSION, { cache: "no-store" })).json();
  let huellas = {};
  try {
    huellas = await (await fetch("local/datos.json?v=" + VERSION, { cache: "no-store" })).json();
  } catch {}
  const c = await caches.open(CACHE_LOCAL);
  const datos = await caches.open(CACHE_DATOS);
  await Promise.all(
    lista.map(async (ruta) => {
      const destino = new URL("local/" + ruta, self.registration.scope).href;
      const huella = huellas[ruta];
      if (huella) {
        const clave = destino + "?h=" + huella;
        const guardado = await datos.match(clave);
        if (guardado) return c.put(destino, guardado);
        const r = await fetch("local/" + ruta + "?h=" + huella, { cache: "no-store" });
        if (r.ok) await Promise.all([datos.put(clave, r.clone()), c.put(destino, r)]);
        return;
      }
      const r = await fetch("local/" + ruta + "?v=" + VERSION, { cache: "no-store" });
      if (r.ok) await c.put(destino, r);
    })
  );
  // Se olvidan las versiones viejas de los datos.
  const vigentes = new Set(Object.entries(huellas).map(([ruta, hh]) => new URL("local/" + ruta, self.registration.scope).href + "?h=" + hh));
  for (const req of await datos.keys()) if (!vigentes.has(req.url)) await datos.delete(req);
}

self.addEventListener("install", (ev) =>
  ev.waitUntil(Promise.all([caches.open(CACHE).then((c) => c.addAll(BASICOS)), guardarJuego()]).then(() => self.skipWaiting()))
);
self.addEventListener("activate", (ev) =>
  ev.waitUntil(
    caches.keys().then((ks) =>
      Promise.all(ks.filter((k) => (k.startsWith("nyp-carcasa") && k !== CACHE) || (k.startsWith("nyp-juego-local") && k !== CACHE_LOCAL)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
);
self.addEventListener("fetch", (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== "GET" || url.origin !== location.origin) return;
  // El juego: siempre desde el móvil (si faltara algo, de internet).
  if (url.pathname.includes("/local/")) {
    ev.respondWith(caches.open(CACHE_LOCAL).then((c) => c.match(url.href)).then((r) => r ?? fetch(ev.request)));
    return;
  }
  ev.respondWith(
    caches.open(CACHE).then((cache) =>
      fetch(ev.request)
        .then((r) => {
          if (r.ok) cache.put(ev.request, r.clone());
          return r;
        })
        .catch(() => cache.match(ev.request, { ignoreSearch: true }).then((g) => g ?? Response.error()))
    )
  );
});
