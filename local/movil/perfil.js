// Perfil del jugador: nombre, color de las letras, fondo del banner y foto (o iniciales).
import { h, banner } from "../comun/ui.js";
import { almacen } from "../comun/conexion.js";
import { campoTexto } from "../comun/teclado.js";
import { selectorColor } from "../comun/color.js";

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
  almacen.guardar("nyp-perfil", JSON.stringify(p));
}

/** Recorta la foto en cuadrado y la reduce (≈15-25 KB) para mandarla a la TV. */
function prepararFoto(archivo) {
  return new Promise((ok, mal) => {
    const img = new Image();
    const url = URL.createObjectURL(archivo);
    img.onload = () => {
      const lado = Math.min(img.naturalWidth, img.naturalHeight);
      const c = Object.assign(document.createElement("canvas"), { width: 192, height: 192 });
      c.getContext("2d").drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, 192, 192);
      URL.revokeObjectURL(url);
      ok(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = mal;
    img.src = url;
  });
}

/**
 * Cámara propia con un círculo guía: lo que queda dentro del círculo es la foto de perfil.
 * Devuelve la foto (JPEG 192×192, data URL) o null si se cancela. Sin cámara disponible, lanza error.
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
      // El visor es cuadrado y el vídeo lo llena (object-fit: cover): se ve el cuadrado central.
      // El círculo ocupa el 80 % del visor.
      const lado = Math.min(vw, vh) * 0.8;
      const c = Object.assign(document.createElement("canvas"), { width: 192, height: 192 });
      const ctx = c.getContext("2d");
      if (frontal) {
        ctx.translate(192, 0);
        ctx.scale(-1, 1); // la foto sale como te ves en el espejo
      }
      ctx.drawImage(video, (vw - lado) / 2, (vh - lado) / 2, lado, lado, 0, 0, 192, 192);
      navigator.vibrate?.(30);
      cerrar(c.toDataURL("image/jpeg", 0.82));
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

  // Colores: una fila de colores y la rueda; arriba eliges qué pintas (fondo, letras o contorno).
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
      } catch {
        aviso.textContent = "No se pudo usar esa imagen";
      }
    });
  }

  // Con cámara propia (https) se ve el círculo guía; si no, la cámara del sistema.
  async function hacerFoto() {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) return entradaCamara.click();
    try {
      const foto = await camaraCircular();
      if (foto) {
        p.foto = foto;
        pintarVista();
      }
    } catch {
      entradaCamara.click();
    }
  }

  const pestañas = { nombre: "Nombre", colores: "Colores", foto: "Foto" };
  const paneles = {
    nombre: h("div.panel-perfil", campo.visor, campo.teclado),
    colores: h("div.panel-perfil", interruptores, cajaColores),
    foto: h(
      "div.panel-perfil",
      h("button.boton.acento.grande", { type: "button", onclick: hacerFoto }, "📸 Hacer una foto"),
      h("button.boton.suave.grande", { type: "button", onclick: () => entradaGaleria.click() }, "🖼️ Elegir de la galería"),
      h("button.boton.suave", { type: "button", onclick: () => ((p.foto = null), pintarVista()) }, "Usar mis iniciales"),
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
    h("button.boton.acento.grande", { type: "button", onclick: guardar }, "Guardar")
  );
  return { el };
}
