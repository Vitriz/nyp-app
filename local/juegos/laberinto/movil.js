// Laberinto de cálculos · móvil: toca un número del banco y luego el hueco donde va.
import { h, botonMantener } from "../../comun/ui.js";
import { crearRejilla } from "./rejilla.js";

export function montar(cuerpo, e, ctx) {
  const d = e.datos;
  const rejilla = crearRejilla(d);
  const huecos = new Set(d.rejilla.filter((x) => x.tipo === "num" && x.texto == null).map((x) => x.k));
  // puestos: hueco -> índice del banco
  const puestos = new Map();
  let elegido = null;

  // Si volvemos a entrar, recolocamos lo que el servidor recuerda.
  const usados = new Set();
  for (const [k, v] of Object.entries(d.puestos ?? {})) {
    const i = d.banco.findIndex((x, idx) => x === v && !usados.has(idx));
    if (i >= 0) {
      usados.add(i);
      puestos.set(k, i);
    }
  }

  const aviso = h("div.pl-aviso.suave", "Toca un número y luego su hueco");
  const banco = h("div.lab-banco");
  const contador = h("span.ficha", "0");
  const total = d.ecs.filter((celdas) => [celdas[0], celdas[2], celdas[4]].some((k) => huecos.has(k))).length;
  const vaciar = botonMantener("Quitar todos", () => {
    puestos.clear();
    elegido = null;
    cambio();
  }, { clase: ".suave", ms: 700 });

  cuerpo.append(
    h(
      "div.lab-movil",
      h("div.mf-cont", "Correctas", contador, h("span.suave", `de ${total}`)),
      h("div.lab-caja", rejilla.el),
      aviso,
      banco,
      vaciar
    )
  );

  function valorDe(k) {
    if (huecos.has(k)) return puestos.has(k) ? d.banco[puestos.get(k)] : null;
    return rejilla.valorDado(k);
  }

  function pintar() {
    for (const k of huecos) rejilla.poner(k, puestos.has(k) ? d.banco[puestos.get(k)] : null);
    const enUso = new Set(puestos.values());
    banco.replaceChildren(
      ...d.banco.map((v, i) =>
        h(`button.ficha.lab-ficha${enUso.has(i) ? ".usada" : ""}${i === elegido ? ".elegida" : ""}`, { type: "button", "data-i": i }, String(v))
      )
    );
    rejilla.marcar(d.ecs, valorDe);
    const ok = rejilla.el.querySelectorAll(".lab-op.bien").length; // cada operación correcta tiene 2 símbolos (op e =)
    contador.textContent = Math.round(ok / 2);
  }

  function cambio() {
    pintar();
    ctx.enviar({ a: "colocar", puestos: Object.fromEntries([...puestos].map(([k, i]) => [k, d.banco[i]])) });
  }

  banco.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest(".lab-ficha");
    if (!b) return;
    ev.preventDefault();
    const i = Number(b.dataset.i);
    // Si ya está puesto, lo devolvemos al banco.
    for (const [k, idx] of puestos) if (idx === i) puestos.delete(k);
    elegido = elegido === i ? null : i;
    navigator.vibrate?.(8);
    cambio();
  });

  rejilla.el.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest(".lab-hueco");
    if (!b) return;
    ev.preventDefault();
    const k = b.dataset.k;
    if (elegido != null) {
      puestos.set(k, elegido);
      elegido = null;
      aviso.textContent = "";
    } else if (puestos.has(k)) {
      puestos.delete(k); // tocar un hueco lleno lo vacía
    } else {
      aviso.textContent = "Primero elige un número de abajo";
      return;
    }
    navigator.vibrate?.(10);
    cambio();
  });

  pintar();
  return { actualizar() {} };
}
