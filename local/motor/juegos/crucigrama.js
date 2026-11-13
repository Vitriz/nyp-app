// CRUCIGRAMA · se elige un ámbito (Medicina, Marina, Música…) o al azar, y se juega un crucigrama
// hecho solo con palabras de ese ámbito. Aquí las definiciones pueden ser largas.
// Todos reciben el mismo crucigrama. Gana quien resuelva más palabras (si empatan, quien acabó antes).
import { cargarCrucigrama, clave } from "../lexico.js";
import { huella, nivelDificultad } from "../util.js";

export const AMBITOS = [
  "Anatomía", "Arquitectura", "Astronomía", "Biología", "Botánica", "Cinegética", "Comercio", "Construcción",
  "Deportes", "Derecho", "Economía", "Equitación", "Esgrima", "Filosofía", "Física", "Geografía", "Geología",
  "Gramática", "Heráldica", "Imprenta", "Informática", "Ingeniería", "Lingüística", "Marina", "Matemáticas",
  "Mecánica", "Medicina", "Milicia", "Música", "Pintura", "Psicología", "Química", "Religión", "Tauromaquia", "Zoología",
];

// Según el nivel: cuántas palabras, tamaño máximo, largo máximo de la definición (en palabras)
// y si se prefieren palabras comunes. En fácil caben definiciones más largas (explican más).
const NIVELES = [
  { n: 8, tam: 11, maxPalabras: 40, comunes: true },
  { n: 10, tam: 13, maxPalabras: 28, comunes: true },
  { n: 12, tam: 15, maxPalabras: 18, comunes: false },
];

/** Coloca palabras cruzadas: cada nueva comparte al menos una letra con las que ya están. */
function montar(azar, entradas, objetivo, tam) {
  let mejor = null;
  for (let intento = 0; intento < 14; intento++) {
    const lista = azar.barajar([...entradas]).slice(0, 400);
    // Empieza por una larga (da más cruces).
    lista.sort((a, b) => (b.clave.length >= 7) - (a.clave.length >= 7));
    const celdas = new Map(); // "r,c" -> { l, h: bool, v: bool }
    const puestas = [];
    const usadas = new Set();
    const caja = { r0: 0, r1: 0, c0: 0, c1: 0 };
    const cel = (r, c) => celdas.get(`${r},${c}`);

    const encaja = (p, r, c, dir) => {
      const dr = dir === "v" ? 1 : 0, dc = dir === "h" ? 1 : 0;
      const L = p.clave.length;
      if (cel(r - dr, c - dc) || cel(r + dr * L, c + dc * L)) return -1; // nada pegado delante ni detrás
      let cruces = 0;
      for (let i = 0; i < L; i++) {
        const rr = r + dr * i, cc = c + dc * i;
        const x = cel(rr, cc);
        if (x) {
          if (x.l !== p.clave[i] || x[dir]) return -1;
          cruces++;
        } else if (cel(rr + dc, cc + dr) || cel(rr - dc, cc - dr)) return -1; // nada pegado a los lados
      }
      const r0 = Math.min(caja.r0, r), r1 = Math.max(caja.r1, r + dr * (L - 1));
      const c0 = Math.min(caja.c0, c), c1 = Math.max(caja.c1, c + dc * (L - 1));
      if (r1 - r0 + 1 > tam || c1 - c0 + 1 > tam) return -1;
      return cruces;
    };
    const poner = (p, r, c, dir) => {
      const dr = dir === "v" ? 1 : 0, dc = dir === "h" ? 1 : 0;
      for (let i = 0; i < p.clave.length; i++) {
        const k = `${r + dr * i},${c + dc * i}`;
        const x = celdas.get(k) ?? { l: p.clave[i] };
        x[dir] = true;
        celdas.set(k, x);
      }
      caja.r0 = Math.min(caja.r0, r);
      caja.r1 = Math.max(caja.r1, r + dr * (p.clave.length - 1));
      caja.c0 = Math.min(caja.c0, c);
      caja.c1 = Math.max(caja.c1, c + dc * (p.clave.length - 1));
      puestas.push({ ...p, r, c, dir });
      usadas.add(p.clave);
    };

    const primera = lista.find((p) => p.clave.length <= tam);
    if (!primera) return null;
    poner(primera, 0, 0, "h");
    for (const p of lista) {
      if (puestas.length >= objetivo) break;
      if (usadas.has(p.clave)) continue;
      let sitio = null, puntos = 0;
      for (const q of puestas) {
        for (let i = 0; i < q.clave.length; i++) {
          for (let j = 0; j < p.clave.length; j++) {
            if (q.clave[i] !== p.clave[j]) continue;
            const dir = q.dir === "h" ? "v" : "h";
            const qr = q.r + (q.dir === "v" ? i : 0), qc = q.c + (q.dir === "h" ? i : 0);
            const r = dir === "v" ? qr - j : qr, c = dir === "h" ? qc - j : qc;
            const cruces = encaja(p, r, c, dir);
            if (cruces < 1) continue;
            const v = cruces * 10 + azar();
            if (v > puntos) {
              puntos = v;
              sitio = [r, c, dir];
            }
          }
        }
      }
      if (sitio) poner(p, ...sitio);
    }
    if (!mejor || puestas.length > mejor.puestas.length) mejor = { puestas, caja: { ...caja } };
    if (puestas.length >= objetivo) break;
  }
  return mejor;
}

