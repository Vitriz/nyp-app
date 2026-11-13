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

/** Deja la máscara nítida: cada píxel, o se ve entero o no se ve (sin difuminado). */
function nitida(m) {
  const c = m.getContext("2d");
  const img = c.getImageData(0, 0, m.width, m.height);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] >= 128 ? 255 : 0;
  c.putImageData(img, 0, 0);
  return m;
}

/**
 * Máscara de la cabeza (con el pelo), nítida.
 * - zona: si ya hay un recorte (a mano o anterior), el detector mira solo ahí dentro (así no se lleva
 *   cosas del fondo) y el resultado nunca se sale de esa zona.
 * - Se queda solo con la mancha unida a la cara (fuera trozos sueltos) y se corta bajo la barbilla.
 */
async function mascaraAutomatica(src, zona = null) {
  const { persona, cara } = await cargarDetector();
  // Qué parte de la foto se analiza: toda, o un cuadrado alrededor de la zona (con un margen).
  let rx = 0, ry = 0, rl = LADO;
  const rz = zona && recuadro(zona);
  if (rz) {
    rl = Math.min(LADO, Math.max(rz.bw, rz.bh) * 1.2);
    rx = Math.max(0, Math.min(LADO - rl, rz.minX + rz.bw / 2 - rl / 2));
    ry = Math.max(0, Math.min(LADO - rl, rz.minY + rz.bh / 2 - rl / 2));
  }
  const T = 512;
  const trozo = lienzoNuevo(T);
  trozo.getContext("2d").drawImage(src, rx, ry, rl, rl, 0, 0, T, T);

  const caras = cara.detect(trozo).detections;
  const b = caras.map((d) => d.boundingBox).sort((x, y) => y.width * y.height - x.width * x.height)[0] ?? null;
  if (!b && !rz) throw new Error("sin-cara");

  const seg = persona.segment(trozo);
  const conf = seg.confidenceMasks[0];
  const w = conf.width, hgt = conf.height;
  const datos = conf.getAsFloat32Array();
  seg.close?.();
  // Solo la mancha que toca la cara (o, sin cara, la del centro de la zona): fuera lo que esté suelto.
  const dentro = (i) => datos[i] >= 0.5;
  let inicio = -1;
  const cx = Math.round(((b ? b.originX + b.width / 2 : T / 2) / T) * w), cy = Math.round(((b ? b.originY + b.height / 2 : T / 2) / T) * hgt);
  for (let r = 0; r < Math.max(w, hgt) && inicio < 0; r++) {
    for (let dy = -r; dy <= r && inicio < 0; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && y >= 0 && x < w && y < hgt && dentro(y * w + x)) {
          inicio = y * w + x;
          break;
        }
      }
    }
  }
  if (inicio < 0) throw new Error("sin-cara");
  const queda = new Uint8Array(w * hgt);
  const pila = [inicio];
  queda[inicio] = 1;
  while (pila.length) {
    const i = pila.pop();
    const x = i % w, y = (i - x) / w;
    for (const n of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < hgt - 1 ? i + w : -1]) {
      if (n >= 0 && !queda[n] && dentro(n)) {
        queda[n] = 1;
        pila.push(n);
      }
    }
  }
  const peq = lienzoNuevo(w, hgt);
  const img = peq.getContext("2d").createImageData(w, hgt);
  for (let i = 0; i < queda.length; i++) {
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = queda[i] ? 255 : 0;
  }
  peq.getContext("2d").putImageData(img, 0, 0);

  const m = lienzoNuevo(LADO);
  const ctx = m.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(peq, 0, 0, w, hgt, rx, ry, rl, rl); // al ampliar, el borde sale curvo (no a escalones)…
  nitida(m); // …y luego se deja nítido
  if (b) {
    // Solo la cabeza: nada por debajo de la barbilla ni muy a los lados (corte limpio).
    const esc = rl / T;
    const barbilla = ry + (b.originY + b.height * 1.12) * esc;
    const centro = rx + (b.originX + b.width / 2) * esc, ancho = b.width * esc * 1.3;
    ctx.clearRect(0, barbilla, LADO, LADO);
    ctx.clearRect(0, 0, centro - ancho, LADO);
    ctx.clearRect(centro + ancho, 0, LADO, LADO);
  }
  if (zona) {
    ctx.globalCompositeOperation = "destination-in"; // nunca fuera de lo que dibujaste
    ctx.drawImage(zona, 0, 0);
  }
  if (!recuadro(m)) throw new Error("sin-cara");
  return m;
}

