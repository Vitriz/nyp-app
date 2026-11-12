// Modo solo: los mismos juegos que en PARTY, ejecutados en el propio móvil, con récords personales.
import { h, cambiarPantalla, banner, avatar, crearReloj } from "../comun/ui.js";
import { calmarFondo } from "../comun/fondo.js";
import { almacen } from "../comun/conexion.js";
import { leerPaquete, diccionarioIncluido, desbloquearDiccionario, actualizarIncluido } from "./paquete.js";
import { campoTexto } from "../comun/teclado.js";

const SIN_SOLO = new Set(["pulsador"]); // necesita presentador y más jugadores

let motor = null;
async function cargarMotor() {
  if (motor) return motor;
  const [lexico, juegos, util] = await Promise.all([import("../motor/lexico.js"), import("../motor/juegos/index.js"), import("../motor/util.js")]);
  motor = { lexico, juegos, util, diccionario: lexico.listo() };
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

/** Guarda el resultado si es récord. Devuelve el récord anterior (o null). */
function apuntar(id, r) {
  const records = leerRecords();
  const anterior = records[id] ?? null;
  if (r.valor != null && (!anterior || r.valor > anterior.valor)) {
    records[id] = { valor: r.valor, texto: r.texto, fecha: new Date().toISOString().slice(0, 10) };
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
    const juegos = m.juegos.listaJuegos().filter((j) => j.disponible && !SIN_SOLO.has(j.id));
    mostrar({
      el: h(
        "section.solo",
        barra(h("button.icono-btn", { type: "button", onclick: alSalir, "aria-label": "Volver al inicio" }, "✕")),
        h("h2.solo-titulo", "Jugar solo"),
        h(
          "div.solo-juegos",
          juegos.map((j) => {
            const falta = j.categoria === "palabras" && !conDiccionario;
            return h(
              `button.boton.suave.solo-juego${falta ? ".bloqueado" : ""}`,
              { type: "button", onclick: () => (falta ? sinDiccionario() : presentar(j)) },
              h("b", j.nombre),
              h("small", falta ? "🔒 Toca para desbloquear" : records[j.id] ? `🏆 ${records[j.id].texto}` : j.categoria === "palabras" ? "Palabras" : "Números")
            );
          })
        )
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
        h("div.barra-sup", h("button.icono-btn", { type: "button", onclick: lista, "aria-label": "Volver" }, "←"), h("span.nombre", "Desbloquear palabras")),
        h("p.grupo-ayuda", "🔒 Escribe la contraseña de la familia. Solo hace falta una vez."),
        campo.visor,
        aviso,
        h("div.grupo-teclado", campo.teclado)
      ),
    });
  }

  function presentar(meta) {
    const record = leerRecords()[meta.id];
    mostrar({
      el: h(
        "section",
        barra(),
        h(
          "div.espera",
          h("span.suave", meta.categoria === "palabras" ? "Prueba de palabras" : "Prueba de números"),
          h("h1", meta.nombre),
          h("p", meta.descripcion),
          h("p.suave", `${meta.duracion} segundos`),
          record ? h("p", `🏆 Tu récord: ${record.texto}`) : null
        ),
        h("div.pl-botones", h("button.boton.suave", { type: "button", onclick: lista }, "Volver"), h("button.boton.acento", { type: "button", onclick: () => preparar(meta) }, "¡Empezar!"))
      ),
    });
  }

  function preparar(meta) {
    mensaje("Preparando…");
    // Dejamos pintar el mensaje antes de calcular (la primera vez tarda un poco).
    setTimeout(() => {
      const impl = motor.juegos.obtenerJuego(meta.id);
      const inicio = Date.now() + 3500;
      const duracion = meta.duracion * 1000;
      const ronda = impl.crear({ azar: motor.util.crearAzar(Date.now()), config: { pulsadorTipos: [] }, duracion, inicio });
      impl.vistaJugador(ronda, yo.id);
      cuenta(meta, impl, ronda, inicio, inicio + duracion);
    }, 60);
  }

  function cuenta(meta, impl, ronda, inicio, fin) {
    const caja = h("div.espera");
    let ultimo = null;
    const t = setInterval(() => {
      const s = Math.ceil((inicio - Date.now()) / 1000);
      const txt = s > 0 ? String(Math.min(3, s)) : "¡YA!";
      if (txt !== ultimo) {
        ultimo = txt;
        caja.replaceChildren(h("span.ficha.cuenta-num.aparece", txt));
        navigator.vibrate?.(30);
      }
      if (s <= 0) {
        clearInterval(t);
        jugar(meta, impl, ronda, inicio, fin);
      }
    }, 100);
    mostrar({ el: h("section", barra(), caja), desmontar: () => clearInterval(t) });
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
    const tic = impl.tic ? setInterval(refrescar, impl.tic) : 0;
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
      resultado(meta, r);
    }

    calmarFondo(true); // fondo quieto y tenue mientras se juega
    mostrar({
      el: h(
        "section",
        h("div.barra-sup.barra-juego", h("span.icono-yo", avatar(yo)), reloj.el, h("button.icono-btn", { type: "button", onclick: abandonar, "aria-label": "Dejar la partida" }, "✕")),
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

  function resultado(meta, r) {
    const anterior = apuntar(meta.id, r);
    const record = r.valor != null && (!anterior || r.valor > anterior.valor);
    if (record) navigator.vibrate?.([60, 60, 120]);
    mostrar({
      el: h(
        "section",
        barra(),
        h(
          "div.espera",
          h("span.suave", meta.nombre),
          h("div.puesto-grande.aparece", record ? "🏆" : r.valor != null ? "👏" : "🙂"),
          h("h1", record ? (anterior ? "¡Nuevo récord!" : "¡Primer récord!") : r.valor != null ? "¡Bien jugado!" : "Esta vez no ha salido"),
          h("p", r.texto),
          anterior && !record ? h("p.suave", `Tu récord: ${anterior.texto}`) : null,
          anterior && record ? h("p.suave", `Antes: ${anterior.texto}`) : null
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
