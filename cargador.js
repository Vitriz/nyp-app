// Carcasa de la app NYP (GitHub Pages).
// El juego entero viaja con la app (carpeta local/) y se guarda en el móvil: abre sin ordenador
// ni internet. Al jugar en grupo, se actualiza con la versión del ordenador de la partida (PARTY).
const CACHE_LOCAL = "nyp-juego-local";
const RAIZ_LOCAL = new URL("local/", location.href).href;
const $ = (id) => document.getElementById(id);

/** Guarda en el móvil los archivos del juego que sirve PARTY (así siempre coinciden con la TV). */
async function guardarCopiaLocal(base) {
  try {
    const lista = await (await fetch(base + "paquete/archivos", { cache: "no-store" })).json();
    const c = await caches.open(CACHE_LOCAL);
    await Promise.all(
      lista.map(async (ruta) => {
        const r = await fetch(base + ruta, { cache: "no-store" });
        if (!r.ok) return;
        const tipo = r.headers.get("Content-Type") ?? "text/javascript";
        await c.put(RAIZ_LOCAL + ruta, new Response(await r.blob(), { headers: { "Content-Type": tipo } }));
      })
    );
  } catch {}
}

async function cargarApp(raiz) {
  await Promise.all(
    ["comun/estilo.css", "movil/movil.css"].map(
      (css) =>
        new Promise((ok) => {
          const l = Object.assign(document.createElement("link"), { rel: "stylesheet", href: raiz + css });
          l.onload = l.onerror = ok;
          document.head.append(l);
        })
    )
  );
  await import(raiz + "movil/movil.js");
  $("carcasa").classList.add("oculto");
}

/** Código de sala del enlace del QR de la TV (…#s=palabra-palabra-palabra). */
const salaInicial = location.hash.match(/[#&]s=([a-z0-9-]+)/i)?.[1]?.toLowerCase() ?? null;

(async () => {
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("sw.js");
      // La primera vez, esperamos a que el service worker controle la página (sirve local/).
      if (!navigator.serviceWorker.controller) await navigator.serviceWorker.ready;
    } catch {}
  }
  // Para pruebas en el ordenador: #base=http://localhost:8771/ carga el juego de ese servidor.
  const prueba = location.hash.match(/base=([^&]+)/)?.[1];
  const base = prueba ? decodeURIComponent(prueba).replace(/\/?$/, "/") : null;
  window.NYP_CARCASA = { salaInicial, baseLocal: base, alConectar: guardarCopiaLocal };
  try {
    await cargarApp(base ?? RAIZ_LOCAL);
  } catch {
    $("estado").textContent = "No se pudo abrir el juego. Cierra la app y vuelve a abrirla.";
  }
})();
