// Perfil del jugador: nombre, color de las letras, fondo del banner y foto (o iniciales).
import { h, banner, SOMBREROS, ANIMACIONES } from "../comun/ui.js";
import { almacen } from "../comun/conexion.js";
import { campoTexto } from "../comun/teclado.js";
import { selectorColor } from "../comun/color.js";
import { editarFoto, cuadrado } from "./recorte.js";
import { premiosGanados, hazanaDe } from "../solo/hazanas.js";
import { idMovil } from "../comun/familia.js";
import { subirFoto, leerFotos, borrarFoto, leerJugadores, leerFicha } from "../comun/nube.js";

// ------------------------------------------------------------------ historial de fotos
// Al cambiar de foto, la anterior se guarda aquí (en el móvil y en la nube) para poder volver a ella.
const MAX_FOTOS = 8;
function leerHistorial() {
  try {
    return JSON.parse(almacen.leer("nyp-fotos") ?? "[]");
  } catch {
    return [];
  }
}
function guardarHistorial(l) {
  almacen.guardar("nyp-fotos", JSON.stringify(l.slice(0, MAX_FOTOS)));
}
/** Guarda una foto en el historial (si no estaba ya). */
export function apuntarFoto(foto) {
  if (!foto) return;
  const l = leerHistorial();
  if (l.some((x) => x.foto === foto)) return;
  const fid = `f${Date.now().toString(36)}`;
  guardarHistorial([{ fid, foto }, ...l]);
  subirFoto(idMovil(), fid, foto).catch(() => {});
}
function quitarFoto(fid) {
  guardarHistorial(leerHistorial().filter((x) => x.fid !== fid));
  borrarFoto(idMovil(), fid).catch(() => {});
}

export const FONDOS = ["#5fb7d0", "#7c9cf0", "#6cc49a", "#e9c75a", "#e7a05c", "#e46a62", "#f08fb5", "#c58be0", "#ffffff", "#1d3f86", "#0b1d4f", "#2b2b2b"];
export const TEXTOS = ["#0a1b4a", "#ffffff", "#000000", "#e9c75a", "#e46a62", "#6cc49a", "#5fb7d0", "#c58be0"];
// Colores rápidos del perfil (los mismos para fondo, letras y contorno).
const COLORES = ["#ffffff", "#000000", "#0a1b4a", "#5fb7d0", "#7c9cf0", "#6cc49a", "#e9c75a", "#e7a05c", "#e46a62", "#f08fb5", "#c58be0"];

export function cargarPerfil() {
  try {
    const p = JSON.parse(almacen.leer("nyp-perfil") ?? "null");
    if (p?.nombre) return p;
  } catch {}
  const viejo = almacen.leer("nyp-nombre"); // nombre de versiones anteriores
  return viejo ? { nombre: viejo, color: FONDOS[0], colorTexto: TEXTOS[0], foto: null } : null;
}

export function guardarPerfil(p) {
  // La foto que dejas de usar pasa al historial.
  const antes = cargarPerfil();
  if (antes?.foto && antes.foto !== p.foto) apuntarFoto(antes.foto);
  almacen.guardar("nyp-perfil", JSON.stringify(p));
}

/**
 * Recuperar tu perfil de otro móvil (o tras borrar la app): eliges quién eres en la lista de la nube y se
 * copian tu perfil, tus récords, tus hazañas y tus fotos. Desde entonces este móvil es «tú».
 */
