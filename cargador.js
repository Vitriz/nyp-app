// Carcasa de la app NYP (GitHub Pages).
// El juego entero viaja con la app (carpeta local/) y se guarda en el móvil: abre sin ordenador
// ni internet. Al jugar en grupo, se actualiza con la versión del ordenador de la partida (PARTY).
const PREFIJO_LOCAL = "nyp-juego-local"; // + versión (lo pone el service worker)
const RAIZ_LOCAL = new URL("local/", location.href).href;
const $ = (id) => document.getElementById(id);

/** Guarda en el móvil los archivos del juego que sirve PARTY (así siempre coinciden con la TV). */
async function guardarCopiaLocal(base) {
  try {
    const lista = await (await fetch(base + "paquete/archivos", { cache: "no-store" })).json();
    // La copia de la versión activa (y la de una versión que se esté instalando).
    const nombres = (await caches.keys()).filter((k) => k.startsWith(PREFIJO_LOCAL));
    const cs = await Promise.all(nombres.map((k) => caches.open(k)));
    await Promise.all(
      lista.map(async (ruta) => {
        const r = await fetch(base + ruta, { cache: "no-store" });
        if (!r.ok) return;
        const tipo = r.headers.get("Content-Type") ?? "text/javascript";
        const datos = await r.blob();
        await Promise.all(cs.map((c) => c.put(RAIZ_LOCAL + ruta, new Response(datos, { headers: { "Content-Type": tipo } }))));
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

// El aviso de "instalar app" puede llegar antes de que cargue el juego: lo guardamos.
window.addEventListener("beforeinstallprompt", (ev) => {
  ev.preventDefault();
  window.NYP_INSTALADOR = ev;
  window.dispatchEvent(new Event("nyp-instalable"));
});

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const activado = (w) =>
  new Promise((ok) => {
    const listo = () => w.state === "activated" || w.state === "redundant";
    if (listo()) return ok();
    w.addEventListener("statechange", () => listo() && ok());
  });

/** Registra el service worker y, si hay versión nueva, la espera antes de abrir el juego. */
async function prepararServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register("sw.js");
    await Promise.race([reg.update().catch(() => {}), espera(4000)]); // sin internet falla enseguida
    const nuevo = reg.installing ?? reg.waiting;
    if (nuevo) {
      $("estado").textContent = navigator.serviceWorker.controller ? "Actualizando…" : "Preparando la app…";
      await Promise.race([activado(nuevo), espera(25000)]);
    }
    if (!navigator.serviceWorker.controller) await Promise.race([navigator.serviceWorker.ready, espera(25000)]);
  } catch {}
}

(async () => {
  await prepararServiceWorker();
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
