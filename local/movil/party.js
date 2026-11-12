// Modo partida: conectado a PARTY (la TV). Esperar, jugar y ver resultados.
import { conectar, almacen } from "../comun/conexion.js";
import { h, cambiarPantalla, avatar, banner, crearReloj, textoPuesto, servidor } from "../comun/ui.js";
import { calmarFondo } from "../comun/fondo.js";
import { actualizarPaquete } from "../solo/paquete.js";

/**
 * app: contenedor; base: dirección del servidor PARTY; perfil: { nombre, color, colorTexto, foto }
 * alSalir(): vuelve al inicio de la app.
 */
export function entrarParty({ app, base, perfil, alSalir, alPaquete }) {
  servidor.base = base;
  const avisoConexion = document.getElementById("sin-conexion");
  let estado = null;
  let actual = null;
  let avisoLargo = 0;
  let paquetePedido = false;

  const con = conectar({
    base,
    alAbrir: () => con.enviar({ t: "hola", rol: "jugador", token: almacen.leer("nyp-token") }),
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
    calmarFondo(false);
    con.cerrar();
    actual?.desmontar?.();
    avisoConexion.classList.add("oculto");
    avisoConexion.onclick = null;
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
        almacen.guardar("nyp-token", null);
        con.enviar({ t: "unirse", nombre: perfil.nombre, color: perfil.color, colorTexto: perfil.colorTexto, contorno: perfil.contorno ?? null, foto: perfil.foto });
        break;
      case "bienvenida":
        almacen.guardar("nyp-token", m.token);
        break;
      case "expulsado":
        almacen.guardar("nyp-token", null);
        mostrar("expulsado", () => ({
          el: h("section", h("div.espera", h("h1", "El presentador te ha sacado de la partida"), h("button.boton.grande", { onclick: salir }, "Volver al inicio"))),
        }));
        break;
      case "estado":
        estado = m;
        if (m.yo && !paquetePedido) {
          paquetePedido = true;
          // Al volver a una partida con el mismo móvil, mandamos el perfil por si ha cambiado.
          con.enviar({ t: "perfil", ...perfil });
          // Aprovechamos para descargar el diccionario del modo solo (en segundo plano).
          actualizarPaquete(base, alPaquete).catch(() => {});
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
    let clave = null;
    const icono = h("span.icono-yo");
    const el = h(
      "div.barra-sup.barra-juego",
      icono,
      reloj.el,
      h("button.icono-btn", { type: "button", onclick: preguntarSalir, "aria-label": "Salir de la partida" }, "✕")
    );
    const actualizar = (e) => {
      const k = [e.yo.nombre, e.yo.color, e.yo.colorTexto, e.yo.contorno, e.yo.foto].join("|");
      if (k !== clave) {
        clave = k;
        icono.replaceChildren(avatar(e.yo));
      }
    };
    actualizar(e);
    return { el, actualizar };
  }

  function barraSuperior(e, { reloj } = {}) {
    if (reloj) return barraJuego(e, reloj);
    const pts = h("span.pts");
    const ban = bannerVivo();
    ban.actualizar(e.yo);
    const el = h(
      "div.barra-sup",
      ban.el,
      pts,
      reloj?.el,
      h("button.icono-btn", { type: "button", onclick: preguntarSalir, "aria-label": "Salir de la partida" }, "✕")
    );
    return {
      el,
      actualizar: (e) => {
        ban.actualizar(e.yo);
        pts.textContent = `${e.yo.puntos} pts`;
      },
    };
  }

  function tituloEnFichas(texto) {
    return h("div.titulo-fichas", texto.toUpperCase().split(" ").map((p) => h("div.palabra", [...p].map((l) => h("span.ficha", l)))));
  }

  const PANTALLAS = {
    lobby(e) {
      const barra = barraSuperior(e);
      const puesto = h("p.suave");
      const lista = h("div.lista-mini");
      const equipos = h("div.elegir-equipo");
      const grande = bannerVivo(".banner-grande");
      const mensaje = h("p.suave", "Esperando al presentador…");
      const el = h("section", barra.el, h("div.espera", grande.el, mensaje, equipos, puesto, lista));
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
            : t.campeon ? (t.campeon === e.yo.id ? "🏆 ¡Has ganado el torneo!" : `🏆 Campeón: ${e.jugadores.find((j) => j.id === t.campeon)?.nombre ?? ""}`)
            : e.yo.eliminado ? (t.eliminadoRonda === e.yo.id ? "❌ Te ha tocado: quedas eliminado" : "Estás eliminado del torneo")
            : t.modo === "torneo" ? "Torneo: el peor de cada prueba queda eliminado"
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
            ...(e.fase === "clasificacion" ? top : []).map((j) =>
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
      const el = h(
        "section",
        barra.el,
        h("div.espera", h("span.suave", "Siguiente prueba"), tituloEnFichas(e.juego.nombre), h("p", e.juego.descripcion), h("p.suave", `${e.juego.duracion} segundos · ¡prepárate!`))
      );
      return { el, actualizar: (e) => barra.actualizar(e) };
    },

    cuenta(e) {
      const caja = h("div.espera");
      const el = h("section", barraSuperior(e).el, caja);
      let ultimo = null;
      const reloj = setInterval(() => {
        const s = Math.ceil((estado.fin - con.ahora()) / 1000);
        const t = s > 0 ? String(Math.min(3, s)) : "¡YA!";
        if (t !== ultimo) {
          ultimo = t;
          caja.replaceChildren(h("span.ficha.cuenta-num.aparece", t));
          navigator.vibrate?.(30);
        }
      }, 100);
      return { el, desmontar: () => clearInterval(reloj) };
    },

    jugando(e) {
      const reloj = crearReloj(con.ahora);
      const inicio = e.fin - e.juego.duracion * 1000;
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
          h(
            "div.lista-mini",
            (e.resultados ?? []).slice(0, 5).map((r) =>
              h(`div.item.tarjeta${r.id === e.yo.id ? ".yo" : ""}`, h("span", textoPuesto(r.puesto)), avatar(r), h("span.n", r.nombre), h("span.suave", r.texto))
            )
          )
        )
      );
      if (mio?.puesto === 1) navigator.vibrate?.([60, 60, 120]);
      return { el, actualizar: (e) => barra.actualizar(e) };
    },
  };

  // Mientras llega el primer estado
  mostrar("conectando", () => ({ el: h("section", h("div.espera", h("h1", "Conectando con la partida…"), h("p.suave", "Asegúrate de que la TV está encendida."))) }));

  return { salir };
}

function medalla(p) {
  return p === 1 ? "🥇" : p === 2 ? "🥈" : p === 3 ? "🥉" : `${p}º`;
}
