// Modo partida: conectado a PARTY (la TV). Esperar, jugar y ver resultados.
import { conectar, almacen } from "../comun/conexion.js";
import { h, confeti, cambiarPantalla, avatar, banner, bannerFijo, fotosMemoria, TIEMPOS, crearReloj, msDuracion, textoSegundos, textoPuesto, textoCuenta, piezaCuenta, servidor, detalleJugador, finalLlegar, palabraPendiente } from "../comun/ui.js";
import { calmarFondo } from "../comun/fondo.js";
import { actualizarPaquete } from "../solo/paquete.js";
import { mensajeRecords, guardarFamilia } from "../comun/familia.js";
import { selectorJuegos, infoPartida } from "../solo/selector.js";
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

  function barraSuperior(e, { reloj, plegar = false, titulo = false } = {}) {
    if (reloj) return barraJuego(e, reloj);
    // Resultados: el juego y cómo se jugó (tiempo · nivel), al lado del perfil, como en «Jugar solo».
    const NIVEL = { facil: "Fácil", normal: "Medio", dificil: "Difícil" };
    const cabTitulo = titulo && e.juego
      ? infoPartida(e.juego, e.juego.duracion, NIVEL[e.juego.dificultad ?? e.sala?.dificultad] ?? null)
      : null;
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
      cabTitulo,
      cabTitulo ? null : chipSala,
      batalla || cabTitulo ? null : pts,
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

  /** Puntos de victoria recomendados: que la partida dure unos 6-8 juegos (2 → 5, 3 → 8, 4 → 12…). */
  const metaRecomendada = (n) => (n <= 2 ? 5 : (n - 1) * 4);
  let metaTocada = false; // si el anfitrión la cambia a mano, ya no se ajusta sola

  function pintarAjustesSala(caja, e) {
    const t = e.sala ?? {};
    const n = e.jugadores.length;
    const rec = metaRecomendada(n);
    if (!metaTocada && t.modo !== "torneo" && n >= 2 && t.meta !== rec && !t.campeon) host("meta", { valor: rec });
    const MODOS = { individual: "🏆 Todos contra todos", equipos: "👥 Batalla por equipos", torneo: "⚔️ Torneo eliminatorio" };
    const cambiar = (d) => {
      metaTocada = true;
      host("meta", { valor: Math.max(1, (t.meta || rec) + d) });
    };
    caja.replaceChildren(
      h("div.ajuste-fila", h("b.ajuste-modo", MODOS[t.modo] ?? ""), t.pruebas === "azar" ? h("span.ajuste-chip", "🎲 Juegos al azar") : h("span.ajuste-chip", "👆 Eliges tú")),
      t.modo === "torneo"
        ? h("p.suave.ajuste-nota", "En cada juego cae el último. Gana quien quede en pie.")
        : h(
            "div.ajuste-fila.ajuste-meta",
            h("span", "🏁 Gana quien llegue a"),
            h("div.meta-control", h("button.icono-btn", { type: "button", onclick: () => cambiar(-1), "aria-label": "Menos puntos" }, "−"), h("b", String(t.meta || rec)), h("button.icono-btn", { type: "button", onclick: () => cambiar(1), "aria-label": "Más puntos" }, "+")),
            h("small.suave", n >= 2 ? `Recomendado: ${rec} para ${n} jugadores${metaTocada && t.meta !== rec ? " · " : ""}` : "Se ajusta cuando entre más gente", metaTocada && t.meta !== rec ? h("button.enlace", { type: "button", onclick: () => ((metaTocada = false), host("meta", { valor: rec })) }, "usar") : null)
          ),
      e.equipos
        ? h("div.ajuste-fila", h("small.suave", "Toca a un jugador para cambiarlo de equipo"), h("button.boton.suave.mini", { type: "button", onclick: () => host("repartir") }, "🔀 Repartir"))
        : null
    );
  }

  /** Juegos al azar: el anfitrión fija el tiempo y el nivel y da paso al siguiente juego. */
  function panelAzar() {
    const seg = () => (TIEMPOS.includes(ajustes.seg) ? ajustes.seg : 60);
    const caja = h("div.panel-azar.tarjeta");
    const pintar = () =>
      caja.replaceChildren(
        h("div.azar-dado", "🎲"),
        h("h2", "Juegos al azar"),
        h("p.suave", "Cada vez sale un juego distinto. Elige el tiempo y el nivel para todos."),
        h("span.etiqueta", "Tiempo"),
        h("div.modo-segmentos", TIEMPOS.map((s) => h(`button.sel-seg${seg() === s ? ".elegido" : ""}`, { type: "button", onclick: () => ((ajustes.seg = s), guardarAjustes(), pintar()) }, textoSegundos(s)))),
        h("span.etiqueta", "Nivel"),
        h("div.modo-segmentos", NIVELES.map((nv) => h(`button.sel-seg${ajustes.nv === nv ? ".elegido" : ""}`, { type: "button", onclick: () => ((ajustes.nv = nv), guardarAjustes(), pintar()) }, NOMBRES_NIVEL[nv]))),
        h("button.boton.acento.grande", { type: "button", onclick: () => host("aleatorio", { segundos: seg(), dificultad: ajustes.nv }) }, "🎲 ¡Siguiente juego! ▶")
      );
    pintar();
    return caja;
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
      const alAzar = e.sala?.pruebas === "azar";
      const panelHost = esHostBatalla ? h("div.batalla-host", alAzar ? panelAzar() : selectorHost(e)) : null;
      // Ajustes de la partida del anfitrión: la meta (− / +, con la recomendada) y los equipos.
      const ajustesSala = esHostBatalla ? h("div.batalla-ajustes.tarjeta") : null;
      const el = esHostBatalla
        ? h("section.batalla-sala", barra.el, ajustesSala, panelHost, h("div.batalla-gente", puesto, lista))
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
          if (ajustesSala) pintarAjustesSala(ajustesSala, e);
          const top = [...e.jugadores].sort((a, b) => b.puntos - a.puntos);
          lista.replaceChildren(
            ...(e.fase === "clasificacion" && e.equipos
              ? e.equipos.map((q) =>
                  h(`div.item.tarjeta${q.id === e.yo.equipo ? ".yo" : ""}`, h("span", textoPuesto(q.puesto)), h("span.avatar", { style: { "--c": q.color } }, "👥"), h("span.n", q.nombre), h("span", q.puntos.toLocaleString("es-ES")))
                )
              : []),
            // En Batalla se ve siempre quién está en la sala (y sus puntos).
            ...(e.fase === "clasificacion" || batalla ? top : []).map((j) => {
              const q = e.equipos?.find((x) => x.id === j.equipo);
              // Por equipos, el anfitrión toca a un jugador para pasarlo al siguiente equipo.
              const mover = esHostBatalla && e.equipos ? () => host("moverEquipo", { id: j.id }) : null;
              return h(
                `${mover ? "button" : "div"}.item.tarjeta${j.id === e.yo.id ? ".yo" : ""}${q ? ".con-equipo" : ""}`,
                { type: mover ? "button" : undefined, onclick: mover, style: q ? { "--eq": q.color } : {} },
                h("span", textoPuesto(j.puesto)),
                avatar(j),
                h("span.n", j.nombre, q ? h("small.eq", q.nombre) : null),
                h("span", `${j.puntos}`)
              );
            })
          );
        },
      };
    },

    eliminado(e) {
      const barra = barraSuperior(e);
      const el = h(
        "section",
        barra.el,
        h("div.espera", h("div.puesto-grande", "👀"), h("h1", "Estás eliminado"), h("p.suave", batalla ? "Sigue el torneo desde aquí: verás los resultados de cada juego." : "Sigue el torneo en la TV. ¡A la próxima!"))
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

    /** ¡Hay ganador! El podio con los tres primeros; el anfitrión elige revancha o salir. */
    victoria(e) {
      const barra = barraSuperior(e);
      const podio = e.podio ?? [];
      const gano = podio[0] && (podio[0].id === e.yo.id || podio[0].id === e.yo.equipo);
      const miPuesto = podio.find((p) => p.id === e.yo.id || p.id === e.yo.equipo)?.puesto;
      const escalon = (p, k) =>
        h(
          `div.podio-sitio.p${p.puesto}`,
          { style: { animationDelay: `${[900, 300, 1500][k]}ms` } },
          h("div.podio-quien", p.equipo ? h("span.avatar.podio-equipo", { style: { "--c": p.color } }, "👥") : avatar(p), p.puesto === 1 ? h("span.podio-corona", "👑") : null),
          h("b.podio-nombre", p.nombre),
          h("small.podio-puntos", e.sala?.modo === "torneo" ? (p.puesto === 1 ? "Campeón" : `Cayó ${p.puesto === 2 ? "en la final" : "en semis"}`) : `${p.puntos} pts`),
          h("div.podio-escalon", h("span", ["🥇", "🥈", "🥉"][p.puesto - 1] ?? p.puesto))
        );
      // En el podio: el 2º a la izquierda, el 1º en medio y el 3º a la derecha.
      const orden = [podio.find((p) => p.puesto === 2) ?? podio[1], podio.find((p) => p.puesto === 1) ?? podio[0], podio.find((p) => p.puesto === 3) ?? podio[2]].filter(Boolean);
      const el = h(
        "section.victoria",
        barra.el,
        h(
          "div.victoria-cuerpo",
          h("div.victoria-titulo.aparece", h("span.victoria-trofeo", "🏆"), h("h1", gano ? "¡Has ganado!" : `¡${podio[0]?.nombre ?? ""} gana!`), h("p.suave", gano ? "Eres el campeón de la partida" : miPuesto ? `Has quedado ${miPuesto}º` : "¡A por la revancha!")),
          h("div.podio", [...new Set(orden)].map((p) => escalon(p, orden.indexOf(p))))
        ),
        batalla && e.esHost
          ? h(
              "div.pl-botones",
              h("button.boton.suave", { type: "button", onclick: preguntarSalir }, "Salir"),
              h("button.boton.acento", { type: "button", onclick: () => host("revancha") }, "🔁 Revancha")
            )
          : h("p.suave.victoria-espera", batalla ? "Esperando a que el anfitrión elija revancha…" : "")
      );
      setTimeout(() => confeti(gano ? 160 : 90), 1200);
      if (gano) navigator.vibrate?.([80, 60, 80, 60, 200]);
      return { el, actualizar: (e) => barra.actualizar(e) };
    },

    resultados(e) {
      const mio = e.resultados?.find((r) => r.id === e.yo.id);
      const barra = barraSuperior(e, { titulo: true });
      const lista = e.resultados ?? [];
      // Arriba, pequeño: tu puesto (con los puntos que ganas) y tus datos de la partida.
      const cabeza = h(
        "div.rp-cabeza",
        h(
          `div.rp-puesto.aparece${mio?.puesto === 1 ? ".oro" : ""}`,
          h("span.rp-medalla", mio?.puesto ? medalla(mio.puesto) : "–"),
          h("b", mio?.puesto ? `${mio.puesto}º` : "Sin puesto"),
          mio?.puntos ? h("small", `+${mio.puntos} pts`) : null
        ),
        h("div.rp-datos", h("small", "Tu partida"), h("b", mio?.texto ?? "No has jugado"))
      );
      // Lo importante: las respuestas. Las tuyas enteras y las de los demás (toca su fila para verlas todas).
      const solucion =
        e.juego.id === "llegar-resultado" ? finalLlegar(e.resumen, mio?.detalle) : null;
      const filas = lista.map((r) => {
        const yoMismo = r.id === e.yo.id;
        const det = yoMismo && r.pendiente ? r.detalle?.slice(0, -1) : r.detalle;
        const abrir = () => ventanaRespuestas(r, det);
        return h(
          `div.rp-jugador.tarjeta${yoMismo ? ".yo" : ""}`,
          h(
            "button.rp-fila",
            { type: "button", onclick: abrir, disabled: !det?.length, "aria-label": `Ver las respuestas de ${r.nombre}` },
            h("span.rp-pos", textoPuesto(r.puesto)),
            avatar(r),
            h("span.rp-nombre", r.nombre),
            h("span.rp-texto", r.corto ?? r.texto),
            det?.length ? h("span.rp-ver", "›") : null
          ),
          e.juego.id === "llegar-resultado" ? null : detalleJugador(det, { max: yoMismo ? Infinity : 10 })
        );
      });
      const el = h(
        "section.res-party",
        barra.el,
        cabeza,
        h("div.rp-cuerpo", solucion, palabraPendiente(mio?.pendiente), ...filas)
      );
      if (mio?.puesto === 1) navigator.vibrate?.([60, 60, 120]);
      // Batalla: el anfitrión pasa a la clasificación (y desde allí elige el siguiente juego).
      if (batalla && e.esHost) el.append(h("div.pl-botones.batalla-siguiente", h("button.boton.acento.grande", { type: "button", onclick: () => host("siguiente") }, "Ver la clasificación ▶")));
      return { el, actualizar: (e) => barra.actualizar(e) };
    },
  };

  /** Todas las respuestas de un jugador, sin recortar. */
  function ventanaRespuestas(r, det) {
    const cerrar = () => capa.remove();
    const capa = h(
      "div.capa-movil",
      { onclick: (ev) => ev.target === capa && cerrar() },
      h(
        "div.caja.tarjeta.rp-ventana",
        h("div.records-cabeza", h("div.rp-ventana-quien", avatar(r), h("h2", r.nombre)), h("button.icono-btn", { type: "button", onclick: cerrar, "aria-label": "Cerrar" }, "✕")),
        h("p.suave", r.texto),
        detalleJugador(det)
      )
    );
    document.body.append(capa);
  }

  // Mientras llega el primer estado
  mostrar("conectando", () => ({
    el: h("section", h("div.espera", h("h1", batalla ? "Entrando en la sala…" : "Conectando con la partida…"), h("p.suave", batalla ? "Comprueba que el código es correcto y que tienes internet." : "Asegúrate de que la TV está encendida."))),
  }));

  return { salir };
}

function medalla(p) {
  return p === 1 ? "🥇" : p === 2 ? "🥈" : p === 3 ? "🥉" : `${p}º`;
}
