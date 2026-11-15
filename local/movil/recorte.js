// Recortar la foto de perfil, todo en el propio móvil (la foto nunca sale de él):
//  - ✨ Detectar: un detector (MediaPipe, de Google) encuentra a la persona y su cara en la foto y
//    recorta la cabeza con el pelo. Funciona dentro del navegador del móvil: lo único que se descarga
//    (la primera vez, con internet) es el propio detector; la foto no se envía a ningún sitio.
//  - ✍️ A mano: rodeas la cabeza con el dedo y se recorta lo que queda dentro del trazo.
// El resultado es una imagen con fondo transparente que asoma por encima del círculo del avatar.
import { h } from "../comun/ui.js";

const ANCHO = 240, ALTO = 324; // el recorte: un poco más alto que ancho (la cabeza sobresale por arriba)
const LADO = 640; // la foto de la cámara es un cuadrado de 640 px
const MAXIMO = 1280; // las fotos de la galería se trabajan enteras, con su forma, hasta 1280 px de lado

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

/** Una imagen entera (sin recortar), como lienzo de hasta MAXIMO px por el lado más largo. */
export function entera(fuente, ancho, alto, maximo = MAXIMO) {
  const k = Math.min(1, maximo / Math.max(ancho, alto));
  const c = lienzoNuevo(Math.round(ancho * k), Math.round(alto * k));
  c.getContext("2d").drawImage(fuente, 0, 0, c.width, c.height);
  return c;
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
function mascaraDeTrazo(puntos, W, H) {
  const m = lienzoNuevo(W, H);
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
  // (Un cuadrado: si la foto no lo es, lo que sobra queda vacío.)
  const W = src.width, H = src.height;
  let rl = Math.max(W, H), rx = (W - rl) / 2, ry = (H - rl) / 2;
  const rz = zona && recuadro(zona);
  if (rz) {
    rl = Math.min(Math.max(W, H), Math.max(rz.bw, rz.bh) * 1.2);
    rx = rz.minX + rz.bw / 2 - rl / 2;
    ry = rz.minY + rz.bh / 2 - rl / 2;
  }
  const T = 512;
  const trozo = lienzoNuevo(T);
  trozo.getContext("2d").drawImage(src, (-rx * T) / rl, (-ry * T) / rl, (W * T) / rl, (H * T) / rl);

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

  const m = lienzoNuevo(W, H);
  const ctx = m.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(peq, 0, 0, w, hgt, rx, ry, rl, rl); // al ampliar, el borde sale curvo (no a escalones)…
  nitida(m); // …y luego se deja nítido
  if (b) {
    // Solo la cabeza: nada por debajo de la barbilla ni muy a los lados (corte limpio).
    const esc = rl / T;
    const barbilla = ry + (b.originY + b.height * 1.12) * esc;
    const centro = rx + (b.originX + b.width / 2) * esc, ancho = b.width * esc * 1.3;
    ctx.clearRect(0, barbilla, W, H);
    ctx.clearRect(0, 0, centro - ancho, H);
    ctx.clearRect(centro + ancho, 0, W, H);
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
  const m = lienzoNuevo(base.width, base.height);
  const c = m.getContext("2d");
  c.drawImage(base, 0, 0);
  c.globalCompositeOperation = modo === "restar" ? "destination-out" : "source-over";
  c.drawImage(trazo, 0, 0);
  return m;
}

// ------------------------------------------------------------------ el editor
//
// Dos modos (arriba):
//  - ✂️ Recortar: la foto entera en el marco; herramientas ➰ Lazo (cada trazo empieza una selección
//    nueva), ➕ Añadir, ➖ Quitar, 🗑️ Borrar selección, ✨ Detectar y ✋ Mover. ↶ / ↷ deshacen y rehacen.
//  - ⭕ Foto redonda: un círculo fijo en el centro y la foto detrás; la mueves y haces zoom para dejar
//    dentro lo que quieras.
// Zoom: rueda del ratón, pellizco con dos dedos o los botones − / +. Mover: herramienta ✋, arrastrar con
// dos dedos o (ratón) con el botón derecho / central. A un lado (o debajo en el móvil), cómo quedará.

const MAX_HISTORIA = 40;

/**
 * Abre el editor. src: lienzo con la foto (con su forma). circulo: parte de la foto (de su lado menor) que
 * entra en el círculo al abrir la foto redonda (p. ej. 0,8 con la cámara, cuyo círculo guía era así).
 * Devuelve la foto (data URL) o null si se cancela.
 */
export function editarFoto(src, circulo = 1) {
  return new Promise((ok) => {
    const W = src.width, H = src.height;
    const lienzo = h("canvas.rec-lienzo");
    const ctx = lienzo.getContext("2d");
    const marco = h("div.rec-visor", lienzo);
    let modo = "recortar"; // recortar | redonda
    let herramienta = "lazo"; // lazo | sumar | restar | mover
    let mascara = null;
    let puntos = []; // trazo en píxeles de la foto
    let dibujando = false;
    // Historia de la selección (deshacer / rehacer): copias de la máscara (null = sin selección).
    let historia = [null], pos = 0;
    // Vista: escala (z) y desplazamiento (ox, oy) de la foto dentro del marco (en px de pantalla).
    const vista = { recortar: null, redonda: null };
    let fw = 0, fh = 0; // tamaño del marco

    // ---------------------------------------------------------------- piezas de la ventana
    const aviso = h("p.rec-aviso");
    const previa = h("div.rec-previa");
    const pestaña = (m, t) => h("button.rec-pestana", { type: "button", "data-m": m, onclick: () => cambiarModo(m) }, t);
    const pestañas = h("div.rec-pestanas", pestaña("recortar", "✂️ Recortar"), pestaña("redonda", "⭕ Foto redonda"));
    const boton = (clase, texto, titulo, alPulsar) => h(`button.rec-herr${clase}`, { type: "button", title: titulo, "aria-label": titulo, onclick: alPulsar }, texto);
    const bHerr = {
      lazo: boton(".lazo", "➰ Lazo", "Lazo: rodea lo que quieras (empieza una selección nueva)", () => elegir("lazo")),
      sumar: boton(".sumar", "➕ Añadir", "Añadir: rodea lo que quieras sumar a la selección", () => elegir("sumar")),
      restar: boton(".restar", "➖ Quitar", "Quitar: rodea lo que quieras quitar de la selección", () => elegir("restar")),
      mover: boton(".mover", "✋ Mover", "Mover la foto (también con dos dedos o el botón derecho)", () => elegir("mover")),
    };
    const bBorrar = boton(".borrar", "🗑️ Borrar selección", "Borrar toda la selección", () => (guardar(null), listo("Selección borrada: rodea con el lazo lo que quieras")));
    const bDetectar = boton(".detectar", "✨ Detectar", "Detectar tu cabeza automáticamente", () => auto());
    const bDeshacer = boton(".deshacer", "↶", "Deshacer", () => irA(pos - 1));
    const bRehacer = boton(".rehacer", "↷", "Rehacer", () => irA(pos + 1));
    const bMenos = boton(".zoom", "−", "Alejar", () => zoom(1 / 1.25));
    const bMas = boton(".zoom", "+", "Acercar", () => zoom(1.25));
    const bAjustar = boton(".zoom", "⤢", "Ver la foto entera", () => ((vista[modo] = inicial(modo)), pintar()));
    const herramientas = h(
      "div.rec-herramientas",
      h("div.rec-grupo.rec-grupo-sel", bHerr.lazo, bHerr.sumar, bHerr.restar, bBorrar),
      h("div.rec-grupo", bDetectar, bHerr.mover, bDeshacer, bRehacer)
    );
    const zoomBox = h("div.rec-zoom", bMenos, bAjustar, bMas);
    const usar = h("button.boton.acento.grande.rec-usar", { type: "button", onclick: () => terminar() });
    const cancelar = h("button.boton.suave.rec-cancelar", { type: "button", onclick: () => cerrar(null) }, "Cancelar");

    // ---------------------------------------------------------------- vista (zoom y mover)
    function medirMarco() {
      const ancho = innerWidth >= 900 && innerWidth > innerHeight;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const maxW = ancho ? Math.min(innerWidth - 28 * rem, 1000) : innerWidth * 0.94;
      const maxH = ancho ? innerHeight * 0.78 : innerHeight * 0.48;
      if (modo === "redonda") {
        fw = fh = Math.min(maxW, maxH);
      } else {
        // La foto entera: el marco toma su forma (sin pasar del tamaño máximo).
        const k = Math.min(maxW / W, maxH / H);
        fw = Math.round(W * k);
        fh = Math.round(H * k);
      }
      marco.style.width = `${fw}px`;
      marco.style.height = `${fh}px`;
      marco.classList.toggle("redondo", modo === "redonda");
      const dpr = Math.min(2, devicePixelRatio || 1);
      lienzo.width = Math.round(fw * dpr);
      lienzo.height = Math.round(fh * dpr);
    }
    const diametro = () => Math.min(fw, fh) * 0.82;
    function inicial(m) {
      if (m === "redonda") {
        // Lo que había en el círculo guía (o el centro de la foto) llena el círculo.
        const z = diametro() / (Math.min(W, H) * circulo);
        return { z, ox: fw / 2 - (W * z) / 2, oy: fh / 2 - (H * z) / 2 };
      }
      const z = Math.min(fw / W, fh / H);
      return { z, ox: (fw - W * z) / 2, oy: (fh - H * z) / 2 };
    }
    const v = () => (vista[modo] ??= inicial(modo));
    function limitar() {
      const t = v();
      if (modo === "redonda") {
        // El centro del círculo siempre sobre la foto.
        const cx = fw / 2, cy = fh / 2;
        t.ox = Math.min(cx, Math.max(cx - W * t.z, t.ox));
        t.oy = Math.min(cy, Math.max(cy - H * t.z, t.oy));
        return;
      }
      const iw = W * t.z, ih = H * t.z;
      t.ox = iw <= fw ? (fw - iw) / 2 : Math.min(0, Math.max(fw - iw, t.ox));
      t.oy = ih <= fh ? (fh - ih) / 2 : Math.min(0, Math.max(fh - ih, t.oy));
    }
    function zoom(f, cx = fw / 2, cy = fh / 2) {
      const t = v();
      const base = inicial(modo).z;
      const z = Math.min(base * 10, Math.max(base * (modo === "redonda" ? 0.35 : 1), t.z * f));
      t.ox = cx - ((cx - t.ox) * z) / t.z;
      t.oy = cy - ((cy - t.oy) * z) / t.z;
      t.z = z;
      limitar();
      pintar();
    }
    const aFoto = (x, y) => {
      const t = v();
      return [(x - t.ox) / t.z, (y - t.oy) / t.z];
    };

    // ---------------------------------------------------------------- pintar
    function pintar() {
      const t = v();
      const dpr = lienzo.width / fw;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, lienzo.width, lienzo.height);
      ctx.setTransform(dpr * t.z, 0, 0, dpr * t.z, dpr * t.ox, dpr * t.oy);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(src, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (modo === "redonda") {
        // Todo oscuro menos el círculo, con su borde.
        const d = diametro();
        ctx.save();
        ctx.fillStyle = "rgba(5, 13, 42, 0.7)";
        ctx.beginPath();
        ctx.rect(0, 0, fw, fh);
        ctx.arc(fw / 2, fh / 2, d / 2, 0, Math.PI * 2, true);
        ctx.fill("evenodd");
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#fff";
        ctx.beginPath();
        ctx.arc(fw / 2, fh / 2, d / 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        pintarPrevia();
        return;
      }
      // Fuera de la selección, oscuro (mientras haces un lazo nuevo, se ve la foto limpia).
      if (mascara && !(dibujando && herramienta === "lazo")) {
        const sombra = lienzoNuevo(lienzo.width, lienzo.height);
        const s = sombra.getContext("2d");
        s.fillStyle = "rgba(5, 13, 42, 0.66)";
        s.fillRect(0, 0, sombra.width, sombra.height);
        s.globalCompositeOperation = "destination-out";
        s.setTransform(dpr * t.z, 0, 0, dpr * t.z, dpr * t.ox, dpr * t.oy);
        s.drawImage(mascara, 0, 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(sombra, 0, 0);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      // El trazo: igual para las tres herramientas (solo cambia el color), sin rellenar.
      if (puntos.length > 1) {
        ctx.beginPath();
        puntos.forEach(([x, y], i) => {
          const px = x * t.z + t.ox, py = y * t.z + t.oy;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        });
        if (!dibujando) ctx.closePath();
        ctx.lineWidth = 3;
        ctx.lineJoin = ctx.lineCap = "round";
        ctx.setLineDash(dibujando ? [] : [10, 7]);
        ctx.strokeStyle = herramienta === "sumar" ? "#6cc49a" : herramienta === "restar" ? "#ff6b6b" : "#ffd34d";
        ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
        ctx.shadowBlur = 4;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.setLineDash([]);
      }
    }

    // Vista previa (al lado): cómo quedará el avatar.
    const previaRedonda = lienzoNuevo(192);
    function pintarPrevia() {
      if (modo === "redonda") {
        dibujarRedonda(previaRedonda);
        previa.replaceChildren(h("span.avatar.rec-avatar-redondo", previaRedonda), h("small", "Así quedará"));
        return;
      }
      const foto = mascara && fotoRecortada(src, mascara);
      previa.replaceChildren(
        foto ? h("span.avatar.con-recorte.rec-avatar", h("img", { src: foto, alt: "" })) : h("span.rec-previa-vacia", "?"),
        h("small", foto ? "Así quedará" : "Aquí verás tu recorte")
      );
    }
    /** Lo que se ve dentro del círculo, en un lienzo de 192 px. */
    function dibujarRedonda(c) {
      const t = v(), d = diametro();
      const x = (fw / 2 - d / 2 - t.ox) / t.z, y = (fh / 2 - d / 2 - t.oy) / t.z, l = d / t.z;
      const g = c.getContext("2d");
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(src, x, y, l, l, 0, 0, c.width, c.height);
    }

    // ---------------------------------------------------------------- selección e historia
    function guardar(m) {
      historia = historia.slice(0, pos + 1);
      historia.push(m);
      if (historia.length > MAX_HISTORIA) historia.shift();
      pos = historia.length - 1;
      mascara = m;
    }
    function irA(p) {
      if (p < 0 || p >= historia.length) return;
      pos = p;
      mascara = historia[p];
      listo(mascara ? "Hecho" : "Sin selección");
    }
    function elegir(hh) {
      herramienta = hh;
      for (const [k, b] of Object.entries(bHerr)) b.classList.toggle("activa", k === hh);
      marco.dataset.herramienta = hh;
      aviso.textContent = {
        lazo: "➰ Rodea con el dedo (o el ratón) lo que quieras: cada lazo empieza una selección nueva",
        sumar: "➕ Rodea lo que quieras añadir a la selección",
        restar: "➖ Rodea lo que quieras quitar de la selección",
        mover: "✋ Arrastra para mover la foto; acerca o aleja con − / +, la rueda o dos dedos",
      }[hh];
    }
    function listo(texto) {
      if (texto) aviso.textContent = texto;
      bDeshacer.disabled = pos <= 0;
      bRehacer.disabled = pos >= historia.length - 1;
      bBorrar.disabled = !mascara;
      usar.disabled = modo === "recortar" && !mascara;
      pintar();
      pintarPrevia();
    }
    function cambiarModo(m) {
      modo = m;
      pestañas.querySelectorAll("button").forEach((b) => b.classList.toggle("activa", b.dataset.m === m));
      herramientas.style.display = m === "recortar" ? "" : "none";
      capa.classList.toggle("en-redonda", m === "redonda");
      usar.textContent = m === "redonda" ? "⭕ Usar foto redonda" : "✂️ Usar recorte";
      medirMarco();
      limitar();
      if (m === "redonda") aviso.textContent = "Mueve la foto y acércala o aléjala hasta dejar dentro del círculo lo que quieras";
      else elegir(herramienta);
      listo();
    }

    async function auto() {
      bDetectar.disabled = true;
      aviso.textContent = detector ? "Buscando tu cara…" : "Preparando el detector (solo la primera vez)…";
      try {
        // Si ya hay selección, el detector busca solo dentro de ella (así no coge cosas del fondo).
        guardar(await mascaraAutomatica(src, mascara));
        listo("¿Te gusta? Puedes ➕ añadir o ➖ quitar trozos");
      } catch (e) {
        aviso.textContent =
          e?.message === "sin-cara" ? "No encuentro ninguna cara: rodéala con el lazo y vuelve a probar" : "No se pudo cargar el detector (¿sin internet?): usa el lazo";
      } finally {
        bDetectar.disabled = false;
      }
    }

    function terminar() {
      if (modo === "redonda") {
        const c = lienzoNuevo(192);
        dibujarRedonda(c);
        return cerrar(c.toDataURL("image/jpeg", 0.85));
      }
      const foto = mascara && fotoRecortada(src, mascara);
      if (foto) cerrar(foto);
    }

    // ---------------------------------------------------------------- dedo y ratón
    const dedos = new Map(); // pointerId -> [x, y] (en el marco)
    let gesto = null; // { tipo: "mover" | "pellizco", … }
    const enMarco = (ev) => {
      const r = lienzo.getBoundingClientRect();
      return [ev.clientX - r.left, ev.clientY - r.top];
    };
    lienzo.addEventListener("contextmenu", (ev) => ev.preventDefault());
    lienzo.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      try {
        lienzo.setPointerCapture(ev.pointerId);
      } catch {}
      dedos.set(ev.pointerId, enMarco(ev));
      if (dedos.size === 2) {
        // Dos dedos: mover y pellizcar (se cancela el trazo que hubiera).
        dibujando = false;
        puntos = [];
        const [a, b] = [...dedos.values()];
        gesto = { tipo: "pellizco", d: Math.hypot(a[0] - b[0], a[1] - b[1]), c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
        return pintar();
      }
      const moverAhora = modo === "redonda" || herramienta === "mover" || ev.button === 1 || ev.button === 2;
      if (moverAhora) {
        gesto = { tipo: "mover", p: enMarco(ev) };
        marco.classList.add("moviendo");
        return;
      }
      dibujando = true;
      puntos = [aFoto(...enMarco(ev))];
      pintar();
    });
    lienzo.addEventListener("pointermove", (ev) => {
      if (!dedos.has(ev.pointerId)) return;
      const p = enMarco(ev);
      dedos.set(ev.pointerId, p);
      if (gesto?.tipo === "pellizco" && dedos.size >= 2) {
        const [a, b] = [...dedos.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]), c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const t = v();
        t.ox += c[0] - gesto.c[0];
        t.oy += c[1] - gesto.c[1];
        gesto.c = c;
        if (gesto.d > 10) zoom(d / gesto.d, c[0], c[1]);
        gesto.d = d;
        return;
      }
      if (gesto?.tipo === "mover") {
        const t = v();
        t.ox += p[0] - gesto.p[0];
        t.oy += p[1] - gesto.p[1];
        gesto.p = p;
        limitar();
        return pintar();
      }
      if (!dibujando) return;
      const q = aFoto(...p), u = puntos.at(-1);
      if (Math.hypot(q[0] - u[0], q[1] - u[1]) * v().z < 3) return;
      puntos.push(q);
      pintar();
    });
    const soltar = (ev) => {
      dedos.delete(ev.pointerId);
      if (gesto) {
        if (!dedos.size) gesto = null;
        marco.classList.remove("moviendo");
        return;
      }
      if (!dibujando) return;
      dibujando = false;
      const xs = puntos.map((p) => p[0]), ys = puntos.map((p) => p[1]);
      const lado = Math.min(W, H);
      const grande = puntos.length >= 4 && Math.max(...xs) - Math.min(...xs) > lado * 0.02 && Math.max(...ys) - Math.min(...ys) > lado * 0.02;
      if (!grande) {
        puntos = [];
        return listo("Rodea un trozo un poco más grande");
      }
      const trazo = mascaraDeTrazo(puntos, W, H);
      puntos = [];
      let nueva = herramienta === "lazo" || !mascara ? (herramienta === "restar" ? null : trazo) : combinar(mascara, trazo, herramienta === "restar" ? "restar" : "sumar");
      if (nueva && !recuadro(nueva)) nueva = null;
      guardar(nueva);
      listo(nueva ? "Hecho: ➕ añade, ➖ quita, o haz otro lazo" : "Sin selección: rodea con el lazo lo que quieras");
    };
    lienzo.addEventListener("pointerup", soltar);
    lienzo.addEventListener("pointercancel", soltar);
    // Rueda del ratón: zoom hacia donde apunta.
    lienzo.addEventListener(
      "wheel",
      (ev) => {
        ev.preventDefault();
        const [x, y] = enMarco(ev);
        zoom(Math.exp(-ev.deltaY * 0.0015), x, y);
      },
      { passive: false }
    );
    // Teclado (ordenador): Ctrl+Z / Ctrl+Y (o Ctrl+Mayús+Z), Esc para cancelar.
    const tecla = (ev) => {
      if (ev.key === "Escape") return cerrar(null);
      if (!(ev.ctrlKey || ev.metaKey)) return;
      const k = ev.key.toLowerCase();
      if (k === "z" && !ev.shiftKey) (ev.preventDefault(), irA(pos - 1));
      else if (k === "y" || (k === "z" && ev.shiftKey)) (ev.preventDefault(), irA(pos + 1));
    };

    const cerrar = (foto) => {
      removeEventListener("resize", alCambiar);
      removeEventListener("keydown", tecla);
      capa.remove();
      ok(foto);
    };
    const alCambiar = () => {
      vista.recortar = vista.redonda = null;
      medirMarco();
      pintar();
    };
    const capa = h(
      "div.capa-camara.capa-recorte",
      h("div.rec-cabeza", h("h2", "Tu foto"), pestañas),
      h("div.rec-cuerpo", h("div.rec-zona", marco, zoomBox), h("div.rec-lado", previa, herramientas, aviso, h("div.rec-botones", usar, cancelar)))
    );
    addEventListener("resize", alCambiar);
    addEventListener("keydown", tecla);
    document.body.append(capa);
    cambiarModo("recortar");
    elegir("lazo");
    listo();
  });
}