/** Numera como en los crucigramas de papel: por filas, de izquierda a derecha. */
function numerar(puestas, caja) {
  const palabras = puestas.map((p) => ({ ...p, r: p.r - caja.r0, c: p.c - caja.c0 }));
  const inicios = [...new Set(palabras.map((p) => `${p.r},${p.c}`))].sort((a, b) => {
    const [ra, ca] = a.split(",").map(Number), [rb, cb] = b.split(",").map(Number);
    return ra - rb || ca - cb;
  });
  const numero = new Map(inicios.map((k, i) => [k, i + 1]));
  for (const p of palabras) p.n = numero.get(`${p.r},${p.c}`);
  return palabras.sort((a, b) => a.n - b.n || (a.dir === "h" ? -1 : 1));
}

export default {
  id: "crucigrama",
  nombre: "Crucigrama",
  categoria: "palabras",
  duracion: 0, // sin límite
  breve: "Un crucigrama con palabras del tema que elijas.",
  descripcion: "Elige un tema (Medicina, Marina, Música…) o al azar y resuelve el crucigrama. Toca una casilla para elegir la palabra y escríbela. Gana quien resuelva más palabras.",
  ambitos: AMBITOS,

  crear({ azar, config, inicio = Date.now() }) {
    const d = nivelDificultad(config);
    const nivel = NIVELES[d + 1];
    const todo = cargarCrucigrama();
    const conDatos = AMBITOS.filter((a) => (todo[a]?.length ?? 0) >= 30);
    const ambito = conDatos.includes(config?.ambito) ? config.ambito : azar.elegir(conDatos.filter((a) => todo[a].length >= 80));
    let entradas = (todo[ambito] ?? [])
      .map(([c, forma, niv, definicion]) => ({ clave: c, forma, nivel: niv, definicion, palabras: definicion.split(/\s+/).length }))
      .filter((x) => x.clave.length <= nivel.tam && x.palabras <= nivel.maxPalabras);
    if (nivel.comunes) {
      const comunes = entradas.filter((x) => x.nivel <= 2);
      if (comunes.length >= nivel.n * 4) entradas = comunes;
    }
    const m = montar(azar, entradas, nivel.n, nivel.tam);
    const palabras = m ? numerar(m.puestas, m.caja) : [];
    return {
      ambito,
      inicio,
      filas: m ? m.caja.r1 - m.caja.r0 + 1 : 1,
      cols: m ? m.caja.c1 - m.caja.c0 + 1 : 1,
      palabras: palabras.map(({ n, dir, r, c, clave: cl, forma, definicion }) => ({ n, dir, r, c, clave: cl, forma, definicion })),
      jugadores: {},
    };
  },

  estadoJugador(ronda, id) {
    return (ronda.jugadores[id] ??= { resueltas: {}, ultimo: 0 });
  },

  vistaJugador(ronda, id) {
    const j = this.estadoJugador(ronda, id);
    return {
      ambito: ronda.ambito,
      filas: ronda.filas,
      cols: ronda.cols,
      // Sin la solución: solo su huella, para comprobar al momento en el móvil.
      palabras: ronda.palabras.map((p) => ({ n: p.n, dir: p.dir, r: p.r, c: p.c, largo: p.clave.length, definicion: p.definicion, h: huella(p.clave) })),
      resueltas: Object.fromEntries(Object.keys(j.resueltas).map((k) => [k, ronda.palabras[k].clave])),
    };
  },

  vistaTV(ronda) {
    return {
      ambito: ronda.ambito,
      filas: ronda.filas,
      cols: ronda.cols,
      palabras: ronda.palabras.map((p) => ({ n: p.n, dir: p.dir, r: p.r, c: p.c, largo: p.clave.length })),
      total: ronda.palabras.length,
      jugadores: Object.fromEntries(Object.entries(ronda.jugadores).map(([id, j]) => [id, Object.keys(j.resueltas).length])),
    };
  },

  accion(ronda, id, msg) {
    if (msg.a !== "respuesta") return false;
    const j = this.estadoJugador(ronda, id);
    const k = Number(msg.k);
    const p = ronda.palabras[k];
    if (!p || j.resueltas[k] || clave(String(msg.texto ?? "")) !== p.clave) return false;
    j.resueltas[k] = true;
    j.ultimo = Math.max(0, Date.now() - ronda.inicio);
    return true;
  },

  terminado(ronda, id) {
    const j = ronda.jugadores[id];
    return Boolean(j) && Object.keys(j.resueltas).length === ronda.palabras.length;
  },

  resultados(ronda, ids) {
    const total = ronda.palabras.length;
    return ids.map((id) => {
      const j = ronda.jugadores[id];
      if (!j) return { id, valor: null, texto: "No jugó" };
      const n = Object.keys(j.resueltas).length;
      const detalle = ronda.palabras.map((p, k) => ({ t: p.forma, k: j.resueltas[k] ? "bien" : "mal" }));
      const tiempo = n === total ? ` · ${(j.ultimo / 1000).toFixed(1).replace(".", ",")} s` : "";
      return { id, valor: n ? n * 1e7 - j.ultimo : null, texto: `${n} de ${total} palabras${tiempo}`, corto: `${n}/${total}${tiempo}`, detalle };
    });
  },

  resumen(ronda) {
    return {
      ambito: ronda.ambito,
      filas: ronda.filas,
      cols: ronda.cols,
      palabras: ronda.palabras.map(({ n, dir, r, c, forma, clave: cl, definicion }) => ({ n, dir, r, c, forma, clave: cl, definicion })),
    };
  },
};