/** Suma o resta un trazo a la máscara actual. */
function combinar(base, trazo, modo) {
  const m = lienzoNuevo(LADO);
  const c = m.getContext("2d");
  c.drawImage(base, 0, 0);
  c.globalCompositeOperation = modo === "restar" ? "destination-out" : "source-over";
  c.drawImage(trazo, 0, 0);
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
    let modo = "nuevo"; // nuevo | sumar | restar: qué hace el siguiente trazo

    const aviso = h("p.cam-aviso", "Toca ✨ Detectar o rodea tu cabeza con el dedo");
    const muestra = h("div.rec-muestra");
    const usar = h("button.boton.acento", { type: "button", disabled: true, onclick: () => cerrar(fotoRecortada(src, mascara)) }, "✂️ Usar recorte");
    const detectar = h("button.boton.rec-detectar", { type: "button", onclick: () => auto() }, "✨ Detectar");
    const sumar = h("button.boton.suave.rec-modo", { type: "button", disabled: true, onclick: () => cambiarModo("sumar") }, "➕ Añadir");
    const restar = h("button.boton.suave.rec-modo", { type: "button", disabled: true, onclick: () => cambiarModo("restar") }, "➖ Quitar");

    function cambiarModo(m) {
      modo = modo === m ? "nuevo" : m;
      sumar.classList.toggle("activo", modo === "sumar");
      restar.classList.toggle("activo", modo === "restar");
      aviso.textContent =
        modo === "sumar" ? "Rodea con el dedo lo que quieras añadir al recorte"
        : modo === "restar" ? "Rodea con el dedo lo que quieras quitar del recorte"
        : "Rodea tu cabeza para empezar de nuevo, o toca ✨ Detectar";
    }

    function tamaño() {
      const lado = Math.round(Math.min(innerWidth * 0.92, innerHeight * 0.5) * devicePixelRatio);
      lienzo.width = lienzo.height = lado;
      pintar();
    }

    function pintar() {
      const L = lienzo.width, k = L / src.width;
      ctx.clearRect(0, 0, L, L);
      ctx.drawImage(src, 0, 0, L, L);
      // Al retocar (➕ / ➖) el recorte sigue a la vista mientras dibujas; solo al empezar de nuevo se aparta.
      const retocando = modo !== "nuevo";
      if (mascara && (!dibujando || retocando)) {
        // Fuera del recorte, oscuro.
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
        if (!dibujando || retocando) ctx.closePath();
        // Al retocar, la zona que rodeas se tiñe de verde (añadir) o rojo (quitar).
        if (retocando && mascara) {
          ctx.fillStyle = modo === "sumar" ? "rgba(108, 196, 154, 0.35)" : "rgba(255, 107, 107, 0.35)";
          ctx.fill();
        }
        ctx.lineWidth = Math.max(3, L / 150);
        ctx.setLineDash(dibujando ? [] : [L / 50, L / 80]);
        ctx.strokeStyle = modo === "sumar" ? "#6cc49a" : modo === "restar" ? "#ff6b6b" : "#ffd34d";
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    function listo(texto) {
      aviso.textContent = texto;
      usar.disabled = !mascara;
      sumar.disabled = restar.disabled = !mascara;
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
        // Si ya hay un recorte, el detector busca solo dentro de él (así no coge cosas del fondo).
        mascara = await mascaraAutomatica(src, mascara);
        puntos = [];
        cambiarModo("nuevo");
        listo("¿Te gusta? Puedes ➕ añadir o ➖ quitar trozos con el dedo");
      } catch (e) {
        aviso.textContent =
          e?.message === "sin-cara"
            ? "No encuentro ninguna cara: rodea tu cabeza con el dedo y vuelve a probar"
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
      // Para retocar valen trozos pequeños; para empezar, hay que rodear toda la cabeza.
      const minimo = mascara && modo !== "nuevo" ? 0.03 : 0.12;
      const grande = Math.max(...xs) - Math.min(...xs) > src.width * minimo && Math.max(...ys) - Math.min(...ys) > src.height * minimo;
      if (puntos.length < (minimo < 0.1 ? 4 : 8) || !grande) {
        puntos = [];
        aviso.textContent = minimo < 0.1 ? "Rodea un trozo un poco más grande" : "Haz el contorno más grande, alrededor de toda la cabeza";
        listo(aviso.textContent);
        pintar();
        return;
      }
      const trazo = mascaraDeTrazo(puntos);
      mascara = mascara && modo !== "nuevo" ? combinar(mascara, trazo, modo) : trazo;
      puntos = [];
      if (!recuadro(mascara)) {
        mascara = null;
        cambiarModo("nuevo");
        listo("Has quitado todo: rodea tu cabeza para empezar de nuevo");
        return;
      }
      listo(modo === "nuevo" ? "¿Te gusta? Toca ✨ Detectar para afinarlo, o ➕ / ➖ para retocar" : "Hecho. Puedes seguir retocando");
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
      h("div.rec-herramientas", detectar, sumar, restar),
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
