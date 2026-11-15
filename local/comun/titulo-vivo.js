// Título del inicio con letras que se pueden agarrar y lanzar: al agarrar una, solo se mueve esa (sigue al
// dedo) y, al soltarla, sale con la velocidad que llevaba. Las letras chocan entre ellas como bolas de billar
// o bolos: una lanzada muy fuerte se lleva por delante a las demás (más o menos según la fuerza del golpe).
// Flotan como en un líquido (frenan poco a poco y giran) y pueden salir de la pantalla. Un toque rápido sobre
// una letra le da un golpecito; un toque cerca (a menos de ~2 cm) la aparta un poco.
// Si no se tocan en 4 segundos, cada letra vuelve despacio a su sitio.
// alExpulsar(): todas las letras fuera de la pantalla a la vez (hazaña «Machaca títulos»).
//
// Rendimiento: solo se mueven `translate` y `rotate` de unas 19 fichas (lo hace la tarjeta gráfica), los
// choques se miran entre parejas (19 × 18 / 2 = 171 comprobaciones, nada) y el bucle de animación solo corre
// mientras alguna letra está fuera de su sitio.

const VUELTA_MS = 4000;
const VUELTA_DURA = 1600; // lo que tarda cada letra en volver (con suavidad)
const suave = (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2); // entra y sale despacio
const REBOTE = 0.88; // en los choques se conserva casi toda la energía (como en el billar)
// Muelle que lleva la letra agarrada hacia el dedo (rigidez y amortiguación: algo de retraso, poco vaivén).
const MUELLE = 260;
const ESCAPE = 3200; // px/s: con el dedo más rápido que esto, la letra se escapa (se suelta sin lanzarla)
const FRENO = 2 * Math.sqrt(MUELLE) * 0.62;

