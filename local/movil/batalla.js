// Batalla multijugador: jugar con los móviles por internet, sin PARTY ni TV.
// El que crea la sala ejecuta en su móvil la misma sala que PARTY (servidor/sala.js) y la maneja desde
// ahí (elige los juegos, empieza, pasa de pantalla). Los demás entran con el código o el QR. Los mensajes
// viajan por Firebase · Realtime Database (web/comun/tiemporeal.js). Los resultados se ven en cada móvil.
import { h } from "../comun/ui.js";
import { entrarParty } from "./party.js";
import { pantallaGrupo } from "./grupo.js";
import { leerPaquete } from "../solo/paquete.js";
import { codigoLibre, atenderSala, conectarBatalla, conectarLocal, leer } from "../comun/tiemporeal.js";

const DIFICULTADES = { facil: "Fácil", normal: "Medio", dificil: "Difícil" };
const METAS = [[30, "30"], [50, "50"], [75, "75"], [100, "100"], [0, "∞"]];

/** El código de una Batalla en un texto (6 cifras, o un enlace con #b=123456). */
export function codigoBatalla(texto) {
  const t = String(texto ?? "");
  const enlace = t.match(/[#&?]b=(\d{6})/);
  if (enlace) return enlace[1];
  const cifras = t.replace(/\D/g, "");
  return cifras.length === 6 && !/[a-z]/i.test(t.replace(/^https?:\/\/\S+/, "")) ? cifras : null;
}

/**
 * Pantallas de la Batalla. mostrar(el) cambia de pantalla; alVolver() vuelve al inicio.
 */
export function crearBatalla({ app, perfil, mostrar, alVolver }) {
  const cabecera = (titulo, volver) =>
    h("div.barra-sup", h("button.icono-btn", { type: "button", onclick: volver, "aria-label": "Volver" }, "←"), h("span.nombre", titulo));

  function menu() {
    mostrar(
      h(
        "section.batalla-menu",
        cabecera("⚔️ Batalla multijugador", alVolver),
        h("p.suave.batalla-intro", "Juega con tus amigos desde vuestros móviles, sin TV. Uno crea la sala y los demás se unen con el código."),
        h(
          "div.inicio-opciones",
          h(
            "button.boton.acento.opcion",
            { type: "button", onclick: opciones },
            h("span.icono", "🏠"),
            h("span.opcion-texto", "Crear sala", h("small", "Tú eliges los juegos y das paso")),
            h("span.opcion-flecha", { "aria-hidden": "true" }, "›")
          ),
          h(
            "button.boton.opcion",
            { type: "button", onclick: () => unirse() },
            h("span.icono", "🎟️"),
            h("span.opcion-texto", "Unirse a sala", h("small", "Con el código o el QR de un amigo")),
            h("span.opcion-flecha", { "aria-hidden": "true" }, "›")
          )
        )
      )
    );
  }

  // ---------------------------------------------------------------- crear
  function opciones() {
    const o = { dificultad: "normal", meta: 50 };
    const cuerpo = h("div.batalla-opciones");
    const fila = (etq, lista, actual, fijar) =>
      h(
        "div.batalla-op",
        h("span.etiqueta", etq),
        h("div.records-opciones", lista.map(([v, t]) => h(`button.records-op${v === actual ? ".elegida" : ""}`, { type: "button", onclick: () => (fijar(v), pintar()) }, t)))
      );
    const pintar = () =>
      cuerpo.replaceChildren(
        fila("Dificultad", Object.entries(DIFICULTADES), o.dificultad, (v) => (o.dificultad = v)),
        fila("Puntos para ganar", METAS, o.meta, (v) => (o.meta = v))
      );
    pintar();
    const aviso = h("div.pl-aviso.mal");
    mostrar(
      h(
        "section.batalla-menu",
        cabecera("🏠 Crear sala", menu),
        cuerpo,
        aviso,
        h("button.boton.acento.grande", { type: "button", onclick: () => crearSala(o, aviso) }, "Crear la sala ▶")
      )
    );
  }

  async function crearSala(o, aviso) {
    aviso.className = "pl-aviso suave";
    aviso.textContent = "Creando la sala…";
    try {
      const [lexico, juegos, { Sala }] = await Promise.all([import("../motor/lexico.js"), import("../motor/juegos/index.js"), import("../motor/sala.js")]);
      await lexico.cargarDatosJuegos?.();
      // El diccionario hace falta en el móvil del anfitrión (es quien comprueba las palabras).
      let conDiccionario = lexico.listo();
      if (!conDiccionario) {
        try {
          const texto = await leerPaquete();
          if (texto) {
            lexico.preparar(JSON.parse(texto));
            conDiccionario = true;
          }
        } catch {}
      }
      const disponibles = juegos.listaJuegos().filter((j) => j.disponible && (conDiccionario || j.categoria !== "palabras" || j.sinDiccionario));
      const codigo = await codigoLibre();
      const claveHost = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join("");
      const sala = new Sala({ claveHost, enNavegador: true, cifras: codigo });
      Object.assign(sala.config, {
        dificultad: o.dificultad,
        meta: o.meta,
        juegos: disponibles.map((j) => j.id),
        pulsadorAuto: true, // sin presentador: quien pulsa escribe la respuesta (5 s)
        pulsadorTipos: conDiccionario ? ["definicion", "calculo", "revuelto"] : ["calculo"],
      });
      sala.fase = "lobby";
      const transporte = atenderSala(codigo, sala, { nombre: perfil.nombre });
      // Que la pantalla no se apague: si el móvil del anfitrión se duerme, la partida se para.
      let despierto = null;
      navigator.wakeLock?.request("screen").then((w) => (despierto = w)).catch(() => {});
      entrarParty({
        app,
        perfil,
        alSalir: alVolver,
        crearConexion: (opciones) => conectarLocal(sala, opciones),
        claveHost,
        batalla: true,
        alCerrar: () => {
          transporte.cerrar();
          despierto?.release?.().catch(() => {});
        },
      });
    } catch {
      aviso.className = "pl-aviso mal";
      aviso.textContent = "No se pudo crear la sala. ¿Tienes internet?";
    }
  }

  // ---------------------------------------------------------------- unirse
  function unirse(aviso = "") {
    const p = pantallaGrupo({
      aviso,
      titulo: "🎟️ Unirse a sala",
      guion: 3,
      reconocer: codigoBatalla,
      resolver: async (texto) => {
        const c = codigoBatalla(texto);
        try {
          return c && (await leer(`salas/${c}/info`)) ? c : null;
        } catch {
          return null;
        }
      },
      textos: {
        escanear: "📷 Escanear el QR de la sala",
        ayuda: "o escribe el código que ves en el móvil de quien creó la sala:",
        buscando: "Buscando la sala…",
        noEsta: "No encuentro esa sala. ¿Sigue abierta?",
        formato: "El código son 6 números, como 123 456",
        sinCamara: "escribe el código de la sala",
      },
      alVolver: menu,
      alEntrar: (codigo) => entrarSala(codigo),
    });
    mostrar(p.el);
  }

  function entrarSala(codigo) {
    entrarParty({
      app,
      perfil,
      alSalir: alVolver,
      crearConexion: (opciones) => conectarBatalla({ codigo, ...opciones }),
      batalla: true,
    });
  }

  return { menu, unirse, entrarSala };
}
