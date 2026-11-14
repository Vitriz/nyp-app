// Pantalla de la TV: la maneja el presentador con ratón y teclado.
import { iniciarFondo } from "../comun/fondo.js";
import { conectar } from "../comun/conexion.js";
import { h, rango, fotosMemoria, cambiarPantalla, avatar, crearReloj, TIEMPOS, msDuracion, textoSegundos, textoPuesto, textoCuenta, piezaCuenta, botonMantener, detalleJugador, vigilarEncaje, confeti } from "../comun/ui.js";
import { selectorJuegos } from "../solo/selector.js";
import { ICONOS_AMBITO } from "../comun/ambitos.js";
import { svgQR } from "../comun/qr.js";

vigilarEncaje(); // ningún número se sale de su casilla

const clave = new URLSearchParams(location.hash.slice(1)).get("clave") ?? "";
let fondo = null;
let app = null;
let avisoConexion = null;
const modulos = {};

let estado = null;
let actual = null; // { clave, el, actualizar?, desmontar? }
let con = null;
let ctxJuego = null;
// Pantalla grande de una Batalla: solo mira (se une a la sala con su código desde la app NYP).
let visor = null; // { codigo, alSalir }

/**
 * Arranca la pantalla de la TV. Sin opciones: la TV de PARTY (WebSocket con el ordenador).
 * Con crearConexion: la «pantalla grande» de una Batalla (por internet), solo para mirar.
 */
export function iniciarTV({ crearConexion = null, fondo: fondoDado = null, codigo = null, alSalir = null } = {}) {
  fondo = fondoDado ?? iniciarFondo({ espaciado: 40 });
  app = document.getElementById("app");
  avisoConexion = document.getElementById("sin-conexion");
  visor = codigo ? { codigo, alSalir } : null;
  con = (crearConexion ?? conectar)({
    alAbrir: () => con.enviar({ t: "hola", rol: "tv", clave }),
    alMensaje: (m) => {
      if (m.t === "fotos") Object.assign(fotosMemoria, m.fotos ?? {});
      else if (m.t === "estado") pintar(m);
    },
    alEstadoConexion: (ok) => avisoConexion?.classList.toggle("oculto", ok),
  });
  ctxJuego = { ahora: con.ahora, onda: fondo.onda, enviar: () => {} };
  if (visor) {
    app.replaceChildren();
    cambiarPantalla(app, h("section", h("div.espera", h("h1", "Conectando con la sala…"), h("p.suave", `Código ${codigo.slice(0, 3)} ${codigo.slice(3)}`))));
  }
}

const host = (accion, extra = {}) => con.enviar({ t: "host", accion, ...extra });

// Tiempo y nivel que elige el presentador en la rueda (como en «Jugar solo»); se recuerdan en la TV.
const NIVELES = ["facil", "normal", "dificil"];
const NOMBRES_NIVEL = { facil: "Fácil", normal: "Medio", dificil: "Difícil" };
const ajustesTV = (() => {
  try {
    return { seg: 60, nv: "normal", ...JSON.parse(localStorage.getItem("nyp-tv-ajustes") ?? "{}") };
  } catch {
    return { seg: 60, nv: "normal" };
  }
})();
const guardarAjustesTV = () => {
  try {
    localStorage.setItem("nyp-tv-ajustes", JSON.stringify(ajustesTV));
  } catch {}
};


// ------------------------------------------------------------------ bucle de pintado
function claveDe(e) {
  if (e.fase === "jugando" || e.fase === "cuenta") return `${e.fase}-${e.rondaN}`;
  if (e.fase === "presentacion") return `pres-${e.juego?.id}`;
  return e.fase;
}

function pintar(e) {
  estado = e;
  const k = claveDe(e);
  if (!actual || actual.clave !== k) {
    actual?.desmontar?.();
    actual = PANTALLAS[e.fase](e);
    actual.clave = k;
    cambiarPantalla(app, actual.el);
  }
  actual.actualizar?.(e);
}

// ------------------------------------------------------------------ piezas comunes
function marca() {
  return h("div.marca", ["N", "Y", "P"].map((l) => h("span.ficha", l)));
}

function cabecera(titulo, derecha) {
  return h("header.cabecera", marca(), h("div.titulo-juego", titulo ?? ""), derecha ?? h("div", { style: { width: "9rem" } }));
}

function tituloEnFichas(texto) {
  let n = 0;
  const largo = Math.max(...texto.split(" ").map((p) => p.length));
  return h(
    "div.fichas-titulo",
    { style: { "--n": largo } },
    texto.toUpperCase().split(" ").map((palabra) =>
      h("div.palabra", [...palabra].map((l) => h("span.ficha", { style: { animationDelay: `${n++ * 55}ms` } }, l)))
    )
  );
}

