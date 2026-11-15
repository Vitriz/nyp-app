// Modo solo: los mismos juegos que en PARTY, ejecutados en el propio móvil, con récords personales.
import { h, cambiarPantalla, banner, bannerFijo, TIEMPOS, msDuracion, crearReloj, textoCuenta, piezaCuenta, detalleJugador, confeti, contarHasta, finalLlegar, palabraPendiente } from "../comun/ui.js";
import { calmarFondo } from "../comun/fondo.js";
import { almacen } from "../comun/conexion.js";
import { leerPaquete, diccionarioIncluido, desbloquearDiccionario, actualizarIncluido } from "./paquete.js";
import { campoTexto } from "../comun/teclado.js";
import { selectorJuegos, ICONOS, textoRecord, infoPartida } from "./selector.js";
import { idMovil } from "../comun/familia.js";
import { subirLuego } from "../comun/nube.js";
import { comprobarHazanas, tarjetaHazanas, ventanaHazanas, celebrarHazanas } from "./hazanas.js";
import { elegirAmbito } from "../comun/ambitos.js";
import { estudioGrupos } from "../juegos/conexiones/piezas.js";
import { casillasFinal, extraFinal, ganoPartida } from "./final.js";
import { ventanaEstadisticas, ventanaClasificacion, apuntarPartida } from "./estadisticas.js";
import { palabrasTocables } from "../comun/diccionario.js";

const SIN_SOLO = new Set(["pulsador"]); // necesita presentador y más jugadores

let motor = null;
async function cargarMotor() {
  if (motor) return motor;
  const [lexico, juegos, util] = await Promise.all([import("../motor/lexico.js"), import("../motor/juegos/index.js"), import("../motor/util.js")]);
  motor = { lexico, juegos, util, diccionario: lexico.listo() };
  // Semántica y Conexiones traen sus datos con la app: se cargan en segundo plano.
  motor.datosJuegos = lexico.cargarDatosJuegos?.() ?? Promise.resolve();
  return motor;
}

/** Las pruebas de palabras necesitan el diccionario (se guarda al jugar en grupo). */
async function cargarDiccionario() {
  if (motor.diccionario) return true;
  try {
    const texto = await leerPaquete();
    if (!texto) return false;
    motor.lexico.preparar(JSON.parse(texto));
    motor.diccionario = true;
  } catch {}
  return motor.diccionario;
}

// ------------------------------------------------------------------ récords
function leerRecords() {
  try {
    return JSON.parse(almacen.leer("nyp-records") ?? "{}");
  } catch {
    return {};
  }
}

// Los récords van con su tiempo y su nivel: "juego@segundos" (nivel medio) o "juego@segundos@facil|dificil".
// Los antiguos (solo "juego") cuentan como récord del tiempo normal de ese juego, en nivel medio.
/** Un tiempo guardado que ya no está en la lista (los antiguos 3 o 4 min) pasa a 2 min. */
const tiempoValido = (s) => (TIEMPOS.includes(s) ? s : 120);
const NIVELES = ["facil", "normal", "dificil"];
const NOMBRES_NIVEL = { facil: "Fácil", normal: "Medio", dificil: "Difícil" };

function claveRecord(id, seg, nivel = "normal") {
  return nivel === "normal" ? `${id}@${seg}` : `${id}@${seg}@${nivel}`;
}

function recordDe(records, meta, seg, nivel = "normal") {
  const r = records[claveRecord(meta.id, seg, nivel)];
  if (r || nivel !== "normal") return r ?? null;
  return seg === meta.duracionBase ? records[meta.id] ?? null : null;
}

/** Nivel elegido para cada juego (se recuerda en el móvil). */
function leerNiveles() {
  try {
    return JSON.parse(almacen.leer("nyp-niveles") ?? "{}");
  } catch {
    return {};
  }
}

/** Tiempo elegido para cada juego (se recuerda en el móvil). */
function leerTiempos() {
  try {
    return JSON.parse(almacen.leer("nyp-tiempos") ?? "{}");
  } catch {
    return {};
  }
}

