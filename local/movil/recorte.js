// Recortar la foto de perfil, todo en el propio móvil (la foto nunca sale de él):
//  - ✨ Detectar: un detector (MediaPipe, de Google) encuentra a la persona y su cara en la foto y
//    recorta la cabeza con el pelo. Funciona dentro del navegador del móvil: lo único que se descarga
//    (la primera vez, con internet) es el propio detector; la foto no se envía a ningún sitio.
//  - ✍️ A mano: rodeas la cabeza con el dedo y se recorta lo que queda dentro del trazo.
// El resultado es una imagen con fondo transparente que asoma por encima del círculo del avatar.
import { h } from "../comun/ui.js";

const ANCHO = 240, ALTO = 324; // el recorte: un poco más alto que ancho (la cabeza sobresale por arriba)
const LADO = 640; // la foto de trabajo es un cuadrado de 640 px

// Detector (se carga solo si se pide, y solo una vez)
const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODELO_PERSONA = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
const MODELO_CARA = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";
let detector = null;

const lienzoNuevo = (w, h2 = w) => Object.assign(document.createElement("canvas"), { width: w, height: h2 });

/** Una imagen (o vídeo) como cuadrado de `lado` px, centrado. */
export function cuadrado(fuente, ancho, alto, lado = LADO, espejo = false) {
  const c = lienzoNuevo(lado);
  const ctx = c.getContext("2d");
  const l = Math.min(ancho, alto);
  if (espejo) {
    ctx.translate(lado, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(fuente, (ancho - l) / 2, (alto - l) / 2, l, l, 0, 0, lado, lado);
  return c;
}

/** Foto redonda de siempre: el centro (fraccion = parte del cuadrado) en JPEG 192×192. */
function fotoRedonda(src, fraccion) {
  const c = lienzoNuevo(192);
  const l = src.width * fraccion;
  c.getContext("2d").drawImage(src, (src.width - l) / 2, (src.height - l) / 2, l, l, 0, 0, 192, 192);
  return c.toDataURL("image/jpeg", 0.82);
}

/** ¿Es una foto recortada (con transparencia)? */
export function esRecorte(foto) {
  return typeof foto === "string" && (/^data:image\/(png|webp)/.test(foto) || /[?&]r=1\b/.test(foto));
}

// ------------------------------------------------------------------ máscara → imagen final

/** Recuadro de lo que la máscara deja ver (alfa > 50 %). */
function recuadro(mascara) {
  const { width: W, height: H } = mascara;
  const d = mascara.getContext("2d").getImageData(0, 0, W, H).data;
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (d[(y * W + x) * 4 + 3] > 128) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { minX, minY, bw: Math.max(1, maxX - minX), bh: Math.max(1, maxY - minY) };
}

/** La foto final: lo que deja ver la máscara, encuadrado (cabeza centrada y apoyada abajo), con fondo transparente. */
function fotoRecortada(src, mascara) {
  const r = recuadro(mascara);
  if (!r) return null;
  const s = Math.min((ANCHO * 0.86) / r.bw, (ALTO * 0.97) / r.bh);
  const c = lienzoNuevo(ANCHO, ALTO);
  const ctx = c.getContext("2d");
  ctx.translate((ANCHO - r.bw * s) / 2 - r.minX * s, ALTO - r.bh * s - r.minY * s);
  ctx.scale(s, s);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(mascara, 0, 0);
  // WebP si el navegador sabe (pesa menos); si no, PNG. Las dos guardan la transparencia.
  const webp = c.toDataURL("image/webp", 0.86);
  return webp.startsWith("data:image/webp") ? webp : c.toDataURL("image/png");
}

// ------------------------------------------------------------------ a mano

/** Máscara de un trazo cerrado (lo que queda dentro). */
function mascaraDeTrazo(puntos) {
  const m = lienzoNuevo(LADO);
  const c = m.getContext("2d");
  c.beginPath();
  puntos.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = "#fff";
  c.fill();
  return m;
}

// ------------------------------------------------------------------ detección automática

async function cargarDetector() {
  if (detector) return detector;
  const v = await import(/* @vite-ignore */ `${MP}/vision_bundle.mjs`);
  const archivos = await v.FilesetResolver.forVisionTasks(`${MP}/wasm`);
  const [persona, cara] = await Promise.all([
    v.ImageSegmenter.createFromOptions(archivos, {
      baseOptions: { modelAssetPath: MODELO_PERSONA, delegate: "CPU" },
      runningMode: "IMAGE",
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    }),
    v.FaceDetector.createFromOptions(archivos, { baseOptions: { modelAssetPath: MODELO_CARA, delegate: "CPU" }, runningMode: "IMAGE" }),
  ]);
  detector = { persona, cara };
  return detector;
}

/** Máscara de la cabeza (con el pelo): la persona que detecta, cortada un poco por debajo de la barbilla. */
async function mascaraAutomatica(src) {
  const { persona, cara } = await cargarDetector();
  const caras = cara.detect(src).detections;
  if (!caras.length) throw new Error("sin-cara");
  // La cara más grande (por si sale alguien más al fondo).
  const b = caras.map((d) => d.boundingBox).sort((x, y) => y.width * y.height - x.width * x.height)[0];

  const seg = persona.segment(src);
  const conf = seg.confidenceMasks[0];
  const w = conf.width, hgt = conf.height;
  const datos = conf.getAsFloat32Array();
  const peq = lienzoNuevo(w, hgt);
  const img = peq.getContext("2d").createImageData(w, hgt);
  for (let i = 0; i < datos.length; i++) {
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, (datos[i] - 0.15) / 0.7)) * 255);
  }
  peq.getContext("2d").putImageData(img, 0, 0);
  seg.close?.();

  const m = lienzoNuevo(LADO);
  const ctx = m.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.filter = "blur(1.5px)";
  ctx.drawImage(peq, 0, 0, LADO, LADO);
  ctx.filter = "none";
  // Solo la cabeza: se borra (suavemente) lo que queda por debajo de la barbilla y muy a los lados.
  const sx = LADO / src.width;
  const barbilla = (b.originY + b.height * 1.12) * sx;
  const cx = (b.originX + b.width / 2) * sx, ancho = b.width * sx * 1.35;
  ctx.globalCompositeOperation = "destination-in";
  const gv = ctx.createLinearGradient(0, barbilla - LADO * 0.03, 0, barbilla + LADO * 0.03);
  gv.addColorStop(0, "#000");
  gv.addColorStop(1, "transparent");
  ctx.fillStyle = gv;
  ctx.fillRect(0, 0, LADO, LADO);
  const gh = ctx.createLinearGradient(cx - ancho, 0, cx + ancho, 0);
  gh.addColorStop(0, "transparent");
  gh.addColorStop(0.08, "#000");
  gh.addColorStop(0.92, "#000");
  gh.addColorStop(1, "transparent");
  ctx.fillStyle = gh;
  ctx.fillRect(0, 0, LADO, LADO);
  if (!recuadro(m)) throw new Error("sin-cara");
  return m;
}