/** Lista de jugadores que se actualiza sin rehacerse (los nuevos aparecen con animación). */
function listaJugadores({ conPuntos = true } = {}) {
  const el = h("div.jugadores");
  const vacio = h("div.vacio.suave", "Todavía no hay nadie. ¡Escanead el código!");
  const fichas = new Map();
  el.append(vacio);
  return {
    el,
    actualizar(jugadores, esHost) {
      vacio.classList.toggle("oculto", jugadores.length > 0);
      const vistos = new Set();
      for (const j of jugadores) {
        vistos.add(j.id);
        let f = fichas.get(j.id);
        if (!f) {
          f = h("div.jugador.tarjeta.aparece", avatar(j), h("span.nombre"), h("span.pts"));
          if (esHost) {
            const quitar = botonMantener("Quitar", () => host("expulsar", { id: j.id }), { clase: ".suave.quitar" });
            f.append(quitar);
          }
          fichas.set(j.id, f);
          el.append(f);
        }
        f.querySelector(".nombre").textContent = j.nombre;
        f.querySelector(".pts").textContent = conPuntos && j.puntos ? `${j.puntos} pts` : "";
        // Banner del jugador con sus colores y su foto (pueden cambiar desde el móvil).
        f.querySelector(".avatar").replaceWith(avatar(j, j.conectado ? "" : ".desconectado"));
        f.classList.add("banner-tv");
        f.style.setProperty("--fondo", j.color);
        f.style.setProperty("--texto", j.colorTexto ?? "#0a1b4a");
        f.style.setProperty("--contorno", j.contorno ?? "transparent");
        f.classList.toggle("con-contorno", Boolean(j.contorno));
        f.classList.toggle("eliminado", Boolean(j.eliminado));
      }
      for (const [id, f] of fichas) if (!vistos.has(id)) (f.remove(), fichas.delete(id));
    },
  };
}

/** Jugadores agrupados por equipos (el presentador cambia a alguien de equipo con un clic). */
function listaEquipos() {
  const el = h("div.equipos-tv");
  const vistos = new Set();
  return {
    el,
    actualizar(e, esHost) {
      el.replaceChildren(
        ...e.equipos.map((eq) =>
          h(
            "div.equipo-col.tarjeta",
            { style: { "--c": eq.color } },
            h("div.equipo-cab", h("b", eq.nombre), h("span.suave", `${eq.puntos.toLocaleString("es-ES")} pts`)),
            ...e.jugadores
              .filter((j) => j.equipo === eq.id)
              .map((j) => {
                const nuevo = !vistos.has(j.id);
                vistos.add(j.id);
                return h(
                  `div.jugador${nuevo ? ".aparece" : ""}${esHost ? ".host-click" : ""}`,
                  { onclick: esHost ? () => host("moverEquipo", { id: j.id }) : null, title: esHost ? "Clic para cambiarlo de equipo" : null },
                  avatar(j, j.conectado ? "" : ".desconectado"),
                  h("span.nombre", j.nombre)
                );
              })
          )
        )
      );
    },
  };
}

/** «Modo automático · sigue en N s» y, para el anfitrión, un botón para pararlo un momento o seguir. */
function avisoAuto() {
  const texto = h("span.suave");
  const boton = h("button.boton.suave.mini.auto-pausa", { onclick: () => host("pausaAuto") });
  const el = h("span.auto-aviso", texto, boton);
  let fin = null, pausado = false, vivo = true;
  (function tic() {
    if (!vivo) return;
    const s = fin && !pausado ? Math.max(0, Math.ceil((fin - con.ahora()) / 1000)) : null;
    texto.textContent = pausado ? "Modo automático en pausa" : s != null ? `Modo automático · sigue en ${s} s` : "";
    requestAnimationFrame(tic);
  })();
  return {
    el,
    fijar: (e) => {
      pausado = Boolean(e.sala?.autoPausado);
      fin = e.automatico ? e.fin : null;
      boton.classList.toggle("oculto", !e.automatico || !e.esHost);
      boton.textContent = pausado ? "▶ Seguir" : "⏸ Pausar";
    },
    parar: () => (vivo = false),
  };
}

const MODOS = {
  individual: { icono: "👤", nombre: "Cada uno por su cuenta" },
  equipos: { icono: "👥", nombre: "Por equipos" },
  torneo: { icono: "🏆", nombre: "Torneo", ayuda: "El peor de cada prueba queda eliminado" },
};
const DIFICULTADES = { facil: "Fácil", normal: "Medio", dificil: "Difícil" };
const ICONOS = {
  "palabra-larga": "🔠", definicion: "📖", sopa: "🔍", revuelto: "🔀", paraulogico: "🐝", crucigrama: "✏️", conexiones: "🔗", semantica: "🔥", memoria: "📸", kenken: "🔢",
  "calculo-mental": "🧠", "llegar-resultado": "🎯", "mates-fugaces": "⚡", laberinto: "🧩", pulsador: "🔔", hilo: "🧵", coronas: "👑", parcelas: "📐", culebras: "🐍",
};

/** Grupo de botones donde se elige una opción. */
function opciones(lista, actual, alElegir) {
  return h(
    "div.opciones",
    lista.map(([valor, contenido]) =>
      h(`button.boton.suave.opcion-tv${valor === actual ? ".elegida" : ""}`, { onclick: () => alElegir(valor) }, contenido)
    )
  );
}

