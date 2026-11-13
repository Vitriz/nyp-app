// Crucigrama · móvil: arriba la definición de la palabra elegida (con ◀ ▶ para pasar de una a otra),
// en medio la rejilla y abajo el teclado. Tocas una casilla para elegir la palabra (otro toque en la
// misma casilla cambia entre horizontal y vertical) y escribes. Al llenarla se comprueba sola.
import { h } from "../../comun/ui.js";
import { huella, reiniciarAnim, tecladoLetras } from "../comun/util.js";

export function montar(cuerpo, e, ctx) {
  const d = e.datos;
  const P = d.palabras ?? [];
  // Diccionario antiguo (sin temas): se avisa en vez de enseñar una rejilla vacía.
  if (!P.length) {
    cuerpo.append(h("div.espera", h("h1", "📚"), h("p", "Este diccionario aún no tiene los temas del crucigrama."), h("p.suave", "Abre la app con internet (o conéctate a PARTY) para actualizarlo.")));
    return { actualizar() {} };
  }
  const letras = new Map(); // "r,c" -> letra escrita
  const bloqueadas = new Set(); // casillas de palabras ya resueltas
  const resueltas = new Set();
  let sel = 0; // palabra elegida
  let pos = 0; // casilla dentro de la palabra

  const celdasDe = (p) => Array.from({ length: p.largo }, (_, i) => `${p.r + (p.dir === "v" ? i : 0)},${p.c + (p.dir === "h" ? i : 0)}`);
  const palabrasEn = new Map(); // "r,c" -> [índices de palabras]
  P.forEach((p, k) => celdasDe(p).forEach((c) => palabrasEn.set(c, [...(palabrasEn.get(c) ?? []), k])));
  const numeros = new Map(P.map((p) => [`${p.r},${p.c}`, p.n]));

  // Resueltas, letras desveladas y lo escrito que trae el servidor (al volver a entrar o seguir otro día).
  for (const [k, cl] of Object.entries(d.resueltas ?? {})) marcarResuelta(Number(k), cl);
  const reveladas = new Set();
  for (const [c, l] of Object.entries(d.reveladas ?? {})) revelar(c, l);
  for (const [c, l] of Object.entries(d.borrador ?? {})) if (!bloqueadas.has(c)) letras.set(c, l);

  const pista = h("div.cg-pista-texto");
  const anterior = h("button.icono-btn.cg-flecha", { type: "button", "aria-label": "Palabra anterior", onclick: () => saltar(-1) }, "◀");
  const siguiente = h("button.icono-btn.cg-flecha", { type: "button", "aria-label": "Palabra siguiente", onclick: () => saltar(1) }, "▶");
  const cuenta = h("span.cg-cuenta");
  // Pista: desvela la letra de la casilla elegida (cuesta 1 punto).
  const botonPista = h("button.boton.suave.cg-pista-btn", { type: "button", onclick: pedirPista, title: "Desvela la letra de la casilla elegida (−1 punto)" }, "💡 Letra (−1)");
  const rejilla = h("div.cg-rejilla", { style: { "--filas": d.filas, "--cols": d.cols } });
  const casillas = new Map();
  for (let r = 0; r < d.filas; r++) {
    for (let c = 0; c < d.cols; c++) {
      const k = `${r},${c}`;
      const viva = palabrasEn.has(k);
      const el = h(`div.cg-celda${viva ? "" : ".negra"}`, { "data-k": k }, numeros.has(k) ? h("span.cg-num", String(numeros.get(k))) : null, h("span.cg-letra"));
      casillas.set(k, el);
      rejilla.append(el);
    }
  }
  const teclado = tecladoLetras(escribir);
  cuerpo.append(
    h(
      "div.cg",
      h("div.cg-cabeza", h("span.cg-ambito", d.ambito === "todos" ? "🌍 Todos los temas" : `📚 ${d.ambito}`), h("span.cg-cabeza-der", botonPista, cuenta)),
      h("div.cg-pista", anterior, pista, siguiente),
      h("div.cg-zona", rejilla),
      teclado
    )
  );

  function marcarResuelta(k, cl) {
    resueltas.add(k);
    celdasDe(P[k]).forEach((c, i) => {
      letras.set(c, cl[i]);
      bloqueadas.add(c);
    });
  }

  function revelar(c, l) {
    letras.set(c, l);
    bloqueadas.add(c);
    reveladas.add(c);
  }

  function pedirPista() {
    const c = celdasDe(P[sel])[pos];
    if (!c || bloqueadas.has(c)) return;
    ctx.enviar({ a: "pista", casilla: c });
  }

  // Lo escrito se guarda (sin prisa) para poder seguir otro día.
  let borradorPendiente = 0;
  function guardarBorrador() {
    clearTimeout(borradorPendiente);
    borradorPendiente = setTimeout(() => {
      const libres = Object.fromEntries([...letras].filter(([c]) => !bloqueadas.has(c)));
      ctx.enviar({ a: "borrador", letras: libres });
    }, 500);
  }

  function elegir(k, p = 0) {
    sel = k;
    pos = p;
    // Si cae en una casilla ya resuelta, a la siguiente libre.
    const cs = celdasDe(P[sel]);
    while (pos < cs.length - 1 && bloqueadas.has(cs[pos])) pos++;
    pintar();
  }

  function saltar(paso) {
    const n = P.length;
    for (let i = 1; i <= n; i++) {
      const k = (((sel + paso * i) % n) + n) % n;
      if (!resueltas.has(k)) return elegir(k);
    }
  }

  rejilla.addEventListener("pointerdown", (ev) => {
    const el = ev.target.closest(".cg-celda:not(.negra)");
    if (!el) return;
    ev.preventDefault();
    const k = el.dataset.k;
    const aqui = palabrasEn.get(k);
    const actual = celdasDe(P[sel]);
    // Otro toque en la misma casilla: cambia de dirección (si allí se cruzan dos palabras).
    let nueva = aqui.includes(sel) && actual[pos] !== k ? sel : aqui.find((x) => x !== sel) ?? aqui[0];
    if (aqui.includes(sel) && actual[pos] === k) nueva = aqui.find((x) => x !== sel) ?? sel;
    elegir(nueva, celdasDe(P[nueva]).indexOf(k));
  });

  function escribir(t) {
    const cs = celdasDe(P[sel]);
    if (resueltas.has(sel)) return saltar(1);
    if (t === "⌫") {
      if (!letras.get(cs[pos]) || bloqueadas.has(cs[pos])) {
        // Atrás hasta una casilla que se pueda borrar.
        let i = pos - 1;
        while (i >= 0 && bloqueadas.has(cs[i])) i--;
        if (i < 0) return;
        pos = i;
      }
      if (!bloqueadas.has(cs[pos])) letras.delete(cs[pos]);
      return pintar();
    }
    if (!bloqueadas.has(cs[pos])) letras.set(cs[pos], t);
    // A la siguiente casilla libre de la palabra.
    let i = pos + 1;
    while (i < cs.length && bloqueadas.has(cs[i])) i++;
    if (i < cs.length) pos = i;
    guardarBorrador();
    comprobar(sel);
    // Al escribir también se pueden completar las palabras que se cruzan.
    for (const k of palabrasEn.get(cs[Math.min(pos, cs.length - 1)]) ?? []) if (k !== sel) comprobar(k, true);
    pintar();
  }

  /** Si la palabra está llena, se comprueba: bien → se queda en verde; mal → tiembla. */
  function comprobar(k, callado = false) {
    if (resueltas.has(k)) return;
    const cs = celdasDe(P[k]);
    if (!cs.every((c) => letras.get(c))) return;
    const texto = cs.map((c) => letras.get(c)).join("");
    if (huella(texto) === P[k].h) {
      marcarResuelta(k, texto);
      cs.forEach((c) => casillas.get(c).classList.remove("mal"));
      ctx.enviar({ a: "respuesta", k, texto });
      navigator.vibrate?.(20);
      cs.forEach((c) => reiniciarAnim(casillas.get(c), "bien"));
      if (k === sel) setTimeout(() => saltar(1), 250);
    } else if (!callado) {
      navigator.vibrate?.([30, 40, 30]);
      cs.forEach((c) => reiniciarAnim(casillas.get(c), "mal"));
      setTimeout(() => cs.forEach((c) => casillas.get(c).classList.remove("mal")), 450); // el rojo, solo un momento
    }
  }

  function pintar() {
    const p = P[sel];
    const cs = new Set(celdasDe(p));
    const actual = celdasDe(p)[pos];
    for (const [k, el] of casillas) {
      if (el.classList.contains("negra")) continue;
      el.classList.toggle("en-palabra", cs.has(k));
      el.classList.toggle("actual", k === actual);
      el.classList.toggle("resuelta", bloqueadas.has(k) && !reveladas.has(k));
      el.classList.toggle("revelada", reveladas.has(k));
      // Fácil: una letra que no es la de la solución se marca en rojo al momento.
      el.classList.toggle("mal-letra", Boolean(d.solucion && letras.get(k) && !bloqueadas.has(k) && d.solucion[k] !== letras.get(k)));
      el.lastChild.textContent = (letras.get(k) ?? "").toUpperCase();
    }
    pista.replaceChildren(h("b", `${p.n} ${p.dir === "h" ? "→" : "↓"}`), h("span", ` ${p.definicion}`), h("small", ` (${p.largo})`));
    cuenta.textContent = `${resueltas.size}/${P.length}`;
    botonPista.disabled = bloqueadas.has(celdasDe(p)[pos]) || resueltas.has(sel);
  }

  elegir(P.findIndex((_, k) => !resueltas.has(k)) >= 0 ? P.findIndex((_, k) => !resueltas.has(k)) : 0);
  return {
    actualizar(e) {
      // El servidor confirma con las palabras resueltas (por si se perdió algo).
      for (const [k, cl] of Object.entries(e.datos?.resueltas ?? {})) if (!resueltas.has(Number(k))) marcarResuelta(Number(k), cl);
      // Letras nuevas de las pistas: se ponen y se comprueban las palabras que pasan por ahí.
      for (const [c, l] of Object.entries(e.datos?.reveladas ?? {})) {
        if (reveladas.has(c)) continue;
        revelar(c, l);
        reiniciarAnim(casillas.get(c), "bien");
        for (const k of palabrasEn.get(c) ?? []) comprobar(k, true);
        const cs = celdasDe(P[sel]);
        if (cs[pos] === c) {
          let i = pos + 1;
          while (i < cs.length && bloqueadas.has(cs[i])) i++;
          if (i < cs.length) pos = i;
        }
      }
      pintar();
    },
  };
}
