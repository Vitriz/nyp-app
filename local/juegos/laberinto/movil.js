// Laberinto de cálculos · móvil: toca un número del banco y luego el hueco donde va.
import { h, botonMantener } from "../../comun/ui.js";
import { crearRejilla } from "./rejilla.js";
import { dosLados, lados } from "../comun/lados.js";

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

  // Ayudas según el nivel: en fácil se marca cada casilla mal puesta; en normal y difícil solo si la cuenta
  // cuadra (y los números se pueden seguir moviendo: quizá van en otro orden).
  // En difícil, ninguna ayuda: ni colores ni cuentas que cuadran (solo cuántos números llevas puestos).
  const solucion = d.solucion ?? null;
  const sinAyudas = (d.nivel ?? 0) > 0;
  const aviso = h("div.pl-aviso.suave", "Arrastra cada número a su hueco");
  const banco = h("div.lab-banco");
  const contador = h("span.ficha", "0");
  const total = d.ecs.filter((celdas) => [celdas[0], celdas[2], celdas[4]].some((k) => huecos.has(k))).length;
  const vaciar = botonMantener("Quitar todos", () => {
    puestos.clear();
    elegido = null;
    cambio();
  }, { clase: ".suave", ms: 700 });

  cuerpo.append(
    lados(
      h(
        "div.lab-movil",
        h("div.mf-cont", sinAyudas ? "Puestos" : solucion ? "Correctas" : "Cuadran", contador, h("span.suave", `de ${sinAyudas ? huecos.size : total}`)),
        h("div.lab-caja", rejilla.el),
        aviso,
        banco,
        vaciar
      ),
      ".mf-cont",
      aviso
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
    if (sinAyudas) {
      contador.textContent = puestos.size;
      return;
    }
    const ok = solucion ? rejilla.marcarExacto(d.ecs, valorDe, solucion) : rejilla.marcar(d.ecs, valorDe);
    contador.textContent = ok;
    // Todo cuadra pero no es la solución (p. ej. 2 + 3 = 5 donde iba 1 + 4): aún no está resuelto.
    const lleno = [...huecos].every((k) => puestos.has(k));
    if (!solucion && lleno && ok === total) aviso.textContent = "Todas las cuentas cuadran, pero algún número va en otro sitio";
    else if (aviso.textContent.startsWith("Todas las cuentas")) aviso.textContent = "";
  }

  function cambio() {
    pintar();
    ctx.enviar({ a: "colocar", puestos: Object.fromEntries([...puestos].map(([k, i]) => [k, d.banco[i]])) });
  }

  // Tocar: elige un número y luego toca su hueco. Arrastrar: llévalo directamente al hueco
  // (o de un hueco a otro; si lo sueltas fuera, vuelve al banco).
  function tocarBanco(i) {
    for (const [k, idx] of puestos) if (idx === i) puestos.delete(k); // si ya estaba puesto, vuelve al banco
    elegido = elegido === i ? null : i;
    navigator.vibrate?.(8);
    cambio();
  }

  function tocarHueco(k) {
    if (elegido != null) {
      for (const [k2, idx] of puestos) if (idx === elegido) puestos.delete(k2);
      puestos.set(k, elegido);
      elegido = null;
      aviso.textContent = "";
    } else if (puestos.has(k)) {
      puestos.delete(k); // tocar un hueco lleno lo vacía
    } else {
      aviso.textContent = "Arrastra un número de abajo a su hueco (o tócalo y luego el hueco)";
      return;
    }
    navigator.vibrate?.(10);
    cambio();
  }

  let arrastre = null; // { i, desde: hueco|null, x, y, fantasma, sobre }
  function empezar(ev, i, desde) {
    ev.preventDefault();
    arrastre = { i, desde, x: ev.clientX, y: ev.clientY, fantasma: null, sobre: null, id: ev.pointerId };
  }
  function huecoEn(x, y) {
    return document.elementFromPoint(x, y)?.closest(".lab-hueco") ?? null;
  }
  const mover = (ev) => {
    if (!arrastre || ev.pointerId !== arrastre.id) return;
    if (!arrastre.fantasma) {
      if (Math.hypot(ev.clientX - arrastre.x, ev.clientY - arrastre.y) < 8) return;
      // Empieza el arrastre: una ficha flotante sigue al dedo.
      const origen = arrastre.desde ? rejilla.el.querySelector(`[data-k="${arrastre.desde}"]`) : banco.querySelector(`[data-i="${arrastre.i}"]`);
      const r = origen.getBoundingClientRect();
      arrastre.fantasma = h("span.ficha.lab-fantasma", { style: { width: `${r.width}px`, height: `${r.height}px`, fontSize: getComputedStyle(origen).fontSize } }, String(d.banco[arrastre.i]));
      document.body.append(arrastre.fantasma);
      elegido = null;
      navigator.vibrate?.(8);
    }
    arrastre.fantasma.style.left = `${ev.clientX}px`;
    arrastre.fantasma.style.top = `${ev.clientY}px`;
    const sobre = huecoEn(ev.clientX, ev.clientY);
    if (sobre !== arrastre.sobre) {
      arrastre.sobre?.classList.remove("sobre");
      sobre?.classList.add("sobre");
      arrastre.sobre = sobre;
    }
  };
  window.addEventListener("pointermove", mover);
  const soltar = (ev) => {
    if (!arrastre || ev.pointerId !== arrastre.id) return;
    const a = arrastre;
    arrastre = null;
    if (!a.fantasma) return a.desde ? tocarHueco(a.desde) : tocarBanco(a.i); // no se movió: es un toque
    a.fantasma.remove();
    a.sobre?.classList.remove("sobre");
    for (const [k, idx] of puestos) if (idx === a.i) puestos.delete(k);
    const destino = ev.type === "pointerup" ? huecoEn(ev.clientX, ev.clientY) : null;
    if (destino) {
      puestos.set(destino.dataset.k, a.i); // si había otro número, ese vuelve al banco
      aviso.textContent = "";
      navigator.vibrate?.(12);
    }
    cambio();
  };
  window.addEventListener("pointerup", soltar);
  window.addEventListener("pointercancel", soltar);

  banco.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest(".lab-ficha");
    if (b) empezar(ev, Number(b.dataset.i), null);
  });
  rejilla.el.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest(".lab-hueco");
    if (!b) return;
    const k = b.dataset.k;
    if (puestos.has(k) && elegido == null) empezar(ev, puestos.get(k), k); // arrastrar desde un hueco lleno
    else {
      ev.preventDefault();
      tocarHueco(k);
    }
  });

  pintar();
  return {
    actualizar() {},
    desmontar() {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      arrastre?.fantasma?.remove();
    },
  };
}
