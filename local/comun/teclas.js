// Teclado del ordenador: las mismas teclas que el teclado de la pantalla.
// El oyente se quita solo cuando su pantalla desaparece.

/**
 * el: elemento de la pantalla (mientras esté puesto, se escucha).
 * alTecla(t, ev): t es una letra en minúscula (con tilde o ñ), una cifra, " ", "-", "⌫", "OK",
 *   o el nombre de la tecla (ArrowUp, Tab…). Devuelve false si no la ha usado.
 */
export function teclasFisicas(el, alTecla) {
  const oir = (ev) => {
    if (!el.isConnected) return window.removeEventListener("keydown", oir);
    if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.isComposing) return;
    if (ev.target?.closest?.("input, textarea, select, [contenteditable]")) return;
    if (document.querySelector(".capa-movil, .capa-camara")) return; // hay una ventana encima
    const k = ev.key;
    const t =
      k === "Backspace" || k === "Delete" ? "⌫"
      : k === "Enter" ? "OK"
      : k.length === 1 ? k.toLowerCase()
      : k;
    if (alTecla(t, ev) === false) return;
    ev.preventDefault();
  };
  window.addEventListener("keydown", oir);
  return () => window.removeEventListener("keydown", oir);
}

/** Pulsa visualmente el botón del teclado de pantalla que corresponde a la tecla. */
export function marcarTecla(teclado, t) {
  const b = [...teclado.querySelectorAll("button[data-t]")].find((x) => x.dataset.t === t);
  if (!b) return;
  b.classList.remove("pulsada");
  void b.offsetWidth;
  b.classList.add("pulsada");
  setTimeout(() => b.classList.remove("pulsada"), 140);
}

/** Letra sin tilde (la ñ se queda). */
export function sinTilde(t) {
  return t === "ñ" ? t : t.normalize("NFD")[0];
}

export const ES_LETRA = /^[a-zñáéíóúü]$/;
