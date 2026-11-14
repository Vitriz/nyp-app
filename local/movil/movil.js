// App NYP del móvil: inicio (perfil · jugar en grupo con PARTY · jugar solo).
import { iniciarFondo } from "../comun/fondo.js";
import { h, cambiarPantalla, bannerFijo, servidor, vigilarEncaje, tituloJuego } from "../comun/ui.js";
import { cargarPerfil, pantallaPerfil } from "./perfil.js";
import { entrarParty } from "./party.js";
import { pantallaGrupo, resolverSala } from "./grupo.js";
import { crearBatalla, codigoBatalla } from "./batalla.js";
import { actualizarPaquete } from "../solo/paquete.js";
import { subirLuego } from "../comun/nube.js";
import { idMovil } from "../comun/familia.js";

vigilarEncaje(); // ningún número se sale de su casilla

iniciarFondo({ espaciado: 30 });
const app = document.getElementById("app");
const enApp = matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches || navigator.standalone;
// Dentro de la app instalada (carcasa de GitHub Pages) el juego vive en el propio móvil.
const carcasa = window.NYP_CARCASA ?? null;
// Sin carcasa, el servidor PARTY es el sitio del que viene la app.
const baseLocal = carcasa ? carcasa.baseLocal ?? null : servidor.base;

let perfil = cargarPerfil();
// Copia en la nube al abrir la app (perfil, récords y hazañas): si no hay internet, no pasa nada.
if (perfil) subirLuego(idMovil(), perfil, 4000);
let instalador = null;
let estadoPaquete = null; // null | "preparando" | "descargando" | "listo" | "error"

// El banner del perfil: el mismo en el inicio y en «Jugar solo» (se mueve, no se rehace).
let fijo = null;
function bannerApp() {
  if (!perfil) return null;
  if (fijo) fijo.actualizar(perfil);
  else fijo = bannerFijo(perfil);
  return fijo;
}
function soltarBanner() {
  fijo?.quitar();
  fijo = null;
}

function mostrar(el) {
  cambiarPantalla(app, el);
  fijo?.colocar();
}

/** La barra de arriba con el banner (tocarlo abre el perfil). */
function barraPerfil(alTocar) {
  const f = bannerApp();
  return h(
    "div.barra-sup.barra-inicio",
    f
      ? h("button.perfil-toque", { type: "button", onclick: alTocar, "aria-label": "Cambiar mi perfil", title: "Cambiar mi perfil" }, f.hueco("abierto"))
      : h("button.boton.suave", { type: "button", onclick: alTocar }, "✏️ Crear mi perfil")
  );
}

// ------------------------------------------------------------------ inicio
async function inicio() {
  const avisoSolo = h("div.aviso-paquete.suave");
  const pintarAviso = () => {
    avisoSolo.textContent = {
      preparando: "Preparando el modo solo…",
      descargando: "Descargando el diccionario para jugar solo…",
      listo: "",
      error: "",
    }[estadoPaquete] ?? "";
  };
  pintarAviso();
  alCambiarPaquete = pintarAviso;

  mostrar(
    h(
      "section.inicio",
      // Arriba a la izquierda, tu banner (tocarlo abre el perfil); en el centro, el título.
      barraPerfil(() => editarPerfil(inicio)),
      h("div.inicio-centro", tituloJuego()),
      h(
        "div.inicio-opciones",
        h(
          "button.boton.acento.opcion",
          { type: "button", onclick: () => conPerfil(irSolo) },
          h("span.icono", "🎯"),
          h("span.opcion-texto", "Jugar solo", h("small", "Pruebas sueltas y récords")),
          h("span.opcion-flecha", { "aria-hidden": "true" }, "›")
        ),
        h(
          "button.boton.opcion.opcion-batalla",
          { type: "button", onclick: () => conPerfil(() => batalla().menu()) },
          h("span.icono", "⚔️"),
          h("span.opcion-texto", "Batalla multijugador", h("small", "Con tus amigos, solo con los móviles")),
          h("span.opcion-flecha", { "aria-hidden": "true" }, "›")
        ),
        h(
          "button.boton.opcion",
          { type: "button", onclick: () => conPerfil(() => irParty()) },
          h("span.icono", "📺"),
          h("span.opcion-texto", "Unirse a modo PARTY", h("small", "Con el código de la TV")),
          h("span.opcion-flecha", { "aria-hidden": "true" }, "›")
        ),
        avisoSolo
      ),
      consejoInstalar()
    )
  );
}