/** QR de la sala con un botón para cambiar a "descargar la app" (nunca dos QR a la vez). */
function tarjetaQR() {
  let modo = "unirse";
  let red = null;
  const img = h("img", { alt: "Código QR" });
  const titulo = h("h2");
  const linea = h("div.direccion");
  const sub = h("div.distancia.suave");
  const botones = h("div.qr-modos");
  const el = h("section.unirse.tarjeta", botones, titulo, h("div.qr", img), linea, sub);
  let ultimaUrl = null;
  function pintar() {
    if (!red) return;
    const palabras = red.tunel?.match(/https:\/\/([a-z0-9-]+)\.trycloudflare\.com/)?.[1];
    const unirse = palabras && red.urlApp ? `${red.urlApp}#s=${palabras}` : `${red.tunel ?? red.local}#party`;
    const descarga = red.urlApp ? `${red.urlApp}#instalar` : null;
    if (!descarga) modo = "unirse";
    botones.replaceChildren(
      ...(descarga
        ? [
            h(`button.boton.suave${modo === "unirse" ? ".elegida" : ""}`, { onclick: () => ((modo = "unirse"), pintar()) }, "🎮 Unirse"),
            h(`button.boton.suave${modo === "app" ? ".elegida" : ""}`, { onclick: () => ((modo = "app"), pintar()) }, "📲 Descargar app"),
          ]
        : [])
    );
    const url = modo === "app" ? descarga : unirse;
    if (url !== ultimaUrl) {
      ultimaUrl = url;
      img.src = `/qr.svg?u=${encodeURIComponent(url)}`;
    }
    if (modo === "app") {
      titulo.textContent = "Descarga la app";
      linea.textContent = "NYP · funciona también sin internet";
      sub.textContent = "Al abrirla, crea tu perfil y vuelve a «Unirse»";
    } else {
      titulo.textContent = "Escanea para jugar";
      linea.textContent = red.codigo ? `Código: ${red.codigo}` : unirse.replace(/^https?:\/\//, "").replace(/\/?#party$/, "");
      sub.textContent = {
        apagado: "Solo en esta red wifi",
        conectando: "Conectando a internet…",
        activo: "Desde casa o a distancia 🌍",
        error: "Sin internet: solo en esta red wifi",
      }[red.tunelEstado] ?? "";
    }
  }
  return { el, actualizar: (e) => ((red = e.red), pintar()) };
}

const enlaceBatalla = (c) => `${new URL("./", location.href).href.split("#")[0]}#b=${c}`;
/** Pantalla grande: dejar de mirar la sala. */
function botonSalirVisor() {
  return visor ? h("button.boton.suave.salir", { onclick: () => visor.alSalir?.() }, "✕ Dejar de mirar") : undefined;
}

/** ⏻ Salir de PARTY, arriba a la derecha (mantener pulsado para no salir sin querer). */
function botonSalir() {
  return botonSalirVisor();
}

/** El QR en una ventana encima (para quien llega tarde). */
function ventanaQR(e) {
  const qr = tarjetaQR();
  qr.actualizar(e);
  const capa = h("div.capa", { onclick: (ev) => ev.target === capa && capa.remove() }, h("div.capa-caja.capa-qr", qr.el, h("button.boton.acento", { onclick: () => capa.remove() }, "Cerrar")));
  document.body.append(capa);
}

/** Reglas de la sala para la tarjeta de la pantalla grande: [icono, texto]. */
function reglasSala(t) {
  return [
    [{ individual: "🏆", equipos: "👥", torneo: "⚔️" }[t.modo] ?? "🎮", { individual: "Todos contra todos", equipos: `Por equipos (${t.equipos})`, torneo: "Torneo eliminatorio" }[t.modo] ?? ""],
    t.modo === "torneo" ? ["❌", "Cae el último de cada juego"] : ["🏁", t.meta ? `Gana quien llegue a ${t.meta} puntos` : "Sin límite de puntos"],
    t.pruebas === "azar" ? ["🎲", "Juegos al azar"] : ["👆", "El anfitrión elige los juegos"],
  ];
}

function resumenSala(t) {
  return [
    `${MODOS[t.modo]?.icono ?? ""} ${MODOS[t.modo]?.nombre ?? ""}${t.modo === "equipos" ? ` (${t.equipos})` : ""}`,
    `Dificultad: ${DIFICULTADES[t.dificultad] ?? ""}`,
    t.modo !== "torneo" ? (t.meta ? `🏁 Gana quien llegue a ${t.meta}` : "Sin límite de puntos") : null,
    t.pruebas === "azar" ? "🎲 Pruebas al azar" : "Pruebas a elegir",
  ].filter(Boolean);
}

// ------------------------------------------------------------------ pantallas
const PANTALLAS = {
  /** Antes de abrir la sala: modo de juego, dificultad y pruebas. */
  nueva(e) {
    if (!e.esHost) return { el: h("section", cabecera("Preparando la sala…"), h("div.vacio.suave.centro", "El anfitrión está eligiendo las opciones")) };
    const disponibles = e.catalogo.filter((j) => j.disponible);
    const o = { ...e.sala, equipos: e.sala.equipos || 2, juegos: [...e.sala.juegos] };
    const qr = tarjetaQR();
    const columnas = h("div.nueva-cols");
    const cuerpo = h("div.nueva", h("div.nueva-qr", qr.el), columnas);
    const crear = () => host("crearSala", { opciones: o });
    function pintar() {
      const todas = o.juegos.length === disponibles.length;
      columnas.replaceChildren(
        h(
          "div.nueva-col",
          h("span.etiqueta", "Cómo se juega"),
          opciones(
            Object.entries(MODOS).map(([k, m]) => [k, [h("span.op-icono", m.icono), h("span", h("b", m.nombre), m.ayuda ? h("small", m.ayuda) : null)]]),
            o.modo,
            (v) => ((o.modo = v), pintar())
          ),
          o.modo === "equipos"
            ? h("div.fila-op", h("span.suave", "Equipos:"), opciones([2, 3, 4].map((n) => [n, String(n)]), o.equipos, (v) => ((o.equipos = v), pintar())))
            : null,
          h("span.etiqueta", "Dificultad"),
          opciones(Object.entries(DIFICULTADES).map(([k, t]) => [k, t]), o.dificultad, (v) => ((o.dificultad = v), pintar())),
          o.modo !== "torneo" ? h("span.etiqueta", "Puntos para ganar") : null,
          o.modo !== "torneo"
            ? opciones([[30, "30"], [50, "50"], [75, "75"], [100, "100"], [0, "∞"]], o.meta ?? 50, (v) => ((o.meta = v), pintar()))
            : null,
          h("span.etiqueta", "Pruebas"),
          opciones(
            [
              ["elegir", [h("span.op-icono", "👆"), h("span", h("b", "Las elijo yo"), h("small", "En cada ronda, con la rueda"))]],
              ["azar", [h("span.op-icono", "🎲"), h("span", h("b", "Al azar"), h("small", "Van saliendo solas, una tras otra"))]],
            ],
            o.pruebas,
            (v) => ((o.pruebas = v), pintar())
          ),
          // Al azar: cuánto dura cada pantalla antes de pasar sola (presentación, resultados, clasificación).
          o.pruebas === "azar"
            ? h("div.fila-op", h("span.suave", "Cada pantalla:"), opciones([5, 10, 15, 20, 30].map((s) => [s, `${s} s`]), o.tiempoAuto ?? 10, (v) => ((o.tiempoAuto = v), pintar())))
            : null
        ),
        h(
          "div.nueva-col",
          h(
            "div.fila-op.entre",
            h("span.etiqueta", `Qué pruebas entran (${o.juegos.length})`),
            h("button.boton.suave.mini", { onclick: () => ((o.juegos = todas ? [] : disponibles.map((j) => j.id)), pintar()) }, todas ? "Quitar todas" : "Todas")
          ),
          h(
            "div.nueva-juegos",
            disponibles.map((j) => {
              const on = o.juegos.includes(j.id);
              return h(
                `button.juego-toggle${on ? ".on" : ""}`,
                { onclick: () => ((o.juegos = on ? o.juegos.filter((x) => x !== j.id) : [...o.juegos, j.id]), pintar()) },
                h("span.op-icono", ICONOS[j.id] ?? "🎲"),
                h("span", h("b", j.nombre), h("small", { palabras: "Palabras", numeros: "Números", pulsador: "Pulsador" }[j.categoria])),
                h("span.marca-on", on ? "✔" : "")
              );
            })
          ),
          h(
            "div.nueva-pie",
            h("button.boton.acento.crear-sala", { disabled: !o.juegos.length, onclick: crear }, e.jugadores.length ? "Guardar y volver ▶" : "Crear sala ▶", h("span.tecla", "Enter"))
          )
        )
      );
    }
    pintar();
    return { el: h("section", cabecera(e.jugadores.length ? "Ajustes de la sala" : "Crear sala", botonSalir()), cuerpo), crear, actualizar: (e) => qr.actualizar(e) };
  },

  lobby(e) {
    const jugadores = listaJugadores();
    const equipos = listaEquipos();
    const resumen = h("div.sala-resumen");
    const codigo = h("span.codigo-mini");
    const reglas = h("div.reglas.tarjeta");
    const izq = h(
      "section.lobby-izq",
      h("span.etiqueta", "Jugadores"),
      h("div.lobby-jugadores", jugadores.el, equipos.el),
      h("div.lobby-unirse", codigo, h("button.boton.suave.mini", { onclick: () => ventanaQR(estado) }, "📱 Ver QR")),
      reglas
    );
    const lado = h("section.lado");
    const t = e.sala;
    if (e.esHost) {
      const juegos = e.catalogo.filter((j) => j.disponible && t.juegos.includes(j.id));
      let zona;
      if (t.pruebas === "elegir") {
        // La misma rueda que en "Jugar solo".
        zona = h(
          "div.lobby-rueda",
          selectorJuegos({
            juegos,
            tiempo: { lista: TIEMPOS, de: () => (TIEMPOS.includes(ajustesTV.seg) ? ajustesTV.seg : 60), fijar: (j, seg) => ((ajustesTV.seg = seg), guardarAjustesTV()) },
            nivel: { lista: NIVELES, nombres: NOMBRES_NIVEL, de: () => ajustesTV.nv, fijar: (j, nv) => ((ajustesTV.nv = nv), guardarAjustesTV()) },
            textoJugar: "▶ Jugar esta prueba",
            alJugar: (j) => host("elegir", { juego: j.id, segundos: TIEMPOS.includes(ajustesTV.seg) ? ajustesTV.seg : 60, dificultad: ajustesTV.nv }),
          })
        );
      } else {
        zona = h(
          "div.lobby-azar.tarjeta",
          h("div.azar-icono", "🎲"),
          h("h2", "Pruebas al azar"),
          h("div.azar-chips", juegos.map((j) => h("span.chip-juego", `${ICONOS[j.id] ?? ""} ${j.nombre}`))),
          h("button.boton.acento.crear-sala", { onclick: () => host("aleatorio") }, "▶ Empezar", h("span.tecla", "Enter"))
        );
      }
      lado.append(
        zona,
        h(
          "div.panel-host",
          h("button.boton.suave", { onclick: () => host("ajustes") }, "⚙ Ajustes de la sala"),
          t.modo === "equipos" ? h("button.boton.suave", { onclick: () => host("repartir") }, "🔀 Repartir equipos") : null,
          botonMantener(t.modo === "torneo" ? "Reiniciar torneo" : "Reiniciar puntos", () => host("reiniciarPuntos"), { clase: ".suave" })
        )
      );
    } else if (visor) {
      // Pantalla grande de una Batalla: el código y el QR para unirse, bien grandes.
      const qr = h("div.visor-qr");
      try {
        qr.innerHTML = svgQR(enlaceBatalla(visor.codigo));
      } catch {}
      lado.append(
        h(
          "div.visor-unirse.tarjeta",
          qr,
          h("div.visor-texto", h("span.etiqueta", "Únete a la sala"), h("b.visor-codigo", `${visor.codigo.slice(0, 3)} ${visor.codigo.slice(3)}`), h("p.visor-paso", "Escanea el QR o escribe el código en ", h("b", "NYP")), h("p.suave.visor-espera", "El anfitrión elige los juegos desde su móvil."))
        )
      );
    } else {
      lado.append(h("div.vacio.suave", "Esperando a que el anfitrión elija la prueba…"));
    }

    // Arriba, los jugadores conectados; debajo, el selector como en «Jugar solo» (ficha a la izquierda y rueda a la derecha).
    if (visor) izq.querySelector(".lobby-unirse")?.remove(); // el código ya sale grande a la derecha
    const el = h("section", cabecera("¡Bienvenidos!", e.esHost ? botonSalir() : botonSalirVisor()), h("div.lobby.lobby-v4", izq, lado));
    return {
      el,
      actualizar(e) {
        codigo.textContent = e.red.codigo ? `Código: ${e.red.codigo}` : "";
        const t = e.sala;
        const campeon = t.campeon && e.jugadores.find((j) => j.id === t.campeon);
        // Las reglas de la partida, juntas en una tarjeta (el nivel se elige en cada juego, no aquí).
        reglas.replaceChildren(
          h("span.etiqueta", "Reglas"),
          ...(campeon ? [h("div.campeon", "🏆 Campeón: ", h("b", campeon.nombre))] : []),
          ...reglasSala(t).map(([ico, txt]) => h("div.regla", h("span.regla-ico", ico), h("span", txt)))
        );
        jugadores.el.classList.toggle("oculto", Boolean(e.equipos));
        equipos.el.classList.toggle("oculto", !e.equipos);
        if (e.equipos) equipos.actualizar(e, e.esHost);
        else jugadores.actualizar(e.jugadores, e.esHost);
      },
    };
  },

  /** ¡Hay ganador! El podio a pantalla completa, con confeti. */
  victoria(e) {
    const podio = e.podio ?? [];
    const orden = [podio.find((p) => p.puesto === 2) ?? podio[1], podio.find((p) => p.puesto === 1) ?? podio[0], podio.find((p) => p.puesto === 3) ?? podio[2]].filter(Boolean);
    const torneo = e.sala?.modo === "torneo";
    const sitio = (p, k) =>
      h(
        `div.podio-sitio.p${p.puesto}`,
        { style: { animationDelay: `${[1100, 400, 1800][k]}ms` } },
        h("div.podio-quien", p.equipo ? h("span.avatar.podio-equipo", { style: { "--c": p.color } }, "👥") : avatar(p), p.puesto === 1 ? h("span.podio-corona", "👑") : null),
        h("b.podio-nombre", p.nombre),
        h("small.podio-puntos", torneo ? (p.puesto === 1 ? "Campeón del torneo" : p.puesto === 2 ? "Cayó en la final" : "Cayó en semis") : `${p.puntos} puntos`),
        h("div.podio-escalon", h("span", ["🥇", "🥈", "🥉"][p.puesto - 1] ?? p.puesto))
      );
    const el = h(
      "section.victoria-tv",
      cabecera("", e.esHost ? botonSalir() : botonSalirVisor()),
      h(
        "div.victoria-cuerpo",
        h("div.victoria-titulo.aparece", h("span.victoria-trofeo", "🏆"), h("h1", `¡${podio[0]?.nombre ?? ""} gana la partida!`)),
        h("div.podio", [...new Set(orden)].map((p) => sitio(p, orden.indexOf(p))))
      ),
      h("footer.pie", h("span.suave", e.esHost ? "" : "Esperando a que el anfitrión elija revancha…"), e.esHost ? h("button.boton.acento", { onclick: () => host("revancha") }, "🔁 Revancha") : null)
    );
    setTimeout(() => confeti(160), 1500);
    setTimeout(() => confeti(120), 3400);
    return { el };
  },

  presentacion(e) {
    const aviso = avisoAuto();
    const duraciones = h("div.duraciones");
    const cuerpo = h(
      "div.presentacion",
      h("span.etiqueta", { palabras: "Prueba de palabras", numeros: "Prueba de números", pulsador: "Ronda de pulsador" }[e.juego.categoria]),
      tituloEnFichas(e.juego.nombre),
      h("p.descripcion", e.juego.descripcion)
    );
    if (e.esHost) {
      cuerpo.append(
        duraciones,
        h(
          "div.acciones",
          h("button.boton.suave", { onclick: () => host("volver") }, "Volver", h("span.tecla", "Esc")),
          h("button.boton.acento", { onclick: () => host("empezar") }, "¡Empezar!", h("span.tecla", "Espacio"))
        )
      );
    } else cuerpo.append(h("p.suave", "Esperando al presentador…"));
    const el = h("section", cabecera(""), cuerpo, h("footer.pie", h("span.suave", ""), aviso.el));
    const pieTexto = el.querySelector(".pie > span");
    return {
      el,
      actualizar(e) {
        aviso.fijar(e);
        const conectados = e.jugadores.filter((j) => j.conectado).length;
        pieTexto.textContent = `${conectados} ${conectados === 1 ? "jugador listo" : "jugadores listos"} · ${e.red.tunel ?? e.red.local}`;
        if (e.juego.ambitos?.length && e.esHost) {
          const actual = e.sala?.ambito ?? "azar";
          duraciones.replaceChildren(
            h(
              "div.ambitos-tv",
              h(`button.boton.suave${actual === "todos" ? ".elegida" : ""}`, { onclick: () => host("ambito", { valor: "todos" }) }, "🌍 Todos"),
              h(`button.boton.suave${actual === "azar" ? ".elegida" : ""}`, { onclick: () => host("ambito", { valor: "azar" }) }, "🎲 Al azar"),
              ...e.juego.ambitos.map((a) =>
                h(`button.boton.suave${a === actual ? ".elegida" : ""}`, { onclick: () => host("ambito", { valor: a }) }, `${ICONOS_AMBITO[a] ?? "📚"} ${a}`)
              )
            ),
            h(
              "div.duraciones",
              h("span.suave", "Tiempo:"),
              ...TIEMPOS.map((s) =>
                h(`button.boton.suave${s === e.juego.duracion ? ".elegida" : ""}`, { onclick: () => host("duracion", { segundos: s }) }, textoSegundos(s))
              )
            )
          );
          return;
        }
        if (e.juego.id === "pulsador" && e.esHost) {
          const tipos = { definicion: "Definiciones", calculo: "Cálculo mental", revuelto: "Revuelto" };
          duraciones.replaceChildren(
            h("span.suave", "Preguntas:"),
            ...Object.entries(tipos).map(([t, txt]) => {
              const on = e.pulsadorTipos.includes(t);
              return h(`button.boton.suave${on ? ".elegida" : ""}`, {
                onclick: () => host("opcion", { clave: "pulsadorTipos", valor: on ? e.pulsadorTipos.filter((x) => x !== t) : [...e.pulsadorTipos, t] }),
              }, txt);
            }),
            h("span.suave", "· Tiempo:"),
            ...TIEMPOS.map((s) =>
              h(`button.boton.suave${s === e.juego.duracion ? ".elegida" : ""}`, { onclick: () => host("duracion", { segundos: s }) }, textoSegundos(s))
            )
          );
          return;
        }
        duraciones.replaceChildren(
          h("span.suave", "Tiempo:"),
          ...TIEMPOS.map((s) =>
            h(`button.boton.suave${s === e.juego.duracion ? ".elegida" : ""}`, { onclick: () => host("duracion", { segundos: s }) }, textoSegundos(s))
          ),
          // Cálculo mental sin límite: cuántas operaciones.
          ...(e.juego.id === "calculo-mental" && !e.juego.duracion
            ? [
                h("span.suave", "· Operaciones:"),
                ...[5, 8, 12, 16, 20].map((n) =>
                  h(`button.boton.suave${n === (e.sala?.operaciones ?? 8) ? ".elegida" : ""}`, { onclick: () => host("opcion", { clave: "operaciones", valor: n }) }, String(n))
                ),
              ]
            : [])
        );
      },
      desmontar: () => aviso.parar(),
    };
  },

  cuenta(e) {
    const caja = h("div.cuenta");
    const el = h("section", cabecera(e.juego.nombre), caja);
    let ultimo = null, vivo = true;
    (function tic() {
      if (!vivo) return;
      const txt = textoCuenta(estado.fin - con.ahora());
      if (txt !== ultimo) {
        ultimo = txt;
        caja.replaceChildren(txt === "¡YA!" ? piezaCuenta(txt) : h("span.ficha", txt));
      }
      requestAnimationFrame(tic);
    })();
    return { el, desmontar: () => (vivo = false) };
  },

  jugando(e) {
    const reloj = crearReloj(con.ahora);
    reloj.el.classList.add("reloj-tv");
    const inicio = e.fin - msDuracion(e.juego.duracion);
    const cuerpo = h("div.jugando-cuerpo");
    const pie = h("footer.pie", h("span.suave", ""));
    if (e.esHost && e.juego.id === "pulsador") {
      const sol = h("span.solucion-oculta");
      const ver = h("button.boton.suave", { title: "Mantén pulsado para ver la solución" }, "👁 Solución", sol);
      const mostrar = (v) => (sol.textContent = v ? ` ${estado.mando?.solucion ?? ""}` : "");
      ver.addEventListener("pointerdown", () => mostrar(true));
      for (const ev of ["pointerup", "pointerleave"]) ver.addEventListener(ev, () => mostrar(false));
      pie.append(
        h(
          "div.fila",
          ver,
          h("button.boton.pul-ok", { onclick: () => host("juego", { sub: "correcto" }) }, "✔ Correcto", h("span.tecla", "C")),
          h("button.boton.pul-mal", { onclick: () => host("juego", { sub: "fallo" }) }, "✘ Fallo", h("span.tecla", "F")),
          h("button.boton.suave", { onclick: () => host("juego", { sub: "saltar" }) }, "⏭ Saltar", h("span.tecla", "S")),
          botonMantener("Terminar ya", () => host("terminar"), { clase: ".suave" })
        )
      );
    } else if (e.esHost) {
      pie.append(
        h(
          "div.fila",
          e.juego.duracion ? h("button.boton.suave", { onclick: () => host("masTiempo") }, "+15 s") : null,
          botonMantener("Terminar ya", () => host("terminar"), { clase: ".suave" })
        )
      );
    }
    const jugandoTxt = h("span.chip-jugando");
    const el = h("section", cabecera(e.juego.nombre, h("div.cabecera-der", jugandoTxt, reloj.el)), cuerpo, pie);
    let modulo = null;
    cargarModulo(e.juego.id).then((m) => {
      if (actual?.el !== el) return;
      modulo = m?.montar(cuerpo, estado, ctxJuego) ?? null;
      if (!m) cuerpo.append(h("p.descripcion", "¡A jugar!"));
    });
    return {
      el,
      actualizar(e) {
        reloj.fijar(e.fin, e.fin - inicio);
        const conectados = e.jugadores.filter((j) => j.conectado).length;
        jugandoTxt.textContent = `👥 ${conectados} jugando`;
        modulo?.actualizar(e);
      },
      desmontar() {
        reloj.parar();
        modulo?.desmontar?.();
      },
    };
  },

  resultados(e) {
    const aviso = avisoAuto();
    const n = (e.resultados ?? []).length;
    const maxChips = n <= 3 ? 24 : n <= 5 ? 12 : 7; // con mucha gente, menos fichas por jugador
    const tabla = h(
      "div.tabla",
      (e.resultados ?? []).map((r, i) =>
        h(
          `div.fila-res.tarjeta.aparece${r.puesto === 1 ? ".p1" : ""}${r.detalle?.length ? ".con-detalle" : ""}`,
          { style: { animationDelay: `${(e.resultados.length - 1 - i) * 140}ms`, "--c": r.color } },
          h("span.puesto", rango(r.puesto, { empate: (e.resultados ?? []).filter((x) => x.puesto === r.puesto).length > 1 })),
          avatar(r),
          h("span.res-nombre", r.nombre),
          h("span.detalle", r.texto),
          h(`span.suma${r.puntos ? "" : ".cero"}`, `+${r.puntos ?? 0}`),
          detalleJugador(r.detalle, { max: maxChips, clase: ".fila-respuestas" })
        )
      )
    );
    const pie = h("footer.pie", aviso.el);
    const fuera = e.sala?.eliminadoRonda && e.jugadores.find((j) => j.id === e.sala.eliminadoRonda);
    if (fuera) pie.prepend(h("div.eliminado-aviso", "❌ Queda eliminado: ", h("b", fuera.nombre)));
    else if (e.sala?.modo === "torneo") pie.prepend(h("div.eliminado-aviso.suave", "Empate abajo: esta vez no sale nadie"));
    if (e.esHost) pie.append(h("button.boton.acento", { onclick: () => host("siguiente") }, "Clasificación", h("span.tecla", "Espacio")));
    if ((e.resultados ?? []).length > 7) tabla.classList.add("compacta");
    const cuerpo = h("div.res-cuerpo", tabla);
    const el = h("section", cabecera(`Resultados · ${e.juego.nombre}`), cuerpo, pie);
    if (e.resumen) {
      cargarModulo(e.juego.id).then((m) => m?.resumen && cuerpo.append(m.resumen(e.resumen)));
    }
    return { el, actualizar: (e) => aviso.fijar(e), desmontar: () => aviso.parar() };
  },

  /**
   * Clasificación: una barra vertical por jugador (o por equipo) que sube hasta la meta de puntos.
   * El avatar va encima de su barra y sube con ella; quien ganó la última prueba lo celebra y los
   * últimos se ponen tristes. Si alguien llega a la meta, gana la partida.
   */
  clasificacion(e) {
    const aviso = avisoAuto();
    const t = e.sala ?? {};
    const ganado = Object.fromEntries((e.resultados ?? []).map((r) => [r.id, r.puntos ?? 0]));
    const filas = e.equipos
      ? e.equipos.map((q) => {
          const miembros = e.jugadores.filter((j) => j.equipo === q.id);
          const antes = miembros.length ? miembros.reduce((a, j) => a + j.puntos - (ganado[j.id] ?? 0), 0) / miembros.length : 0;
          const animos = miembros.map((j) => t.animo?.[j.id]);
          const animo = animos.includes("gana") ? "gana" : animos.length && animos.every((x) => x === "pierde") ? "pierde" : null;
          return { id: q.id, nombre: q.nombre, color: q.color, puntos: q.puntos, antes, puesto: q.puesto, animo, avatarEl: () => h("span.avatar", { style: { "--c": q.color } }, "👥") };
        })
      : e.jugadores.map((j) => ({ id: j.id, nombre: j.nombre, color: j.color, puntos: j.puntos, antes: j.puntos - (ganado[j.id] ?? 0), puesto: j.puesto, animo: t.animo?.[j.id], eliminado: j.eliminado, avatarEl: () => avatar(j) }));
    filas.sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre));
    // Arriba del todo, la meta; sin meta (torneo), la barra más alta marca el máximo.
    const meta = t.modo === "torneo" ? 0 : t.meta;
    const tope = meta || Math.max(1, ...filas.map((f) => f.puntos)) * 1.12;
    const pct = (v) => `${Math.max(0, Math.min(100, (v / tope) * 100))}%`;
    const nombreDe = (id) => filas.find((f) => f.id === id)?.nombre ?? "";

    const columnas = filas.map((f, i) => {
      const relleno = h("div.col-relleno", { style: { height: pct(f.antes) } });
      const cima = h(
        `div.col-cima${f.animo ? "." + f.animo : ""}${t.campeon === f.id ? ".campeon" : ""}`,
        { style: { bottom: pct(f.antes) } },
        t.campeon === f.id ? h("span.col-corona", "👑") : null,
        f.avatarEl(),
        f.animo === "gana" ? h("span.col-fiesta", "🎉") : f.animo === "pierde" ? h("span.col-lagrima", "💧") : null
      );
      const gano = Math.round((f.puntos - f.antes) * 10) / 10;
      const mas = gano > 0 ? h("span.col-mas", { style: { animationDelay: `${700 + i * 90}ms` } }, `+${gano.toLocaleString("es-ES")}`) : null;
      if (gano > 0) setTimeout(() => relleno.classList.add("destello"), 600 + i * 90);
      const col = h(
        `div.col${f.eliminado ? ".eliminado" : ""}${(t.desempate ?? []).includes(f.id) ? ".desempate" : ""}`,
        { style: { "--c": f.color, animationDelay: `${i * 70}ms` } },
        h("div.col-carril", relleno, cima, mas),
        h("b.col-puntos", f.puntos.toLocaleString("es-ES")),
        h("span.col-nombre", f.eliminado ? `❌ ${f.nombre}` : f.nombre)
      );
      // La barra sube desde lo que tenía antes de la última prueba hasta lo que tiene ahora.
      setTimeout(() => {
        relleno.style.height = pct(f.puntos);
        cima.style.bottom = pct(f.puntos);
      }, 500 + i * 90);
      return col;
    });

    const carrera = h(
      `div.carrera${filas.length > 7 ? ".muchos" : ""}`,
      meta ? h("div.carrera-meta", h("span", `🏁 Meta: ${meta}`)) : null,
      h("div.carrera-cols", { style: { "--n": filas.length } }, columnas)
    );
    const avisoArriba = t.campeon
      ? h("div.campeon.tarjeta.aparece", "🏆 ¡", h("b", nombreDe(t.campeon)), t.modo === "torneo" ? " gana el torneo!" : " gana la partida!")
      : t.desempate?.length
        ? h("div.desempate-aviso.tarjeta.aparece", "⚔️ ¡Empate en la meta! ", h("b", t.desempate.map(nombreDe).join(" y ")), " se lo juegan en la última prueba")
        : null;
    if (t.campeon) setTimeout(() => confeti(120), 1400);

    const pie = h("footer.pie", aviso.el);
    if (e.esHost) {
      pie.append(
        h("button.boton.acento", { onclick: () => host("siguiente") }, t.campeon ? "Volver a la sala" : e.automatico ? "Siguiente prueba" : "Elegir siguiente prueba", h("span.tecla", "Espacio"))
      );
    }
    const titulo = e.equipos ? "Clasificación por equipos" : t.modo === "torneo" ? "Torneo" : "Clasificación";
    const el = h("section", cabecera(titulo), avisoArriba, carrera, pie);
    return { el, actualizar: (e) => aviso.fijar(e), desmontar: () => aviso.parar() };
  },
};

