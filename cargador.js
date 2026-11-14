// Carcasa de la app NYP (GitHub Pages).
// El juego entero viaja con la app (carpeta local/) y se guarda en el móvil: abre sin ordenador
// ni internet (el multijugador, la Batalla, va por internet).
const RAIZ_LOCAL = new URL("local/", location.href).href;
const $ = (id) => document.getElementById(id);

async function cargarApp(raiz) {
  await Promise.all(
    ["comun/estilo.css", "movil/movil.css", "comun/selector.css"].map(
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
  window.NYP_CARCASA = { baseLocal: base };
  try {
    await cargarApp(base ?? RAIZ_LOCAL);
  } catch {
    $("estado").textContent = "No se pudo abrir el juego. Cierra la app y vuelve a abrirla.";
    $("estado").classList.add("sin-giro");
  }
})();
