// Modo partida: conectado a PARTY (la TV). Esperar, jugar y ver resultados.
import { conectar, almacen } from "../comun/conexion.js";
import { h, cambiarPantalla, avatar, banner, bannerFijo, fotosMemoria, TIEMPOS, crearReloj, msDuracion, textoSegundos, textoPuesto, textoCuenta, piezaCuenta, servidor, detalleJugador, finalLlegar, palabraPendiente } from "../comun/ui.js";
import { calmarFondo } from "../comun/fondo.js";
import { actualizarPaquete } from "../solo/paquete.js";
import { mensajeRecords, guardarFamilia } from "../comun/familia.js";
import { selectorJuegos } from "../solo/selector.js";
import { elegirAmbito, elegirNumero } from "../comun/ambitos.js";
import { svgQR } from "../comun/qr.js";

/**
 * app: contenedor; base: dirección del servidor PARTY; perfil: { nombre, color, colorTexto, foto }
 * alSalir(): vuelve al inicio de la app.
 */
/**
 * Batalla multijugador (sin PARTY): las mismas pantallas, pero la conexión es otra (crearConexion), el que
 * crea la sala la maneja desde su móvil (claveHost) y al salir se cierra la sala (alCerrar).
 */
export function entrarParty({ app, base, perfil, alSalir, alPaquete, crearConexion = null, claveHost = null, batalla = false, alCerrar = null }) {
  if (base) servidor.base = base;
  const avisoConexion = document.getElementById("sin-conexion");
  let estado = null;
  let actual = null;
  let avisoLargo = 0;
  let paquetePedido = false;
  // Un solo banner para toda la partida (se abre y se cierra; su animación nunca vuelve a empezar).
  let fijo = null;
  const banFijo = (yo) => {
    fijo ??= bannerFijo(yo);
    fijo.actualizar(yo);
    return fijo;
  };

  const tokenClave = batalla ? "nyp-token-batalla" : "nyp-token";
  const con = (crearConexion ?? conectar)({
    base,
    alAbrir: () => con.enviar({ t: "hola", rol: "jugador", token: almacen.leer(tokenClave), ...(claveHost ? { clave: claveHost } : {}) }),
    alMensaje: recibir,
    alEstadoConexion: (ok) => {
      avisoConexion.classList.toggle("oculto", ok);
      clearTimeout(avisoLargo);
      avisoConexion.textContent = "Reconectando…";
      if (!ok) avisoLargo = setTimeout(() => (avisoConexion.textContent = "Reconectando… toca aquí para salir"), 10000);
    },
  });
  avisoConexion.onclick = () => salir();
  const ctxJuego = { ahora: con.ahora, onda: () => {}, enviar: (m) => con.enviar({ t: "juego", ...m }) };

  function salir() {
    fijo?.quitar();
    fijo = null;
    calmarFondo(false);
    con.cerrar();
    actual?.desmontar?.();
    avisoConexion.classList.add("oculto");
    avisoConexion.onclick = null;
    alCerrar?.();
    alSalir();
  }

  function preguntarSalir() {
    const capa = h(
      "div.capa-movil",
      { onclick: (e) => e.target === capa && capa.remove() },
      h(
        "div.caja.tarjeta",
        h("h2", "¿Salir de la partida?"),
        h("p.suave", "Conservas tus puntos si vuelves a entrar."),
        h("button.boton.acento.grande", { type: "button", onclick: () => (capa.remove(), salir()) }, "Salir"),
        h("button.boton.suave.grande", { type: "button", onclick: () => capa.remove() }, "Seguir jugando")
      )
    );
    document.body.append(capa);
  }

  function recibir(m) {
    switch (m.t) {
      case "necesitoNombre":
        // Entramos con el perfil del móvil: no hace falta escribir nada.
        almacen.guardar(tokenClave, null);
        con.enviar({ t: "unirse", nombre: perfil.nombre, color: perfil.color, colorTexto: perfil.colorTexto, contorno: perfil.contorno ?? null, foto: perfil.foto, sombrero: perfil.sombrero ?? null, animacion: perfil.animacion ?? null });
        break;
      case "bienvenida":
        almacen.guardar(tokenClave, m.token);
        break;
      case "fotos":
        // Batalla: las fotos de los jugadores llegan aparte (una vez) y los avatares las citan como «mem:id».
        Object.assign(fotosMemoria, m.fotos ?? {});
        break;
      case "expulsado":
        almacen.guardar(tokenClave, null);
        mostrar("expulsado", () => ({
          el: h("section", h("div.espera", h("h1", "El presentador te ha sacado de la partida"), h("button.boton.grande", { onclick: salir }, "Volver al inicio"))),
        }));
        break;
      case "recordsFamilia":
        if (m.tabla?.jugadores) guardarFamilia(m.tabla);
        break;
      case "estado":
        estado = m;
        if (m.yo && !paquetePedido) {
          paquetePedido = true;
          // Al volver a una partida con el mismo móvil, mandamos el perfil por si ha cambiado.
          con.enviar({ t: "perfil", ...perfil });
          // Y nuestros récords de «Jugar solo», para la clasificación de la familia.
          con.enviar(mensajeRecords(perfil));
          // Aprovechamos para descargar el diccionario del modo solo (en segundo plano).
          if (base) actualizarPaquete(base, alPaquete).catch(() => {});
        }
        pintar(m);
        break;
    }
  }

  function mostrar(clave, construir) {
    if (actual?.clave === clave) return actual;
    actual?.desmontar?.();
    actual = construir();
    actual.clave = clave;
    cambiarPantalla(app, actual.el);
    fijo?.colocar();
    return actual;
  }

  function pintar(e) {
    if (!e.yo) return;
    let fase = e.fase === "clasificacion" || e.fase === "nueva" ? "lobby" : e.fase;
    // Torneo: quien está eliminado mira la partida en la TV.
    if (e.yo.eliminado && ["presentacion", "cuenta", "jugando"].includes(e.fase)) fase = "eliminado";
    let clave = fase === "lobby" ? "espera" : fase;
    if (fase === "jugando" || fase === "cuenta") clave += `-${e.rondaN}`;
    if (fase === "presentacion") clave += `-${e.juego?.id}`;
    const p = mostrar(clave, () => PANTALLAS[fase](e));
    p.actualizar?.(e);
  }

  // ---------------------------------------------------------------- piezas
  /** Banner que se redibuja si cambian el nombre, los colores o la foto. */
  function bannerVivo(extra = "") {
    let clave = null;
    const caja = h("span.banner-vivo");
    return {
      el: caja,
      actualizar(yo) {
        const k = [yo.nombre, yo.color, yo.colorTexto, yo.contorno, yo.foto].join("|");
        if (k !== clave) {
          clave = k;
          caja.replaceChildren(banner(yo, extra));
        }
      },
    };
  }

  /** Durante una prueba: solo tu icono, el tiempo y salir. */
  function barraJuego(e, reloj) {
    const icono = h("span.icono-yo", banFijo(e.yo).hueco("cerrado"));
    const el = h(
      "div.barra-sup.barra-juego",
      icono,
      reloj.el,
      h("button.icono-btn", { type: "button", onclick: preguntarSalir, "aria-label": "Salir de la partida" }, "✕")
    );
    return { el, actualizar: (e) => banFijo(e.yo) };
  }

  function barraSuperior(e, { reloj, plegar = false } = {}) {
    if (reloj) return barraJuego(e, reloj);
    const pts = h(`span.pts${plegar ? ".plegar" : ""}`);
    // Batalla: arriba, la sala (y si eres el anfitrión); al tocarla se abre el QR para invitar.
    const chipSala =
      batalla && e.batalla?.codigo && !plegar
        ? h(
            "button.batalla-chip",
            { type: "button", onclick: () => ventanaQR(estado ?? e), title: "Ver el QR para invitar" },
            h("small", e.esHost ? "👑 Eres el anfitrión" : "Sala"),
            h("b", codigoBonito(e.batalla.codigo)),
            h("span.batalla-chip-qr", "▦")
          )
        : null;
    // El hueco del banner fijo: abierto, o cerrado en círculo en la cuenta atrás (se va a jugar).
    const el = h(
      "div.barra-sup",
      banFijo(e.yo).hueco(plegar ? "cerrado" : "abierto"),
      chipSala,
      batalla ? null : pts,
      reloj?.el,
      h("button.icono-btn", { type: "button", onclick: preguntarSalir, "aria-label": "Salir de la partida" }, "✕")
    );
    return {
      el,
      actualizar: (e) => {
        banFijo(e.yo);
        pts.textContent = `${e.yo.puntos} pts`;
      },
    };
  }

  // ---------------------------------------------------------------- Batalla: el móvil anfitrión manda
  const host = (accion, extra = {}) => con.enviar({ t: "host", accion, ...extra });
  const enlaceSala = (codigo) => `${new URL("./", location.href).href.split("#")[0]}#b=${codigo}`;
  const codigoBonito = (c) => `${c.slice(0, 3)} ${c.slice(3)}`;

  /** Ventana con el QR y el código de la sala, para que se unan los demás. */
  function ventanaQR(e) {
    const c = e.batalla?.codigo ?? "";
    const qr = h("div.batalla-qr.grande");
    try {
      qr.innerHTML = svgQR(enlaceSala(c));
    } catch {}
    const cerrar = () => capa.remove();
    const capa = h(
      "div.capa-movil.capa-qr-sala",
      { onclick: (ev) => ev.target === capa && cerrar() },
      h(
        "div.caja.tarjeta",
        h("div.records-cabeza", h("h2", "📲 Invitar a la sala"), h("button.icono-btn", { type: "button", onclick: cerrar, "aria-label": "Cerrar" }, "✕")),
        qr,
        h("div.batalla-codigo-texto", h("small", "Código de la sala"), h("b", codigoBonito(c)), h("span.suave", "Que lo escaneen, o que entren en «Batalla multijugador → Unirse a sala» y escriban el código."))
      )
    );
    document.body.append(capa);
  }

  // Tiempo y nivel del anfitrión: como en «Jugar solo», uno para todos los juegos y se recuerda.
  const NIVELES = ["facil", "normal", "dificil"];
  const NOMBRES_NIVEL = { facil: "Fácil", normal: "Medio", dificil: "Difícil" };
  const ajustes = (() => {
    try {
      return { seg: 60, nv: "normal", ...JSON.parse(almacen.leer("nyp-batalla-ajustes") ?? "{}") };
    } catch {
      return { seg: 60, nv: "normal" };
    }
  })();
  const guardarAjustes = () => almacen.guardar("nyp-batalla-ajustes", JSON.stringify(ajustes));

  /** Selector de juegos del anfitrión: exactamente el de «Jugar solo» (tiempo, nivel, ayuda, dado…). */
  function selectorHost(e) {
    const juegos = (e.catalogo ?? []).filter((j) => j.disponible && (e.sala?.juegos ?? []).includes(j.id));
    return selectorJuegos({
      juegos,
      tiempo: { lista: TIEMPOS, de: () => (TIEMPOS.includes(ajustes.seg) ? ajustes.seg : 60), fijar: (j, s) => ((ajustes.seg = s), guardarAjustes()) },
      nivel: { lista: NIVELES, nombres: NOMBRES_NIVEL, de: () => ajustes.nv, fijar: (j, nv) => ((ajustes.nv = nv), guardarAjustes()) },
      conAyuda: true,
      alJugar: async (j) => {
        const pedido = { juego: j.id, segundos: TIEMPOS.includes(ajustes.seg) ? ajustes.seg : 60, dificultad: ajustes.nv };
        // Igual que en solo: Cálculo mental sin límite pregunta cuántas operaciones; los juegos con tema, el tema.
        if (j.id === "calculo-mental" && !pedido.segundos) {
          const n = await elegirNumero("🧠 ¿Cuántas operaciones?", [5, 8, 12, 16, 20], 8);
          if (!n) return;
          pedido.operaciones = n;
        }
        if (j.ambitos?.length) {
          const ambito = await elegirAmbito(j.ambitos);
          if (!ambito) return;
          pedido.ambito = ambito;
        }
        host("elegir", pedido);
      },
    });
  }

  function tituloEnFichas(texto) {
    const largo = Math.max(...texto.split(" ").map((p) => p.length));
    return h("div.titulo-fichas", { style: { "--n": largo } }, texto.toUpperCase().split(" ").map((p) => h("div.palabra", [...p].map((l) => h("span.ficha", l)))));
  }

  const PANTALLAS = {
    lobby(e) {
      const barra = barraSuperior(e);
      const puesto = h("p.suave");
      const lista = h("div.lista-mini");
      const equipos = h("div.elegir-equipo");
      const grande = bannerVivo(".banner-grande");
      const mensaje = h("p.suave", "Esperando al presentador…");
      // Batalla: el anfitrión ve el código para invitar y elige el juego; los demás, quién hay en la sala.
      const esHostBatalla = batalla && e.esHost;
      const panelHost = esHostBatalla ? h("div.batalla-host", selectorHost(e)) : null;
      const el = esHostBatalla
        ? h("section.batalla-sala", barra.el, panelHost, h("div.batalla-gente", puesto, lista))
        : h("section", barra.el, h("div.espera", grande.el, mensaje, equipos, puesto, lista));
      return {
        el,
        actualizar(e) {
          barra.actualizar(e);
          grande.actualizar(e.yo);
          const yo = e.jugadores.find((j) => j.id === e.yo.id);
          puesto.textContent = e.yo.puntos ? `Vas ${textoPuesto(yo?.puesto)} con ${e.yo.puntos} puntos` : "";
          const t = e.sala ?? {};
          mensaje.textContent =
            e.fase === "nueva" ? "Preparando la sala…"
            : t.campeon
              ? t.campeon === e.yo.id || t.campeon === e.yo.equipo
                ? "🏆 ¡Has ganado la partida!"
                : `🏆 Gana: ${(e.jugadores.find((j) => j.id === t.campeon) ?? e.equipos?.find((q) => q.id === t.campeon))?.nombre ?? ""}`
            : t.desempate?.length
              ? `⚔️ ¡Desempate! La próxima prueba decide entre ${t.desempate.map((id) => (e.jugadores.find((j) => j.id === id) ?? e.equipos?.find((q) => q.id === id))?.nombre ?? "").join(" y ")}`
            : t.meta && t.modo !== "torneo"
              ? `🏁 Gana quien llegue a ${t.meta} puntos`
            : e.yo.eliminado ? (t.eliminadoRonda === e.yo.id ? "❌ Te ha tocado: quedas eliminado" : "Estás eliminado del torneo")
            : t.modo === "torneo" ? "Torneo: el peor de cada prueba queda eliminado"
            : batalla ? "Esperando a que el anfitrión elija el juego…"
            : "Esperando al presentador…";
          equipos.replaceChildren(
            ...(e.equipos && e.fase !== "clasificacion"
              ? [
                  h("span.suave", "Tu equipo (toca para cambiar):"),
                  h(
                    "div.equipos-botones",
                    e.equipos.map((q) =>
                      h(
                        `button.boton.suave.equipo-btn${q.id === e.yo.equipo ? ".mio" : ""}`,
                        { type: "button", style: { "--c": q.color }, onclick: () => con.enviar({ t: "equipo", equipo: q.id }) },
                        q.nombre.replace("Equipo ", "")
                      )
                    )
                  ),
                ]
              : [])
          );
          const top = [...e.jugadores].sort((a, b) => b.puntos - a.puntos);
          lista.replaceChildren(
            ...(e.fase === "clasificacion" && e.equipos
              ? e.equipos.map((q) =>
                  h(`div.item.tarjeta${q.id === e.yo.equipo ? ".yo" : ""}`, h("span", textoPuesto(q.puesto)), h("span.avatar", { style: { "--c": q.color } }, "👥"), h("span.n", q.nombre), h("span", q.puntos.toLocaleString("es-ES")))
                )
              : []),
            // En Batalla se ve siempre quién está en la sala (y sus puntos).
            ...(e.fase === "clasificacion" || batalla ? top : []).map((j) =>
              h(`div.item.tarjeta${j.id === e.yo.id ? ".yo" : ""}`, h("span", textoPuesto(j.puesto)), avatar(j), h("span.n", j.nombre), h("span", `${j.puntos}`))
            )
          );
        },
      };
    },

    eliminado(e) {
      const barra = barraSuperior(e);
      const el = h(
        "section",
        barra.el,
        h("div.espera", h("div.puesto-grande", "👀"), h("h1", "Estás eliminado"), h("p.suave", "Sigue el torneo en la TV. ¡A la próxima!"))
      );
      return { el, actualizar: (e) => barra.actualizar(e) };
    },

    presentacion(e) {
      const barra = barraSuperior(e);
      const info = h("p.suave");
      // Batalla: el anfitrión empieza (o vuelve a elegir otro juego). El tiempo y el nivel ya los eligió en la lista.
      const controles =
        batalla && e.esHost
          ? h(
              "div.batalla-controles",
              h(
                "div.pl-botones",
                h("button.boton.suave", { type: "button", onclick: () => host("volver") }, "← Otro juego"),
                h("button.boton.acento", { type: "button", onclick: () => host("empezar") }, "¡Empezar! ▶")
              )
            )
          : null;
      const el = h(
        "section",
        barra.el,
        h("div.espera", h("span.suave", "Siguiente prueba"), tituloEnFichas(e.juego.nombre), h("p", e.juego.descripcion), info, controles)
      );
      return {
        el,
        actualizar: (e) => {
          barra.actualizar(e);
          const nivel = batalla ? ` · ${NOMBRES_NIVEL[e.sala?.dificultad] ?? ""}` : "";
          info.textContent = `${e.juego.duracion ? textoSegundos(e.juego.duracion) : "Sin límite de tiempo"}${nivel} · ${batalla && !e.esHost ? "esperando a que empiece…" : "¡prepárate!"}`;
        },
      };
    },

    cuenta(e) {
      const caja = h("div.espera");
      // Al entrar a jugar, el banner se cierra y solo queda tu icono.
      const el = h("section", barraSuperior(e, { plegar: true }).el, caja);
      let ultimo = null;
      const reloj = setInterval(() => {
        const t = textoCuenta(estado.fin - con.ahora());
        if (t !== ultimo) {
          ultimo = t;
          caja.replaceChildren(piezaCuenta(t));
          navigator.vibrate?.(30);
        }
      }, 100);
      return { el, desmontar: () => clearInterval(reloj) };
    },

    jugando(e) {
      const reloj = crearReloj(con.ahora);
      const inicio = e.fin - msDuracion(e.juego.duracion);
      const barra = barraSuperior(e, { reloj });
      const cuerpo = h("div.cuerpo-juego");
      const el = h("section", barra.el, cuerpo);
      let modulo = null;
      const yo = { el };
      calmarFondo(true); // fondo quieto y tenue mientras se juega
      import(`../juegos/${e.juego.id}/movil.js`)
        .then((m) => {
          if (actual !== yo) return;
          modulo = m.montar(cuerpo, estado, ctxJuego);
        })
        .catch(() => cuerpo.append(h("div.espera", h("p", "Este juego todavía no está disponible en el móvil."))));
      return Object.assign(yo, {
        actualizar(e) {
          barra.actualizar(e);
          reloj.fijar(e.fin, e.fin - inicio);
          modulo?.actualizar(e);
        },
        desmontar() {
          reloj.parar();
          modulo?.desmontar?.();
          calmarFondo(false);
        },
      });
    },

    resultados(e) {
      const mio = e.resultados?.find((r) => r.id === e.yo.id);
      const barra = barraSuperior(e);
      const el = h(
        "section",
        barra.el,
        h(
          "div.espera",
          h("span.suave", e.juego.nombre),
          h("div.puesto-grande.aparece", mio?.puesto ? medalla(mio.puesto) : "–"),
          h("h1", mio?.puesto ? `${mio.puesto}º puesto` : "Esta vez no has puntuado"),
          h("p", mio?.texto ?? ""),
          mio?.puntos ? h("p.suave", `+${mio.puntos} puntos`) : null,
          e.juego.id === "llegar-resultado" ? finalLlegar(e.resumen, mio?.detalle) : detalleJugador(mio?.pendiente ? mio.detalle?.slice(0, -1) : mio?.detalle, { clase: ".mis-respuestas" }),
          palabraPendiente(mio?.pendiente),
          h(
            "div.lista-mini",
            (e.resultados ?? []).slice(0, 8).map((r) =>
              h(
                `div.item.tarjeta${r.id === e.yo.id ? ".yo" : ""}`,
                h("div.item-fila", h("span", textoPuesto(r.puesto)), avatar(r), h("span.n", r.nombre), h("span.suave", r.texto)),
                r.id === e.yo.id ? null : detalleJugador(r.detalle, { max: 8 })
              )
            )
          )
        )
      );
      if (mio?.puesto === 1) navigator.vibrate?.([60, 60, 120]);
      // Batalla: el anfitrión pasa a la clasificación (y desde allí elige el siguiente juego).
      if (batalla && e.esHost) el.append(h("div.pl-botones.batalla-siguiente", h("button.boton.acento.grande", { type: "button", onclick: () => host("siguiente") }, "Ver la clasificación ▶")));
      return { el, actualizar: (e) => barra.actualizar(e) };
    },
  };

  // Mientras llega el primer estado
  mostrar("conectando", () => ({
    el: h("section", h("div.espera", h("h1", batalla ? "Entrando en la sala…" : "Conectando con la partida…"), h("p.suave", batalla ? "Comprueba que el código es correcto y que tienes internet." : "Asegúrate de que la TV está encendida."))),
  }));

  return { salir };
}

function medalla(p) {
  return p === 1 ? "🥇" : p === 2 ? "🥈" : p === 3 ? "🥉" : `${p}º`;
}