export function recuperarPerfil() {
  return new Promise((ok) => {
    const lista = h("div.recuperar-lista", h("p.suave", "Buscando en la nube…"));
    const cerrar = (v) => (capa.remove(), ok(v));
    const capa = h(
      "div.capa-movil",
      { onclick: (ev) => ev.target === capa && cerrar(null) },
      h("div.caja.tarjeta", h("div.records-cabeza", h("h2", "☁️ ¿Quién eres?"), h("button.icono-btn", { type: "button", onclick: () => cerrar(null), "aria-label": "Cerrar" }, "✕")), lista)
    );
    document.body.append(capa);
    leerJugadores()
      .then((js) => {
        const yo = idMovil();
        const otros = js.filter((j) => j.id !== yo && j.nombre).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        if (!otros.length) return lista.replaceChildren(h("p.suave", "No hay perfiles guardados en la nube."));
        lista.replaceChildren(
          h("p.suave", "Elige tu perfil. Se copiarán tus récords, hazañas y fotos a este móvil."),
          ...otros.map((j) =>
            h("button.recuperar-fila", { type: "button", onclick: () => elegir(j.id) }, banner({ ...j, foto: null }), h("small", j.actualizado ? `Última vez: ${j.actualizado.slice(0, 10).split("-").reverse().join("/")}` : ""))
          )
        );
      })
      .catch(() => lista.replaceChildren(h("p.suave", "No se pudo conectar con la nube. ¿Tienes internet?")));
    async function elegir(id) {
      lista.replaceChildren(h("p.suave", "Copiando tu perfil…"));
      try {
        const f = await leerFicha(id);
        const json = (t) => {
          try {
            return JSON.parse(t ?? "{}");
          } catch {
            return {};
          }
        };
        // Récords y hazañas: se juntan con los de este móvil (gana la mejor marca).
        const mios = json(almacen.leer("nyp-records"));
        for (const [k, r] of Object.entries(json(f.records))) if (!mios[k] || r.valor > mios[k].valor) mios[k] = r;
        almacen.guardar("nyp-records", JSON.stringify(mios));
        almacen.guardar("nyp-hazanas", JSON.stringify({ ...json(almacen.leer("nyp-hazanas")), ...json(f.hazanas) }));
        almacen.guardar("nyp-id", id);
        const p = { nombre: f.nombre, color: f.color, colorTexto: f.colorTexto, contorno: f.contorno, foto: f.foto, sombrero: f.sombrero, animacion: f.animacion };
        almacen.guardar("nyp-perfil", JSON.stringify(p));
        try {
          guardarHistorial((await leerFotos(id)).map(({ fid, foto }) => ({ fid, foto })));
        } catch {}
        cerrar(p);
      } catch {
        lista.replaceChildren(h("p.suave", "No se pudo copiar. Inténtalo otra vez."));
      }
    }
  });
}

/** Foto de la galería: el cuadrado central, para el editor (recortar la cara o dejarla redonda). */
function prepararFoto(archivo) {
  return new Promise((ok, mal) => {
    const img = new Image();
    const url = URL.createObjectURL(archivo);
    img.onload = () => {
      URL.revokeObjectURL(url);
      ok(editarFoto(cuadrado(img, img.naturalWidth, img.naturalHeight), 1));
    };
    img.onerror = mal;
    img.src = url;
  });
}

/**
 * Cámara propia con un círculo guía. Después se abre el editor (recortar la cara o foto redonda).
 * Devuelve la foto (data URL) o null si se cancela. Sin cámara disponible, lanza error.
 */
function camaraCircular() {
  return new Promise(async (ok, mal) => {
    let flujo;
    let frontal = true;
    const video = h("video.cam-video", { playsinline: true, muted: true, autoplay: true });
    const aviso = h("p.cam-aviso", "Pon tu cara dentro del círculo");
    async function abrir() {
      flujo?.getTracks().forEach((t) => t.stop());
      flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: frontal ? "user" : "environment", width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
      video.srcObject = flujo;
      video.classList.toggle("espejo", frontal);
      await video.play().catch(() => {});
    }
    try {
      await abrir();
    } catch (e) {
      return mal(e);
    }
    const cerrar = (foto) => {
      flujo?.getTracks().forEach((t) => t.stop());
      capa.remove();
      ok(foto);
    };
    function disparar() {
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw) return;
      // El visor es cuadrado y el vídeo lo llena: se guarda ese cuadrado (como espejo con la cámara de delante).
      const src = cuadrado(video, vw, vh, 640, frontal);
      navigator.vibrate?.(30);
      flujo?.getTracks().forEach((t) => t.stop());
      capa.remove();
      // El círculo guía ocupa el 80 % del visor: eso es la foto redonda.
      editarFoto(src, 0.8).then(ok);
    }
    const capa = h(
      "div.capa-camara",
      h("div.cam-visor", video, h("div.cam-circulo")),
      aviso,
      h(
        "div.cam-botones",
        h("button.icono-btn.cam-lateral", { type: "button", onclick: () => cerrar(null), "aria-label": "Cancelar" }, "✕"),
        h("button.cam-disparo", { type: "button", onclick: disparar, "aria-label": "Hacer la foto" }),
        h("button.icono-btn.cam-lateral", { type: "button", onclick: () => ((frontal = !frontal), abrir().catch(() => {})), "aria-label": "Cambiar de cámara" }, "🔄")
      )
    );
    document.body.append(capa);
  });
}