let alCambiarPaquete = () => {};
function cambioPaquete(e) {
  estadoPaquete = e;
  alCambiarPaquete();
}

function editarPerfil(despues, volver = inicio) {
  mostrar(
    pantallaPerfil({
      perfil,
      titulo: perfil ? "Tu perfil" : "Crea tu perfil",
      alGuardar: (p) => {
        perfil = p;
        subirLuego(idMovil(), perfil);
        despues();
      },
      // Cambios guardados solos (al cambiar de pestaña): también a la nube.
      alCambiar: (p) => {
        perfil = p;
        subirLuego(idMovil(), perfil, 2500);
      },
      // Perfil borrado: se empieza otro desde cero.
      alBorrar: () => {
        perfil = null;
        soltarBanner();
        editarPerfil(inicio);
      },
      alVolver: perfil ? volver : null,
    }).el
  );
}

/** Si aún no hay perfil, primero lo creamos. */
function conPerfil(siguiente) {
  if (perfil) siguiente();
  else editarPerfil(siguiente);
}

// ------------------------------------------------------------------ batalla, partida y solo
const batalla = () => (soltarBanner(), crearBatalla({ app, perfil, mostrar, alVolver: inicio }));

function irParty(aviso = "") {
  soltarBanner(); // PARTY lleva su propio banner
  pantallaCompleta();
  const p = pantallaGrupo({
    baseLocal,
    aviso,
    alVolver: inicio,
    alEntrar: (base) => {
      carcasa?.alConectar?.(base); // la app instalada se actualiza con la versión de PARTY
      entrarParty({ app, base, perfil, alSalir: inicio, alPaquete: cambioPaquete });
    },
  });
  mostrar(p.el);
}

/** Abierta desde el QR de la TV: entramos directo a esa partida. */
async function irPartyDirecto(texto) {
  soltarBanner();
  pantallaCompleta();
  const base = texto ? await resolverSala(texto) : baseLocal;
  if (base) {
    carcasa?.alConectar?.(base);
    return entrarParty({ app, base, perfil, alSalir: inicio, alPaquete: cambioPaquete });
  }
  irParty("No encuentro esa partida. ¿Está abierta en la TV?");
}

async function irSolo() {
  pantallaCompleta();
  const { entrarSolo } = await import("../solo/solo.js");
  entrarSolo({
    app,
    perfil,
    fijo: bannerApp(),
    alSalir: inicio,
    // Desde la lista de juegos también se cambia el perfil (durante el juego, no).
    alPerfil: (volver) => editarPerfil(() => volver(perfil), () => volver(perfil)),
  });
}

// ------------------------------------------------------------------ utilidades del móvil
function pantallaCompleta() {
  const d = document.documentElement;
  if (!enApp && !document.fullscreenElement && d.requestFullscreen) d.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
  mantenerEncendida();
}

let bloqueo = null;
async function mantenerEncendida() {
  try {
    if (!bloqueo && navigator.wakeLock) {
      bloqueo = await navigator.wakeLock.request("screen");
      bloqueo.addEventListener("release", () => (bloqueo = null));
    }
  } catch {}
}
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && mantenerEncendida());

const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const esMovil = esIOS || /Android|Mobi/i.test(navigator.userAgent);

/** En el inicio, si se abre en el navegador del móvil: un botón para instalar la app. */
function consejoInstalar() {
  if (enApp || !esMovil) return null;
  return h("button.boton.suave.grande.instalar", { type: "button", onclick: pantallaInstalar }, "📲 Descargar la app NYP");
}

/**
 * Pantalla de descarga (a la que lleva el QR "Descarga la app"): en Android, el botón de instalar;
 * en iPhone, los pasos de Safari. Al abrir la app instalada, lo primero es crear el perfil.
 */
