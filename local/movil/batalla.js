// Batalla multijugador: jugar con los móviles por internet, sin PARTY ni TV.
// El que crea la sala ejecuta en su móvil la misma sala que PARTY (servidor/sala.js) y la maneja desde
// ahí (elige los juegos, empieza, pasa de pantalla). Los demás entran con el código o el QR. Los mensajes
// viajan por Firebase · Realtime Database (web/comun/tiemporeal.js). Los resultados se ven en cada móvil.
import { h } from "../comun/ui.js";
import { entrarParty } from "./party.js";
import { pantallaGrupo } from "./grupo.js";
import { leerPaquete } from "../solo/paquete.js";
import { codigoLibre, atenderSala, conectarBatalla, conectarLocal, leer } from "../comun/tiemporeal.js";


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

  const avisoMenu = h("div.pl-aviso.mal");
  function menu() {
    avisoMenu.textContent = "";
    mostrar(
      h(
        "section.batalla-menu",
        cabecera("⚔️ Batalla multijugador", alVolver),
        h("p.suave.batalla-intro", "Juega con tus amigos desde vuestros móviles, sin TV. Uno crea la sala y los demás se unen con el código."),
        avisoMenu,
        h(
          "div.inicio-opciones",
          h(
            "button.boton.acento.opcion",
            { type: "button", onclick: () => elegirModo() },
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

  // ---------------------------------------------------------------- modo de juego
  // Antes de crear la sala: cómo se juega (todos contra todos, por equipos o torneo) y quién elige los juegos.
  function elegirModo() {
    const o = { modo: "individual", equipos: 2, pruebas: "elegir" };
    const aviso = h("div.pl-aviso.mal");
    const cajaModos = h("div.inicio-opciones.modo-opciones");
    const cajaEquipos = h("div.modo-equipos");
    const cajaPruebas = h("div.modo-pruebas");
    const MODOS = [
      ["individual", "🏆", "Todos contra todos", "Cada uno por su cuenta. Gana quien llegue antes a la meta de puntos"],
      ["equipos", "👥", "Batalla por equipos", "Equipos repartidos al azar. Cuenta la media de puntos de cada equipo"],
      ["torneo", "⚔️", "Torneo eliminatorio", "En cada juego cae el último. Gana quien quede en pie"],
    ];
    const pintar = () => {
      cajaModos.replaceChildren(
        ...MODOS.map(([id, ico, nombre, txt]) =>
          h(
            `button.boton.opcion${o.modo === id ? ".acento" : ""}`,
            { type: "button", onclick: () => ((o.modo = id), pintar()), "aria-pressed": String(o.modo === id) },
            h("span.icono", ico),
            h("span.opcion-texto", nombre, h("small", txt)),
            h("span.opcion-flecha", { "aria-hidden": "true" }, o.modo === id ? "✔" : "")
          )
        )
      );
      cajaEquipos.replaceChildren(
        ...(o.modo === "equipos"
          ? [h("span.etiqueta", "Equipos"), h("div.modo-segmentos", [2, 3, 4].map((n) => h(`button.sel-seg${o.equipos === n ? ".elegido" : ""}`, { type: "button", onclick: () => ((o.equipos = n), pintar()) }, `${n} equipos`)))]
          : [])
      );
      cajaPruebas.replaceChildren(
        h("span.etiqueta", "Los juegos"),
        h(
          "div.modo-segmentos",
          h(`button.sel-seg${o.pruebas === "elegir" ? ".elegido" : ""}`, { type: "button", onclick: () => ((o.pruebas = "elegir"), pintar()) }, "👆 Los elijo yo"),
          h(`button.sel-seg${o.pruebas === "azar" ? ".elegido" : ""}`, { type: "button", onclick: () => ((o.pruebas = "azar"), pintar()) }, "🎲 Al azar")
        )
      );
    };
    pintar();
    mostrar(
      h(
        "section.batalla-menu.batalla-modo",
        cabecera("🏠 Crear sala", menu),
        h("p.suave.batalla-intro", "¿Cómo queréis jugar? Los puntos para ganar se ajustan en la sala, según cuántos seáis."),
        cajaModos,
        cajaEquipos,
        cajaPruebas,
        aviso,
        h("button.boton.acento.grande", { type: "button", onclick: () => crearSala(o, aviso) }, "Crear la sala ▶")
      )
    );
  }

  // ---------------------------------------------------------------- crear
  // La sala se crea directamente: el tiempo y el nivel se eligen en cada juego, como en «Jugar solo».
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
        pulsadorAuto: true, // sin presentador: quien pulsa escribe la respuesta (5 s)
        pulsadorTipos: conDiccionario ? ["definicion", "calculo", "revuelto"] : ["calculo"],
      });
      // Modo, equipos y cómo se eligen los juegos (la meta se ajusta luego en la sala, según cuántos seáis).
      sala.configurarBatalla({ modo: o.modo, equipos: o.modo === "equipos" ? o.equipos : 0, pruebas: o.pruebas, juegos: disponibles.map((j) => j.id), meta: 5 });
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
  function unirse(aviso = "", { titulo = "🎟️ Unirse a sala", alEntrar = (codigo) => entrarSala(codigo), volver = menu } = {}) {
    const p = pantallaGrupo({
      aviso,
      titulo,
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
      alVolver: volver,
      alEntrar,
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

  /** Pantalla grande: se pide el código de la sala y se abre la vista para mirar. */
  const verSala = (alEntrar) => unirse("", { titulo: "📺 Pantalla grande", alEntrar, volver: alVolver });

  return { menu, unirse, entrarSala, verSala };
}
