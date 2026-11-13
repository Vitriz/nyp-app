// Código QR (para unirse a una Batalla). Generador pequeño: modo byte, corrección de errores M,
// versiones 1 a 6 (hasta 106 caracteres: de sobra para una dirección con el código de sala).
// Devuelve una matriz de módulos (true = negro) o un SVG listo para pintar.

// ------------------------------------------------------------------ Reed-Solomon en GF(256)
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function generador(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const r = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      r[j] ^= g[j];
      r[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = r;
  }
  return g;
}

function correccion(datos, n) {
  const g = generador(n);
  const r = [...datos, ...new Array(n).fill(0)];
  for (let i = 0; i < datos.length; i++) {
    const c = r[i];
    if (c) for (let j = 0; j < g.length; j++) r[i + j] ^= mul(g[j], c);
  }
  return r.slice(datos.length);
}

// ------------------------------------------------------------------ tablas (nivel M)
// versión: [codewords de datos, codewords de corrección por bloque, bloques, alineación]
const VERSIONES = {
  1: [16, 10, 1, []],
  2: [28, 16, 1, [6, 18]],
  3: [44, 26, 1, [6, 22]],
  4: [64, 18, 2, [6, 26]],
  5: [86, 24, 2, [6, 30]],
  6: [108, 16, 4, [6, 34]],
};

