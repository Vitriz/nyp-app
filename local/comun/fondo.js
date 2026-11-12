// Fondo de puntos que respiran despacio y forman una onda donde se toca.
// Durante una prueba se pone en "calma": más tenue y quieto, para no distraer al leer.

let calma = false;
let alCambiarCalma = () => {};
export function calmarFondo(v) {
  if (calma === Boolean(v)) return;
  calma = Boolean(v);
  alCambiarCalma();
}

export function iniciarFondo({ espaciado = 34, color = "150, 185, 255" } = {}) {
  const lienzo = document.getElementById("fondo") ?? document.body.appendChild(
    Object.assign(document.createElement("canvas"), { id: "fondo" })
  );
  const ctx = lienzo.getContext("2d", { alpha: true });
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let ancho = 0, alto = 0, esp = espaciado, puntos = [];
  const ondas = [];
  let quieto = false; // en calma: ya está pintado y no hace falta repintar
  lienzo.style.transition = "opacity 600ms ease";
  alCambiarCalma = () => {
    lienzo.style.opacity = calma ? "0.4" : "1";
    quieto = false;
  };

  function medir() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ancho = window.innerWidth;
    alto = window.innerHeight;
    lienzo.width = Math.round(ancho * dpr);
    lienzo.height = Math.round(alto * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Espaciado proporcional a la pantalla: en la TV los puntos se ven del mismo tamaño relativo.
    esp = Math.max(22, Math.round(espaciado * Math.min(ancho, alto) / 900 * (ancho > 900 ? 1 : 1.6)));
    puntos = [];
    const cols = Math.ceil(ancho / esp) + 1;
    const filas = Math.ceil(alto / esp) + 1;
    const offX = (ancho - (cols - 1) * esp) / 2;
    const offY = (alto - (filas - 1) * esp) / 2;
    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < cols; c++) {
        const x = offX + c * esp + (f % 2 ? esp / 2 : 0);
        const y = offY + f * esp;
        const fase = 0.42 * c + 0.31 * f + 1.6 * Math.sin((c + f) * 0.17) + 0.9 * Math.cos(c * 0.11 - f * 0.07);
        puntos.push(x, y, fase);
      }
    }
  }

  function onda(x, y, fuerza = 1) {
    if (calma) return;
    ondas.push({ x, y, t0: performance.now() / 1000, fuerza });
    if (ondas.length > 8) ondas.shift();
  }

  function dibujar(ms) {
    if (calma && quieto) return requestAnimationFrame(dibujar);
    if (calma) {
      ondas.length = 0;
      quieto = true;
    }
    const t = ms / 1000;
    ctx.clearRect(0, 0, ancho, alto);
    const rMin = esp * 0.045, rMax = esp * 0.14;
    const vel = esp * 14, grosor = esp * 2.2;
    for (let k = ondas.length - 1; k >= 0; k--) if (t - ondas[k].t0 > 3.2) ondas.splice(k, 1);

    const normal = new Path2D();
    const brillo = new Path2D();
    for (let i = 0; i < puntos.length; i += 3) {
      const x = puntos[i], y = puntos[i + 1], fase = puntos[i + 2];
      const s = reducido || calma ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.55 + fase);
      let r = rMin + (rMax - rMin) * s * s;
      let extra = 0;
      for (const o of ondas) {
        const dt = t - o.t0;
        const d = Math.hypot(x - o.x, y - o.y);
        const z = (d - dt * vel) / grosor;
        extra += o.fuerza * Math.exp(-z * z) * Math.exp(-dt * 1.1);
      }
      r += extra * rMax * 1.3;
      const camino = extra > 0.25 ? brillo : normal;
      camino.moveTo(x + r, y);
      camino.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fillStyle = `rgba(${color}, 0.20)`;
    ctx.fill(normal);
    ctx.fillStyle = `rgba(${color}, 0.42)`;
    ctx.fill(brillo);
    requestAnimationFrame(dibujar);
  }

  medir();
  window.addEventListener("resize", () => {
    medir();
    quieto = false;
  });
  // La ola solo sale al tocar el fondo, nunca al pulsar botones, letras o campos.
  const INTERACTIVO = "button, a, input, textarea, select, label, [role=button], .ficha, .juego-carta, .interruptor, .sin-onda";
  window.addEventListener(
    "pointerdown",
    (e) => {
      if (e.target instanceof Element && e.target.closest(INTERACTIVO)) return;
      onda(e.clientX, e.clientY);
    },
    { passive: true }
  );
  requestAnimationFrame(dibujar);
  return { onda };
}