/** Guarda el resultado si es récord para ese tiempo. Devuelve el récord anterior (o null). */
function apuntar(meta, r) {
  const records = leerRecords();
  const anterior = recordDe(records, meta, meta.duracion, meta.dificultad);
  if (r.valor != null && (!anterior || r.valor > anterior.valor)) {
    records[claveRecord(meta.id, meta.duracion, meta.dificultad)] = { valor: r.valor, texto: r.texto, corto: r.corto ?? null, detalle: r.detalle?.slice(0, 30) ?? null, fecha: new Date().toISOString().slice(0, 10) };
    almacen.guardar("nyp-records", JSON.stringify(records));
  }
  return anterior;
}

// ------------------------------------------------------------------ pantallas
export function entrarSolo({ app, perfil, alSalir, fijo: fijoApp = null, alPerfil = null }) {
  const datosYo = (p) => ({ nombre: p.nombre, color: p.color, colorTexto: p.colorTexto, contorno: p.contorno ?? null, foto: p.foto, sombrero: p.sombrero ?? null, animacion: p.animacion ?? null, fondo: p.fondo ?? null });
  const yo = { id: "yo", ...datosYo(perfil), puntos: 0 };
  let actual = null;
  // Un solo banner para todo el modo solo (el mismo del inicio): se abre en la lista y en el resultado y se cierra al jugar.
  const fijo = fijoApp ?? bannerFijo(yo);
  if (fijoApp) fijo.actualizar(yo);
  const salir = () => (fijoApp ? null : fijo.quitar(), alSalir());
  /** Tocar el banner en la lista abre el perfil; al guardarlo (o volver) se vuelve a la lista. */
  const editarPerfil = alPerfil
    ? () => {
        actual?.desmontar?.();
        actual = null;
        alPerfil((nuevo) => {
          perfil = nuevo;
          Object.assign(yo, datosYo(nuevo));
          fijo.actualizar(yo);
          lista();
        });
      }
    : null;

  function mostrar(p) {
    actual?.desmontar?.();
    actual = p;
    cambiarPantalla(app, p.el);
    fijo.colocar();
  }

  const barra = (...extra) => h("div.barra-sup", fijo.hueco("abierto"), ...extra);
  const barraLista = (...extra) =>
    h(
      "div.barra-sup",
      editarPerfil ? h("button.perfil-toque", { type: "button", onclick: editarPerfil, "aria-label": "Cambiar mi perfil", title: "Cambiar mi perfil" }, fijo.hueco("abierto")) : fijo.hueco("abierto"),
      ...extra
    );

  function mensaje(titulo, texto) {
    mostrar({ el: h("section.solo-msg", barra(), h("div.espera", h("h1", titulo), texto ? h("p.suave", texto) : null)) });
  }

  async function lista() {
    mensaje("Preparando…");
    const m = await cargarMotor();
    if (!m.diccionario) await actualizarIncluido().catch(() => {});
    const conDiccionario = await cargarDiccionario();
    const records = leerRecords();
    const tiempos = leerTiempos();
    const niveles = leerNiveles();
    const juegos = m.juegos.listaJuegos().filter((j) => j.disponible && !SIN_SOLO.has(j.id));
    mostrar({
      el: h(
        "section.solo.solo-sel",
        barraLista(
          h(
            "div.barra-botones",
            h("button.icono-btn.estadisticas", { type: "button", onclick: () => ventanaEstadisticas(juegos), "aria-label": "Estadísticas", title: "Estadísticas" }, "📊"),
            h("button.icono-btn.records", {
              type: "button",
              onclick: () => ventanaClasificacion(juegos, perfil, { seg: tiempoValido(leerTiempos()["*"] ?? 60), nv: leerNiveles()["*"] ?? "normal" }),
              "aria-label": "Clasificación",
              title: "Clasificación",
            }, "🏆"),
            h("button.icono-btn.hazanas", { type: "button", onclick: () => ventanaHazanas(juegos, ICONOS), "aria-label": "Hazañas", title: "Hazañas" }, "🎖️"),
            h("button.icono-btn.cerrar", { type: "button", onclick: salir, "aria-label": "Volver al inicio" }, "✕")
          )
        ),
        selectorJuegos({
          juegos: juegos.map((j) => ({ ...j, duracionBase: j.duracion, bloqueado: j.categoria === "palabras" && !j.sinDiccionario && !conDiccionario })),
          recordDe: (j, seg, nv) => recordDe(records, j, seg, nv),
          nivel: {
            lista: NIVELES,
            nombres: NOMBRES_NIVEL,
            // Un solo nivel y un solo tiempo para todos los juegos (no cambian al moverte por la lista).
            de: () => niveles["*"] ?? "normal",
            fijar: (j, nv) => {
              niveles["*"] = nv;
              almacen.guardar("nyp-niveles", JSON.stringify(niveles));
            },
          },
          tiempo: {
            lista: TIEMPOS,
            de: () => tiempoValido(tiempos["*"] ?? 60),
            fijar: (j, s) => {
              tiempos["*"] = s;
              almacen.guardar("nyp-tiempos", JSON.stringify(tiempos));
            },
          },
          conAyuda: true,
          alJugar: async (j) => {
            const meta = { ...j, duracion: tiempoValido(tiempos["*"] ?? 60), dificultad: niveles["*"] ?? "normal" };
            // Crucigrama sin límite a medias: ¿seguirlo?
            const g = j.id === "crucigrama" && !meta.duracion ? leerGuardado() : null;
            if (g) {
              const r = await preguntarGuardado(g);
              if (r === false) return;
              if (r) return preparar({ ...meta, ambito: g.ronda.ambito, dificultad: g.meta.dificultad }, r);
            }
            // Cálculo mental sin límite de tiempo: ¿cuántas operaciones?
            if (j.id === "calculo-mental" && !meta.duracion) {
              const n = await elegirNumero("🧠 ¿Cuántas operaciones?", [5, 8, 12, 16, 20], 8);
              if (!n) return;
              meta.operaciones = n;
            }
            // Juegos con tema: primero se elige el tema (todos, al azar o uno).
            if (j.ambitos?.length) {
              const ambito = await elegirAmbito(j.ambitos);
              if (!ambito) return;
              meta.ambito = ambito;
            }
            preparar(meta);
          },
          alDesbloquear: sinDiccionario,
        })
      ),
    });
  }

  async function sinDiccionario() {
    const info = await diccionarioIncluido();
    if (!info) {
      // App abierta desde PARTY sin diccionario: se guarda al jugar en grupo.
      mostrar({
        el: h(
          "section",
          barra(),
          h("div.espera", h("h1", "Falta el diccionario"), h("p", "Se guarda en el móvil al jugar una vez en grupo con PARTY."), h("p.suave", "Las pruebas de números funcionan desde ya.")),
          h("button.boton.acento.grande", { type: "button", onclick: lista }, "Volver")
        ),
      });
      return;
    }
    // La app trae el diccionario cifrado: se desbloquea una vez con la contraseña de la familia.
    const aviso = h("div.pl-aviso.mal");
    let ocupado = false;
    const campo = campoTexto({
      max: 30,
      modo: "codigo",
      placeholder: "Contraseña",
      alAceptar: async (clave) => {
        if (ocupado || !clave) return;
        ocupado = true;
        aviso.className = "pl-aviso suave";
        aviso.textContent = "Abriendo el diccionario…";
        let ok = false;
        try {
          ok = await desbloquearDiccionario(clave, info);
        } catch {
          aviso.className = "pl-aviso mal";
          aviso.textContent = "No se pudo abrir. ¿Tienes internet la primera vez?";
          ocupado = false;
          return;
        }
        ocupado = false;
        if (ok) {
          navigator.vibrate?.(20);
          lista();
        } else {
          aviso.className = "pl-aviso mal";
          aviso.textContent = "Esa no es la contraseña";
          campo.fijar("");
          navigator.vibrate?.([30, 40, 30]);
        }
      },
    });
    mostrar({
      el: h(
        "section.grupo",
        h("div.barra-sup", h("button.icono-btn.volver", { type: "button", onclick: lista, "aria-label": "Volver" }, "←"), h("span.nombre", "Desbloquear palabras")),
        h("p.grupo-ayuda", "🔒 Escribe la contraseña de la familia. Solo hace falta una vez."),
        campo.visor,
        aviso,
        h("div.grupo-teclado", campo.teclado)
      ),
    });
  }

  /** Preparar y cuenta atrás en la misma pantalla: mientras, el banner se cierra y solo queda tu icono. */
  /** Ventana para elegir un número (p. ej. cuántas operaciones). Devuelve el número o null. */
  function elegirNumero(titulo, valores, defecto) {
    return new Promise((ok) => {
      const cerrar = (v) => (capa.remove(), ok(v));
      const capa = h(
        "div.capa-movil",
        { onclick: (ev) => ev.target === capa && cerrar(null) },
        h(
          "div.caja.tarjeta",
          h("div.records-cabeza", h("h2", titulo), h("button.icono-btn.cerrar", { type: "button", onclick: () => cerrar(null), "aria-label": "Cerrar" }, "✕")),
          h("div.elegir-numero", valores.map((v) => h(`button.boton${v === defecto ? ".acento" : ".suave"}.grande`, { type: "button", onclick: () => cerrar(v) }, String(v))))
        )
      );
      document.body.append(capa);
    });
  }

  // Palabras de los crucigramas recientes: las próximas partidas no las repiten (mientras haya otras).
  const VISTAS = "nyp-palabras-vistas";
  const leerVistas = () => {
    try {
      return JSON.parse(almacen.leer(VISTAS) ?? "[]");
    } catch {
      return [];
    }
  };
  function apuntarVistas(ronda) {
    const nuevas = (ronda?.palabras ?? []).map((p) => p?.clave).filter((c) => typeof c === "string");
    if (!nuevas.length) return;
    const lista = [...new Set([...nuevas, ...leerVistas()])].slice(0, 400);
    almacen.guardar(VISTAS, JSON.stringify(lista));
  }

  // Crucigrama sin límite de tiempo: si lo dejas a medias, se guarda para seguirlo otro día.
  const GUARDADO = "nyp-crucigrama-guardado";
  const leerGuardado = () => {
    try {
      return JSON.parse(almacen.leer(GUARDADO) ?? "null");
    } catch {
      return null;
    }
  };
  /** ¿Seguir el crucigrama guardado? Devuelve la partida guardada, null (uno nuevo) o false (cancelar). */
  function preguntarGuardado(g) {
    return new Promise((ok) => {
      const j = g.ronda.jugadores?.[yo.id];
      const hechas = Object.keys(j?.resueltas ?? {}).length;
      const tema = g.ronda.ambito === "todos" ? "todos los temas" : g.ronda.ambito;
      const cerrar = (v) => (capa.remove(), ok(v));
      const capa = h(
        "div.capa-movil",
        { onclick: (ev) => ev.target === capa && cerrar(false) },
        h(
          "div.caja.tarjeta",
          h("h2", "✏️ Tienes un crucigrama a medias"),
          h("p.suave", `${tema} · ${hechas} de ${g.ronda.palabras.length} palabras · ${g.fecha.split("-").reverse().join("/")}`),
          h("button.boton.acento.grande", { type: "button", onclick: () => cerrar(g) }, "Seguirlo"),
          h("button.boton.suave.grande", { type: "button", onclick: () => cerrar(null) }, "Empezar uno nuevo")
        )
      );
      document.body.append(capa);
    });
  }

  function preparar(meta, guardada = null) {
    const caja = h("div.espera", h("h1", "Preparando…"));
    let t = 0;
    mostrar({ el: h("section", h("div.barra-sup", fijo.hueco("cerrado")), caja), desmontar: () => clearInterval(t) });
    // Dejamos pintar antes de calcular (la primera vez tarda un poco).
    setTimeout(async () => {
      if (meta.sinDiccionario) await motor.datosJuegos;
      if (!caja.isConnected) return;
      const impl = motor.juegos.obtenerJuego(meta.id);
      const duracion = msDuracion(meta.duracion);
      const previsto = Date.now() + 4000;
      const ronda = guardada
        ? { ...guardada.ronda, inicio: previsto - (guardada.ronda.transcurrido ?? 0) }
        : impl.crear({ azar: motor.util.crearAzar(Date.now()), config: { pulsadorTipos: [], dificultad: meta.dificultad ?? "normal", ambito: meta.ambito, operaciones: meta.operaciones, evitar: leerVistas(), solo: true }, duracion, inicio: previsto });
      if (!guardada && meta.id === "crucigrama") apuntarVistas(ronda);
      impl.vistaJugador(ronda, yo.id);
      // La cuenta atrás empieza al acabar de preparar: así el 3 dura lo mismo que el 2 y el 1.
      const retraso = Math.max(0, Date.now() - (previsto - 4000));
      if (typeof ronda.inicio === "number") ronda.inicio += retraso; // los que miden el tiempo desde el inicio
      const inicio = previsto + retraso;
      let ultimo = null;
      const paso = () => {
        const falta = inicio - Date.now();
        const txt = textoCuenta(falta);
        if (txt !== ultimo) {
          ultimo = txt;
          caja.classList.add("cuenta-centro"); // en el centro de la pantalla (no del hueco bajo la barra)
          caja.replaceChildren(piezaCuenta(txt));
          navigator.vibrate?.(30);
        }
        if (falta <= 0) {
          clearInterval(t);
          jugar(meta, impl, ronda, inicio, inicio + duracion);
        }
      };
      t = setInterval(paso, 100);
      paso();
    }, 60);
  }

  function jugar(meta, impl, ronda, inicio, fin) {
    const reloj = crearReloj(Date.now);
    reloj.fijar(fin, fin - inicio);
    const cuerpo = h("div.cuerpo-juego");
    let modulo = null;
    let acabado = false;
    const estado = () => ({
      fase: "jugando", juego: meta, fin, yo, jugadores: [yo],
      datos: impl.vistaJugador(ronda, yo.id), terminado: impl.terminado(ronda, yo.id),
    });
    const refrescar = () => !acabado && modulo?.actualizar(estado());
    const ctx = {
      ahora: Date.now,
      onda: () => {},
      enviar(msg) {
        const cambio = impl.accion(ronda, yo.id, msg);
        // Como en PARTY, la respuesta llega "un instante después" del toque.
        setTimeout(() => {
          if (cambio) refrescar();
          if (impl.terminado(ronda, yo.id)) terminar();
        }, 0);
      },
    };
    const tic = impl.tic ? setInterval(() => (impl.terminado(ronda, yo.id) ? terminar() : refrescar()), impl.tic) : 0;
    const finRonda = setTimeout(terminar, fin - Date.now());

    function abandonar() {
      acabado = true;
      limpiar();
      // Crucigrama con tiempo ∞ a medias: se guarda tal cual para seguirlo otro día.
      if (meta.id === "crucigrama" && !meta.duracion && !impl.terminado(ronda, yo.id)) {
        almacen.guardar(GUARDADO, JSON.stringify({ meta, ronda: { ...ronda, transcurrido: Date.now() - ronda.inicio }, fecha: new Date().toISOString().slice(0, 10) }));
      }
      lista();
    }
    function limpiar() {
      calmarFondo(false);
      clearInterval(tic);
      clearTimeout(finRonda);
      reloj.parar();
      modulo?.desmontar?.();
    }
    function terminar() {
      if (acabado) return;
      acabado = true;
      limpiar();
      if (meta.id === "crucigrama") almacen.guardar(GUARDADO, null); // ya no está a medias
      const r = impl.resultados(ronda, [yo.id])[0];
      let resumen = null;
      try {
        resumen = impl.resumen?.(ronda) ?? null;
      } catch {}
      let nuevas = [];
      try {
        nuevas = comprobarHazanas(meta, r, ronda, yo.id);
      } catch {}
      let datos = null;
      let ganada = r.valor != null;
      try {
        const jj = impl.estadoJugador(ronda, yo.id);
        ganada = ganoPartida(meta, r, ronda, jj);
        datos = [casillasFinal(meta, ronda, jj), extraFinal(meta, ronda, jj)];
      } catch {}
      try {
        apuntarPartida(meta, ganada); // para las estadísticas
      } catch {}
      resultado(meta, r, resumen, nuevas, datos);
    }

    calmarFondo(true); // fondo quieto y tenue mientras se juega
    mostrar({
      el: h(
        "section",
        h(
          "div.barra-sup.barra-juego",
          // El mismo banner, ya cerrado en círculo: así no hay salto al empezar.
          h("span.icono-yo", fijo.hueco("cerrado")),
          // Sin límite de tiempo: en vez del reloj, un botón para acabar cuando quieras (y ver el resultado).
          meta.duracion ? reloj.el : h("button.boton.suave.sin-limite", { type: "button", onclick: terminar }, "∞ · Terminar 🏁"),
          h("button.icono-btn.cerrar", { type: "button", onclick: abandonar, "aria-label": "Dejar la partida" }, "✕")),
        cuerpo
      ),
      desmontar: () => {
        if (!acabado) {
          acabado = true;
          limpiar();
        }
      },
    });
    import(`../juegos/${meta.id}/movil.js`).then((m) => {
      if (acabado) return;
      modulo = m.montar(cuerpo, estado(), ctx);
    });
  }

  /** Lo que se podía haber hecho (de momento, las palabras más largas). */
  function solucion(meta, resumen, r = null) {
    if (meta.id === "llegar-resultado") return finalLlegar(resumen, r?.detalle);
    if (meta.id === "conexiones") return estudioGrupos(resumen, yo.id);
    if (meta.id !== "palabra-larga" || !resumen?.mejores?.length) return null;
    // Agrupadas por largo: el número de letras sale una vez y debajo sus palabras.
    const lista = [...resumen.mejores];
    if (resumen.rara && !lista.some((p) => p.forma === resumen.rara.forma)) lista.push({ ...resumen.rara, rara: true });
    const largos = [...new Set(lista.map((p) => p.largo))].sort((a, b) => b - a);
    return h(
      "div.solo-solucion.final-seccion-caja",
      h("small.final-seccion", "Las más largas que se podían formar"),
      largos.map((n) =>
        h(
          "div.grupo-largo",
          h("span.grupo-largo-n", h("b", String(n)), h("small", "letras")),
          h("div.solo-chips", lista.filter((p) => p.largo === n).map((p) => h(`span.pg-chip${p.rara ? ".rara" : ""}`, { "data-palabra": p.forma }, p.forma.toUpperCase())))
        )
      )
    );
  }

  function resultado(meta, r, resumen = null, hazanas = [], datos = null) {
    setTimeout(() => document.querySelectorAll(".bloqueo-final button").forEach((b) => (b.disabled = false)), 1500);
    const anterior = apuntar(meta, r);
    const record = r.valor != null && (!anterior || r.valor > anterior.valor);
    if (record) navigator.vibrate?.([60, 60, 120]);
    // Récords y hazañas nuevos, a la nube (para la clasificación de todos): un récord, enseguida.
    subirLuego(idMovil(), perfil, record ? 300 : 2500);
    const textoR = h("p.final-marca", r.texto);
    if (hazanas.length) setTimeout(() => celebrarHazanas(hazanas), 500); // ¡con trompetas!
    else if (record) setTimeout(() => confeti(), 250); // récord nuevo: confeti dorado
    if (record) {
      contarHasta(textoR, r.texto);
    }
    const pantalla = h(
        "section.pantalla-final",
        // El juego y cómo se jugó (tiempo · nivel), a la derecha del perfil: fijo arriba aunque bajes.
        // (el banner, contraído: así cabe bien el nombre del juego)
        h("div.barra-sup.barra-final", fijo.hueco("cerrado"), infoPartida(meta, meta.duracion, NOMBRES_NIVEL[meta.dificultad ?? "normal"])),
        h(
          "div.espera.final-solo.zona-final",
          h(
            "div.final-cabeza",
            h(`div.puesto-grande.final-icono.aparece${record ? ".copa-record" : ""}`, record ? "🏆" : r.valor != null ? "👏" : "🙂"),
            h(
              "div.final-textos",
              h(`h1${record ? ".titulo-record" : ""}`, record ? (anterior ? "¡Nuevo récord!" : "¡Primer récord!") : r.valor != null ? "¡Bien jugado!" : "Esta vez no ha salido"),
              textoR,
              anterior && !record ? h("small", `🏆 Récord: ${textoRecord(anterior)}`) : null,
              anterior && record ? h("small", `Antes: ${textoRecord(anterior)}`) : null
            )
          ),
          // Los datos de la partida, en casillas propias de cada juego.
          datos,
          // La palabra que faltó sale aparte (en su tarjeta), no repetida entre las respuestas.
          tarjetaHazanas(hazanas),
          meta.id === "llegar-resultado" ? null : detalleJugador(r.pendiente ? r.detalle?.slice(0, -1) : r.detalle, { clase: ".mis-respuestas" }),
          palabraPendiente(r.pendiente),
          solucion(meta, resumen, r)
        ),
        // Bloqueados un momento: si estabas tocando cuando se acabó el tiempo, no empiezas otra sin querer.
        h(
          "div.pl-botones.bloqueo-final",
          h("button.boton.suave", { type: "button", disabled: true, onclick: lista }, "Otro juego"),
          h("button.boton.acento", { type: "button", disabled: true, onclick: () => preparar(meta) }, "Otra vez")
        )
      );
    // Juegos de palabras: toca una palabra para ver qué significa.
    if (meta.categoria === "palabras") palabrasTocables(pantalla.querySelector(".zona-final"));
    mostrar({ el: pantalla });
  }

  lista();
  return { salir: () => (actual?.desmontar?.(), fijoApp ? null : fijo.quitar()) };
}
