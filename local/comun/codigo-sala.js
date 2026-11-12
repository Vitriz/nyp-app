// Código de sala de números (1234-56). La dirección del túnel de Cloudflare son palabras al azar,
// así que PARTY la deja en un "buzón" de ntfy.sh con el código, y el móvil la busca allí.
// Lo usan el servidor (Node) y el móvil.

const NTFY = "https://ntfy.sh/";
const TEMA = "nyp-sala-q7m2-"; // prefijo para no chocar con temas de otra gente
const TUNEL = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com\/?$/;

/** Código nuevo al azar: 6 cifras. */
export function codigoNuevo() {
  return String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
}

/** "123456" → "1234-56" */
export function formatearCodigo(cifras) {
  return cifras.length > 4 ? `${cifras.slice(0, 4)}-${cifras.slice(4)}` : cifras;
}

/** Deja solo las cifras; null si no son 6. */
export function cifrasDe(texto) {
  const c = String(texto ?? "").replace(/\D/g, "");
  return c.length === 6 ? c : null;
}

/** PARTY: deja la dirección del túnel en el buzón del código (se guarda unas horas). */
export async function publicarSala(cifras, url) {
  const r = await fetch(NTFY + TEMA + cifras, { method: "POST", body: url, headers: { Cache: "yes" } });
  if (!r.ok) throw new Error(`ntfy ${r.status}`);
}

/** Móvil: busca la dirección de PARTY para ese código (la más reciente). null si no hay. */
export async function buscarSala(cifras) {
  // Si PARTY acaba de abrir, el buzón puede tardar un instante: probamos dos veces.
  return (await buscarUnaVez(cifras)) ?? (await new Promise((r) => setTimeout(r, 1500)), await buscarUnaVez(cifras));
}

async function buscarUnaVez(cifras) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${NTFY}${TEMA}${cifras}/json?poll=1&since=12h`, { signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) return null;
    const mensajes = (await r.text())
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l))
      .filter((m) => m.event === "message" && TUNEL.test(String(m.message).trim()));
    const url = mensajes.at(-1)?.message.trim();
    return url ? url.replace(/\/?$/, "/") : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
