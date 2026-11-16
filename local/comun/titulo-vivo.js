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

// ------------------------------------------------------------------ valores del movimiento
// Todos juntos aquí. Se pueden retocar en vivo con el panel de ajustes: abre la app con #ajustes en la
// dirección (…/nyp-app/#ajustes). Lo que cambies en el panel se guarda solo en ese dispositivo; para dejarlo
// para todos, copia los valores («📋 Copiar») y ponlos aquí.
export const VALORES = {
  vueltaMs: 2000, // ms sin tocar una letra hasta que vuelve a su sitio (cada una con su propio reloj)
  vueltaVel: 1000, // px/s: velocidad al pasar por el radio de frenada (arranca proporcional a la distancia)
  vueltaRadio: 500, // px: a esta distancia de su sitio la letra empieza a frenar para llegar suave
  rebote: 0.34, // energía que se conserva en los choques (0 a 1)
  muelle: 560, // fuerza con la que la letra agarrada sigue al dedo
  amortigua: 0.42, // amortiguación del muelle (más: menos vaivén)
  alcance: 140, // px: hasta dónde llega un toque cerca de las letras (≈ 2 cm)
  golpe: 350, // fuerza de un toque
  giroGolpe: 150, // cuánto giran con un toque
  tironSoltar: 1, // parte de la velocidad del dedo que se lleva al soltarla
  velMax: 1000, // px/s: velocidad máxima de una letra lanzada
  roce: 1.5, // rozamiento del «líquido» (más: frenan antes)
  roceGiro: 1, // lo que tarda en frenar el giro
};
const A = VALORES;
const suave = (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2); // entra y sale despacio
export const DEFECTO = { ...VALORES };
// ¿Abierta con #ajustes? (se apunta antes de que la app limpie la dirección)
const conPanel = /ajustes/.test(location.hash) || sessionStorage.getItem("nyp-panel-ajustes") === "1";
if (conPanel) sessionStorage.setItem("nyp-panel-ajustes", "1");
// Lo que se cambió en el panel de ajustes (en este dispositivo).
try {
  // (solo los valores que siguen existiendo: los que se quitaron se ignoran)
  const guardados = JSON.parse(localStorage.getItem("nyp-ajustes-titulo") ?? "{}");
  for (const k in guardados) if (k in DEFECTO && typeof guardados[k] === "number") VALORES[k] = guardados[k];
} catch {}

