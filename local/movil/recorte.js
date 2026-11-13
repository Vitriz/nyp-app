// Recortar la foto de perfil, todo en el propio móvil (la foto no sale de él):
// rodeas tu cabeza con el dedo y queda una imagen con fondo transparente que asoma por encima
// del círculo del avatar. También se puede usar la foto redonda de siempre.
import { h } from "../comun/ui.js";

const ANCHO = 240, ALTO = 324; // el recorte: un poco más alto que ancho (la cabeza sobresale por arriba)

/** Una imagen (o vídeo) como cuadrado de `lado` px, centrado. */
export function cuadrado(fuente, ancho, alto, lado = 640, espejo = false) {
  const c = Object.assign(document.createElement("canvas"), { width: lado, height: lado });
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
  const c = Object.assign(document.createElement("canvas"), { width: 192, height: 192 });
  const l = src.width * fraccion;
  c.getContext("2d").drawImage(src, (src.width - l) / 2, (src.height - l) / 2, l, l, 0, 0, 192, 192);
  return c.toDataURL("image/jpeg", 0.82);
}

/** Recorta lo que hay dentro del trazo (puntos en píxeles de src) con fondo transparente. */
function fotoRecortada(src, puntos) {
  const xs = puntos.map((p) => p[0]), ys = puntos.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
  const s = Math.min((ANCHO * 0.86) / bw, (ALTO * 0.97) / bh);
  const c = Object.assign(document.createElement("canvas"), { width: ANCHO, height: ALTO });
  const ctx = c.getContext("2d");
  // Centrado y apoyado abajo: la barbilla queda dentro del círculo y el pelo asoma por arriba.
  ctx.translate((ANCHO - bw * s) / 2 - minX * s, ALTO - bh * s - minY * s);
  ctx.scale(s, s);
  ctx.beginPath();
  puntos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(src, 0, 0);
  // WebP si el navegador sabe (pesa menos); si no, PNG. Las dos guardan la transparencia.
  const webp = c.toDataURL("image/webp", 0.86);
  return webp.startsWith("data:image/webp") ? webp : c.toDataURL("image/png");
}

/** ¿Es una foto recortada (con transparencia)? */
export function esRecorte(foto) {
  return typeof foto === "string" && (/^data:image\/(png|webp)/.test(foto) || /[?&]r=1\b/.test(foto));
}

/**
 * Abre el editor. src: canvas cuadrado con la foto. fraccion: qué parte usar si se elige la foto redonda.
 * Devuelve la foto (data URL) o null si se cancela.
 */
export function editarFoto(src, fraccion = 1) {
  return new Promise((ok) => {
    const lienzo = h("canvas.rec-lienzo");
    const ctx = lienzo.getContext("2d");
    let puntos = []; // en píxeles de src
    let dibujando = false;
    const aviso = h("p.cam-aviso", "Rodea tu cabeza con el dedo ✍️");
    const muestra = h("div.rec-muestra");
    const usar = h("button.boton.acento", { type: "button", disabled: true, onclick: () => cerrar(fotoRecortada(src, puntos)) }, "✂️ Usar recorte");

    function tamaño() {
      const lado = Math.round(Math.min(innerWidth * 0.92, innerHeight * 0.55) * devicePixelRatio);
      lienzo.width = lienzo.height = lado;
      pintar();
    }

    function pintar() {
      const L = lienzo.width, k = L / src.width;
      ctx.clearRect(0, 0, L, L);
      ctx.drawImage(src, 0, 0, L, L);
      if (puntos.length < 2) return;
      const camino = new Path2D();
      puntos.forEach(([x, y], i) => (i ? camino.lineTo(x * k, y * k) : camino.moveTo(x * k, y * k)));
      if (!dibujando) {
        camino.closePath();
        // Fuera del recorte, oscuro.
        const fuera = new Path2D();
        fuera.rect(0, 0, L, L);
        fuera.addPath(camino);
        ctx.fillStyle = "rgba(5, 13, 42, 0.62)";
        ctx.fill(fuera, "evenodd");
      }
      ctx.lineWidth = Math.max(3, L / 140);
      ctx.setLineDash([L / 50, L / 80]);
      ctx.strokeStyle = "#ffd34d";
      ctx.stroke(camino);
      ctx.setLineDash([]);
    }

    const aPunto = (ev) => {
      const r = lienzo.getBoundingClientRect();
      return [((ev.clientX - r.left) / r.width) * src.width, ((ev.clientY - r.top) / r.height) * src.height];
    };
    lienzo.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      try {
        lienzo.setPointerCapture(ev.pointerId);
      } catch {}
      dibujando = true;
      puntos = [aPunto(ev)];
      usar.disabled = true;
      muestra.replaceChildren();
      pintar();
    });
    lienzo.addEventListener("pointermove", (ev) => {
      if (!dibujando) return;
      const p = aPunto(ev), u = puntos.at(-1);
      if (Math.hypot(p[0] - u[0], p[1] - u[1]) < src.width / 200) return;
      puntos.push(p);
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
      } else {
        aviso.textContent = "¿Te gusta? Si no, vuelve a dibujar encima";
        usar.disabled = false;
        // Vista previa: cómo queda en el avatar.
        const foto = fotoRecortada(src, puntos);
        muestra.replaceChildren(h("span.avatar.con-recorte.rec-avatar", h("img", { src: foto, alt: "" })), h("small", "Así quedará"));
      }
      pintar();
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