// ------------------------------------------------------------------ el editor

/**
 * Abre el editor. src: canvas cuadrado con la foto. fraccion: qué parte usar si se elige la foto redonda.
 * Devuelve la foto (data URL) o null si se cancela.
 */
export function editarFoto(src, fraccion = 1) {
  return new Promise((ok) => {
    const lienzo = h("canvas.rec-lienzo");
    const ctx = lienzo.getContext("2d");
    let puntos = []; // trazo del dedo, en píxeles de src
    let dibujando = false;
    let mascara = null; // lo que se va a recortar

    const aviso = h("p.cam-aviso", "Toca ✨ Detectar o rodea tu cabeza con el dedo");
    const muestra = h("div.rec-muestra");
    const usar = h("button.boton.acento", { type: "button", disabled: true, onclick: () => cerrar(fotoRecortada(src, mascara)) }, "✂️ Usar recorte");
    const detectar = h("button.boton.rec-detectar", { type: "button", onclick: () => auto() }, "✨ Detectar");

    function tamaño() {
      const lado = Math.round(Math.min(innerWidth * 0.92, innerHeight * 0.5) * devicePixelRatio);
      lienzo.width = lienzo.height = lado;
      pintar();
    }

    function pintar() {
      const L = lienzo.width, k = L / src.width;
      ctx.clearRect(0, 0, L, L);
      ctx.drawImage(src, 0, 0, L, L);
      if (mascara && !dibujando) {
        // Fuera del recorte, oscuro (con el mismo borde suave que tendrá la foto).
        const sombra = lienzoNuevo(L);
        const s = sombra.getContext("2d");
        s.fillStyle = "rgba(5, 13, 42, 0.66)";
        s.fillRect(0, 0, L, L);
        s.globalCompositeOperation = "destination-out";
        s.drawImage(mascara, 0, 0, L, L);
        ctx.drawImage(sombra, 0, 0);
      }
      if (puntos.length > 1) {
        ctx.beginPath();
        puntos.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k)));
        if (!dibujando) ctx.closePath();
        ctx.lineWidth = Math.max(3, L / 150);
        ctx.setLineDash(dibujando ? [] : [L / 50, L / 80]);
        ctx.strokeStyle = "#ffd34d";
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    function listo(texto) {
      aviso.textContent = texto;
      usar.disabled = !mascara;
      muestra.replaceChildren();
      const foto = mascara && fotoRecortada(src, mascara);
      if (foto) muestra.replaceChildren(h("span.avatar.con-recorte.rec-avatar", h("img", { src: foto, alt: "" })), h("small", "Así quedará"));
      pintar();
    }

    async function auto() {
      detectar.disabled = true;
      const primera = !detector;
      aviso.textContent = primera ? "Preparando el detector (solo la primera vez)…" : "Buscando tu cara…";
      try {
        mascara = await mascaraAutomatica(src);
        puntos = [];
        listo("¿Te gusta? Si no, rodea tu cabeza con el dedo");
      } catch (e) {
        aviso.textContent =
          e?.message === "sin-cara"
            ? "No encuentro ninguna cara: rodea tu cabeza con el dedo"
            : "No se pudo cargar el detector (¿sin internet?): rodea tu cabeza con el dedo";
      } finally {
        detectar.disabled = false;
      }
    }

    const aPunto = (ev) => {
      const r = lienzo.getBoundingClientRect();
      return [((ev.clientX - r.left) / r.width) * src.width, ((ev.clientY - r.top) / r.height) * src.height];
    };
    const añadir = (p) => puntos.push(p);
    lienzo.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      try {
        lienzo.setPointerCapture(ev.pointerId);
      } catch {}
      dibujando = true;
      puntos = [];
      añadir(aPunto(ev));
      usar.disabled = true;
      muestra.replaceChildren();
      pintar();
    });
    lienzo.addEventListener("pointermove", (ev) => {
      if (!dibujando) return;
      const p = aPunto(ev), u = puntos.at(-1);
      if (Math.hypot(p[0] - u[0], p[1] - u[1]) < src.width / 200) return;
      añadir(p);
      pintar();
    });
    const soltar = () => {
      if (!dibujando) return;
      dibujando = false;
      const xs = puntos.map((p) => p[0]), ys = puntos.map((p) => p[1]);
      const grande = Math.max(...xs) - Math.min(...xs) > src.width * 0.12 && Math.max(...ys) - Math.min(...ys) > src.height * 0.12;
      if (puntos.length < 8 || !grande) {
        puntos = [];
        aviso.textContent = "Haz el contorno más grande, alrededor de toda la cabeza";
        pintar();
        return;
      }
      mascara = mascaraDeTrazo(puntos);
      listo("¿Te gusta? Si no, vuelve a dibujar encima");
    };
    lienzo.addEventListener("pointerup", soltar);
    lienzo.addEventListener("pointercancel", soltar);

    const cerrar = (foto) => {
      removeEventListener("resize", tamaño);
      capa.remove();
      ok(foto);
    };
    const capa = h(
      "div.capa-camara.capa-recorte",
      h("div.rec-visor", lienzo),
      h("div.rec-herramientas", detectar),
      aviso,
      muestra,
      h(
        "div.rec-botones",
        h("button.boton.suave", { type: "button", onclick: () => cerrar(fotoRedonda(src, fraccion)) }, "⭕ Foto redonda"),
        usar
      ),
      h("button.boton.suave.rec-cancelar", { type: "button", onclick: () => cerrar(null) }, "Cancelar")
    );
    addEventListener("resize", tamaño);
    document.body.append(capa);
    tamaño();
  });
}
