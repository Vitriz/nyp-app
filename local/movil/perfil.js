// Perfil del jugador: nombre, color de las letras, fondo del banner y foto (o iniciales).
import { h, banner } from "../comun/ui.js";
import { almacen } from "../comun/conexion.js";
import { campoTexto } from "../comun/teclado.js";
import { selectorColor } from "../comun/color.js";

export const FONDOS = ["#5fb7d0", "#7c9cf0", "#6cc49a", "#e9c75a", "#e7a05c", "#e46a62", "#f08fb5", "#c58be0", "#ffffff", "#1d3f86", "#0b1d4f", "#2b2b2b"];
export const TEXTOS = ["#0a1b4a", "#ffffff", "#000000", "#e9c75a", "#e46a62", "#6cc49a", "#5fb7d0", "#c58be0"];
export const CONTORNOS = ["#0a1b4a", "#000000", "#ffffff", "#e9c75a", "#e46a62"];

export function cargarPerfil() {
  try {
    const p = JSON.parse(almacen.leer("nyp-perfil") ?? "null");
    if (p?.nombre) return p;
  } catch {}
  const viejo = almacen.leer("nyp-nombre"); // nombre de versiones anteriores
  return viejo ? { nombre: viejo, color: FONDOS[0], colorTexto: TEXTOS[0], foto: null } : null;
}

export function guardarPerfil(p) {
  almacen.guardar("nyp-perfil", JSON.stringify(p));
}

/** Recorta la foto en cuadrado y la reduce (≈15-25 KB) para mandarla a la TV. */
function prepararFoto(archivo) {
  return new Promise((ok, mal) => {
    const img = new Image();
    const url = URL.createObjectURL(archivo);
    img.onload = () => {
      const lado = Math.min(img.naturalWidth, img.naturalHeight);
      const c = Object.assign(document.createElement("canvas"), { width: 192, height: 192 });
      c.getContext("2d").drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, 192, 192);
      URL.revokeObjectURL(url);
      ok(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = mal;
    img.src = url;
  });
}

/** Pantalla de edición. alGuardar(perfil) recibe el perfil nuevo. */
export function pantallaPerfil({ perfil, alGuardar, alVolver, titulo = "Tu perfil" }) {
  const p = { nombre: "", color: FONDOS[0], colorTexto: TEXTOS[0], contorno: null, foto: null, ...(perfil ?? {}) };
  const vista = h("div.perfil-vista");
  const pintarVista = () => vista.replaceChildren(banner(p, ".banner-grande"));

  const campo = campoTexto({ valor: p.nombre, max: 14, placeholder: "Toca las letras", alCambiar: (t) => ((p.nombre = t), pintarVista()) });

  const paleta = (colores, clave, ninguno = null) =>
    selectorColor({ valor: p[clave], colores, ninguno, alCambiar: (c) => ((p[clave] = c), pintarVista()) }).el;

  // Foto: abre la cámara del móvil (o la galería). Funciona también sin https.
  const entradaCamara = h("input", { type: "file", accept: "image/*", capture: "user", class: "oculto" });
  const entradaGaleria = h("input", { type: "file", accept: "image/*", class: "oculto" });
  const aviso = h("div.pl-aviso");
  for (const entrada of [entradaCamara, entradaGaleria]) {
    entrada.addEventListener("change", async () => {
      const archivo = entrada.files?.[0];
      entrada.value = "";
      if (!archivo) return;
      try {
        p.foto = await prepararFoto(archivo);
        pintarVista();
      } catch {
        aviso.textContent = "No se pudo usar esa imagen";
      }
    });
  }

  const pestañas = { nombre: "Nombre", colores: "Colores", foto: "Foto" };
  const paneles = {
    nombre: h("div.panel-perfil", campo.visor, campo.teclado),
    colores: h(
      "div.panel-perfil",
      h("label", "Fondo del banner"),
      paleta(FONDOS, "color"),
      h("label", "Color de las letras"),
      paleta(TEXTOS, "colorTexto"),
      h("label", "Contorno de las letras"),
      paleta(CONTORNOS, "contorno", "Sin contorno")
    ),
    foto: h(
      "div.panel-perfil",
      h("button.boton.acento.grande", { type: "button", onclick: () => entradaCamara.click() }, "📸 Hacer una foto"),
      h("button.boton.suave.grande", { type: "button", onclick: () => entradaGaleria.click() }, "🖼️ Elegir de la galería"),
      h("button.boton.suave", { type: "button", onclick: () => ((p.foto = null), pintarVista()) }, "Usar mis iniciales"),
      entradaCamara,
      entradaGaleria
    ),
  };
  const cuerpo = h("div.perfil-cuerpo");
  const botonesPestaña = h("div.pestanas");
  const elegir = (k) => {
    cuerpo.replaceChildren(paneles[k]);
    botonesPestaña.querySelectorAll("button").forEach((b) => b.classList.toggle("activa", b.dataset.k === k));
  };
  botonesPestaña.append(...Object.entries(pestañas).map(([k, t]) => h("button", { type: "button", "data-k": k, onclick: () => elegir(k) }, t)));

  const guardar = () => {
    p.nombre = campo.valor();
    if (!p.nombre) {
      elegir("nombre");
      aviso.textContent = "Escribe tu nombre";
      return;
    }
    guardarPerfil(p);
    alGuardar(p);
  };

  pintarVista();
  elegir("nombre");
  const el = h(
    "section.perfil",
    h("div.barra-sup", alVolver ? h("button.icono-btn", { type: "button", onclick: alVolver, "aria-label": "Volver" }, "←") : null, h("span.nombre", titulo)),
    vista,
    botonesPestaña,
    cuerpo,
    aviso,
    h("button.boton.acento.grande", { type: "button", onclick: guardar }, "Guardar")
  );
  return { el };
}
