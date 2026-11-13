// Parcelas · móvil: arrastra de una esquina a la otra para dibujar un rectángulo (se ve mientras
// arrastras). Si pisa a otros, los sustituye. Tocar un rectángulo lo borra.
import { h, botonMantener, confeti } from "../../comun/ui.js";
import { seguirDedo, avisoBreve } from "../comun/trazo.js";
import { crearTablero, iconoForma } from "./rejilla.js";

export function montar(cuerpo, e, ctx) {
  const d = e.datos;
  const n = d.n;
  let rects = (d.rects ?? []).map((x) => [...x]);
  let acabado = Boolean(d.resuelto);
  const historia = [];

  const tablero = crearTablero(d);
  const aviso = h("div.pl-aviso.suave", "Arrastra para dibujar rectángulos");
  const decir = avisoBreve(aviso);
  const cuenta = h("b", "");
  const deshacer = h("button.boton.suave", { type: "button", onclick: () => historia.length && cambiar(historia.pop(), false) }, "↶ Deshacer");
  const borrar = botonMantener("Borrar todo", () => cambiar([]), { clase: ".suave", ms: 600 });
  const leyenda = h(
    "div.pc-leyenda",
    [["cuadrado", "Cuadrado"], ["alto", "Alto"], ["ancho", "Ancho"], ["cualquiera", "Cualquiera"]].map(([f, t]) => h("span", iconoForma(f), t)),
    h("small", "Con número: ese es su tamaño en casillas.")
  );
  cuerpo.append(
    h(
      "div.pc-pantalla",
      h("div.puzle-datos", h("span", "Rectángulos bien ", cuenta)),
      h("div.puzle-zona", tablero.el),
      aviso,
      h("div.puzle-botones", deshacer, borrar),
      leyenda
    )
  );

  function pintar() {
    tablero.pintar(rects);
    const bien = rects.filter((x) => tablero.valida(x) >= 0).length;
    cuenta.textContent = `${bien}/${d.pistas.length}`;
    deshacer.disabled = acabado || !historia.length;
    tablero.el.classList.toggle("completo", acabado);
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

  let desde = -1, actual = null;
  seguirDedo(tablero.el, n, n, {
    empezar(k) {
      if (acabado) return false;
      desde = k;
      actual = rectDe(k, k);
      return true;
    },
    mover(k) {
      actual = rectDe(desde, k);
      tablero.previa(actual);
      navigator.vibrate?.(2);
    },
    soltar(k, seMovio) {
      tablero.previa(null);
      if (!seMovio) {
        // Un toque: si hay un rectángulo, se borra; si no, se pone uno de 1×1.
        const i = rects.findIndex((x) => dentro(x, desde));
        if (i >= 0) {
          navigator.vibrate?.(6);
          return cambiar(rects.filter((_, j) => j !== i));
        }
      }
      const nuevo = actual;
      navigator.vibrate?.(tablero.valida(nuevo) >= 0 ? [10, 30, 10] : 8);
      cambiar([...rects.filter((x) => !pisan(x, nuevo)), nuevo]);
      if (tablero.valida(nuevo) < 0 && !acabado) decir("Ese rectángulo no cumple su pista (o tiene más de una)", "mal");
    },
    cancelar() {
      tablero.previa(null);
    },
  });

  pintar();
  return {
    actualizar(e) {
      if (e.datos?.resuelto && !acabado) {
        acabado = true;
        pintar();
      }
    },
    desmontar() {},
  };
}
