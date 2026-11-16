// Parcelas · móvil: arrastra de una esquina a la otra para dibujar un rectángulo (se ve mientras
// arrastras). Las parcelas ya puestas no se pueden pisar. Sobre una parcela: doble toque la borra,
// arrastrar desde una esquina la mueve (cambia su tamaño) y arrastrar desde más al centro dibuja
// una nueva desde ese punto (en lugar de la que había).
import { h, botonMantener, confeti } from "../../comun/ui.js";
import { seguirDedo, avisoBreve } from "../comun/trazo.js";
import { crearTablero, insignia } from "./rejilla.js";
import { dosLados, lados } from "../comun/lados.js";

export function montar(cuerpo, e, ctx) {
  const d = e.datos;
  const n = d.n;
  let rects = (d.rects ?? []).map((x) => [...x]);
  let acabado = Boolean(d.resuelto);
  const historia = [];

  const tablero = crearTablero(d);
  const aviso = h("div.pl-aviso.suave", "Arrastra para dibujar · doble toque para borrar");
  const decir = avisoBreve(aviso);
  const cuenta = h("b", "");
  const deshacer = h("button.boton.suave", { type: "button", onclick: () => historia.length && cambiar(historia.pop(), false) }, "↶ Deshacer");
  const borrar = botonMantener("Borrar todo", () => cambiar([]), { clase: ".suave", ms: 600 });
  // Pistas (solo): ponen una pieza de la solución. quedanPistas: null si no hay (Batalla).
  let quedanPistas = d.quedanPistas ?? null;
  let pistasVistas = (d.ayudas ?? []).length;
  const pista = h("button.boton.suave", { type: "button", onclick: () => !acabado && quedanPistas && ctx.enviar({ a: "pista" }) });
  const pintarPista = () => {
    pista.textContent = `💡 Pista · ${quedanPistas}`;
    pista.disabled = acabado || !quedanPistas;
  };

  const leyenda = h(
    "div.pc-leyenda",
    [["cuadrado", "Cuadrado"], ["alto", "Alto"], ["ancho", "Ancho"], ["cualquiera", "Cualquiera"]].map(([f, t]) => h("span", insignia(f, null, "#8fb4ff"), t)),
    h("small", "Con número: ese es su tamaño en casillas.")
  );
  cuerpo.append(
    lados(
      h(
        "div.pc-pantalla",
        h("div.puzle-datos", h("span", "Rectángulos bien ", cuenta)),
        h("div.puzle-zona", tablero.el),
        aviso,
        h("div.puzle-botones", deshacer, borrar, quedanPistas != null ? pista : null),
        leyenda
      )
    )
  );

  function pintar() {
    tablero.pintar(rects);
    const bien = rects.filter((x) => tablero.valida(x) >= 0).length;
    cuenta.textContent = `${bien}/${d.pistas.length}`;
    deshacer.disabled = acabado || !historia.length;
    tablero.el.classList.toggle("completo", acabado);
    if (quedanPistas != null) pintarPista();
    return bien;
  }

  const cubiertas = () => {
    const c = new Uint8Array(n * n);
    for (const [r, cc, alto, ancho] of rects) for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) c[(r + y) * n + cc + x] = 1;
    return c.every(Boolean);
  };

  function cambiar(nuevo, guardar = true) {
    if (acabado) return;
    if (guardar) historia.push(rects);
    rects = nuevo;
    const bien = pintar();
    ctx.enviar({ a: "parcelas", p: rects });
    if (bien === d.pistas.length && rects.length === d.pistas.length && cubiertas()) {
      acabado = true;
      pintar();
      navigator.vibrate?.([30, 50, 90]);
      confeti?.();
      decir("¡Resuelto!", "bien", 0);
    }
  }

  const rectDe = (a, b) => {
    const ra = Math.floor(a / n), ca = a % n, rb = Math.floor(b / n), cb = b % n;
    return [Math.min(ra, rb), Math.min(ca, cb), Math.abs(ra - rb) + 1, Math.abs(ca - cb) + 1];
  };
  const dentro = ([r, c, alto, ancho], k) => {
    const y = Math.floor(k / n), x = k % n;
    return y >= r && y < r + alto && x >= c && x < c + ancho;
  };
  const pisan = (a, b) => !(a[0] + a[2] <= b[0] || b[0] + b[2] <= a[0] || a[1] + a[3] <= b[1] || b[1] + b[3] <= a[1]);

  // Lo que se está haciendo con el dedo: dibujar una nueva o mover la esquina de una (sin la de debajo).
  let desde = -1, actual = null, quitar = -1, choca = false;
  let ultimoToque = { i: -1, t: 0 }; // para el doble toque
  const esquinaDe = ([r, c, alto, ancho], k) => {
    const y = Math.floor(k / n), x = k % n;
    const arriba = y === r, abajo = y === r + alto - 1, izq = x === c, der = x === c + ancho - 1;
    if (!((arriba || abajo) && (izq || der))) return -1;
    // La esquina contraria queda fija.
    return (arriba && alto > 1 ? r + alto - 1 : r) * n + (izq && ancho > 1 ? c + ancho - 1 : c);
  };
  const otras = () => rects.filter((_, j) => j !== quitar);
  seguirDedo(tablero.el, n, n, {
    empezar(k) {
      if (acabado) return false;
      quitar = rects.findIndex((x) => dentro(x, k));
      desde = k;
      if (quitar >= 0) {
        const fija = esquinaDe(rects[quitar], k);
        // Desde una esquina: la contraria se queda quieta y esta se mueve con el dedo.
        if (fija >= 0 && (rects[quitar][2] > 1 || rects[quitar][3] > 1)) desde = fija;
      }
      actual = rectDe(desde, k);
      choca = false;
      return true;
    },
    mover(k) {
      // Al moverse, la parcela de debajo deja de verse (se está rehaciendo).
      if (quitar >= 0) tablero.pintar(otras());
      actual = rectDe(desde, k);
      choca = otras().some((x) => pisan(x, actual));
      tablero.previa(actual, { choca });
      navigator.vibrate?.(2);
    },
    soltar(k, seMovio, ms) {
      tablero.previa(null);
      if (!seMovio) {
        tablero.pintar(rects);
        if (ms > 450) return; // dedo quieto un rato: nada
        if (quitar >= 0) {
          // Doble toque en la misma parcela: se borra.
          const ahora = Date.now();
          if (ultimoToque.i === quitar && ahora - ultimoToque.t < 400) {
            ultimoToque = { i: -1, t: 0 };
            navigator.vibrate?.(6);
            return cambiar(rects.filter((_, j) => j !== quitar));
          }
          ultimoToque = { i: quitar, t: ahora };
          return;
        }
        // Un toque en una casilla libre: una parcela de 1×1.
        actual = rectDe(k, k);
        choca = false;
      }
      if (choca) {
        pintar();
        navigator.vibrate?.(20);
        return decir("No puede pisar otra parcela", "mal");
      }
      const nuevo = actual;
      navigator.vibrate?.(tablero.valida(nuevo) >= 0 ? [10, 30, 10] : 8);
      cambiar([...otras(), nuevo]);
      if (tablero.valida(nuevo) < 0 && !acabado) decir("Ese rectángulo no cumple su pista (o tiene más de una)", "mal");
    },
    cancelar() {
      tablero.previa(null);
      pintar();
    },
  });

  pintar();
  return {
    actualizar(e) {
      if (e.datos?.quedanPistas != null) quedanPistas = e.datos.quedanPistas;
      // Una pista nueva: el servidor ya dibujó el rectángulo bueno; se toman sus rectángulos.
      if ((e.datos?.ayudas ?? []).length > pistasVistas) {
        pistasVistas = e.datos.ayudas.length;
        cambiar(e.datos.rects.map((x) => [...x]));
        decir("💡 Ahí va un rectángulo", "bien", 1400);
      }
      pintar();
      if (e.datos?.resuelto && !acabado) {
        acabado = true;
        pintar();
      }
    },
    desmontar() {},
  };
}
