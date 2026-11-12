// "Jugar en grupo": entrar a la sala de PARTY con su código (o escaneando el QR de la TV).
import { h } from "../comun/ui.js";
import { cifrasDe, formatearCodigo, buscarSala } from "../comun/codigo-sala.js";

/** Del texto (código, enlace con #s=…, enlace del túnel o de la wifi) saca la dirección de PARTY. */
export function baseDe(texto) {
  if (!texto) return null;
  texto = String(texto).trim().toLowerCase();
  const enlace = texto.match(/[#&?]s=([a-z0-9-]+)/);
  if (enlace) return `https://${enlace[1]}.trycloudflare.com/`;
  const tunel = texto.match(/https:\/\/([a-z0-9-]+)\.trycloudflare\.com/);
  if (tunel) return `https://${tunel[1]}.trycloudflare.com/`;
  const wifi = texto.match(/^(https?:\/\/[a-z0-9.-]+(:\d+)?)\//);
  if (wifi) return `${wifi[1]}/`;
  const palabras = texto.replace(/\s+/g, "-").replace(/^código:-?/, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return /^[a-z0-9]+(-[a-z0-9]+){2,}$/.test(palabras) ? `https://${palabras}.trycloudflare.com/` : null;
}

/** Comprueba que en esa dirección hay una partida de PARTY. */
export async function probarBase(base) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const r = await fetch(`${base}hola`, { signal: ctrl.signal, cache: "no-store" });
    return (await r.json()).nyp ? base : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Código de números (1234-56), enlace o palabras del túnel → dirección de PARTY comprobada, o null. */
export async function resolverSala(texto) {
  const cifras = cifrasDe(texto);
  const base = cifras && !/[a-z]/i.test(texto) ? await buscarSala(cifras) : baseDe(texto);
  return base ? probarBase(base) : null;
}

/**
 * baseLocal: si la app viene del propio ordenador de PARTY, se puede entrar sin código.
 * alEntrar(base) entra en la partida; alVolver() vuelve al inicio.
 */
export function pantallaGrupo({ baseLocal, aviso: avisoInicial = "", alEntrar, alVolver }) {
  const aviso = h("div.pl-aviso.mal", avisoInicial);
  const estado = h("p.suave.grupo-estado");
  let ocupado = false;
  let cifras = "";

  async function entrar(texto) {
    if (ocupado) return;
    if (!cifrasDe(texto) && !baseDe(texto)) {
      aviso.textContent = "El código son 6 números, como 1234-56";
      return;
    }
    ocupado = true;
    aviso.textContent = "";
    estado.textContent = "Buscando la partida…";
    const base = await resolverSala(texto);
    ocupado = false;
    estado.textContent = "";
    if (!base) {
      aviso.textContent = "No encuentro esa partida. ¿Está abierta en la TV?";
      navigator.vibrate?.([30, 40, 30]);
      return;
    }
    pararCamara();
    alEntrar(base);
  }

  // ---- código de números con teclado propio
  const visor = h("div.codigo-sala", { role: "textbox", "aria-label": "Código de la sala" });
  const pintarCodigo = () =>
    visor.replaceChildren(
      ...[..."000000"].flatMap((_, i) => [
        ...(i === 4 ? [h("span.codigo-guion", "–")] : []),
        h(`span.codigo-cifra${i === cifras.length ? ".actual" : ""}`, cifras[i] ?? ""),
      ])
    );
  const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"];
  const teclado = h(
    "div.teclado-codigo",
    teclas.map((t) => h(`button.tecla-l${t === "⌫" ? ".borrar" : t === "OK" ? ".aceptar" : ""}`, { type: "button", "data-t": t }, t))
  );
  teclado.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    ev.preventDefault();
    navigator.vibrate?.(6);
    const t = b.dataset.t;
    if (t === "OK") return entrar(cifras);
    if (t === "⌫") cifras = cifras.slice(0, -1);
    else if (cifras.length < 6) cifras += t;
    aviso.textContent = "";
    pintarCodigo();
    if (cifras.length === 6) entrar(cifras); // con la última cifra ya entra
  });
  pintarCodigo();

  // ---- cámara (QR de la TV)
  const video = h("video.grupo-camara.oculto", { playsinline: true, muted: true });
  let flujo = null, mirando = false;
  function pararCamara() {
    mirando = false;
    flujo?.getTracks().forEach((t) => t.stop());
    flujo = null;
    video.classList.add("oculto");
    escanear.textContent = "📷 Escanear el QR de la TV";
  }
  async function cargarLector() {
    if ("BarcodeDetector" in window || window.jsQR) return;
    await new Promise((ok) => {
      const s = h("script", { src: new URL("../jsQR.js", import.meta.url).href });
      s.onload = s.onerror = ok;
      document.head.append(s);
    });
  }
  async function empezarCamara() {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      aviso.textContent = "Aquí no puedo usar la cámara: escribe el código de la TV";
      return;
    }
    try {
      [flujo] = await Promise.all([navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }), cargarLector()]);
    } catch {
      aviso.textContent = "No puedo usar la cámara: escribe el código de la TV";
      return;
    }
    video.srcObject = flujo;
    video.classList.remove("oculto");
    escanear.textContent = "Cerrar la cámara";
    await video.play().catch(() => {});
    mirando = true;
    const detector = "BarcodeDetector" in window ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
    const lienzo = document.createElement("canvas");
    const ctx = lienzo.getContext("2d", { willReadFrequently: true });
    const mirar = async () => {
      if (!mirando || !video.isConnected) return pararCamara();
      let texto = null;
      try {
        if (detector) texto = (await detector.detect(video))[0]?.rawValue ?? null;
        else if (video.videoWidth && window.jsQR) {
          lienzo.width = video.videoWidth;
          lienzo.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          texto = window.jsQR(ctx.getImageData(0, 0, lienzo.width, lienzo.height).data, lienzo.width, lienzo.height)?.data ?? null;
        }
      } catch {}
      if (texto && (baseDe(texto) || cifrasDe(texto))) return entrar(texto);
      setTimeout(mirar, 250);
    };
    mirar();
  }
  const escanear = h("button.boton.suave.grande", { type: "button", onclick: () => (mirando || flujo ? pararCamara() : empezarCamara()) }, "📷 Escanear el QR de la TV");

  const el = h(
    "section.grupo",
    h(
      "div.barra-sup",
      h("button.icono-btn", { type: "button", onclick: () => (pararCamara(), alVolver()), "aria-label": "Volver" }, "←"),
      h("span.nombre", "Jugar en grupo")
    ),
    baseLocal
      ? h("button.boton.acento.grande", { type: "button", onclick: () => (pararCamara(), alEntrar(baseLocal)) }, "📺 Entrar a la partida de esta wifi")
      : null,
    video,
    escanear,
    h("p.suave.grupo-ayuda", "o escribe el código que sale en la TV:"),
    visor,
    estado,
    aviso,
    h("div.grupo-teclado", teclado)
  );
  return { el, desmontar: pararCamara };
}
