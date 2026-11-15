// Título del inicio con letras que se pueden golpear: al tocarlas se apartan como si flotaran en un líquido
// (frenan poco a poco y giran) y, con golpes fuertes, pueden salir de la pantalla; al arrastrar el dedo, lo
// remueves. Si no se tocan en 4 segundos, cada letra vuelve despacio a su sitio y sigue ondeando.
// alExpulsar(): todas las letras fuera de la pantalla a la vez (hazaña «Machaca títulos»).
//
// Rendimiento: solo se mueven `translate` y `rotate` de unas 19 fichas (lo hace la tarjeta gráfica) y el
// bucle de animación solo corre mientras alguna letra está fuera de su sitio.

const VUELTA_MS = 4000;
const VUELTA_DURA = 1600; // lo que tarda cada letra en volver (con suavidad)
const suave = (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2); // entra y sale despacio

export function tituloVivo(titulo, { alExpulsar = null } = {}) {
  if (!titulo || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const fichas = [...titulo.querySelectorAll(".ficha")];
  const est = fichas.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0, vuelta: null }));
  let expulsadas = false;
  let ultimoToque = 0;
  let bucle = 0;
  let tAnterior = 0;
  let pulsado = null; // { id, x, y, t }

  const centro = (k) => {
    const r = fichas[k].getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2, r.width];
  };

  // La fuerza va con el tamaño de la pantalla: en el ordenador las letras recorren lo mismo, en proporción,
  // que en el móvil (≈ 1 en un móvil normal).
  const escala = () => Math.max(0.85, Math.hypot(innerWidth, innerHeight) / 950);

  // Alcance del golpe: unos 2 cm (1 cm ≈ 38 px de CSS). Si golpeas encima de la letra se mueve más; cerca
  // de ella, menos cuanto más lejos. Siempre sale hacia el lado contrario a donde golpeaste (sin azar):
  // golpe por debajo → hacia arriba; por la izquierda → hacia la derecha…
  const ALCANCE = 76;

  /** Golpe en (x, y): las letras cercanas salen despedidas en sentido contrario al golpe. */
  function golpe(x, y, fuerza = 1) {
    let tocadas = 0;
    const e = escala();
    fichas.forEach((el, k) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = cx - x, dy = cy - y;
      const d = Math.hypot(dx, dy);
      // Distancia al borde de la letra (0 si el golpe cae encima).
      const fuera = Math.hypot(Math.max(0, Math.abs(dx) - r.width / 2), Math.max(0, Math.abs(dy) - r.height / 2));
      if (fuera > ALCANCE) return;
      const encima = fuera === 0;
      // Encima: fuerza entera (más si cae lejos del centro, hacia su borde); fuera: baja con la distancia.
      const f = (encima ? 1 : 0.55 * (1 - fuera / ALCANCE) ** 1.4) * fuerza;
      if (f < 0.02 || d < 0.5) return;
      tocadas++;
      const s = est[k];
      s.vuelta = null; // si estaba volviendo, deja de volver
      const impulso = 260 * f * e; // poco a poco: hacen falta varios golpes para echarlas
      s.vx += (dx / d) * impulso;
      s.vy += (dy / d) * impulso;
      // Giro según dónde la golpeas: un golpe a un lado del centro la hace girar.
      s.vr += (dx / Math.max(r.width, 1)) * 160 * f;
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
      s.vuelta = null;
      s.vx += vx * f * 0.25;
      s.vy += vy * f * 0.25;
      s.vr += (vx - vy) * f * 0.05;
    });
  }

  function paso(t) {
    if (!titulo.isConnected) {
      document.removeEventListener("click", comerClic, true);
      return void (bucle = 0);
    }
    const dt = Math.min(0.033, (t - (tAnterior || t)) / 1000) || 0.016;
    tAnterior = t;
    // (Si un dedo se quedó «pulsado» sin soltar —p. ej. el sistema se tragó el evento— tampoco bloquea la vuelta.)
    if (pulsado && performance.now() - ultimoToque > 8000) pulsado = null;
    const volviendo = performance.now() - ultimoToque > VUELTA_MS && !pulsado;
    const ancho = innerWidth, alto = innerHeight;
    let quietas = 0;
    let fuera = 0;
    const ahora = performance.now();
    fichas.forEach((el, k) => {
      const s = est[k];
      if (volviendo && !s.vuelta && s.x === 0 && s.y === 0 && s.r === 0) {
        // Ya está en su sitio: no se vuelve a empezar otra vuelta (si no, el bucle no pararía nunca).
        el.style.translate = el.style.rotate = "";
        quietas++;
        return;
      }
      if (volviendo) {
        // Vuelta suave: desde donde esté, a su sitio, una detrás de otra (sin rebotes ni muelles bruscos).
        s.vuelta ??= { x: s.x, y: s.y, r: ((s.r % 360) + 540) % 360 - 180, t0: ahora + k * 45 };
        const p = Math.min(1, Math.max(0, (ahora - s.vuelta.t0) / VUELTA_DURA));
        const q = 1 - suave(p);
        s.x = s.vuelta.x * q;
        s.y = s.vuelta.y * q;
        s.r = s.vuelta.r * q;
        s.vx = s.vy = s.vr = 0;
        if (p >= 1) {
          Object.assign(s, { x: 0, y: 0, r: 0, vuelta: null });
          el.style.translate = el.style.rotate = "";
          quietas++;
          return;
        }
      } else {
        // Líquido: frena poco a poco y se mece un poco (y puede salir de la pantalla).
        const roce = Math.exp(-2.3 * dt);
        s.vx *= roce;
        s.vy *= roce;
        s.vr *= Math.exp(-1.4 * dt);
        s.vy += Math.sin(t / 600 + k) * 8 * dt; // se mece (sube y baja por igual)
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.r += s.vr * dt;
        const r = el.getBoundingClientRect();
        if (r.right < 0 || r.left > ancho || r.bottom < 0 || r.top > alto) fuera++;
      }
      // En su sitio y quieta: ya no hace falta seguir moviéndola.
      if (!volviendo && Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.r) < 0.3 && Math.hypot(s.vx, s.vy) + Math.abs(s.vr) < 1) {
        el.style.translate = el.style.rotate = "";
        quietas++;
        return;
      }
      el.style.translate = `${s.x.toFixed(1)}px ${s.y.toFixed(1)}px`;
      el.style.rotate = `${s.r.toFixed(1)}deg`;
    });
    // ¡Todas fuera de la pantalla a la vez!
    if (fuera === fichas.length && !expulsadas) {
      expulsadas = true;
      alExpulsar?.();
    }
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

  // Golpear una letra que está encima de un botón no pulsa el botón: la letra sale volando y, al levantar
  // el dedo, el navegador «haría clic» en lo que queda debajo. Ese clic se descarta.
  let sinClicHasta = 0;
  const comerClic = (ev) => {
    if (!titulo.isConnected) return document.removeEventListener("click", comerClic, true);
    if (performance.now() > sinClicHasta) return;
    ev.preventDefault();
    ev.stopPropagation();
  };
  document.addEventListener("click", comerClic, true);
  const vetar = (ms) => (sinClicHasta = Math.max(sinClicHasta, performance.now() + ms));

  titulo.addEventListener("pointerdown", (ev) => {
    if (!ev.target.closest(".ficha")) return;
    ev.preventDefault();
    vetar(10000); // hasta que se suelte
    pulsado = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, t: ev.timeStamp };
    try {
      titulo.setPointerCapture(ev.pointerId);
    } catch {}
    golpe(ev.clientX, ev.clientY);
    arrancar();
  });
  // Golpes cerca de las letras (sin tocarlas): en el fondo, a menos de ~2 cm, también las mueven (algo menos).
  // Sobre botones u otros controles no: así pulsarlos no mueve el título.
  const cerca = (ev) => {
    if (!titulo.isConnected) return document.removeEventListener("pointerdown", cerca);
    if (ev.target.closest?.(".titulo-nyp .ficha, button, a, input, textarea, select, label, [role=button], .capa-movil")) return;
    const r = titulo.getBoundingClientRect();
    if (ev.clientX < r.left - ALCANCE || ev.clientX > r.right + ALCANCE || ev.clientY < r.top - ALCANCE || ev.clientY > r.bottom + ALCANCE) return;
    golpe(ev.clientX, ev.clientY);
    arrancar();
  };
  document.addEventListener("pointerdown", cerca);
  titulo.addEventListener("pointermove", (ev) => {
    if (!pulsado || ev.pointerId !== pulsado.id) return;
    ultimoToque = performance.now();
    const dt = Math.max(8, ev.timeStamp - pulsado.t) / 1000;
    remover(ev.clientX, ev.clientY, (ev.clientX - pulsado.x) / dt, (ev.clientY - pulsado.y) / dt);
    pulsado = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, t: ev.timeStamp };
    arrancar();
  });
  const soltar = (ev) => {
    if (pulsado && ev.pointerId === pulsado.id) {
      pulsado = null;
      sinClicHasta = performance.now() + 450; // el clic llega justo después de soltar
    }
    ultimoToque = performance.now();
  };
  titulo.addEventListener("pointerup", soltar);
  titulo.addEventListener("pointercancel", soltar);
  titulo.addEventListener("lostpointercapture", soltar);
}
