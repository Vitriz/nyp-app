// La sala: jugadores, fases de la partida, rondas y puntos.
// Funciona en el ordenador (PARTY, con WebSockets) y en el navegador del anfitrión (Batalla multijugador,
// con los mensajes por internet): lo que depende del sitio (récords, código de sala, fotos) se le pasa al crearla.
import { crearAzar, clasificar, puntosPorPuesto, limpiarNombre, TIEMPOS, msDuracion } from "./util.js";
import { listaJuegos, obtenerJuego, juegosDisponibles } from "./juegos/index.js";

const azarHex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");

export const COLORES = [
  "#5fb7d0", "#7c9cf0", "#e7a05c", "#e46a62", "#6cc49a",
  "#c58be0", "#e9c75a", "#f08fb5", "#8fd3e0", "#b4c06a",
];

export const EQUIPOS = [
  { id: "azul", nombre: "Equipo Azul", color: "#5fb7d0" },
  { id: "naranja", nombre: "Equipo Naranja", color: "#e7a05c" },
  { id: "verde", nombre: "Equipo Verde", color: "#6cc49a" },
  { id: "lila", nombre: "Equipo Lila", color: "#c58be0" },
];

const CUENTA_ATRAS_MS = 4000; // 3, 2, 1 y ¡YA!: un segundo cada uno
const HEX = /^#[0-9a-f]{6}$/i;
const MAX_FOTO = 160 * 1024;
const METAS = [30, 50, 75, 100, 0]; // puntos para ganar la partida (0 = sin límite)
const PREMIO = /^[a-z]{2,12}$/; // sombrero o animación del avatar (premios de las hazañas)
// Modo automático: un solo tiempo para pasar de presentación a juego y de resultados a la siguiente.
const FASES_AUTO = ["presentacion", "resultados", "clasificacion"];
const TIEMPOS_AUTO = [5, 10, 15, 20, 30];

export class Sala {
  /**
   * enNavegador: Batalla multijugador (sin TV; las fotos viajan aparte y no hay récords de la familia).
   * codigo: { nuevo(), formatear(c), publicar(c, url) } · apuntarRecords(msg) → tabla (solo en PARTY).
   */
  constructor({ claveHost, tunel, urlLocal, urlApp = null, enNavegador = false, codigo = null, cifras = null, apuntarRecords = null }) {
    this.enNavegador = enNavegador;
    this.codigo = codigo;
    this.apuntarRecords = apuntarRecords;
    this.urlApp = urlApp;
    this.claveHost = claveHost;
    this.tunel = tunel;
    this.urlLocal = urlLocal;
    this.jugadores = new Map(); // id -> jugador
    this.fotos = new Map(); // id -> Buffer JPEG (se sirven en /foto/<id>)
    this.tvs = new Set();
    // nueva (se eligen las opciones de la sala) | lobby | presentacion | cuenta | jugando | resultados | clasificacion
    this.fase = "nueva";
    this.config = {
      automatico: false,
      tiempoAuto: 10, // segundos de cada fase en modo automático
      autoPausado: false, // el anfitrión puede parar un momento el modo automático
      modo: "individual", // individual | equipos | torneo
      dificultad: "normal", // facil | normal | dificil
      pruebas: "elegir", // elegir (el anfitrión, en cada ronda) | azar
      juegos: juegosDisponibles(), // pruebas que entran en la partida
      tablaPuntos: [10, 8, 6, 5, 4, 3, 2, 1],
      duraciones: {},
      pulsadorTipos: ["definicion", "calculo", "revuelto"],
      meta: 50, // puntos para ganar (por separado o por equipos; en el torneo no se usa)
      ambito: "azar", // crucigrama: tema elegido por el presentador (o al azar)
    };
    this.desempate = null; // ids empatados que se juegan la victoria en una última prueba
    this.animo = {}; // id -> "gana" | "pierde": cómo quedó cada uno en la última prueba (para animar la clasificación)
    this.equipos = null; // null = cada uno por su cuenta; si no, lista de equipos activos
    this.juego = null; // metadatos del juego elegido
    this.ronda = null; // estado privado del juego
    this.rondaN = 0;
    this.fin = null; // hora (ms) a la que acaba la fase con tiempo
    this.resultados = null;
    this.resumen = null;
    this.ultimoJuego = null;
    this.temporizador = null;
    this.envioPendiente = false;
    this.eliminados = new Set(); // torneo: quién está fuera
    this.eliminadoRonda = null; // torneo: a quién ha eliminado la última ronda
    this.campeon = null; // torneo: el último que queda
    // Código de números de esta partida (nuevo cada vez que se abre PARTY).
    this.cifras = cifras ?? codigo?.nuevo() ?? null;
    this.codigoListo = Boolean(cifras); // ya está en el buzón con la dirección del túnel (en Batalla, siempre)
    let publicada = null;
    tunel?.on("cambio", () => {
      const url = tunel.url;
      if (!url) this.codigoListo = false;
      else if (url !== publicada) {
        publicada = url;
        Promise.resolve(this.codigo?.publicar(this.cifras, url))
          .then(() => (this.codigoListo = tunel.url === url))
          .catch(() => (this.codigoListo = false)) // sin buzón, el código serán las palabras del túnel
          .finally(() => this.difundir());
      }
      this.difundir();
    });
  }

