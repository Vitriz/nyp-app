// Fondo de puntos: varias olas lo recorren en distintas direcciones (los puntos crecen al pasar la ola)
// y, donde se toca, sale una onda suave que tiñe los puntos de un color (cada toque, otro) y luego se va.
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
        // Posición en "puntos" (no en píxeles): las olas miden lo mismo en el móvil y en la TV.
        puntos.push(x / esp, y / esp, 0.35 * Math.sin(c * 1.7 + f * 2.3));
      }
    }
  }

  // Cada golpe tiñe los puntos de un color (van rotando); al pasar la onda vuelven a su color.
  const COLORES_ONDA = ["255, 211, 77", "244, 127, 176", "95, 214, 142", "120, 210, 255", "245, 166, 35", "180, 140, 255"];
  let siguienteColor = 0;
  function onda(x, y, fuerza = 1) {
    if (calma) return;
    const t0 = performance.now() / 1000;
    ondas.push({ x, y, t0, fuerza, color: COLORES_ONDA[siguienteColor++ % COLORES_ONDA.length], apagar: null });
    // Sin límite práctico: cada onda dura 3,4 s, así que aunque golpees muy deprisa hay pocas a la vez.
    // Solo por seguridad (más de 40 a la vez), las más antiguas se apagan poco a poco, nunca de golpe.
    const vivas = ondas.filter((o) => o.apagar == null);
    for (let k = 0; k < vivas.length - 40; k++) vivas[k].apagar = t0;
  }

  // Pase lo que pase en un fotograma, el siguiente se pide igual (si no, los puntos desaparecerían para siempre).
  function dibujar(ms) {
    try {
      pintarFotograma(ms);
    } catch {}
    requestAnimationFrame(dibujar);
  }
  function pintarFotograma(ms) {
    if (calma && quieto) return;
    if (calma) {
      ondas.length = 0;
      quieto = true;
    }
    const t = ms / 1000;
    ctx.clearRect(0, 0, ancho, alto);
    const rMin = esp * 0.045, rMax = esp * 0.14;
    // La onda: suave y lenta, crece poco y se apaga del todo (varias seguidas no se suman sin fin).
    const vel = esp * 7, grosor = esp * 3.2, VIDA = 3.4;
    const APAGADO = 0.5; // lo que tarda en desvanecerse una onda que se apaga antes de tiempo
    for (let k = ondas.length - 1; k >= 0; k--) {
      const o = ondas[k];
      if (t - o.t0 > VIDA || (o.apagar != null && t - o.apagar > APAGADO)) ondas.splice(k, 1);
    }

    const normal = new Path2D();
    // Puntos teñidos: por onda y por intensidad (3 niveles), para pintarlos de pocas veces.
    const tenidos = ondas.map(() => [new Path2D(), new Path2D(), new Path2D()]);
    // Tres olas que avanzan en direcciones distintas (y a distinto ritmo) y se cruzan.
    const OLAS = [
      [0.52, 0.16, 1.35, 0.5], // [kx, ky, velocidad, peso]
      [-0.2, 0.45, 1.05, 0.3],
      [0.3, -0.36, 1.7, 0.2],
    ];
    for (let i = 0; i < puntos.length; i += 3) {
      const px = puntos[i], py = puntos[i + 1], jitter = puntos[i + 2];
      const x = px * esp, y = py * esp;
      let s = 0.5;
      if (!reducido && !calma) {
        let v = 0;
        for (const [kx, ky, w, peso] of OLAS) v += peso * Math.sin(kx * px + ky * py - w * t + jitter);
        s = 0.5 + 0.5 * v;
      }
      let r = rMin + (rMax - rMin) * s * s;
      let extra = 0, mejor = -1, mejorV = 0;
      for (let k = 0; k < ondas.length; k++) {
        const o = ondas[k];
        // (El tiempo del fotograma puede ser un pelín anterior al del toque: nunca negativo.)
        const dt = Math.max(0, t - o.t0);
        const d = Math.hypot(x - o.x, y - o.y);
        const z = (d - dt * vel) / grosor;
        // Entra y sale con suavidad (sin golpe al principio) y se apaga al final de su vida.
        const vida = Math.min(1, dt / 0.25) * Math.max(0, 1 - dt / VIDA) ** 1.5 * (o.apagar == null ? 1 : Math.max(0, 1 - (t - o.apagar) / APAGADO));
        // El anillo que se aleja y, además, un «golpe» donde tocaste: los puntos de ahí crecen más y
        // vuelven a su tamaño en algo más de un segundo.
        const impacto = Math.exp(-((d / (esp * 2.4)) ** 2)) * Math.exp(-dt * 2.2) * Math.min(1, dt / 0.12);
        const v = o.fuerza * (Math.exp(-z * z) * vida + impacto * 1.6);
        extra += v;
        if (v > mejorV) (mejorV = v), (mejor = k);
      }
      extra = Math.min(1.8, Math.max(0, extra)); // con muchas ondas juntas, un tope (para que no tapen los textos)
      r = Math.max(0.5, r + extra * rMax * 1.05); // un radio negativo rompería el dibujo (y el fondo se quedaría vacío)
      if (mejor >= 0 && mejorV > 0.12) {
        const nivel = mejorV > 0.6 ? 2 : mejorV > 0.3 ? 1 : 0;
        const camino = tenidos[mejor][nivel];
        camino.moveTo(x + r, y);
        camino.arc(x, y, r, 0, Math.PI * 2);
      } else {
        normal.moveTo(x + r, y);
        normal.arc(x, y, r, 0, Math.PI * 2);
      }
    }
    ctx.fillStyle = `rgba(${color}, 0.20)`;
    ctx.fill(normal);
    ondas.forEach((o, k) =>
      [0.26, 0.36, 0.48].forEach((a, nivel) => {
        ctx.fillStyle = `rgba(${o.color}, ${a})`;
        ctx.fill(tenidos[k][nivel]);
      })
    );
  }

  medir();
  window.addEventListener("resize", () => {
    medir();
    quieto = false;
  });
  // La ola solo sale al tocar el fondo, nunca al pulsar botones, letras o campos (salvo las letras del título).
  const INTERACTIVO = "button, a, input, textarea, select, label, [role=button], .ficha, .juego-carta, .interruptor, .sin-onda, .capa-movil";
  window.addEventListener(
    "pointerdown",
    (e) => {
      if (e.target instanceof Element && e.target.closest(INTERACTIVO) && !e.target.closest(".titulo-nyp")) return;
      // Pantallas de resultado: en el móvil, sin olas (al desplazar salían muchas); en el ordenador,
      // solo fuera de la zona con los resultados.
      if (e.target instanceof Element && e.target.closest(".pantalla-final") && (e.pointerType !== "mouse" || e.target.closest(".zona-final"))) return;
      onda(e.clientX, e.clientY);
    },
    { passive: true }
  );
  requestAnimationFrame(dibujar);
  return { onda };
}