function pantallaInstalar() {
  const pasos = h("div.instalar-pasos");
  const pintar = () => {
    if (enApp) {
      pasos.replaceChildren(h("p", "✔ Ya estás en la app."), h("button.boton.acento.grande", { type: "button", onclick: arrancar }, "Empezar"));
    } else if (esIOS) {
      pasos.replaceChildren(
        h("ol.instalar-lista",
          h("li", "Abre esta página en ", h("b", "Safari"), "."),
          h("li", "Pulsa ", h("b", "Compartir"), " ", h("span.icono-compartir", "⬆︎"), " (abajo)."),
          h("li", "Elige ", h("b", "«Añadir a pantalla de inicio»"), "."),
          h("li", "Abre ", h("b", "NYP"), " desde la pantalla de inicio y crea tu perfil.")
        )
      );
    } else if (instalador) {
      pasos.replaceChildren(
        h("button.boton.acento.grande", {
          type: "button",
          onclick: async () => {
            const ev = instalador;
            instalador = null;
            ev.prompt();
            const r = await ev.userChoice.catch(() => null);
            if (r?.outcome === "accepted") pasos.replaceChildren(h("p", "✔ ¡Instalada! Ábrela desde tu pantalla de inicio y crea tu perfil."));
            else pintar();
          },
        }, "📲 Instalar NYP"),
        h("p.suave", "Ocupa muy poco y funciona sin internet.")
      );
    } else {
      pasos.replaceChildren(
        h("ol.instalar-lista",
          h("li", "Abre el menú del navegador ", h("b", "⋮"), " (arriba a la derecha)."),
          h("li", "Pulsa ", h("b", "«Instalar aplicación»"), " o ", h("b", "«Añadir a pantalla de inicio»"), "."),
          h("li", "Abre ", h("b", "NYP"), " desde la pantalla de inicio y crea tu perfil.")
        ),
        h("p.suave", "Si ya la tienes instalada, ábrela desde la pantalla de inicio.")
      );
    }
  };
  alInstalable = pintar;
  pintar();
  mostrar(
    h(
      "section.inicio.instalar-pantalla",
      tituloJuego(),
      h("h1.instalar-titulo", "Descarga la app"),
      h("p.suave.instalar-sub", "Juegos de palabras y números para jugar en familia, en grupo o tú solo."),
      pasos,
      h("button.boton.suave", { type: "button", onclick: () => ((alInstalable = () => {}), arrancar()) }, "Seguir en el navegador")
    )
  );
}

let alInstalable = () => {};
instalador = window.NYP_INSTALADOR ?? null;
const recibirInstalador = (ev) => {
  if (ev) {
    ev.preventDefault?.();
    instalador = ev;
  } else instalador = window.NYP_INSTALADOR ?? instalador;
  alInstalable();
};
window.addEventListener("beforeinstallprompt", recibirInstalador);
window.addEventListener("nyp-instalable", () => recibirInstalador());
const mismoSitio = new URL(import.meta.url).origin === location.origin;
if (mismoSitio && !carcasa && "serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register(new URL("../sw.js", import.meta.url), { scope: "/" }).catch(() => {});
}

// ------------------------------------------------------------------ arranque
// El QR de la TV lleva #party: quien lo escanea entra directo a la partida.
const sala = carcasa?.salaInicial ?? null;
const directo = location.hash.includes("party") || sala;
// El QR de una Batalla lleva #b=123456: quien lo escanea entra directo a esa sala.
const salaBatalla = codigoBatalla(location.hash);
const paraInstalar = /instalar/.test(location.hash + location.search);
if (location.hash) history.replaceState(null, "", location.pathname);

function arrancar() {
  if (salaBatalla) conPerfil(() => batalla().entrarSala(salaBatalla));
  else if (directo) conPerfil(() => irPartyDirecto(sala));
  // La primera vez, lo primero es crear tu perfil.
  else if (!perfil) editarPerfil(inicio);
  else inicio();
}
if (paraInstalar && !enApp) pantallaInstalar();
else arrancar();
// Aunque no entremos a una partida, si estamos en el ordenador de PARTY, guardamos el diccionario.
if (baseLocal) actualizarPaquete(baseLocal, cambioPaquete).catch(() => {});
