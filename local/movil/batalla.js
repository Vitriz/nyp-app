// Batalla multijugador: jugar con los móviles por internet, sin PARTY ni TV.
// El que crea la sala ejecuta en su móvil la misma sala que PARTY (servidor/sala.js) y la maneja desde
// ahí (elige los juegos, empieza, pasa de pantalla). Los demás entran con el código o el QR. Los mensajes
// viajan por Firebase · Realtime Database (web/comun/tiemporeal.js). Los resultados se ven en cada móvil.
import { h } from "../comun/ui.js";
import { entrarParty } from "./party.js";
import { pantallaGrupo } from "./grupo.js";
import { leerPaquete } from "../solo/paquete.js";
import { codigoLibre, atenderSala, conectarBatalla, conectarLocal, leer, limpiarSalas, salaViva } from "../comun/tiemporeal.js";
import { almacen } from "../comun/conexion.js";

// La sala que creaste se guarda en el móvil (quién juega, puntos, ajustes…): si cierras la app sin cerrar la
// sala, al volver a «Batalla multijugador» puedes retomarla y seguir mandando.
const GUARDADA = "nyp-batalla-sala";
const GUARDADA_MOVIL = GUARDADA;
// La sala que creó la pantalla grande (la TV o el ordenador), aparte: allí no hay jugador, solo quien elige.
const GUARDADA_TV = "nyp-pantalla-sala";
const leerGuardada = (clave = GUARDADA) => {
  try {
    return JSON.parse(almacen.leer(clave) ?? "null");
  } catch {
    return null;
  }
};


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
export function crearBatalla({ app, perfil, mostrar, alVolver, verEnGrande = null }) {
  const cabecera = (titulo, volver) =>
    h("div.barra-sup", h("button.icono-btn.volver", { type: "button", onclick: volver, "aria-label": "Volver" }, "←"), h("span.nombre", titulo));

  const avisoMenu = h("div.pl-aviso.mal");
  /** ¿Tienes una sala abierta? Un botón para volver a entrar y seguir mandando (si sigue viva). */
  function huecoRetomar(clave) {
    const hueco = h("div.batalla-retomar-hueco");
    const g = leerGuardada(clave);
    if (g?.codigo) {
      salaViva(g.codigo).then((viva) => {
        if (!viva) return almacen.guardar(clave, null);
        const n = g.sala?.jugadores?.length ?? 0;
        hueco.replaceChildren(
          h(
            "button.boton.acento.opcion.batalla-retomar",
            { type: "button", onclick: () => retomarSala(g, { pantalla: clave === GUARDADA_TV }) },
            h("span.icono", "🔁"),
            h("span.opcion-texto", `Volver a tu sala ${codigoBonito(g.codigo)}`, h("small", `Sigue abierta · ${n} ${n === 1 ? "jugador" : "jugadores"}. Retómala donde la dejaste`)),
            h("span.opcion-flecha", { "aria-hidden": "true" }, "›")
          )
        );
      });
    }
    return hueco;
  }

  function menu() {
    avisoMenu.textContent = "";
    limpiarSalas(); // de paso, fuera las salas en las que ya no queda nadie
    // ¿Tienes una sala abierta? Arriba del todo, para volver a entrar y seguir mandando.
    const hueco = huecoRetomar(GUARDADA);
    mostrar(
      h(
        "section.batalla-menu",
        cabecera("⚔️ Batalla multijugador", alVolver),
        h("p.suave.batalla-intro", "Juega con tus amigos desde vuestros móviles, sin TV. Uno crea la sala y los demás se unen con el código."),
        avisoMenu,
        hueco,
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

  // ---------------------------------------------------------------- pantalla grande
  /**
   * La TV o el ordenador: crea una sala (y elige los juegos, sin jugar) o mira la de otro con su código.
   * Los jugadores entran con sus móviles como siempre.
   */
  function menuPantalla() {
    avisoMenu.textContent = "";
    limpiarSalas();
    const hueco = huecoRetomar(GUARDADA_TV);
    mostrar(
      h(
        "section.batalla-menu",
        cabecera("📺 Pantalla grande", alVolver),
        h("p.suave.batalla-intro", "Pon la partida en la TV o el ordenador. Los jugadores juegan con sus móviles."),
        avisoMenu,
        hueco,
        h(
          "div.inicio-opciones",
          h(
            "button.boton.acento.opcion",
            { type: "button", onclick: () => elegirModo({ pantalla: true }) },
            h("span.icono", "🏠"),
            h("span.opcion-texto", "Crear sala", h("small", "Esta pantalla elige los juegos (no juega)")),
            h("span.opcion-flecha", { "aria-hidden": "true" }, "›")
          ),
          h(
            "button.boton.opcion",
            { type: "button", onclick: () => verSala((codigo) => verEnGrande?.(codigo)) },
            h("span.icono", "👀"),
            h("span.opcion-texto", "Mirar una sala", h("small", "Con el código o el QR de quien la creó")),
            h("span.opcion-flecha", { "aria-hidden": "true" }, "›")
          )
        )
      )
    );
  }

  // ---------------------------------------------------------------- modo de juego
  // Antes de crear la sala: cómo se juega (todos contra todos, por equipos o torneo) y quién elige los juegos.
  function elegirModo({ pantalla = false } = {}) {
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
        cabecera("🏠 Crear sala", pantalla ? menuPantalla : menu),
        h("p.suave.batalla-intro", "¿Cómo queréis jugar? Los puntos para ganar se ajustan en la sala, según cuántos seáis."),
        cajaModos,
        cajaEquipos,
        cajaPruebas,
        aviso,
        h("button.boton.acento.grande", { type: "button", onclick: () => crearSala(o, aviso, { pantalla }) }, "Crear la sala ▶")
      )
    );
  }

  // ---------------------------------------------------------------- crear
  /** Lo que necesita el móvil anfitrión para llevar la sala (la misma sala que PARTY y el diccionario). */
  async function prepararMotor() {
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
    return { juegos, Sala, conDiccionario };
  }

  /** Atiende la sala y entra en ella como anfitrión. Se va guardando para poder retomarla. */
  function llevarSala({ codigo, claveHost, sala, creada, reanudar = false, pantalla = false }) {
    const GUARDADA = pantalla ? GUARDADA_TV : GUARDADA_MOVIL;
    const transporte = atenderSala(codigo, sala, { nombre: pantalla ? "📺 Pantalla grande" : perfil?.nombre, reanudar: reanudar ? { creada } : null });
    // Copia de la sala en el móvil (como mucho una vez por segundo, cuando cambia algo).
    let pendiente = 0;
    const guardar = () => {
      clearTimeout(pendiente);
      pendiente = setTimeout(() => {
        try {
          almacen.guardar(GUARDADA, JSON.stringify({ codigo, claveHost, creada, guardada: Date.now(), sala: sala.exportar() }));
        } catch {}
      }, 1000);
    };
    const difundir = sala.difundir.bind(sala);
    sala.difundir = () => (difundir(), guardar());
    guardar();
    // cerrarSala: el anfitrión la cierra para todos; si no, solo sale un momento (y la puede retomar).
    let despierto = null;
    const alCerrar = ({ cerrarSala = true } = {}) => {
      clearTimeout(pendiente);
      despierto?.release?.().catch(() => {});
      if (cerrarSala) {
        almacen.guardar(GUARDADA, null);
        return transporte.cerrar();
      }
      try {
        almacen.guardar(GUARDADA, JSON.stringify({ codigo, claveHost, creada, guardada: Date.now(), sala: sala.exportar() }));
      } catch {}
      transporte.soltar();
    };
    // La pantalla grande: la vista de la TV, que manda (tiene la clave del anfitrión) pero no juega.
    if (pantalla) return verEnGrande?.(codigo, { crearConexion: (opciones) => conectarLocal(sala, opciones), clave: claveHost, alCerrar });
    // Que la pantalla no se apague: si el móvil del anfitrión se duerme, la partida se para.
    navigator.wakeLock?.request("screen").then((w) => (despierto = w)).catch(() => {});
    entrarParty({
      app,
      perfil,
      alSalir: () => menu(),
      crearConexion: (opciones) => conectarLocal(sala, opciones),
      claveHost,
      batalla: true,
      alCerrar,
    });
  }

  // La sala se crea directamente: el tiempo y el nivel se eligen en cada juego, como en «Jugar solo».
  async function crearSala(o, aviso, { pantalla = false } = {}) {
    aviso.className = "pl-aviso suave";
    aviso.textContent = "Creando la sala…";
    try {
      const { juegos, Sala, conDiccionario } = await prepararMotor();
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
      llevarSala({ codigo, claveHost, sala, creada: Date.now(), pantalla });
    } catch {
      aviso.className = "pl-aviso mal";
      aviso.textContent = "No se pudo crear la sala. ¿Tienes internet?";
    }
  }

  /** Vuelve a la sala que dejaste abierta: la misma sala, los mismos jugadores y puntos, y tú mandas. */
  async function retomarSala(g, { pantalla = false } = {}) {
    avisoMenu.className = "pl-aviso suave";
    avisoMenu.textContent = "Volviendo a tu sala…";
    try {
      const { Sala } = await prepararMotor();
      const sala = new Sala({ claveHost: g.claveHost, enNavegador: true, cifras: g.codigo });
      if (!sala.importar(g.sala)) throw new Error("copia");
      llevarSala({ codigo: g.codigo, claveHost: g.claveHost, sala, creada: g.creada, reanudar: true, pantalla });
    } catch {
      avisoMenu.className = "pl-aviso mal";
      avisoMenu.textContent = "No se pudo volver a la sala. ¿Tienes internet?";
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
  const verSala = (alEntrar) => unirse("", { titulo: "👀 Mirar una sala", alEntrar, volver: menuPantalla });

  return { menu, menuPantalla, unirse, entrarSala, verSala };
}

/** «123 456» */
function codigoBonito(c) {
  return `${String(c).slice(0, 3)} ${String(c).slice(3)}`;
}
