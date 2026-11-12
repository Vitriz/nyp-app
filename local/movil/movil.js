// App NYP del móvil: inicio (perfil · jugar en grupo con PARTY · jugar solo).
import { iniciarFondo } from "../comun/fondo.js";
import { h, cambiarPantalla, banner, servidor } from "../comun/ui.js";
import { cargarPerfil, pantallaPerfil } from "./perfil.js";
import { entrarParty } from "./party.js";
import { pantallaGrupo, baseDe, probarBase } from "./grupo.js";
import { actualizarPaquete } from "../solo/paquete.js";

iniciarFondo({ espaciado: 30 });
const app = document.getElementById("app");
const enApp = matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches || navigator.standalone;
// Dentro de la app instalada (carcasa de GitHub Pages) el juego vive en el propio móvil.
const carcasa = window.NYP_CARCASA ?? null;
// Sin carcasa, el servidor PARTY es el sitio del que viene la app.
const baseLocal = carcasa ? carcasa.baseLocal ?? null : servidor.base;

let perfil = cargarPerfil();
let instalador = null;
let estadoPaquete = null; // null | "preparando" | "descargando" | "listo" | "error"

function mostrar(el) {
  cambiarPantalla(app, el);
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
      h("div.marca-movil", ["N", "Y", "P"].map((l) => h("span.ficha", l))),
      h(
        "div.inicio-perfil",
        // Tocar el banner abre el perfil.
        h(
          "button.perfil-toque",
          { type: "button", onclick: () => editarPerfil(inicio), "aria-label": "Cambiar mi perfil" },
          perfil ? banner(perfil, ".banner-grande") : h("span.boton.suave", "✏️ Crear mi perfil"),
          perfil ? h("small", "Toca para cambiar tu perfil") : null
        )
      ),
      h(
        "div.inicio-opciones",
        h(
          "button.boton.acento.opcion",
          { type: "button", onclick: () => conPerfil(() => irParty()) },
          h("span.icono", "📺"),
          h("span", "Jugar en grupo", h("small", "Entra con el código de la TV"))
        ),
        h(
          "button.boton.opcion",
          { type: "button", onclick: () => conPerfil(irSolo) },
          h("span.icono", "🎯"),
          h("span", "Jugar solo", h("small", "Pruebas sueltas y récords"))
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

function editarPerfil(despues) {
  mostrar(
    pantallaPerfil({
      perfil,
      titulo: perfil ? "Tu perfil" : "Crea tu perfil",
      alGuardar: (p) => {
        perfil = p;
        despues();
      },
      alVolver: perfil ? inicio : null,
    }).el
  );
}

/** Si aún no hay perfil, primero lo creamos. */
function conPerfil(siguiente) {
  if (perfil) siguiente();
  else editarPerfil(siguiente);
}

// ------------------------------------------------------------------ partida y solo
function irParty(codigo, aviso = "") {
  pantallaCompleta();
  const p = pantallaGrupo({
    baseLocal,
    ...(codigo ? { codigo } : {}),
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
  pantallaCompleta();
  const base = texto ? baseDe(texto) : baseLocal;
  if (base && (base === baseLocal || (await probarBase(base)))) {
    carcasa?.alConectar?.(base);
    return entrarParty({ app, base, perfil, alSalir: inicio, alPaquete: cambioPaquete });
  }
  irParty(base?.match(/^https:\/\/([a-z0-9-]+)\.trycloudflare/)?.[1], "No encuentro esa partida. ¿Está abierta en la TV?");
}

async function irSolo() {
  pantallaCompleta();
  const { entrarSolo } = await import("../solo/solo.js");
  entrarSolo({ app, perfil, alSalir: inicio });
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

function consejoInstalar() {
  if (enApp || carcasa) return null;
  const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const caja = h("div.instalar.tarjeta");
  if (esIOS) caja.append("📲 Para tenerla como app: pulsa ", h("b", "Compartir"), " y luego ", h("b", "«Añadir a pantalla de inicio»"), ".");
  else if (instalador) caja.append(h("button.boton.suave.grande", { onclick: () => (instalador.prompt(), (instalador = null), caja.remove()) }, "📲 Instalar NYP como app"));
  else return null;
  return caja;
}

window.addEventListener("beforeinstallprompt", (ev) => {
  ev.preventDefault();
  instalador = ev;
});
const mismoSitio = new URL(import.meta.url).origin === location.origin;
if (mismoSitio && !carcasa && "serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register(new URL("../sw.js", import.meta.url), { scope: "/" }).catch(() => {});
}

// ------------------------------------------------------------------ arranque
// El QR de la TV lleva #party: quien lo escanea entra directo a la partida.
const sala = carcasa?.salaInicial ?? null;
const directo = location.hash.includes("party") || sala;
if (location.hash) history.replaceState(null, "", location.pathname);
if (directo) conPerfil(() => irPartyDirecto(sala));
else inicio();
// Aunque no entremos a una partida, si estamos en el ordenador de PARTY, guardamos el diccionario.
if (baseLocal) actualizarPaquete(baseLocal, cambioPaquete).catch(() => {});