export function tituloVivo(titulo, { alExpulsar = null } = {}) {
  if (!titulo || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const fichas = [...titulo.querySelectorAll(".ficha")];
  const est = fichas.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0, vuelta: null }));
  let expulsadas = false;
  let ultimoToque = 0;
  let bucle = 0;
  let tAnterior = 0;
  // La letra agarrada: { id (dedo), k, ox, oy (dónde la cogiste, respecto a su centro), px, py, t0, vx, vy, movida }
  let agarre = null;

  // La fuerza va con el tamaño de la pantalla: en el ordenador las letras recorren lo mismo, en proporción,
  // que en el móvil (≈ 1 en un móvil normal).
  const escala = () => Math.max(0.85, Math.hypot(innerWidth, innerHeight) / 950);

  /** Centro de cada letra en su sitio (sin el desplazamiento) y su radio para los choques. */
  function casas() {
    return fichas.map((el, k) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - est[k].x, y: r.top + r.height / 2 - est[k].y, radio: (Math.min(el.offsetWidth, el.offsetHeight) / 2) * 0.9 };
    });
  }

  // Alcance de un toque cerca de las letras: unos 2 cm (1 cm ≈ 38 px de CSS). Cuanto más lejos, menos.
  const ALCANCE = 76;

  /** Golpe en (x, y): las letras indicadas (o todas las cercanas) salen en sentido contrario al golpe. */
  function golpe(x, y, { solo = null, fuerza = 1 } = {}) {
    let tocadas = 0;
    const e = escala();
    fichas.forEach((el, k) => {
      if (solo != null && k !== solo) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = cx - x, dy = cy - y;
      let d = Math.hypot(dx, dy);
      const fuera = Math.hypot(Math.max(0, Math.abs(dx) - r.width / 2), Math.max(0, Math.abs(dy) - r.height / 2));
      if (fuera > ALCANCE) return;
      const f = (fuera === 0 ? 1 : 0.55 * (1 - fuera / ALCANCE) ** 1.4) * fuerza;
      if (f < 0.02) return;
      if (d < 0.5) (dx = 0), (dy = 1), (d = 1); // justo en el centro: un saltito hacia arriba… o abajo, da igual
      tocadas++;
      const s = est[k];
      s.vuelta = null;
      const impulso = 260 * f * e;
      s.vx += (dx / d) * impulso;
      s.vy += (dy / d) * impulso;
      s.vr += (dx / Math.max(r.width, 1)) * 160 * f;
    });
    if (tocadas) navigator.vibrate?.(8);
  }

  /** Choques entre letras: se separan y se reparten la velocidad (la agarrada empuja sin frenarse). */
  function choques(c) {
    const quieta = (k) => (!agarre || agarre.k !== k) && Math.hypot(est[k].vx, est[k].vy) < 15;
    for (let i = 0; i < fichas.length; i++) {
      for (let j = i + 1; j < fichas.length; j++) {
        if (quieta(i) && quieta(j)) continue; // dos letras paradas no chocan (en su sitio ni se tocan)
        const a = est[i], b = est[j];
        const ax = c[i].x + a.x, ay = c[i].y + a.y, bx = c[j].x + b.x, by = c[j].y + b.y;
        const dx = bx - ax, dy = by - ay;
        const d = Math.hypot(dx, dy);
        const minimo = c[i].radio + c[j].radio;
        if (d >= minimo || d < 0.01) continue;
        const nx = dx / d, ny = dy / d;
        const iAgarrada = agarre?.k === i, jAgarrada = agarre?.k === j;
        // Se separan (la agarrada no se mueve: va con el dedo).
        const solape = minimo - d;
        if (iAgarrada) (b.x += nx * solape), (b.y += ny * solape);
        else if (jAgarrada) (a.x -= nx * solape), (a.y -= ny * solape);
        else (a.x -= (nx * solape) / 2), (a.y -= (ny * solape) / 2), (b.x += (nx * solape) / 2), (b.y += (ny * solape) / 2);
        // Velocidad relativa en la dirección del choque: si se acercan, rebotan.
        const vrel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vrel >= 0) continue;
        const tx = -ny, ty = nx; // lo que se rozan de lado: las hace girar
        const roce = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty;
        if (iAgarrada) {
          b.vx -= (1 + REBOTE) * vrel * nx;
          b.vy -= (1 + REBOTE) * vrel * ny;
          b.vr += roce * 0.25;
        } else if (jAgarrada) {
          a.vx += (1 + REBOTE) * vrel * nx;
          a.vy += (1 + REBOTE) * vrel * ny;
          a.vr -= roce * 0.25;
        } else {
          const J = ((1 + REBOTE) * vrel) / 2; // misma masa
          a.vx += J * nx, a.vy += J * ny;
          b.vx -= J * nx, b.vy -= J * ny;
          a.vr -= roce * 0.12;
          b.vr += roce * 0.12;
        }
        a.vuelta = b.vuelta = null;
        if (Math.abs(vrel) > 150) navigator.vibrate?.(Math.min(25, Math.abs(vrel) / 60));
      }
    }
  }

  function paso(t) {
    if (!titulo.isConnected) {
      document.removeEventListener("click", comerClic, true);
      document.removeEventListener("pointerdown", cerca);
      return void (bucle = 0);
    }
    const dt = Math.min(0.033, (t - (tAnterior || t)) / 1000) || 0.016;
    tAnterior = t;
    // (Si un dedo se quedó agarrando sin soltar —p. ej. el sistema se tragó el evento— tampoco bloquea la vuelta.)
    if (agarre && performance.now() - ultimoToque > 8000) agarre = null;
    const volviendo = performance.now() - ultimoToque > VUELTA_MS && !agarre;
    const ancho = innerWidth, alto = innerHeight;
    let quietas = 0;
    let fuera = 0;
    const ahora = performance.now();
    const c = volviendo ? null : casas();

    if (!volviendo) {
      fichas.forEach((el, k) => {
        const s = est[k];
        if (agarre?.k === k) {
          // La agarrada no va pegada al dedo: la lleva un muelle hacia él, así que se queda algo atrás
          // cuanto más deprisa y más lejos mueves el dedo, y lo alcanza con un pequeño vaivén.
          const tx = agarre.px - agarre.ox - c[k].x, ty = agarre.py - agarre.oy - c[k].y;
          const ax = MUELLE * (tx - s.x) - FRENO * s.vx, ay = MUELLE * (ty - s.y) - FRENO * s.vy;
          s.vx += ax * dt;
          s.vy += ay * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          // Se inclina hacia donde tira el dedo (como si colgara de él).
          const inclina = Math.max(-25, Math.min(25, ax * 0.004));
          s.vr += ((inclina - s.r) * 40 - s.vr * 8) * dt;
          s.r += s.vr * dt;
          return;
        }
        // Líquido: frena poco a poco y se mece un poco (y puede salir de la pantalla).
        const roce = Math.exp(-2.3 * dt);
        s.vx *= roce;
        s.vy *= roce;
        s.vr *= Math.exp(-1.4 * dt);
        if (Math.hypot(s.vx, s.vy) > 1 || s.x || s.y) s.vy += Math.sin(t / 600 + k) * 8 * dt; // se mece
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.r += s.vr * dt;
      });
      choques(c);
    }

    fichas.forEach((el, k) => {
      const s = est[k];
      if (volviendo && !s.vuelta && s.x === 0 && s.y === 0 && s.r === 0) {
        // Ya está en su sitio: no se vuelve a empezar otra vuelta (si no, el bucle no pararía nunca).
        el.style.translate = el.style.rotate = "";
        el.classList.remove("suelta"); // en su sitio: vuelve a ondear
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
        el.classList.remove("suelta"); // en su sitio: vuelve a ondear
          quietas++;
          return;
        }
      } else {
        const r = el.getBoundingClientRect();
        if (r.right < 0 || r.left > ancho || r.bottom < 0 || r.top > alto) fuera++;
        // En su sitio y quieta: ya no hace falta seguir moviéndola.
        if (agarre?.k !== k && Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.r) < 0.3 && Math.hypot(s.vx, s.vy) + Math.abs(s.vr) < 1) {
          el.style.translate = el.style.rotate = "";
        el.classList.remove("suelta"); // en su sitio: vuelve a ondear
          quietas++;
          return;
        }
      }
      el.classList.add("suelta"); // fuera de su sitio: deja de ondear (las demás siguen)
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

  // Agarrar una letra que está encima de un botón no pulsa el botón: al levantar el dedo, el navegador
  // «haría clic» en lo que queda debajo. Ese clic se descarta.
  let sinClicHasta = 0;
  const comerClic = (ev) => {
    if (!titulo.isConnected) return document.removeEventListener("click", comerClic, true);
    if (performance.now() > sinClicHasta) return;
    ev.preventDefault();
    ev.stopPropagation();
  };
  document.addEventListener("click", comerClic, true);
  const vetar = (ms) => (sinClicHasta = Math.max(sinClicHasta, performance.now() + ms));

  // Agarrar: solo esa letra (las demás no se mueven… hasta que choque con ellas).
  titulo.addEventListener("pointerdown", (ev) => {
    const el = ev.target.closest(".ficha");
    if (!el || agarre) return;
    ev.preventDefault();
    vetar(10000); // hasta que se suelte
    const k = fichas.indexOf(el);
    if (k < 0) return;
    const r = el.getBoundingClientRect();
    const s = est[k];
    s.vuelta = null;
    s.vx = s.vy = 0;
    s.r = ((s.r % 360) + 540) % 360 - 180; // (si había dado vueltas, el giro más corto)
    agarre = { id: ev.pointerId, k, ox: ev.clientX - (r.left + r.width / 2), oy: ev.clientY - (r.top + r.height / 2), px: ev.clientX, py: ev.clientY, pt: ev.timeStamp, t0: ev.timeStamp, movida: 0 };
    try {
      titulo.setPointerCapture(ev.pointerId);
    } catch {}
    titulo.classList.add("agarrando"); // (puntero: mano cerrada)
    arrancar(); // (se ve «levantada» solo cuando empiezas a arrastrarla: un toque no la agranda)
  });
  titulo.addEventListener("pointermove", (ev) => {
    if (!agarre || ev.pointerId !== agarre.id) return;
    ultimoToque = performance.now();
    const dt = Math.max(8, ev.timeStamp - agarre.pt) / 1000;
    // Velocidad del dedo (suavizada): se suma al lanzarla.
    agarre.fvx = (agarre.fvx ?? 0) * 0.5 + ((ev.clientX - agarre.px) / dt) * 0.5;
    agarre.fvy = (agarre.fvy ?? 0) * 0.5 + ((ev.clientY - agarre.py) / dt) * 0.5;
    agarre.movida += Math.hypot(ev.clientX - agarre.px, ev.clientY - agarre.py);
    Object.assign(agarre, { px: ev.clientX, py: ev.clientY, pt: ev.timeStamp });
    // Si tiras demasiado deprisa, la letra se te escapa: se suelta donde está, sin salir lanzada.
    if (Math.hypot(agarre.fvx, agarre.fvy) > ESCAPE * escala()) {
      const s = est[agarre.k];
      fichas[agarre.k].classList.remove("agarrada");
      titulo.classList.remove("agarrando");
      s.vx *= 0.15;
      s.vy *= 0.15;
      agarre = null;
      sinClicHasta = performance.now() + 450;
      navigator.vibrate?.(15);
      return arrancar();
    }
    if (agarre.movida > 6) fichas[agarre.k].classList.add("agarrada");
    arrancar();
  });
  const soltar = (ev) => {
    if (!agarre || ev.pointerId !== agarre.id) return;
    const { k, movida, t0, pt } = agarre;
    const agarreSoltado = agarre;
    const s = est[k];
    fichas[k].classList.remove("agarrada");
    titulo.classList.remove("agarrando");
    agarre = null;
    sinClicHasta = performance.now() + 450; // el clic llega justo después de soltar
    if (movida < 6 && ev.timeStamp - t0 < 350) {
      // Un toque rápido sin arrastrar: un golpecito solo a esa letra.
      s.vx = s.vy = 0;
      golpe(ev.clientX, ev.clientY, { solo: k });
    } else {
      // Lanzamiento: sale con su propia velocidad (la del muelle) más parte de la del dedo; si el dedo ya
      // estaba quieto al soltar, solo le queda lo que llevaba (se para enseguida).
      const quieto = ev.timeStamp - pt > 90;
      const { fvx = 0, fvy = 0 } = agarreSoltado;
      if (!quieto) (s.vx = s.vx * 0.55 + fvx * 0.45), (s.vy = s.vy * 0.55 + fvy * 0.45);
      const tope = 4500 * escala();
      const v = Math.hypot(s.vx, s.vy);
      if (v > tope) (s.vx *= tope / v), (s.vy *= tope / v);
    }
    arrancar();
  };
  titulo.addEventListener("pointerup", soltar);
  titulo.addEventListener("pointercancel", soltar);
  titulo.addEventListener("lostpointercapture", soltar);

  // Toques cerca de las letras (sin tocarlas): en el fondo, a menos de ~2 cm, las apartan un poco.
  // Sobre botones u otros controles no: así pulsarlos no mueve el título.
  function cerca(ev) {
    if (!titulo.isConnected) return document.removeEventListener("pointerdown", cerca);
    if (ev.target.closest?.(".titulo-nyp .ficha, button, a, input, textarea, select, label, [role=button], .capa-movil")) return;
    const r = titulo.getBoundingClientRect();
    if (ev.clientX < r.left - ALCANCE || ev.clientX > r.right + ALCANCE || ev.clientY < r.top - ALCANCE || ev.clientY > r.bottom + ALCANCE) return;
    golpe(ev.clientX, ev.clientY);
    arrancar();
  }
  document.addEventListener("pointerdown", cerca);
}
