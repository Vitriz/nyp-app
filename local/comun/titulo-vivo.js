// Título del inicio con letras que se pueden golpear: al tocarlas salen despedidas como si flotaran en un
// líquido (frenan poco a poco, giran y rebotan en los bordes); al arrastrar el dedo, lo remueves. Si no se
// tocan en 4 segundos, cada letra vuelve a su sitio con un muelle y sigue ondeando como siempre.
//
// Rendimiento: solo se mueven `translate` y `rotate` de unas 19 fichas (lo hace la tarjeta gráfica) y el
// bucle de animación solo corre mientras alguna letra está fuera de su sitio.

const VUELTA_MS = 4000;

export function tituloVivo(titulo) {
  if (!titulo || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const fichas = [...titulo.querySelectorAll(".ficha")];
  const est = fichas.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0 }));
  let ultimoToque = 0;
  let bucle = 0;
  let tAnterior = 0;
  let pulsado = null; // { id, x, y, t }

  const centro = (k) => {
    const r = fichas[k].getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2, r.width];
  };

  /** Golpe en (x, y): las letras cercanas salen despedidas hacia fuera. */
  function golpe(x, y, fuerza = 1) {
    let tocadas = 0;
    fichas.forEach((_, k) => {
      const [cx, cy, lado] = centro(k);
      const dx = cx - x, dy = cy - y;
      const d = Math.hypot(dx, dy) || 1;
      const alcance = lado * 2.6;
      const f = Math.exp(-(d * d) / (2 * alcance * alcance)) * fuerza;
      if (f < 0.04) return;
      tocadas++;
      const s = est[k];
      const impulso = 1150 * f;
      s.vx += (dx / d) * impulso + (Math.random() - 0.5) * 260 * f;
      s.vy += (dy / d) * impulso - 260 * f; // un poco hacia arriba: queda más vistoso
      s.vr += (Math.random() - 0.5) * 900 * f;
    });
    if (tocadas) navigator.vibrate?.(8);
  }

  /** Remover: al arrastrar el dedo, las letras cercanas se llevan parte de su velocidad. */
  function remover(x, y, vx, vy) {
    fichas.forEach((_, k) => {
      const [cx, cy, lado] = centro(k);
      const d = Math.hypot(cx - x, cy - y);
      const f = Math.exp(-(d * d) / (2 * (lado * 1.6) ** 2));
      if (f < 0.05) return;
      const s = est[k];
      s.vx += vx * f * 0.55;
      s.vy += vy * f * 0.55;
      s.vr += (vx - vy) * f * 0.08;
    });
  }

  function paso(t) {
    if (!titulo.isConnected) return void (bucle = 0);
    const dt = Math.min(0.033, (t - (tAnterior || t)) / 1000) || 0.016;
    tAnterior = t;
    const volviendo = performance.now() - ultimoToque > VUELTA_MS && !pulsado;
    const ancho = innerWidth, alto = innerHeight;
    let quietas = 0;
    fichas.forEach((el, k) => {
      const s = est[k];
      if (volviendo) {
        // Muelle hacia su sitio (amortiguado: llega sin pasarse demasiado).
        s.vx += (-38 * s.x - 9 * s.vx) * dt;
        s.vy += (-38 * s.y - 9 * s.vy) * dt;
        s.vr += (-38 * s.r - 9 * s.vr) * dt;
      } else {
        // Líquido: frena poco a poco y se mece un poco.
        const roce = Math.exp(-1.7 * dt);
        s.vx *= roce;
        s.vy *= roce;
        s.vr *= Math.exp(-1.2 * dt);
        s.vy += Math.sin(t / 600 + k) * 12 * dt;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.r += s.vr * dt;
      // Rebote en los bordes de la pantalla (sin salirse).
      const r = el.getBoundingClientRect();
      if (!volviendo) {
        if (r.left < 4 && s.vx < 0) s.vx = -s.vx * 0.6;
        if (r.right > ancho - 4 && s.vx > 0) s.vx = -s.vx * 0.6;
        if (r.top < 4 && s.vy < 0) s.vy = -s.vy * 0.6;
        if (r.bottom > alto - 4 && s.vy > 0) s.vy = -s.vy * 0.6;
      }
      const parada = Math.abs(s.x) + Math.abs(s.y) < 0.5 && Math.abs(s.r) < 0.5 && Math.hypot(s.vx, s.vy) < 2;
      if (volviendo && parada) {
        Object.assign(s, { x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0 });
        el.style.translate = el.style.rotate = "";
        quietas++;
        return;
      }
      el.style.translate = `${s.x.toFixed(1)}px ${s.y.toFixed(1)}px`;
      el.style.rotate = `${s.r.toFixed(1)}deg`;
    });
    if (quietas === fichas.length) {
      titulo.classList.remove("agitado");
      bucle = 0;
      tAnterior = 0;
      return;
    }
    bucle = requestAnimationFrame(paso);
  }

  const arrancar = () => {
    ultimoToque = performance.now();
    titulo.classList.add("agitado");
    if (!bucle) bucle = requestAnimationFrame(paso);
  };

  titulo.addEventListener("pointerdown", (ev) => {
    if (!ev.target.closest(".ficha")) return;
    ev.preventDefault();
    pulsado = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, t: ev.timeStamp };
    try {
      titulo.setPointerCapture(ev.pointerId);
    } catch {}
    golpe(ev.clientX, ev.clientY);
    arrancar();
  });
  titulo.addEventListener("pointermove", (ev) => {
    if (!pulsado || ev.pointerId !== pulsado.id) return;
    const dt = Math.max(8, ev.timeStamp - pulsado.t) / 1000;
    remover(ev.clientX, ev.clientY, (ev.clientX - pulsado.x) / dt, (ev.clientY - pulsado.y) / dt);
    pulsado = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, t: ev.timeStamp };
    arrancar();
  });
  const soltar = (ev) => {
    if (pulsado && ev.pointerId === pulsado.id) pulsado = null;
    ultimoToque = performance.now();
  };
  titulo.addEventListener("pointerup", soltar);
  titulo.addEventListener("pointercancel", soltar);
}
