// Rejilla de operaciones cruzadas (compartida por el móvil y la TV).
import { h } from "../../comun/ui.js";

const OPS = { "+": (a, b) => a + b, "−": (a, b) => a - b, "×": (a, b) => a * b, "÷": (a, b) => (b && a % b === 0 ? a / b : NaN) };

export function crearRejilla({ filas, cols, rejilla }, { conHuecos = true } = {}) {
  const el = h("div.lab", { style: { gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${filas}, 1fr)`, "--cols": cols, "--filas": filas } });
  const nodos = new Map();
  const info = new Map(rejilla.map((x) => [x.k, x]));
  for (const x of rejilla) {
    let n;
    if (x.tipo === "num") {
      if (x.texto == null && conHuecos) n = h("button.lab-hueco", { type: "button", "data-k": x.k });
      else n = h(`span.ficha.lab-num${x.hueco ? ".era-hueco" : ""}`, x.texto ?? "");
    } else n = h("span.lab-op", x.texto);
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
      for (const celdas of ecs) {
        const [a, b, c] = [valorDe(celdas[0]), valorDe(celdas[2]), valorDe(celdas[4])];
        if (a == null || b == null || c == null) continue;
        const ok = OPS[info.get(celdas[1]).texto]?.(a, b) === c;
        for (const k of celdas) nodos.get(k).classList.add(ok ? "bien" : "mal");
      }
    },
    valorDado(k) {
      const t = info.get(k)?.texto;
      return t == null ? null : Number(t);
    },
  };
}