  // ------------------------------------------------------------ conexiones
  conectar(ws) {
    ws.vivo = true;
    ws.on("pong", () => (ws.vivo = true));
    ws.on("message", (datos) => {
      let msg;
      try {
        msg = JSON.parse(datos);
      } catch {
        return;
      }
      this.#recibir(ws, msg);
    });
    ws.on("close", () => {
      if (ws.rol === "tv") this.tvs.delete(ws);
      const j = ws.jugador;
      if (j && j.socket === ws) {
        j.socket = null;
        j.conectado = false;
        this.difundir();
      }
    });
  }

  latido() {
    for (const ws of [...this.tvs, ...[...this.jugadores.values()].map((j) => j.socket)]) {
      if (!ws) continue;
      if (!ws.vivo) {
        ws.terminate();
        continue;
      }
      ws.vivo = false;
      ws.ping();
    }
  }

  #enviar(ws, msg) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  #recibir(ws, msg) {
    switch (msg.t) {
      case "hola":
        if (msg.rol === "tv" || msg.rol === "mando") {
          ws.rol = "tv";
          ws.esHost = msg.clave === this.claveHost;
          ws.esMando = msg.rol === "mando" && ws.esHost;
          this.tvs.add(ws);
          this.#enviar(ws, this.#vistaTV(ws));
        } else {
          ws.rol = "jugador";
          // En Batalla, el móvil que crea la sala juega y además manda (tiene la clave del anfitrión).
          ws.esHost = Boolean(this.enNavegador && msg.clave && msg.clave === this.claveHost);
          const j = [...this.jugadores.values()].find((x) => x.token && x.token === msg.token);
          if (j) this.#asociar(ws, j);
          else this.#enviar(ws, { t: "necesitoNombre", colores: COLORES, ocupados: this.#coloresOcupados() });
        }
        break;
      case "unirse": {
        if (ws.rol !== "jugador" || ws.jugador) return;
        const nombre = this.#nombreUnico(limpiarNombre(msg.nombre) || "Jugador");
        const color = HEX.test(msg.color ?? "") ? msg.color : COLORES[this.jugadores.size % COLORES.length];
        const j = {
          id: azarHex(4),
          token: azarHex(16),
          nombre,
          color,
          puntos: 0,
          conectado: true,
          socket: null,
          equipo: this.#equipoMasPequeno(),
          colorTexto: HEX.test(msg.colorTexto ?? "") ? msg.colorTexto : null,
          contorno: HEX.test(msg.contorno ?? "") ? msg.contorno : null,
          foto: null,
          sombrero: PREMIO.test(msg.sombrero ?? "") ? msg.sombrero : null,
          animacion: PREMIO.test(msg.animacion ?? "") ? msg.animacion : null,
        };
        this.jugadores.set(j.id, j);
        this.#ponerFoto(j, msg.foto);
        this.#enviar(ws, { t: "bienvenida", token: j.token, id: j.id });
        this.#asociar(ws, j);
        break;
      }
      case "perfil": {
        // El jugador cambió su perfil en el móvil (nombre, colores o foto).
        const j = ws.jugador;
        if (!j) return;
        const nombre = limpiarNombre(msg.nombre);
        if (nombre && nombre !== j.nombre && !j.nombre.startsWith(nombre + " ")) j.nombre = this.#nombreUnico(nombre, j.id);
        if (HEX.test(msg.color ?? "")) j.color = msg.color;
        if (HEX.test(msg.colorTexto ?? "")) j.colorTexto = msg.colorTexto;
        if ("contorno" in msg) j.contorno = HEX.test(msg.contorno ?? "") ? msg.contorno : null;
        if ("foto" in msg) this.#ponerFoto(j, msg.foto);
        if ("sombrero" in msg) j.sombrero = PREMIO.test(msg.sombrero ?? "") ? msg.sombrero : null;
        if ("animacion" in msg) j.animacion = PREMIO.test(msg.animacion ?? "") ? msg.animacion : null;
        this.difundir();
        break;
      }
      case "salir": {
        const j = ws.jugador;
        if (!j) return;
        this.jugadores.delete(j.id);
        ws.jugador = null;
        this.#enviar(ws, { t: "necesitoNombre", colores: COLORES, ocupados: this.#coloresOcupados() });
        this.difundir();
        break;
      }
      case "equipo": {
        const j = ws.jugador;
        if (!j || !this.equipos || !this.equipos.some((e) => e.id === msg.equipo)) return;
        if (!["lobby", "clasificacion", "presentacion"].includes(this.fase)) return;
        j.equipo = msg.equipo;
        this.difundir();
        break;
      }
      case "juego": {
        const j = ws.jugador;
        if (!j || this.fase !== "jugando" || !this.ronda) return;
        const impl = obtenerJuego(this.juego.id);
        if (impl.accion(this.ronda, j.id, msg)) {
          if (this.#todosTerminaron()) this.#terminarRonda();
          else this.difundir();
        }
        break;
      }
      case "host":
        if (ws.esHost) this.#accionHost(msg);
        break;
      case "ping":
        this.#enviar(ws, { t: "pong", ahora: Date.now(), eco: msg.eco });
        break;
      case "records":
        // Récords de «Jugar solo» de este móvil: se guardan y se le devuelve la clasificación de la familia.
        if (ws.rol !== "jugador") return;
        if (this.apuntarRecords) this.#enviar(ws, { t: "recordsFamilia", tabla: this.apuntarRecords(msg) });
        break;
    }
  }

