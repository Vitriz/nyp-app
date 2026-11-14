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
  await viajarTitulo();
  $("carcasa").classList.add("oculto");
}

/**
 * El título no desaparece al abrirse el juego: el del inicio sale desde donde estaba el de la pantalla de
 * carga y se desliza (y encoge) hasta su sitio. Si el inicio no tiene título (p. ej. crear el perfil), nada.
 */
async function viajarTitulo() {
  const carga = document.querySelector("#carcasa .marca");
  await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
  const destino = document.querySelector("#app .pantalla:not(.sale) .titulo-nyp");
  if (!carga || !destino || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // Sin la animación de entrada de la pantalla (movería el título): el título viaja y lo demás aparece suave.
  const pantalla = destino.closest(".pantalla");
  pantalla.classList.remove("entra");
  for (const x of pantalla.children) if (!x.contains(destino)) x.animate([{ opacity: 0, transform: "translateY(1rem)" }, { opacity: 1, transform: "none" }], { duration: 450, delay: 350, easing: "ease-out", fill: "backwards" });
  const a = carga.getBoundingClientRect(), b = destino.getBoundingClientRect();
  if (!a.width || !b.width) return;
  const dx = a.left + a.width / 2 - (b.left + b.width / 2);
  const dy = a.top + a.height / 2 - (b.top + b.height / 2);
  const k = a.width / b.width;
  $("carcasa").classList.add("oculto");
  destino.animate(
    [{ transform: `translate(${dx}px, ${dy}px) scale(${k})` }, { transform: "none" }],
    { duration: 750, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
  );
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
