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
 * El título no desaparece al abrirse el juego: la pantalla de carga se vuelve transparente (se ve el inicio
 * detrás), su título se desliza y encoge hasta donde está el del inicio y entonces se cambian. Mientras, las
 * opciones del inicio aparecen una detrás de otra. Si la primera pantalla no tiene título, se funde y ya.
 */
async function viajarTitulo() {
  const carcasa = $("carcasa");
  const carga = carcasa.querySelector(".marca");
  // El inicio puede tardar un instante en pintarse: lo esperamos (como mucho, 2 s).
  let destino = null;
  for (let t = 0; t < 2000 && !destino; t += 50) {
    destino = document.querySelector("#app .pantalla:not(.sale) .titulo-nyp");
    if (!destino) await espera(50);
  }
  const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!carga || !destino || quieto) {
    carcasa.animate([{ opacity: 1 }, { opacity: 0 }], { duration: quieto ? 1 : 350, fill: "forwards" });
    await espera(quieto ? 0 : 360);
    return;
  }
  const pantalla = destino.closest(".pantalla");
  pantalla.classList.remove("entra"); // su entrada movería el título mientras medimos
  destino.style.visibility = "hidden";
  await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
  const a = carga.getBoundingClientRect(), b = destino.getBoundingClientRect();
  // Las opciones (y el banner) aparecen escalonadas desde abajo.
  const piezas = [...pantalla.querySelectorAll(".barra-sup, .opcion, .instalar, .aviso-paquete")];
  piezas.forEach((x, i) =>
    x.animate([{ opacity: 0, transform: "translateY(1.6rem) scale(0.96)" }, { opacity: 1, transform: "none" }], {
      duration: 520, delay: 420 + i * 110, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards",
    })
  );
  document.querySelectorAll(".banner-fijo").forEach((x) => x.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 420, fill: "backwards" }));
  // Fuera el fondo y el texto de carga; el título se queda y viaja.
  carcasa.classList.add("saliendo");
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const k = b.width / a.width;
  const viaje = carga.animate([{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }], {
    duration: 900, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "forwards",
  });
  await viaje.finished.catch(() => {});
  destino.style.visibility = "";
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