export function tituloVivo(titulo, { alExpulsar = null } = {}) {
  if (!titulo || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (conPanel) import("./ajustes-titulo.js").then((m) => m.panelAjustes()).catch(() => {});
  const fichas = [...titulo.querySelectorAll(".ficha")];
  // Cada letra: posición, velocidad, giro, su propio reloj (toque: la última vez que la tocaron, la golpearon
  // o chocó) y su vuelta a casa (si está volviendo).
  const est = fichas.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0, toque: 0, vuelta: null }));
  let expulsadas = false;
  let ultimoToque = 0;
  let bucle = 0;
  let tAnterior = 0;
  // La letra agarrada: { id (dedo), k, ox, oy (dónde la cogiste, respecto a su centro), px, py, t0, vx, vy, movida }
  let agarre = null;

  // La fuerza va con el tamaño de la pantalla: en el ordenador las letras recorren lo mismo, en proporción,
  // que en el móvil (≈ 1 en un móvil normal).
  const escala = () => Math.max(0.85, Math.hypot(innerWidth, innerHeight) / 950);

  /**
   * Centro de cada letra en su sitio y su radio para los choques. Se mide con la maqueta (offsetLeft/Top):
   * no cuenta el desplazamiento ni el ondeo, que sigue siempre en marcha por debajo. Así, al volver, cada
   * letra cae justo donde el ondeo la tiene en ese momento (todas a la vez, como si nunca se hubieran ido).
   */
  function casas() {
    const t = titulo.getBoundingClientRect();
    return fichas.map((el) => ({
      x: t.left + titulo.clientLeft + el.offsetLeft + el.offsetWidth / 2,
      y: t.top + titulo.clientTop + el.offsetTop + el.offsetHeight / 2,
      radio: (Math.min(el.offsetWidth, el.offsetHeight) / 2) * 0.9,
    }));
  }

  // Alcance de un toque cerca de las letras: unos 2 cm (1 cm ≈ 38 px de CSS). Cuanto más lejos, menos.

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
      if (fuera > A.alcance) return;
      const f = (fuera === 0 ? 1 : 0.55 * (1 - fuera / A.alcance) ** 1.4) * fuerza;
      if (f < 0.02) return;
      if (d < 0.5) (dx = 0), (dy = 1), (d = 1); // justo en el centro: un saltito hacia arriba… o abajo, da igual
      tocadas++;
      const s = est[k];
      s.vuelta = null; // si estaba volviendo, deja de volver (solo esta)
      s.toque = performance.now();
      const impulso = A.golpe * f * e;
      s.vx += (dx / d) * impulso;
      s.vy += (dy / d) * impulso;
      s.vr += (dx / Math.max(r.width, 1)) * A.giroGolpe * f;
    });
    if (tocadas) navigator.vibrate?.(8);
    return tocadas;
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
          b.vx -= (1 + A.rebote) * vrel * nx;
          b.vy -= (1 + A.rebote) * vrel * ny;
          b.vr += roce * 0.25;
        } else if (jAgarrada) {
          a.vx += (1 + A.rebote) * vrel * nx;
          a.vy += (1 + A.rebote) * vrel * ny;
          a.vr -= roce * 0.25;
        } else {
          const J = ((1 + A.rebote) * vrel) / 2; // misma masa
          a.vx += J * nx, a.vy += J * ny;
          b.vx -= J * nx, b.vy -= J * ny;
          a.vr -= roce * 0.12;
          b.vr += roce * 0.12;
        }
        // Las que chocan dejan de volver y su reloj empieza de nuevo (solo ellas).
        const ahora = performance.now();
        if (!iAgarrada) (a.vuelta = null), (a.toque = ahora);
        if (!jAgarrada) (b.vuelta = null), (b.toque = ahora);
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
    const ahora = performance.now();
    // (Si un dedo se quedó agarrando sin soltar —p. ej. el sistema se tragó el evento— se suelta solo.)
    if (agarre && ahora - ultimoToque > 8000) agarre = null;
    const ancho = innerWidth, alto = innerHeight;
    let quietas = 0;
    let fuera = 0;
    const c = casas();

    // 1) Mover cada letra según su estado: agarrada, volviendo a su sitio o flotando. Cada una va a su aire.
    fichas.forEach((el, k) => {
      const s = est[k];
      if (agarre?.k === k) {
        s.toque = ahora;
        s.vuelta = null;
        // La agarrada no va pegada al dedo: la lleva un muelle hacia él, así que se queda algo atrás
        // cuanto más deprisa y más lejos mueves el dedo, y lo alcanza con un pequeño vaivén.
        const tx = agarre.px - agarre.ox - c[k].x, ty = agarre.py - agarre.oy - c[k].y;
        const freno = 2 * Math.sqrt(A.muelle) * A.amortigua;
        const ax = A.muelle * (tx - s.x) - freno * s.vx, ay = A.muelle * (ty - s.y) - freno * s.vy;
        s.vx += ax * dt;
        s.vy += ay * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        // Se inclina hacia donde tira el dedo (como si colgara de él).
        const inclina = Math.max(-25, Math.min(25, ax * 0.004));
        s.vr += ((inclina - s.r) * 40 - s.vr * 8) * dt;
        s.r += s.vr * dt;
        return; // (no se suelta nunca del dedo: solo al levantarlo)
      }
      const fueraDeCasa = s.vuelta || Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.r) > 0.3;
      if (fueraDeCasa && ahora - s.toque > A.vueltaMs) {
        // Vuelta a su sitio (solo esta letra). Arranca ya con una velocidad proporcional a la distancia (a 2000 px,
        // más rápido que a 1500) y desde ahí siempre va frenando: fuera del radio de frenada la velocidad baja
        // con la distancia; dentro del radio frena más suave hasta llegar a velocidad cero. El giro se deshace
        // a la par que la distancia.
        const d = Math.hypot(s.x, s.y);
        if (!s.vuelta) s.vuelta = { d0: Math.max(d, 0.001), r0: ((s.r % 360) + 540) % 360 - 180 };
        const R = Math.max(1, A.vueltaRadio);
        const vel = d >= R ? (A.vueltaVel * d) / R : A.vueltaVel * Math.sqrt(d / R);
        const avance = d < 0.5 ? d : Math.min(d, vel * dt);
        if (d > 0.001) {
          s.x -= (s.x / d) * avance;
          s.y -= (s.y / d) * avance;
        }
        const resto = Math.hypot(s.x, s.y);
        s.r = s.vuelta.r0 * Math.min(1, resto / s.vuelta.d0);
        s.vx = s.vy = s.vr = 0;
        if (resto < 0.5) Object.assign(s, { x: 0, y: 0, r: 0, vuelta: null });
        return;
      }
      s.vuelta = null;
      // Líquido: frena poco a poco y se mece un poco (y puede salir de la pantalla).
      const roce = Math.exp(-A.roce * dt);
      s.vx *= roce;
      s.vy *= roce;
      s.vr *= Math.exp(-A.roceGiro * dt);
      if (Math.hypot(s.vx, s.vy) > 1 || s.x || s.y) s.vy += Math.sin(t / 600 + k) * 8 * dt; // se mece
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.r += s.vr * dt;
    });
    choques(c);

    // 2) Pintar. Las que están en su sitio y quietas, sin nada: siguen ondeando con las demás.
    fichas.forEach((el, k) => {
      const s = est[k];
      const enCasa = agarre?.k !== k && !s.vuelta && Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.r) < 0.3 && Math.hypot(s.vx, s.vy) + Math.abs(s.vr) < 1;
      if (enCasa) {
        Object.assign(s, { x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0 });
        el.style.translate = el.style.rotate = "";
        quietas++;
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.right < 0 || r.left > ancho || r.bottom < 0 || r.top > alto) fuera++;
      el.style.translate = `${s.x.toFixed(1)}px ${s.y.toFixed(1)}px`;
      el.style.rotate = `${s.r.toFixed(1)}deg`;
    });
    // ¡Todas fuera de la pantalla a la vez!
    if (fuera === fichas.length && !expulsadas) {
      expulsadas = true;
      alExpulsar?.();
    }
    if (quietas === fichas.length && !agarre) {
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
    s.vuelta = null; // si estaba volviendo, se para solo esta
    s.toque = performance.now();
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
    if (agarre.movida > 6) fichas[agarre.k].classList.add("agarrada");
    arrancar();
  });
  const soltar = (ev) => {
    if (!agarre || ev.pointerId !== agarre.id) return;
    const { k, movida, pt, t0 } = agarre;
    const agarreSoltado = agarre;
    const s = est[k];
    fichas[k].classList.remove("agarrada");
    titulo.classList.remove("agarrando");
    agarre = null;
    sinClicHasta = performance.now() + 450; // el clic llega justo después de soltar
    // Solo sale lanzada si la estabas moviendo al soltarla, y tanto más cuanto más deprisa iba la letra.
    // Cogerla y soltarla sin moverla (o con el dedo ya quieto) la deja donde está.
    const quieto = movida < 6 || ev.timeStamp - pt > 90;
    if (movida < 6 && ev.timeStamp - t0 < 220) {
      // Un toque rápido encima (sin agarrarla): un golpe a esa letra, que sale despedida.
      s.vx = s.vy = 0;
      golpe(ev.clientX, ev.clientY, { solo: k });
    } else if (quieto) s.vx = s.vy = 0;
    else {
      const { fvx = 0, fvy = 0 } = agarreSoltado;
      s.vx += fvx * A.tironSoltar;
      s.vy += fvy * A.tironSoltar;
      const tope = A.velMax * escala();
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
    if (ev.clientX < r.left - A.alcance || ev.clientX > r.right + A.alcance || ev.clientY < r.top - A.alcance || ev.clientY > r.bottom + A.alcance) return;
    if (golpe(ev.clientX, ev.clientY)) arrancar(); // un toque que no mueve ninguna letra no cuenta
  }
  document.addEventListener("pointerdown", cerca);
}