/** Matriz QR del texto (true = módulo negro). */
export function matrizQR(texto) {
  const bytes = [...new TextEncoder().encode(texto)];
  const v = Object.keys(VERSIONES).map(Number).find((x) => VERSIONES[x][0] - 2 >= bytes.length);
  if (!v) throw new Error("Texto demasiado largo para el QR");
  const [nDatos, nEc, nBloques, alineacion] = VERSIONES[v];

  // Bits: modo byte (0100), longitud (8 bits), datos, terminador y relleno.
  const bits = [];
  const poner = (valor, n) => {
    for (let i = n - 1; i >= 0; i--) bits.push((valor >> i) & 1);
  };
  poner(0b0100, 4);
  poner(bytes.length, 8);
  bytes.forEach((b) => poner(b, 8));
  poner(0, Math.min(4, nDatos * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const datos = [];
  for (let i = 0; i < bits.length; i += 8) datos.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let k = 0; datos.length < nDatos; k++) datos.push(k % 2 ? 0x11 : 0xec);

  // Bloques, su corrección y el entrelazado.
  const porBloque = nDatos / nBloques;
  const bloques = Array.from({ length: nBloques }, (_, b) => datos.slice(b * porBloque, (b + 1) * porBloque));
  const ecs = bloques.map((b) => correccion(b, nEc));
  const final = [];
  for (let i = 0; i < porBloque; i++) bloques.forEach((b) => final.push(b[i]));
  for (let i = 0; i < nEc; i++) ecs.forEach((e) => final.push(e[i]));

  // Matriz y zonas reservadas.
  const tam = 17 + 4 * v;
  const m = Array.from({ length: tam }, () => new Array(tam).fill(null));
  const fija = Array.from({ length: tam }, () => new Array(tam).fill(false));
  const fijar = (r, c, val) => {
    m[r][c] = val;
    fija[r][c] = true;
  };
  const buscador = (r0, c0) => {
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r, cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= tam || cc >= tam) continue;
        const borde = r === 0 || r === 6 || c === 0 || c === 6;
        const centro = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        fijar(rr, cc, r >= 0 && r <= 6 && c >= 0 && c <= 6 && (borde || centro));
      }
  };
  buscador(0, 0);
  buscador(0, tam - 7);
  buscador(tam - 7, 0);
  for (let i = 8; i < tam - 8; i++) {
    fijar(6, i, i % 2 === 0);
    fijar(i, 6, i % 2 === 0);
  }
  for (const r of alineacion)
    for (const c of alineacion) {
      if (fija[r][c]) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) fijar(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  // Sitio del formato (se rellena al final).
  for (let i = 0; i < 9; i++) {
    if (!fija[8][i]) fijar(8, i, false);
    if (!fija[i][8]) fijar(i, 8, false);
  }
  for (let i = 0; i < 8; i++) fijar(8, tam - 1 - i, false);
  for (let i = 0; i < 7; i++) fijar(tam - 1 - i, 8, false);
  fijar(tam - 8, 8, true); // módulo oscuro (siempre negro)

  // Datos en zigzag, de abajo a la derecha hacia arriba.
  const flujo = [];
  final.forEach((b) => {
    for (let i = 7; i >= 0; i--) flujo.push((b >> i) & 1);
  });
  let k = 0;
  for (let c = tam - 1; c > 0; c -= 2) {
    if (c === 6) c--;
    const subiendo = ((tam - 1 - c) >> 1) % 2 === 0;
    for (let i = 0; i < tam; i++) {
      const r = subiendo ? tam - 1 - i : i;
      for (const cc of [c, c - 1]) if (!fija[r][cc]) m[r][cc] = Boolean(flujo[k++]);
    }
  }

  // Máscara: se prueban las 8 y se queda la de menor penalización.
  const MASCARAS = [
    (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];
  const conFormato = (mat, mascara) => {
    // Formato: nivel M (00) + máscara, con BCH(15,5) y la máscara fija 101010000010010.
    let d = (0b00 << 3) | mascara;
    let b = d << 10;
    for (let i = 14; i >= 10; i--) if ((b >> i) & 1) b ^= 0x537 << (i - 10);
    const f = ((d << 10) | b) ^ 0x5412;
    const bit = (i) => Boolean((f >> i) & 1);
    // Primera copia, alrededor del buscador de arriba a la izquierda (mat[fila][columna]).
    for (let i = 0; i <= 5; i++) mat[i][8] = bit(i);
    mat[7][8] = bit(6);
    mat[8][8] = bit(7);
    mat[8][7] = bit(8);
    for (let i = 9; i <= 14; i++) mat[8][14 - i] = bit(i);
    // Segunda copia: abajo a la izquierda y arriba a la derecha.
    for (let i = 0; i <= 7; i++) mat[8][tam - 1 - i] = bit(i);
    for (let i = 8; i <= 14; i++) mat[tam - 15 + i][8] = bit(i);
  };
  const penalizacion = (mat) => {
    let p = 0;
    for (let r = 0; r < tam; r++) {
      let fila = 1, col = 1;
      for (let c = 1; c < tam; c++) {
        fila = mat[r][c] === mat[r][c - 1] ? fila + 1 : 1;
        if (fila === 5) p += 3;
        else if (fila > 5) p++;
        col = mat[c][r] === mat[c - 1][r] ? col + 1 : 1;
        if (col === 5) p += 3;
        else if (col > 5) p++;
      }
    }
    for (let r = 0; r < tam - 1; r++) for (let c = 0; c < tam - 1; c++) if (mat[r][c] === mat[r + 1][c] && mat[r][c] === mat[r][c + 1] && mat[r][c] === mat[r + 1][c + 1]) p += 3;
    const negros = mat.flat().filter(Boolean).length;
    p += Math.floor(Math.abs((negros * 100) / (tam * tam) - 50) / 5) * 10;
    return p;
  };
  let mejor = null;
  MASCARAS.forEach((f, i) => {
    const mat = m.map((fila, r) => fila.map((x, c) => (fija[r][c] ? x : x !== f(r, c))));
    conFormato(mat, i);
    const p = penalizacion(mat);
    if (!mejor || p < mejor.p) mejor = { mat, p };
  });
  return mejor.mat;
}

/** SVG del QR (con su margen blanco). */
export function svgQR(texto, { margen = 4, oscuro = "#0a1b4a", claro = "#ffffff" } = {}) {
  const mat = matrizQR(texto);
  const tam = mat.length + margen * 2;
  let d = "";
  mat.forEach((fila, r) => fila.forEach((x, c) => x && (d += `M${c + margen} ${r + margen}h1v1h-1z`)));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tam} ${tam}" shape-rendering="crispEdges"><rect width="${tam}" height="${tam}" fill="${claro}"/><path d="${d}" fill="${oscuro}"/></svg>`;
}