  #asociar(ws, j) {
    if (j.socket && j.socket !== ws) j.socket.close(4000, "sesion-reemplazada");
    j.socket = ws;
    j.conectado = true;
    ws.jugador = j;
    if (ws.esHost) j.esHost = true;
    if (this.enNavegador) this.#enviar(ws, { t: "fotos", fotos: Object.fromEntries(this.fotos) });
    this.difundir();
  }

  /** Guarda la foto (data:image/jpeg;base64,...) y la publica en /foto/<id>. */
  #ponerFoto(j, foto) {
    const m = typeof foto === "string" ? foto.match(/^data:image\/(jpeg|png|webp);base64,/) : null;
    if (!m) {
      if (foto === null) {
        this.fotos.delete(j.id);
        j.foto = null;
      }
      return;
    }
    if (this.enNavegador) {
      // Batalla: la foto se manda una vez a todos (no en cada estado) y se cita como «mem:id».
      if (foto.length > MAX_FOTO * 1.4) return;
      this.fotos.set(j.id, foto);
      j.foto = `mem:${j.id}:${Date.now().toString(36)}`;
      for (const x of this.jugadores.values()) if (x.socket) this.#enviar(x.socket, { t: "fotos", fotos: { [j.id]: foto } });
      return;
    }
    const buf = Buffer.from(foto.slice(m[0].length), "base64");
    if (buf.length > MAX_FOTO) return;
    this.fotos.set(j.id, { buf, tipo: `image/${m[1]}` });
    // r=1: recorte con transparencia (la cabeza asoma por encima del círculo del avatar).
    j.foto = `foto/${j.id}?v=${Date.now().toString(36)}${m[1] === "jpeg" ? "" : "&r=1"}`;
  }

  #nombreUnico(nombre, excepto = null) {
    const usados = new Set([...this.jugadores.values()].filter((j) => j.id !== excepto).map((j) => j.nombre.toLowerCase()));
    if (!usados.has(nombre.toLowerCase())) return nombre;
    for (let n = 2; ; n++) if (!usados.has(`${nombre} ${n}`.toLowerCase())) return `${nombre} ${n}`;
  }

  #coloresOcupados() {
    return [...this.jugadores.values()].map((j) => j.color);
  }

  // ------------------------------------------------------------ presentador
  #accionHost(msg) {
    const f = this.fase;
    switch (msg.accion) {
      case "crearSala": {
        // Opciones de la partida, antes de abrir la sala (y al volver a "Ajustes").
        if (f !== "nueva" && f !== "lobby") return;
        const o = msg.opciones ?? {};
        if (["individual", "equipos", "torneo"].includes(o.modo)) this.config.modo = o.modo;
        if (["facil", "normal", "dificil"].includes(o.dificultad)) this.config.dificultad = o.dificultad;
        if (["elegir", "azar"].includes(o.pruebas)) this.config.pruebas = o.pruebas;
        if (METAS.includes(Number(o.meta))) this.config.meta = Number(o.meta);
        if (TIEMPOS_AUTO.includes(Number(o.tiempoAuto))) this.config.tiempoAuto = Number(o.tiempoAuto);
        if (Array.isArray(o.juegos)) {
          const validos = o.juegos.filter((id) => juegosDisponibles().includes(id));
          if (validos.length) this.config.juegos = validos;
        }
        this.config.automatico = this.config.pruebas === "azar";
        this.config.autoPausado = false;
        const n = Number(o.equipos);
        if (this.config.modo === "equipos" && n >= 2 && n <= EQUIPOS.length) {
          if (this.equipos?.length !== n) {
            this.equipos = EQUIPOS.slice(0, n);
            this.#repartir();
          }
        } else this.equipos = null;
        this.#reiniciarTorneo();
        this.#irA("lobby");
        return;
      }
      case "ajustes":
        if (f === "lobby" || f === "clasificacion") this.#irA("nueva");
        return;
      case "elegir":
        if (["lobby", "clasificacion", "presentacion"].includes(f)) {
          if (this.campeon) this.#reiniciarPuntos();
          // El anfitrión (TV o móvil de la Batalla) elige como en «Jugar solo»: tiempo, nivel (y tema u operaciones) en cada juego.
          if (TIEMPOS.includes(msg.segundos)) this.config.duraciones[msg.juego] = msg.segundos;
          if (["facil", "normal", "dificil"].includes(msg.dificultad)) this.config.dificultad = msg.dificultad;
          if ([5, 8, 12, 16, 20].includes(Number(msg.operaciones))) this.config.operaciones = Number(msg.operaciones);
          this.#presentar(msg.juego);
          if (typeof msg.ambito === "string" && msg.ambito.length <= 30 && this.juego?.ambitos?.length) this.config.ambito = msg.ambito;
        }
        break;
      case "aleatorio":
        if (["lobby", "clasificacion", "presentacion"].includes(f)) {
          if (this.campeon) this.#reiniciarPuntos(); // torneo acabado: empieza otro
          this.#presentar(this.#juegoAleatorio());
        }
        break;
      case "empezar":
        if (f === "presentacion") this.#cuentaAtras();
        break;
      case "volver":
        if (f === "presentacion" || f === "clasificacion") this.#irA("lobby");
        break;
      case "ambito":
        if (f === "presentacion" && (msg.valor === "azar" || msg.valor === "todos" || (obtenerJuego(this.juego?.id)?.ambitos ?? []).includes(msg.valor))) {
          this.config.ambito = msg.valor;
          this.difundir();
        }
        break;
      case "duracion":
        if (this.juego && TIEMPOS.includes(msg.segundos)) {
          this.config.duraciones[this.juego.id] = msg.segundos;
          this.juego.duracion = msg.segundos;
          this.difundir();
        }
        break;
      case "masTiempo":
        if (f === "jugando") {
          this.fin += 15000;
          this.#programar(this.fin - Date.now(), () => this.#terminarRonda());
          this.difundir();
        }
        break;
      case "terminar":
        if (f === "jugando" || f === "cuenta") this.#terminarRonda();
        break;
      case "siguiente":
        if (f === "resultados") this.#irA("clasificacion");
        else if (f === "clasificacion") this.config.automatico && !this.campeon ? this.#presentar(this.#juegoAleatorio()) : this.#irA("lobby");
        else if (f === "presentacion") this.#cuentaAtras();
        break;
      case "automatico":
        this.config.automatico = Boolean(msg.valor);
        this.#reprogramarAuto();
        this.difundir();
        break;
      case "pausaAuto":
        // Para (o vuelve a poner en marcha) el paso automático sin quitar el modo automático.
        if (!this.config.automatico) break;
        this.config.autoPausado = !this.config.autoPausado;
        if (this.config.autoPausado) {
          if (FASES_AUTO.includes(f)) clearTimeout(this.temporizador);
        } else this.#reprogramarAuto();
        this.difundir();
        break;
      case "tunel":
        msg.valor ? this.tunel?.iniciar() : this.tunel?.detener();
        break;
      case "expulsar": {
        const j = this.jugadores.get(msg.id);
        if (!j) return;
        this.jugadores.delete(j.id);
        if (j.socket) {
          j.socket.jugador = null;
          this.#enviar(j.socket, { t: "expulsado" });
        }
        this.difundir();
        break;
      }
      case "equipos": {
        const n = Number(msg.n);
        if (n === 0) this.equipos = null;
        else if (n >= 2 && n <= EQUIPOS.length) {
          this.equipos = EQUIPOS.slice(0, n);
          this.#repartir();
        }
        this.difundir();
        break;
      }
      case "repartir":
        if (this.equipos) this.#repartir();
        this.difundir();
        break;
      case "moverEquipo": {
        const j = this.jugadores.get(msg.id);
        if (!j || !this.equipos) return;
        const i = this.equipos.findIndex((e) => e.id === j.equipo);
        j.equipo = this.equipos[(i + 1) % this.equipos.length].id;
        this.difundir();
        break;
      }
      case "opcion":
        if (msg.clave === "operaciones" && [5, 8, 12, 16, 20].includes(Number(msg.valor))) {
          this.config.operaciones = Number(msg.valor); // Cálculo mental sin límite de tiempo
          this.difundir();
        }
        if (msg.clave === "pulsadorTipos" && Array.isArray(msg.valor)) {
          const validos = msg.valor.filter((t) => ["definicion", "calculo", "revuelto"].includes(t));
          if (validos.length) this.config.pulsadorTipos = validos;
          this.difundir();
        }
        break;
      case "juego": {
        // Acciones del presentador dentro de un juego (p. ej. Correcto / Fallo en el pulsador).
        if (this.fase !== "jugando" || !this.ronda) return;
        const impl = obtenerJuego(this.juego.id);
        if (impl.accionHost?.(this.ronda, msg, this)) this.difundir();
        break;
      }
      case "reiniciarPuntos":
        this.#reiniciarPuntos();
        this.difundir();
        break;
    }
  }

  #reiniciarPuntos() {
    for (const j of this.jugadores.values()) j.puntos = 0;
    this.#reiniciarTorneo();
  }

  #reiniciarTorneo() {
    this.eliminados = new Set();
    this.eliminadoRonda = null;
    this.campeon = null;
    this.desempate = null;
    this.animo = {};
  }

  /**
   * Partida a puntos: gana quien llega antes a la meta. Si llegan dos o más en la misma prueba,
   * se juegan la victoria en una última prueba (gana el mejor de ellos en esa prueba).
   * Por equipos cuenta la puntuación del equipo.
   */
  #comprobarMeta(filas) {
    const meta = this.config.meta;
    if (this.config.modo === "torneo" || !meta || this.campeon) return;
    const equipos = this.#clasificacionEquipos();
    if (this.desempate?.length) {
      let mejores;
      if (equipos) {
        const vivos = equipos.filter((e) => this.desempate.includes(e.id));
        const max = Math.max(...vivos.map((e) => e.puntos));
        mejores = vivos.filter((e) => e.puntos === max).map((e) => e.id);
      } else {
        const puesto = (id) => filas.find((f) => f.id === id)?.puesto ?? Infinity;
        const mejor = Math.min(...this.desempate.map(puesto));
        mejores = this.desempate.filter((id) => puesto(id) === mejor);
      }
      if (mejores.length === 1) {
        this.campeon = mejores[0];
        this.desempate = null;
      } else this.desempate = mejores; // siguen empatados: otra prueba más
      return;
    }
    const entradas = equipos ?? [...this.jugadores.values()].map((j) => ({ id: j.id, puntos: j.puntos }));
    const llegan = entradas.filter((x) => x.puntos >= meta);
    if (llegan.length === 1) this.campeon = llegan[0].id;
    else if (llegan.length > 1) this.desempate = llegan.map((x) => x.id);
  }

  /** Jugadores que juegan la ronda (en el torneo, los que no están eliminados). */
  #enJuego() {
    return [...this.jugadores.values()].filter((j) => !this.eliminados.has(j.id));
  }

  /** Torneo: sale el peor de la ronda (desempata quien lleva menos puntos; si siguen iguales, nadie sale). */
  #eliminarPeor(filas) {
    const vivos = filas.filter((f) => !this.eliminados.has(f.id) && this.jugadores.get(f.id)?.conectado !== false);
    if (vivos.length < 2) return null;
    const peorPuesto = (f) => f.puesto ?? Infinity;
    const orden = [...vivos].sort((a, b) => peorPuesto(b) - peorPuesto(a) || this.jugadores.get(a.id).puntos - this.jugadores.get(b.id).puntos);
    const [peor, siguiente] = orden;
    const empate = peorPuesto(peor) === peorPuesto(siguiente) && this.jugadores.get(peor.id).puntos === this.jugadores.get(siguiente.id).puntos;
    if (empate) return null;
    this.eliminados.add(peor.id);
    const quedan = this.#enJuego();
    if (quedan.length === 1) this.campeon = quedan[0].id;
    return peor.id;
  }

  #equipoMasPequeno() {
    if (!this.equipos) return null;
    const cuenta = Object.fromEntries(this.equipos.map((e) => [e.id, 0]));
    for (const j of this.jugadores.values()) if (j.equipo in cuenta) cuenta[j.equipo]++;
    return this.equipos.reduce((a, e) => (cuenta[e.id] < cuenta[a.id] ? e : a), this.equipos[0]).id;
  }

  #repartir() {
    const lista = [...this.jugadores.values()].sort(() => Math.random() - 0.5);
    lista.forEach((j, i) => (j.equipo = this.equipos[i % this.equipos.length].id));
  }

  /** Puntos de cada equipo: la media de sus miembros (justo aunque haya equipos de distinto tamaño). */
  #clasificacionEquipos() {
    if (!this.equipos) return null;
    const filas = this.equipos.map((e) => {
      const miembros = [...this.jugadores.values()].filter((j) => j.equipo === e.id);
      const media = miembros.length ? miembros.reduce((a, j) => a + j.puntos, 0) / miembros.length : 0;
      return { ...e, puntos: Math.round(media * 10) / 10, miembros: miembros.map((j) => j.id), valor: miembros.length ? media : null };
    });
    return clasificar(filas).map(({ valor, ...f }) => f);
  }

  #juegoAleatorio() {
    // Al azar entre las pruebas elegidas al crear la sala (el pulsador necesita a alguien que lo lleve).
    const elegidas = this.config.juegos.filter((id) => id !== "pulsador");
    const ids = elegidas.length ? elegidas : juegosDisponibles().filter((id) => id !== "pulsador");
    const otros = ids.filter((id) => id !== this.ultimoJuego);
    const lista = otros.length ? otros : ids;
    return lista[Math.floor(Math.random() * lista.length)];
  }

  // ------------------------------------------------------------ fases
  #irA(fase, { fin = null } = {}) {
    clearTimeout(this.temporizador);
    clearInterval(this.intervaloTic);
    this.temporizador = null;
    this.fase = fase;
    this.fin = fin;
    this.#reprogramarAuto();
    this.difundir();
  }

  #programar(ms, fn) {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(fn, Math.max(0, ms));
  }

  #reprogramarAuto() {
    if (!this.config.automatico || this.config.autoPausado || !FASES_AUTO.includes(this.fase)) return;
    const espera = (this.config.tiempoAuto ?? 10) * 1000;
    this.fin = Date.now() + espera;
    this.#programar(espera, () => this.#accionHost({ accion: "siguiente" }));
  }

  #presentar(juegoId) {
    const meta = listaJuegos().find((j) => j.id === juegoId);
    if (!meta || !meta.disponible) return;
    this.juego = { ...meta, duracion: this.config.duraciones[meta.id] ?? meta.duracion };
    if (meta.ambitos?.length) this.config.ambito = meta.ambitoDefecto ?? "azar"; // cada juego con tema empieza en su opción por defecto
    if (!TIEMPOS.includes(this.juego.duracion)) this.juego.duracion = 120;
    this.ronda = null;
    this.resultados = null;
    this.resumen = null;
    this.#irA("presentacion");
  }

  #cuentaAtras() {
    this.#irA("cuenta", { fin: Date.now() + CUENTA_ATRAS_MS });
    this.#programar(CUENTA_ATRAS_MS, () => this.#iniciarRonda());
  }

  #iniciarRonda() {
    const impl = obtenerJuego(this.juego.id);
    this.rondaN++;
    const inicio = Date.now();
    this.ronda = impl.crear({ azar: crearAzar(inicio), config: this.config, duracion: msDuracion(this.juego.duracion), inicio });
    // Preparamos el estado de cada jugador conectado para que cuenten en el resultado.
    for (const j of this.#enJuego()) if (j.conectado) impl.vistaJugador(this.ronda, j.id);
    const fin = inicio + msDuracion(this.juego.duracion);
    this.#irA("jugando", { fin });
    this.#programar(fin - Date.now(), () => this.#terminarRonda());
    // Juegos con su propio reloj interno (p. ej. Cálculo mental) piden refrescos periódicos.
    const tic = typeof impl.tic === "function" ? impl.tic(this.config) : impl.tic;
    if (tic) this.intervaloTic = setInterval(() => (this.#todosTerminaron() ? this.#terminarRonda() : this.difundir()), tic);
  }

  #todosTerminaron() {
    const impl = obtenerJuego(this.juego.id);
    const activos = this.#enJuego().filter((j) => j.conectado);
    return activos.length > 0 && activos.every((j) => impl.terminado(this.ronda, j.id));
  }

  #terminarRonda() {
    if (this.fase === "cuenta") {
      this.#irA("presentacion");
      return;
    }
    if (this.fase !== "jugando") return;
    const impl = obtenerJuego(this.juego.id);
    const ids = this.#enJuego().map((j) => j.id);
    const filas = clasificar(impl.resultados(this.ronda, ids));
    this.resultados = filas.map((f) => {
      const j = this.jugadores.get(f.id);
      const puntos = puntosPorPuesto(f.puesto, this.config.tablaPuntos);
      j.puntos += puntos;
      return { id: f.id, nombre: j.nombre, color: j.color, colorTexto: j.colorTexto, contorno: j.contorno, foto: j.foto, sombrero: j.sombrero ?? null, animacion: j.animacion ?? null, puesto: f.puesto, texto: f.texto, detalle: f.detalle ?? null, pendiente: f.pendiente ?? null, puntos };
    });
    this.resumen = impl.resumen(this.ronda);
    this.ultimoJuego = this.juego.id;
    this.eliminadoRonda = this.config.modo === "torneo" ? this.#eliminarPeor(filas) : null;
    // Cómo quedó cada uno en esta prueba: el ganador lo celebra y los últimos se ponen tristes.
    const conPuesto = filas.filter((f) => f.puesto != null);
    const peor = Math.max(0, ...conPuesto.map((f) => f.puesto));
    this.animo = {};
    for (const f of filas) {
      if (f.puesto === 1) this.animo[f.id] = "gana";
      // Tristes: los que no puntúan; si todos puntúan, el último (con 3 o más jugadores).
      else if (f.puesto == null || (filas.length > 2 && conPuesto.length === filas.length && f.puesto === peor)) this.animo[f.id] = "pierde";
    }
    this.#comprobarMeta(filas);
    this.#irA("resultados");
  }

  // ------------------------------------------------------------ vistas
  difundir() {
    if (this.envioPendiente) return;
    this.envioPendiente = true;
    setTimeout(() => {
      this.envioPendiente = false;
      for (const ws of this.tvs) this.#enviar(ws, this.#vistaTV(ws));
      for (const j of this.jugadores.values()) if (j.socket) this.#enviar(j.socket, this.#vistaJugador(j));
    }, 25);
  }

  #clasificacionGeneral() {
    const filas = clasificar(
      [...this.jugadores.values()].map((j) => ({ id: j.id, valor: j.puntos })),
    );
    return Object.fromEntries(filas.map((f) => [f.id, f.puesto]));
  }

  #base() {
    const puestos = this.#clasificacionGeneral();
    return {
      t: "estado",
      ahora: Date.now(),
      fase: this.fase,
      fin: this.fin,
      rondaN: this.rondaN,
      juego: this.juego,
      automatico: this.config.automatico,
      sala: {
        modo: this.config.modo,
        dificultad: this.config.dificultad,
        pruebas: this.config.pruebas,
        juegos: this.config.juegos,
        equipos: this.equipos?.length ?? 0,
        eliminadoRonda: this.eliminadoRonda,
        campeon: this.campeon,
        meta: this.config.meta, // en el torneo no se usa
        ambito: this.config.ambito,
        tiempoAuto: this.config.tiempoAuto,
        operaciones: this.config.operaciones ?? 8,
        autoPausado: this.config.autoPausado,
        desempate: this.desempate,
        animo: this.animo,
      },
      jugadores: [...this.jugadores.values()].map((j) => ({
        eliminado: this.eliminados.has(j.id),
        id: j.id,
        nombre: j.nombre,
        color: j.color,
        puntos: j.puntos,
        puesto: puestos[j.id],
        conectado: j.conectado,
        equipo: j.equipo,
        colorTexto: j.colorTexto,
        contorno: j.contorno,
        foto: j.foto,
        sombrero: j.sombrero ?? null,
        animacion: j.animacion ?? null,
      })),
      equipos: this.#clasificacionEquipos(),
      pulsadorTipos: this.config.pulsadorTipos,
      resultados: this.resultados,
      resumen: this.resumen,
    };
  }

  #vistaTV(ws) {
    const v = this.#base();
    v.esHost = Boolean(ws.esHost);
    v.catalogo = listaJuegos();
    v.tablaPuntos = this.config.tablaPuntos;
    v.red = {
      local: this.urlLocal,
      tunel: this.tunel?.url ?? null,
      tunelEstado: this.tunel?.estado ?? "apagado",
      urlApp: this.urlApp,
      // Código de sala: 6 cifras (1234-56); si el buzón falla, las palabras del túnel.
      codigo: this.codigoListo && this.cifras ? this.codigo?.formatear(this.cifras) ?? this.cifras : this.tunel?.url?.match(/https:\/\/([a-z0-9-]+)\.trycloudflare\.com/)?.[1] ?? null,
    };
    v.esMando = Boolean(ws.esMando);
    if (ws.esHost) v.claveHost = this.claveHost; // para dibujar el QR del mando
    if (this.fase === "jugando" && this.ronda) {
      const impl = obtenerJuego(this.juego.id);
      v.datos = impl.vistaTV(this.ronda);
      // Solo el presentador (su mando, o la TV mientras mantiene "👁 Solución") recibe las soluciones.
      if (ws.esHost && impl.vistaMando) v.mando = impl.vistaMando(this.ronda);
    }
    return v;
  }

  #vistaJugador(j) {
    const v = this.#base();
    v.yo = { eliminado: this.eliminados.has(j.id), id: j.id, nombre: j.nombre, color: j.color, colorTexto: j.colorTexto, contorno: j.contorno, foto: j.foto, sombrero: j.sombrero ?? null, animacion: j.animacion ?? null, puntos: j.puntos, equipo: j.equipo };
    // Batalla: el anfitrión elige los juegos desde su móvil (necesita el catálogo) y ve el código de la sala.
    if (this.enNavegador) {
      v.batalla = { codigo: this.cifras };
      if (j.esHost) {
        v.esHost = true;
        v.catalogo = listaJuegos();
      }
    }
    if (this.fase === "jugando" && this.ronda && !this.eliminados.has(j.id)) {
      const impl = obtenerJuego(this.juego.id);
      v.datos = impl.vistaJugador(this.ronda, j.id);
      v.terminado = impl.terminado(this.ronda, j.id);
    }
    return v;
  }
}