function medalla(p) {
  return p === 1 ? "🥇" : p === 2 ? "🥈" : p === 3 ? "🥉" : textoPuesto(p);
}

async function cargarModulo(id) {
  if (!(id in modulos)) {
    modulos[id] = import(`../juegos/${id}/tv.js`).catch(() => null);
  }
  return modulos[id];
}

// ------------------------------------------------------------------ teclado del presentador
window.addEventListener("keydown", (ev) => {
  if (!estado?.esHost) return;
  if (estado.fase === "nueva" && ev.key === "Enter") return actual?.crear?.();
  if (estado.fase === "lobby" && ev.key === "Enter" && estado.sala?.pruebas === "azar") return host("aleatorio");
  if (ev.key === " " || ev.key === "Enter") {
    if (estado.fase === "lobby") return; // en la sala, Enter lo usa la rueda
    ev.preventDefault();
    if (estado.fase === "presentacion") host("empezar");
    else if (estado.fase === "resultados" || estado.fase === "clasificacion") host("siguiente");
  } else if (estado.fase === "jugando" && estado.juego?.id === "pulsador" && /^[cfs]$/i.test(ev.key)) {
    host("juego", { sub: { c: "correcto", f: "fallo", s: "saltar" }[ev.key.toLowerCase()] });
  } else if (ev.key === "Escape") {
    if (estado.fase === "presentacion" || estado.fase === "clasificacion") host("volver");
  }
});

// En la TV de PARTY arranca sola; la app NYP la arranca como «pantalla grande» de una Batalla.
if (!window.NYP_VISOR) iniciarTV();
