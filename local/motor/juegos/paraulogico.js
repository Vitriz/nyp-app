// PARAULÓGICO · 7 letras en panal; la del centro es obligatoria y las letras se pueden repetir.
// Puntos: 3 letras = 1, 4 letras = 2, 5 o más = tantas como letras; usar las 7 letras = +10.
import { clave, formaVisible, pangramasPosibles, palabrasDeConjunto, letrasDeMascara, indiceLetra, mascaraDe } from "../lexico.js";

const RARAS = new Set(["ñ", "x", "k", "w", "q", "j", "z", "y", "h", "v", "f"]);

function puntosDe(c, esTuti) {
  const base = c.length === 3 ? 1 : c.length === 4 ? 2 : c.length;
  return base + (esTuti ? 10 : 0);
}

function generar(azar) {
  const pangramas = pangramasPosibles();
  let mejor = null;
  for (let intento = 0; intento < 60; intento++) {
    const p = azar.elegir(pangramas);
    const letras = letrasDeMascara(p.mascara);
    const centros = azar.barajar(letras.filter((l) => !RARAS.has(l)));
    for (const centro of centros.slice(0, 3)) {
      const { todas, comunes } = palabrasDeConjunto(p.mascara, 1 << indiceLetra(centro));
      const cand = { mascara: p.mascara, letras, centro, todas, comunes };
      if (comunes.length >= 40 && comunes.length <= 450) return cand;
      if (!mejor || Math.abs(comunes.length - 150) < Math.abs(mejor.comunes.length - 150)) mejor = cand;
    }
  }
  return mejor;
}

export default {
  id: "paraulogico",
  nombre: "Tutifruti",
  categoria: "palabras",
  duracion: 120,
  descripcion: "Forma palabras de 3 o más letras con las del panal. La del centro es obligatoria y puedes repetir letras. Cuanto más larga, más puntos; usar las 7 letras da +10.",

  crear({ azar }) {
    const g = generar(azar);
    return {
      centro: g.centro,
      letras: azar.barajar(g.letras.filter((l) => l !== g.centro)),
      mascara: g.mascara,
      validas: new Set(g.todas),
      comunes: g.comunes,
      jugadores: {},
    };
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { encontradas: [], puntos: 0, ultimo: null, intentos: 0 });
  },

  vistaJugador(ronda, id) {
    const j = this.estadoJugador(ronda, id);
    return { centro: ronda.centro, letras: ronda.letras, encontradas: j.encontradas, puntos: j.puntos, ultimo: j.ultimo };
  },

  vistaTV(ronda) {
    return {
      centro: ronda.centro,
      letras: ronda.letras,
      jugadores: Object.fromEntries(Object.entries(ronda.jugadores).map(([id, j]) => [id, { puntos: j.puntos, n: j.encontradas.length }])),
    };
  },

  accion(ronda, id, msg) {
    if (msg.a !== "probar") return false;
    const j = this.estadoJugador(ronda, id);
    const c = clave(String(msg.texto ?? "")).slice(0, 20);
    j.intentos++;
    let motivo = "";
    if (c.length < 3) motivo = "Mínimo 3 letras";
    else if (!c.includes(ronda.centro)) motivo = `Falta la letra central (${ronda.centro.toUpperCase()})`;
    else if ((mascaraDe(c) & ~ronda.mascara) !== 0) motivo = "Usa solo las letras del panal";
    else if (j.encontradas.some((e) => e.clave === c)) motivo = "Ya la tienes";
    else if (!ronda.validas.has(c)) motivo = "No está en el diccionario";
    if (motivo) {
      j.ultimo = { n: j.intentos, ok: false, motivo, palabra: c };
      return true;
    }
    const tuti = mascaraDe(c) === ronda.mascara;
    const pts = puntosDe(c, tuti);
    const forma = formaVisible(c);
    j.encontradas.unshift({ clave: c, forma, pts, tuti });
    j.puntos += pts;
    j.ultimo = { n: j.intentos, ok: true, forma, pts, tuti, palabra: c };
    return true;
  },

  terminado() {
    return false;
  },

  resultados(ronda, ids) {
    return ids.map((id) => {
      const j = ronda.jugadores[id];
      if (!j || !j.encontradas.length) return { id, valor: null, texto: j ? "Ninguna palabra" : "No jugó" };
      const n = j.encontradas.length;
      return { id, valor: j.puntos, texto: `${n} ${n === 1 ? "palabra" : "palabras"} · ${j.puntos} en el panal` };
    });
  },

  resumen(ronda) {
    const tutis = ronda.comunes.filter((c) => mascaraDe(c) === ronda.mascara);
    const largas = [...ronda.comunes].sort((a, b) => b.length - a.length).filter((c) => !tutis.includes(c));
    return {
      centro: ronda.centro,
      letras: ronda.letras,
      total: ronda.comunes.length,
      tutis: tutis.slice(0, 6).map(formaVisible),
      largas: largas.slice(0, 6).map(formaVisible),
    };
  },
};
