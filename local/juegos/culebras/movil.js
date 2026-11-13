// Culebras · móvil: arrastra el dedo de letra en letra (sin diagonales) desde la primera letra de una
// palabra hasta la última. Volver a la casilla anterior deshace el último paso. Al soltar se comprueba.
import { h, confeti } from "../../comun/ui.js";
import { seguirDedo, avisoBreve } from "../comun/trazo.js";
import { crearTablero, COLORES } from "./rejilla.js";

export function montar(cuerpo, e, ctx) {
  let d = e.datos;
  const n = d.n;
  const tablero = crearTablero(d);
  const aviso = h("div.pl-aviso.suave", "Arrastra de la primera letra a la última");
  const decir = avisoBreve(aviso);
  const lista = h("div.cul-lista");
  const elegida = h("div.cul-elegida");
  const largos = [...new Set(d.largos)];
  const info = h("p.cul-info", `Encuentra las ${d.largos.length} palabras escondidas. Tienen ${listaY(largos)} letras.`);
  cuerpo.append(h("div.cul-pantalla", h("div.puzle-zona", tablero.el), elegida, aviso, lista, info));

  let trazo = [];
  let vistoUltimo = d.ultimo?.n ?? 0;
  const hechas = () => d.encontradas.map((x) => ({ celdas: x.celdas, color: COLORES[x.i % COLORES.length] }));
  const ocupadas = () => new Set(d.encontradas.flatMap((x) => x.celdas));

  function pintar() {
    tablero.pintar(hechas(), trazo);
    elegida.textContent = trazo.map((k) => d.letras[k]).join("").toUpperCase();
    elegida.classList.toggle("vacia", !trazo.length);
    // La lista: casillas en blanco por palabra; las encontradas, con sus letras y su color.
    const porI = new Map(d.encontradas.map((x) => [x.i, x]));
    lista.replaceChildren(
      ...d.largos.map((l, i) => {
        const x = porI.get(i);
        return h(
          `div.cul-palabra${x ? ".hallada" : ""}`,
          { style: { "--c": COLORES[i % COLORES.length] } },
          Array.from({ length: l }, (_, j) => h("span", x ? x.clave[j].toUpperCase() : "")),
          x ? h("i", "✓") : null
        );
      })
    );
  }

  const ady = (a, b) => (Math.abs(a - b) === 1 && Math.floor(a / n) === Math.floor(b / n)) || Math.abs(a - b) === n;

  seguirDedo(tablero.el, n, n, {
    empezar(k) {
      if (d.resuelto || !d.letras[k] || ocupadas().has(k)) return false;
      trazo = [k];
      navigator.vibrate?.(4);
      pintar();
      return true;
    },
    mover(k) {
      const i = trazo.indexOf(k);
      if (i >= 0) {
        // Volver atrás por el mismo camino.
        if (i < trazo.length - 1) {
          trazo = trazo.slice(0, i + 1);
          pintar();
        }
        return;
      }
      if (!d.letras[k] || ocupadas().has(k) || !ady(trazo[trazo.length - 1], k)) return;
      trazo.push(k);
      navigator.vibrate?.(3);
      pintar();
    },
    soltar() {
      const c = trazo;
      trazo = [];
      pintar();
      if (c.length >= 2) ctx.enviar({ a: "palabra", c });
    },
    cancelar() {
      trazo = [];
      pintar();
    },
  });

  function actualizar(e) {
    d = e.datos;
    const u = d.ultimo;
    if (u && u.n !== vistoUltimo) {
      vistoUltimo = u.n;
      const p = u.clave.toUpperCase();
      if (u.res === "bien") {
        navigator.vibrate?.([10, 30, 20]);
        decir(d.resuelto ? "¡Todas encontradas!" : `✔ ${p}`, "bien", d.resuelto ? 0 : 1600);
        if (d.resuelto) confeti?.();
      } else if (u.res === "camino") decir(`${p} está, pero va por otras casillas`, "mal", 2200);
      else if (u.res === "repetida") decir(`${p} ya la tienes`, "suave");
      else {
        navigator.vibrate?.([20, 30, 20]);
        decir(`${p} no es ninguna de las escondidas`, "mal");
      }
    }
    pintar();
  }

  pintar();
  return { actualizar, desmontar() {} };
}

function listaY(l) {
  const t = [...l].sort((a, b) => a - b).map(String);
  return t.length > 1 ? `${t.slice(0, -1).join(", ")} y ${t[t.length - 1]}` : t[0] ?? "";
}
