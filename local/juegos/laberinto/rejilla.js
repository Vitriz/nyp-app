// Rejilla de operaciones cruzadas (compartida por el móvil y la TV).
import { h } from "../../comun/ui.js";

const OPS = { "+": (a, b) => a + b, "−": (a, b) => a - b, "×": (a, b) => a * b, "÷": (a, b) => (b && a % b === 0 ? a / b : NaN) };

const COLORES_CAMINO = ["#5fb7d0", "#e7a05c", "#6cc49a", "#c58be0", "#e9c75a", "#f08fb5", "#7c9cf0", "#b4c06a", "#e46a62"];

export function crearRejilla({ filas, cols, rejilla, ecs = [] }, { conHuecos = true } = {}) {
  const el = h("div.lab", { style: { gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${filas}, 1fr)`, "--cols": cols, "--filas": filas } });
  const nodos = new Map();
  const info = new Map(rejilla.map((x) => [x.k, x]));
  const bandas = [];
  // Caminos: una banda de color por operación, detrás de las casillas; sus signos van del mismo color.
  ecs.forEach((celdas, n) => {
    const a = info.get(celdas[0]), b = info.get(celdas[celdas.length - 1]);
    if (!a || !b) return;
    const color = COLORES_CAMINO[n % COLORES_CAMINO.length];
    const banda = h(`span.lab-camino.${a.r === b.r ? "horizontal" : "vertical"}`, { style: { "--c": color } });
    banda.style.gridRow = `${Math.min(a.r, b.r) + 1} / ${Math.max(a.r, b.r) + 2}`;
    banda.style.gridColumn = `${Math.min(a.c, b.c) + 1} / ${Math.max(a.c, b.c) + 2}`;
    el.append(banda);
    bandas[n] = banda;
    for (const k of [celdas[1], celdas[3]]) info.get(k) && (info.get(k).color = color);
  });
  for (const x of rejilla) {
    let n;
    if (x.tipo === "num") {
      if (x.texto == null && conHuecos) n = h("button.lab-hueco", { type: "button", "data-k": x.k });
      else n = h(`span.ficha.lab-num${x.hueco ? ".era-hueco" : ""}`, x.texto ?? "");
    } else n = h("span.lab-op", { style: x.color ? { "--c": x.color } : {} }, x.texto);
    n.style.gridRow = x.r + 1;
    n.style.gridColumn = x.c + 1;
    el.append(n);
    nodos.set(x.k, n);
  }
  return {
    el,
    poner(k, v) {
      const n = nodos.get(k);
      n.textContent = v ?? "";
      n.classList.toggle("lleno", v != null);
    },
    /** Colorea las operaciones completas: bien o mal. */
    marcar(ecs, valorDe) {
      for (const n of nodos.values()) n.classList.remove("bien", "mal");
      bandas.forEach((b) => b?.classList.remove("hecha"));
      const bien = new Set();
      ecs.forEach((celdas, i) => {
        const [a, b, c] = [valorDe(celdas[0]), valorDe(celdas[2]), valorDe(celdas[4])];
        if (a == null || b == null || c == null) return;
        const ok = OPS[info.get(celdas[1]).texto]?.(a, b) === c;
        // Cuenta correcta: su camino se pone verde (y sus casillas, aunque compartan con otra que esté mal).
        bandas[i]?.classList.toggle("hecha", ok);
        for (const k of celdas) {
          if (ok) bien.add(k);
          nodos.get(k).classList.remove("mal");
          nodos.get(k).classList.add(ok || bien.has(k) ? "bien" : "mal");
        }
      });
    },
    valorDado(k) {
      const t = info.get(k)?.texto;
      return t == null ? null : Number(t);
    },
  };
}
