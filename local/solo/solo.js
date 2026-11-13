// Modo solo: los mismos juegos que en PARTY, ejecutados en el propio móvil, con récords personales.
import { h, cambiarPantalla, banner, avatar, TIEMPOS, msDuracion, crearReloj, textoCuenta, piezaCuenta, detalleJugador, confeti, contarHasta, finalLlegar, palabraPendiente } from "../comun/ui.js";
import { calmarFondo } from "../comun/fondo.js";
import { almacen } from "../comun/conexion.js";
import { leerPaquete, diccionarioIncluido, desbloquearDiccionario, actualizarIncluido } from "./paquete.js";
import { campoTexto } from "../comun/teclado.js";
import { selectorJuegos, ICONOS, textoSegundos, textoRecord } from "./selector.js";
import { leerFamilia, idMovil } from "../comun/familia.js";
import { comprobarHazanas, tarjetaHazanas, ventanaHazanas, celebrarHazanas } from "./hazanas.js";
import { elegirAmbito } from "../comun/ambitos.js";

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
export function entrarSolo({ app, perfil, alSalir }) {
  const yo = { id: "yo", nombre: perfil.nombre, color: perfil.color, colorTexto: perfil.colorTexto, contorno: perfil.contorno ?? null, foto: perfil.foto, puntos: 0 };
  let actual = null;

  function mostrar(p) {
    actual?.desmontar?.();
    actual = p;
    cambiarPantalla(app, p.el);
  }

  const barra = (...extra) => h("div.barra-sup", banner(yo), ...extra);

  function mensaje(titulo, texto) {
    mostrar({ el: h("section", barra(), h("div.espera", h("h1", titulo), texto ? h("p.suave", texto) : null)) });
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
        barra(
          h(
            "div.barra-botones",
            h("button.icono-btn.hazanas", { type: "button", onclick: () => ventanaHazanas(juegos, ICONOS), "aria-label": "Hazañas", title: "Hazañas" }, "🎖️"),
            h("button.icono-btn.records", { type: "button", onclick: () => verRecords(juegos), "aria-label": "Récords", title: "Récords" }, "🏆"),
            h("button.icono-btn", { type: "button", onclick: alSalir, "aria-label": "Volver al inicio" }, "✕")
          )
        ),
        selectorJuegos({
          juegos: juegos.map((j) => ({ ...j, duracionBase: j.duracion, bloqueado: j.categoria === "palabras" && !j.sinDiccionario && !conDiccionario })),
          recordDe: (j, seg, nv) => recordDe(records, j, seg, nv),
          nivel: {
            lista: NIVELES,
            nombres: NOMBRES_NIVEL,
            de: (j) => niveles[j.id] ?? "normal",
            fijar: (j, nv) => {
              niveles[j.id] = nv;
              almacen.guardar("nyp-niveles", JSON.stringify(niveles));
            },
          },
          tiempo: {
            lista: TIEMPOS,
            de: (j) => tiempoValido(tiempos[j.id] ?? j.duracion),
            fijar: (j, s) => {
              tiempos[j.id] = s;
              almacen.guardar("nyp-tiempos", JSON.stringify(tiempos));
            },
          },
          conAyuda: true,
          alJugar: async (j) => {
            const meta = { ...j, duracion: tiempoValido(tiempos[j.id] ?? j.duracion), dificultad: niveles[j.id] ?? "normal" };
            // Crucigrama: primero se elige el tema (o al azar).
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

  /** Récords: «Míos» (cada juego con su mejor marca y las de cada tiempo y nivel) y «Familia» (clasificación). */
  function verRecords(juegos) {
    const records = leerRecords();
    // Las claves antiguas (solo el juego) son del tiempo normal y nivel medio.
    const partes = (k, j) => {
      const [, seg, nv = "normal"] = k.split("@");
      return { seg: seg ? Number(seg) : j.duracion, nv };
    };
    const delJuego = (recs, j) =>
      Object.entries(recs ?? {})
        .filter(([k]) => k.split("@")[0] === j.id)
        .map(([k, r]) => ({ ...partes(k, j), r }));

    function vistaMios() {
      const filas = juegos.map((j) => {
        const marcas = delJuego(records, j).sort((a, b) => a.seg - b.seg || NIVELES.indexOf(a.nv) - NIVELES.indexOf(b.nv));
        const mejor = marcas.reduce((m, x) => (!m || x.r.valor > m.r.valor ? x : m), null);
        return { j, marcas, mejor };
      });
      filas.sort((a, b) => Boolean(b.mejor) - Boolean(a.mejor));
      return filas.map(({ j, marcas, mejor }, i) =>
        h(
          `div.record-fila${mejor ? "" : ".sin"}`,
          { style: { animationDelay: `${60 + i * 40}ms` } },
          h("span.ico", ICONOS[j.id] ?? "🎲"),
          h("b", j.nombre),
          h("span.mejor", mejor ? textoRecord(mejor.r) : "—"),
          h(
            "div.marcas",
            marcas.length ? marcas.map((m) => h("span", `${textoSegundos(m.seg)} · ${NOMBRES_NIVEL[m.nv] ?? m.nv}: ${textoRecord(m.r)}`)) : h("span", "Aún sin récord")
          )
        )
      );
    }

    function vistaFamilia() {
      const fam = leerFamilia(perfil);
      const yoId = idMovil();
      const bloques = [];
      for (const j of juegos) {
        // Por cada tiempo y nivel, el mejor de cada persona.
        const grupos = new Map();
        for (const [pid, p] of Object.entries(fam.jugadores)) {
          for (const m of delJuego(p.records, j)) {
            const clave = `${m.seg}@${m.nv}`;
            const g = grupos.get(clave) ?? { seg: m.seg, nv: m.nv, gente: new Map() };
            const antes = g.gente.get(pid);
            if (!antes || m.r.valor > antes.r.valor) g.gente.set(pid, { p, r: m.r, yo: pid === yoId });
            grupos.set(clave, g);
          }
        }
        if (!grupos.size) continue;
        const lista = [...grupos.values()].sort((a, b) => a.seg - b.seg || NIVELES.indexOf(a.nv) - NIVELES.indexOf(b.nv));
        bloques.push(
          h(
            "div.familia-juego",
            { style: { animationDelay: `${60 + bloques.length * 50}ms` } },
            h("div.familia-titulo", h("span.ico", ICONOS[j.id] ?? "🎲"), h("b", j.nombre)),
            lista.map((g) =>
              h(
                "div.familia-grupo",
                h("small", `${textoSegundos(g.seg)} · ${NOMBRES_NIVEL[g.nv] ?? g.nv}`),
                h(
                  "ol.familia-podio",
                  [...g.gente.values()]
                    .sort((a, b) => b.r.valor - a.r.valor)
                    .slice(0, 5)
                    .map((x, k, todos) => {
                      // Empate: mismo puesto (y misma medalla).
                      const puesto = todos.findIndex((y) => y.r.valor === x.r.valor);
                      return h(
                        `li${x.yo ? ".yo" : ""}`,
                        h("span.medalla", ["🥇", "🥈", "🥉"][puesto] ?? `${puesto + 1}º`),
                        h("span.familia-nombre", { style: { "--c": x.p.color ?? "#5fb7d0" } }, x.p.nombre),
                        h("span.familia-marca", textoRecord(x.r))
                      );
                    })
                )
              )
            )
          )
        );
      }
      const nota = h(
        "p.familia-nota",
        fam.recibida
          ? `Se actualiza cada vez que te conectas a PARTY. Última vez: ${fam.recibida.split("-").reverse().join("/")}.`
          : "Conéctate una vez a PARTY para ver los récords de los demás."
      );
      return bloques.length ? [nota, ...bloques] : [nota, h("p.suave", "Todavía no hay récords.")];
    }

    const lista = h("div.records-lista");
    const pestanas = h(
      "div.records-pestanas",
      { role: "tablist" },
      [["mios", "Míos"], ["familia", "👨‍👩‍👧 Familia"]].map(([id, texto]) => h("button.records-pestana", { type: "button", role: "tab", "data-id": id, onclick: () => ver(id) }, texto))
    );
    function ver(id) {
      pestanas.querySelectorAll(".records-pestana").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.id === id)));
      lista.replaceChildren(...(id === "mios" ? vistaMios() : vistaFamilia()));
      lista.scrollTop = 0;
    }
    const cerrar = () => capa.remove();
    const capa = h(
      "div.capa-movil.capa-records",
      { onclick: (ev) => ev.target === capa && cerrar() },
      h(
        "div.caja.tarjeta",
        h("div.records-cabeza", h("h2", "🏆 Récords"), h("button.icono-btn", { type: "button", onclick: cerrar, "aria-label": "Cerrar" }, "✕")),
        pestanas,
        lista
      )
    );
    ver("mios");
    document.body.append(capa);
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
        h("div.barra-sup", h("button.icono-btn", { type: "button", onclick: lista, "aria-label": "Volver" }, "←"), h("span.nombre", "Desbloquear palabras")),
        h("p.grupo-ayuda", "🔒 Escribe la contraseña de la familia. Solo hace falta una vez."),
        campo.visor,
        aviso,
        h("div.grupo-teclado", campo.teclado)
      ),
    });
  }

  /** Preparar y cuenta atrás en la misma pantalla: mientras, el banner se cierra y solo queda tu icono. */
  function preparar(meta) {
    const caja = h("div.espera", h("h1", "Preparando…"));
    let t = 0;
    mostrar({ el: h("section", h("div.barra-sup", banner(yo, ".plegar")), caja), desmontar: () => clearInterval(t) });
    // Dejamos pintar antes de calcular (la primera vez tarda un poco).
    setTimeout(async () => {
      if (meta.sinDiccionario) await motor.datosJuegos;
      if (!caja.isConnected) return;
      const impl = motor.juegos.obtenerJuego(meta.id);
      const duracion = msDuracion(meta.duracion);
      const previsto = Date.now() + 4000;
      const ronda = impl.crear({ azar: motor.util.crearAzar(Date.now()), config: { pulsadorTipos: [], dificultad: meta.dificultad ?? "normal", ambito: meta.ambito }, duracion, inicio: previsto });
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
      const r = impl.resultados(ronda, [yo.id])[0];
      let resumen = null;
      try {
        resumen = impl.resumen?.(ronda) ?? null;
      } catch {}
      let nuevas = [];
      try {
        nuevas = comprobarHazanas(meta, r, ronda, yo.id);
      } catch {}
      resultado(meta, r, resumen, nuevas);
    }

    calmarFondo(true); // fondo quieto y tenue mientras se juega
    mostrar({
      el: h(
        "section",
        h(
          "div.barra-sup.barra-juego",
          h("span.icono-yo", avatar(yo)),
          // Sin límite de tiempo: en vez del reloj, un botón para acabar cuando quieras (y ver el resultado).
          meta.duracion ? reloj.el : h("button.boton.suave.sin-limite", { type: "button", onclick: terminar }, "∞ · Terminar 🏁"),
          h("button.icono-btn", { type: "button", onclick: abandonar, "aria-label": "Dejar la partida" }, "✕")),
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
    if (meta.id !== "palabra-larga" || !resumen?.mejores?.length) return null;
    const lista = [...resumen.mejores];
    if (resumen.rara) lista.unshift({ ...resumen.rara, rara: true });
    return h(
      "div.solo-solucion.tarjeta",
      h("small", "Las más largas que se podían formar"),
      h("div.solo-chips", lista.map((p) => h(`span.pg-chip${p.rara ? ".rara" : ""}`, `${p.forma.toUpperCase()} · ${p.largo}`)))
    );
  }

  function resultado(meta, r, resumen = null, hazanas = []) {
    const anterior = apuntar(meta, r);
    const record = r.valor != null && (!anterior || r.valor > anterior.valor);
    if (record) navigator.vibrate?.([60, 60, 120]);
    const textoR = h("p.final-marca", r.texto);
    if (hazanas.length) setTimeout(() => celebrarHazanas(hazanas), 500); // ¡con trompetas!
    else if (record) setTimeout(() => confeti(), 250); // récord nuevo: confeti dorado
    if (record) {
      contarHasta(textoR, r.texto);
    }
    mostrar({
      el: h(
        "section",
        // El juego y sus ajustes, al lado del perfil (así abajo queda sitio para lo importante).
        barra(h("div.barra-titulo", h("b", meta.nombre), h("small", `${textoSegundos(meta.duracion)} · ${NOMBRES_NIVEL[meta.dificultad ?? "normal"]}`))),
        h(
          "div.espera.final-solo",
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
          // La palabra que faltó sale aparte (en su tarjeta), no repetida entre las respuestas.
          tarjetaHazanas(hazanas),
          meta.id === "llegar-resultado" ? null : detalleJugador(r.pendiente ? r.detalle?.slice(0, -1) : r.detalle, { clase: ".mis-respuestas" }),
          palabraPendiente(r.pendiente),
          solucion(meta, resumen, r)
        ),
        h(
          "div.pl-botones",
          h("button.boton.suave", { type: "button", onclick: lista }, "Otro juego"),
          h("button.boton.acento", { type: "button", onclick: () => preparar(meta) }, "Otra vez")
        )
      ),
    });
  }

  lista();
  return { salir: () => actual?.desmontar?.() };
}