/** Pantalla de edición. alGuardar(perfil) recibe el perfil nuevo. */
export function pantallaPerfil({ perfil, alGuardar, alVolver, titulo = "Tu perfil" }) {
  const p = { nombre: "", color: FONDOS[0], colorTexto: TEXTOS[0], contorno: null, foto: null, ...(perfil ?? {}) };
  const vista = h("div.perfil-vista");
  const pintarVista = () => vista.replaceChildren(banner(p, ".banner-grande"));

  const campo = campoTexto({ valor: p.nombre, max: 14, placeholder: "Toca las letras", alCambiar: (t) => ((p.nombre = t), pintarVista()) });

  // Colores: dos filas de colores y debajo la rueda, siempre a la vista; arriba eliges qué pintas (fondo, letras o contorno).
  const PARTES = { color: "Fondo", colorTexto: "Texto", contorno: "Contorno" };
  let parte = "color";
  const cajaColores = h("div.colores-perfil");
  const interruptores = h("div.pestanas.partes-color");
  const pintarColores = () => {
    interruptores.querySelectorAll("button").forEach((b) => b.classList.toggle("activa", b.dataset.k === parte));
    cajaColores.replaceChildren(
      selectorColor({
        valor: p[parte],
        colores: COLORES,
        ninguno: parte === "contorno" ? "Sin contorno" : null,
        ruedaFija: true,
        alCambiar: (c) => ((p[parte] = c), pintarVista()),
      }).el
    );
  };
  interruptores.append(
    ...Object.entries(PARTES).map(([k, t]) => h("button", { type: "button", "data-k": k, onclick: () => ((parte = k), pintarColores()) }, t))
  );
  pintarColores();

  // Foto: abre la cámara del móvil (o la galería). Funciona también sin https.
  const entradaCamara = h("input", { type: "file", accept: "image/*", capture: "user", class: "oculto" });
  const entradaGaleria = h("input", { type: "file", accept: "image/*", class: "oculto" });
  const aviso = h("div.pl-aviso");
  for (const entrada of [entradaCamara, entradaGaleria]) {
    entrada.addEventListener("change", async () => {
      const archivo = entrada.files?.[0];
      entrada.value = "";
      if (!archivo) return;
      try {
        p.foto = await prepararFoto(archivo);
        pintarVista();
        pintarFotos();
      } catch {
        aviso.textContent = "No se pudo usar esa imagen";
      }
    });
  }

  // Fotos que has usado antes: tocar una la vuelve a poner; ✕ la borra de la lista.
  const cajaFotos = h("div.fotos-usadas");
  const pintarFotos = () => {
    const l = leerHistorial().filter((x) => x.foto !== p.foto);
    cajaFotos.replaceChildren(
      ...(l.length
        ? [
            h("span.etiqueta", "Fotos que has usado"),
            h(
              "div.fotos-usadas-lista",
              l.map((x) =>
                h(
                  "div.foto-usada",
                  h("button.foto-usada-img", { type: "button", onclick: () => (apuntarFoto(p.foto), (p.foto = x.foto), pintarVista(), pintarFotos()), "aria-label": "Usar esta foto" }, h("img", { src: x.foto, alt: "" })),
                  h("button.foto-usada-quitar", { type: "button", onclick: () => (quitarFoto(x.fid), pintarFotos()), "aria-label": "Quitar de la lista" }, "✕")
                )
              )
            ),
          ]
        : [])
    );
  };
  pintarFotos();

  // Con cámara propia (https) se ve el círculo guía; si no, la cámara del sistema.
  async function hacerFoto() {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) return entradaCamara.click();
    try {
      const foto = await camaraCircular();
      if (foto) {
        p.foto = foto;
        pintarVista();
        pintarFotos();
      }
    } catch {
      entradaCamara.click();
    }
  }

  // Premios: sombreros y animaciones que se ganan con las hazañas (los que faltan, con candado).
  const cajaPremios = h("div.premios");
  const pintarPremios = () => {
    const ganados = premiosGanados();
    const opcion = (tipo, id, texto, icono) => {
      const ok = id === null || ganados[tipo === "sombrero" ? "sombreros" : "animaciones"].has(id);
      const elegido = (p[tipo] ?? null) === id;
      const de = id && !ok ? hazanaDe(tipo, id) : null;
      return h(
        `button.premio${elegido ? ".elegido" : ""}${ok ? "" : ".bloqueado"}`,
        { type: "button", disabled: !ok, title: de ? `Se consigue con la hazaña «${de.nombre}»` : texto, onclick: () => ((p[tipo] = id), pintarPremios(), pintarVista()) },
        h("span.premio-icono", ok ? icono : "🔒"),
        h("small", ok ? texto : de?.nombre ?? texto)
      );
    };
    cajaPremios.replaceChildren(
      h("span.etiqueta", "Sombrero"),
      h("div.premios-fila", opcion("sombrero", null, "Ninguno", "🚫"), Object.entries(SOMBREROS).map(([id, e]) => opcion("sombrero", id, id[0].toUpperCase() + id.slice(1), e))),
      h("span.etiqueta", "Animación"),
      h("div.premios-fila", opcion("animacion", null, "Ninguna", "🚫"), Object.entries(ANIMACIONES).map(([id, t]) => opcion("animacion", id, t, { salto: "🦘", giro: "🌀", baile: "💃", brillo: "✨" }[id]))),
      h("p.suave.premios-nota", "Se desbloquean con las 🎖️ Hazañas de «Jugar solo».")
    );
  };
  pintarPremios();

  const pestañas = { nombre: "Nombre", colores: "Colores", foto: "Foto", premios: "Premios" };
  const paneles = {
    nombre: h("div.panel-perfil", campo.visor, campo.teclado),
    colores: h("div.panel-perfil", interruptores, cajaColores),
    premios: h("div.panel-perfil", cajaPremios),
    foto: h(
      "div.panel-perfil",
      h("button.boton.acento.grande", { type: "button", onclick: hacerFoto }, "📸 Hacer una foto"),
      h("button.boton.suave.grande", { type: "button", onclick: () => entradaGaleria.click() }, "🖼️ Elegir de la galería"),
      h("button.boton.suave", { type: "button", onclick: () => (apuntarFoto(p.foto), (p.foto = null), pintarVista(), pintarFotos()) }, "Usar mis iniciales"),
      cajaFotos,
      entradaCamara,
      entradaGaleria
    ),
  };
  const cuerpo = h("div.perfil-cuerpo");
  const botonesPestaña = h("div.pestanas");
  const elegir = (k) => {
    cuerpo.replaceChildren(paneles[k]);
    botonesPestaña.querySelectorAll("button").forEach((b) => b.classList.toggle("activa", b.dataset.k === k));
  };
  botonesPestaña.append(...Object.entries(pestañas).map(([k, t]) => h("button", { type: "button", "data-k": k, onclick: () => elegir(k) }, t)));

  const guardar = () => {
    p.nombre = campo.valor();
    if (!p.nombre) {
      elegir("nombre");
      aviso.textContent = "Escribe tu nombre";
      return;
    }
    guardarPerfil(p);
    alGuardar(p);
  };

  pintarVista();
  elegir("nombre");
  const el = h(
    "section.perfil",
    h("div.barra-sup", alVolver ? h("button.icono-btn", { type: "button", onclick: alVolver, "aria-label": "Volver" }, "←") : null, h("span.nombre", titulo)),
    vista,
    botonesPestaña,
    cuerpo,
    aviso,
    h("button.boton.acento.grande", { type: "button", onclick: guardar }, "Guardar"),
    // ¿Ya jugabas en otro móvil (o borraste la app)? Se recupera todo de la nube.
    h(
      "button.boton.suave.recuperar-btn",
      {
        type: "button",
        onclick: async () => {
          const r = await recuperarPerfil();
          if (r) alGuardar(r);
        },
      },
      "☁️ Recuperar mi perfil de otro móvil"
    )
  );
  return { el };
}
