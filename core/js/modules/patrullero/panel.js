import { auth, db } from "../../../firebase-init.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  getDoc,
  orderBy,
  getDocs,
  limit,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const countDisponibles = document.getElementById("countDisponibles");
const countActivas = document.getElementById("countActivas");
const countHistorial = document.getElementById("countHistorial");

const kpiDisponibles = document.getElementById("kpiDisponibles");
const kpiActivas = document.getElementById("kpiActivas");
const kpiHistorial = document.getElementById("kpiHistorial");

const goDisponibles = document.getElementById("goDisponibles");
const goActivas = document.getElementById("goActivas");
const goHistorial = document.getElementById("goHistorial");

const tabDisponibles = document.getElementById("tabDisponibles");
const tabActivas = document.getElementById("tabActivas");
const tabHistorial = document.getElementById("tabHistorial");

const usuarioInfo = document.getElementById("usuarioInfo");

const heroTitulo = document.getElementById("heroTitulo");
const heroTexto = document.getElementById("heroTexto");
const heroBadge = document.getElementById("heroBadge");
const heroEstadoActual = document.getElementById("heroEstadoActual");
const heroCampoActual = document.getElementById("heroCampoActual");
const heroGpsEstado = document.getElementById("heroGpsEstado");

const nextActionTitle = document.getElementById("nextActionTitle");
const nextActionText = document.getElementById("nextActionText");
const nextActionBadge = document.getElementById("nextActionBadge");
const nextActionBtn = document.getElementById("nextActionBtn");

const smartDisponibles = document.getElementById("smartDisponibles");
const smartActivas = document.getElementById("smartActivas");
const smartHistorial = document.getElementById("smartHistorial");
const smartGps = document.getElementById("smartGps");
const smartCampo = document.getElementById("smartCampo");

let currentUser = null;
let perfilPatrullero = null;

let unsubDisponibles = null;
let unsubActivas = null;
let unsubHistorial = null;

let patrullaActivaActual = null;

let geoWatchId = null;
let trackingSolicitudId = null;
let ultimoTrackingMs = 0;
let ultimaLatEnviada = null;
let ultimaLngEnviada = null;

let miniMapa = null;
let miniMapaMarcadorActual = null;
let miniMapaMarcadorEnviado = null;
let miniMapaLinea = null;
let miniMapaRuta = null;
let miniMapaMarcadorInicioRuta = null;
let miniMapaMarcadorFinRuta = null;

let miniMapaSeguirUbicacion = true;




let timerEstadoConexion = null;

let gpsEstado = {
  activo: false,
  permiso: "pendiente",
  ultimaSenialMs: null,
  precisionM: null,
  velocidadMps: null,
  error: "",
  modo: "inactivo",
  enviandoManual: false,
  ultimaAccionManual: "",
  pausado: false
};



function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatFecha(value) {
  if (!value) return "-";
  try {
    if (typeof value.toDate === "function") {
      return value.toDate().toLocaleString("es-AR");
    }
    return new Date(value).toLocaleString("es-AR");
  } catch {
    return "-";
  }
}

function renderEstadoBonito(estado = "") {
  const e = String(estado || "pendiente").toLowerCase();

  const map = {
    pendiente: "Pendiente",
    asignada: "Asignada",
    aceptada: "Aceptada",
    en_camino: "En camino",
    en_curso: "En curso",
    finalizada: "Finalizada"
  };

  return map[e] || e;
}

function badgePrioridad(prioridad = "") {
  const p = String(prioridad || "media").toLowerCase();

  if (p === "alta") {
    return `<span class="chip-prioridad alta">🔴 Alta</span>`;
  }

  if (p === "baja") {
    return `<span class="chip-prioridad baja">🟢 Baja</span>`;
  }

  return `<span class="chip-prioridad media">🟡 Media</span>`;
}

function distanceSafe(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function getStatusContainer() {
  return document.getElementById("panelPatrullaStatus") || document.querySelector(".wrap") || document.body;
}

function limpiarListeners() {
  if (unsubDisponibles) unsubDisponibles();
  if (unsubActivas) unsubActivas();
  if (unsubHistorial) unsubHistorial();

  unsubDisponibles = null;
  unsubActivas = null;
  unsubHistorial = null;
}

function detenerTracking() {
  if (geoWatchId !== null) {
    navigator.geolocation.clearWatch(geoWatchId);
    geoWatchId = null;
  }

  trackingSolicitudId = null;
  ultimoTrackingMs = 0;
  ultimaLatEnviada = null;
  ultimaLngEnviada = null;

  gpsEstado.activo = false;
  gpsEstado.modo = "inactivo";
  gpsEstado.error = "";
  gpsEstado.enviandoManual = false;
  gpsEstado.ultimaAccionManual = "";
  renderEstadoGPS();
  renderEstadoConexion();
}

function soportaGeolocalizacion() {
  return typeof navigator !== "undefined" && !!navigator.geolocation;
}

function calcularDistanciaMetros(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => deg * Math.PI / 180;
  const R = 6371000;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function validarAccesoPatrullero(user) {
  const refDoc = doc(db, "patrulleros_externos", user.uid);
  const snap = await getDoc(refDoc);

  if (!snap.exists()) {
    throw new Error("Tu cuenta no pertenece a un patrullero externo registrado.");
  }

  const data = snap.data();

  if (data.estado !== "aprobado") {
    throw new Error("Tu cuenta todavía no fue aprobada.");
  }

  if (data.activo !== true) {
    throw new Error("Tu cuenta se encuentra inactiva.");
  }

  return data;
}

function puedeVerComoDisponible(item) {
  const estado = String(item.estado || "").toLowerCase();
  const asignadoInterno = String(item.asignadoPatrulleroDni || "").trim();
  const tomadoPorExterno = String(item.patrulleroExternoId || "").trim();

  if (estado !== "pendiente") return false;
  if (asignadoInterno) return false;
  if (tomadoPorExterno) return false;
  if (patrullaActivaActual) return false;

  return true;
}

function esPatrullaActivaDeEstePatrullero(item) {
  const estado = String(item.estado || "").toLowerCase();
  const esMia = String(item.patrulleroExternoId || "") === String(currentUser?.uid || "");

  if (!esMia) return false;

  return ["asignada", "aceptada", "en_camino", "en_curso"].includes(estado);
}

function esPatrullaTrackeable(item) {
  const estado = String(item?.estado || "").toLowerCase();
  const esMia = String(item?.patrulleroExternoId || "") === String(currentUser?.uid || "");
  return esMia && ["en_camino", "en_curso"].includes(estado);
}

function esPatrullaFinalizadaDeEstePatrullero(item) {
  const estado = String(item.estado || "").toLowerCase();
  const esMia = String(item.patrulleroExternoId || "") === String(currentUser?.uid || "");

  return esMia && estado === "finalizada";
}

function estadoPeso(estado = "") {
  const e = String(estado).toLowerCase();

  if (e === "en_curso") return 1;
  if (e === "en_camino") return 2;
  if (e === "aceptada") return 3;
  if (e === "asignada") return 4;
  return 99;
}

function ordenarActivas(items = []) {
  return [...items].sort((a, b) => {
    const pesoA = estadoPeso(a.estado);
    const pesoB = estadoPeso(b.estado);

    if (pesoA !== pesoB) return pesoA - pesoB;

    const aTime = a.aceptadaEn?.toDate ? a.aceptadaEn.toDate().getTime() : 0;
    const bTime = b.aceptadaEn?.toDate ? b.aceptadaEn.toDate().getTime() : 0;
    return bTime - aTime;
  });
}

function obtenerPatrullaPrincipal(items = []) {
  if (!items.length) return null;
  return ordenarActivas(items)[0];
}

function renderBannerPatrullaActiva() {
  const existing = document.getElementById("bannerPatrullaActiva");
  if (existing) existing.remove();

  if (!patrullaActivaActual) return;

  const contenedor = getStatusContainer();
  if (!contenedor) return;

  const campo =
    patrullaActivaActual.nombreCampo ||
    patrullaActivaActual.campo ||
    patrullaActivaActual.establecimiento ||
    "Campo sin nombre";

  const estado = renderEstadoBonito(patrullaActivaActual.estado || "aceptada");

  const div = document.createElement("div");
  div.id = "bannerPatrullaActiva";
  div.className = "pp-card pp-banner";
  div.innerHTML = `
    <div class="pp-card-title">🚨 Patrulla activa</div>
    <div class="pp-card-body">
      <b>Campo:</b> ${escapeHtml(campo)}<br>
      <b>Estado:</b> ${escapeHtml(estado)}
    </div>
  `;

  contenedor.appendChild(div);
  actualizarHeroOperativa();
}

function textoGpsModo() {
  if (!patrullaActivaActual) return "Sin patrulla activa";

  if (trackingEstaPausado()) return "Tracking pausado manualmente";

  const estado = String(patrullaActivaActual.estado || "").toLowerCase();

  if (estado === "en_camino") return "Patrulla en camino";
  if (estado === "en_curso") return "Patrulla en curso";
  if (estado === "aceptada") return "Patrulla aceptada, GPS aún no iniciado";

  return "GPS inactivo";
}

function tiempoDesdeUltimaSenialTexto() {
  if (!gpsEstado.ultimaSenialMs) return "Sin registros";

  const diffMs = Date.now() - gpsEstado.ultimaSenialMs;
  const seg = Math.max(0, Math.floor(diffMs / 1000));

  if (seg < 60) return `Hace ${seg} s`;

  const min = Math.floor(seg / 60);
  const resto = seg % 60;

  if (min < 60) {
    return resto > 0 ? `Hace ${min} min ${resto} s` : `Hace ${min} min`;
  }

  const horas = Math.floor(min / 60);
  const minRest = min % 60;
  return minRest > 0 ? `Hace ${horas} h ${minRest} min` : `Hace ${horas} h`;
}

function obtenerEstadoConexion() {
  if (gpsEstado.error) {
    return {
      texto: "Error de señal",
      icono: "🔴",
      clase: "error"
    };
  }

  if (gpsEstado.pausado) {
    return {
      texto: "Tracking pausado",
      icono: "⏸️",
      clase: "pausado"
    };
  }

  if (!gpsEstado.ultimaSenialMs) {
    return {
      texto: "Sin señal",
      icono: "⚪",
      clase: "sin_senal"
    };
  }

  const diffMs = Date.now() - gpsEstado.ultimaSenialMs;
  const seg = Math.floor(diffMs / 1000);

  if (seg <= 20) {
    return {
      texto: "En línea",
      icono: "🟢",
      clase: "online"
    };
  }

  if (seg <= 60) {
    return {
      texto: "Señal reciente",
      icono: "🟡",
      clase: "reciente"
    };
  }

  return {
    texto: "Sin señal reciente",
    icono: "🔴",
    clase: "offline"
  };
}
function renderEstadoConexion() {
  const existente = document.getElementById("estadoConexionPatrullero");
  if (existente) existente.remove();

  const estado = obtenerEstadoConexion();

  let extraClass = "pp-gps-info";
  if (estado.clase === "online") extraClass = "pp-gps-ok";
  else if (estado.clase === "reciente") extraClass = "pp-gps-warn";
  else if (estado.clase === "offline" || estado.clase === "error") extraClass = "pp-gps-danger";
  else if (estado.clase === "pausado") extraClass = "pp-gps-info";

  const div = document.createElement("div");
  div.id = "estadoConexionPatrullero";
  div.className = `pp-card ${extraClass}`;

  div.innerHTML = `
    <div class="pp-card-title">${estado.icono} Estado de conexión</div>
    <div class="pp-card-body">
      <b>Estado:</b> ${escapeHtml(estado.texto)}<br>
      <b>Última señal:</b> ${escapeHtml(
    gpsEstado.ultimaSenialMs
      ? new Date(gpsEstado.ultimaSenialMs).toLocaleString("es-AR")
      : "—"
  )}<br>
      <b>Tiempo desde última señal:</b> ${escapeHtml(tiempoDesdeUltimaSenialTexto())}
    </div>
  `;

  const contenedor = getStatusContainer();
  const controles = document.getElementById("controlesGpsPatrullero");

  if (controles && controles.parentNode === contenedor) {
    controles.insertAdjacentElement("afterend", div);
  } else {
    contenedor.appendChild(div);
  }
}

function iniciarTimerEstadoConexion() {
  detenerTimerEstadoConexion();

  timerEstadoConexion = setInterval(() => {
    renderEstadoConexion();
  }, 5000);
}

function detenerTimerEstadoConexion() {
  if (timerEstadoConexion) {
    clearInterval(timerEstadoConexion);
    timerEstadoConexion = null;
  }
}

function colorEstadoGps() {
  if (gpsEstado.error) {
    return {
      fondo: "#fee2e2",
      borde: "#fecaca",
      texto: "#991b1b",
      titulo: "⚠️ Error de GPS"
    };
  }

  if (gpsEstado.pausado) {
    return {
      fondo: "#fef3c7",
      borde: "#fcd34d",
      texto: "#92400e",
      titulo: "⏸️ GPS pausado"
    };
  }

  if (gpsEstado.activo) {
    return {
      fondo: "#dcfce7",
      borde: "#86efac",
      texto: "#166534",
      titulo: "🛰️ GPS activo"
    };
  }

  return {
    fondo: "#f3f4f6",
    borde: "#d1d5db",
    texto: "#374151",
    titulo: "📡 GPS inactivo"
  };
}

function formatVelocidad(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)} m/s`;
}

function renderEstadoGPS() {
  const existing = document.getElementById("estadoGpsPatrullero");
  if (existing) existing.remove();

  const estilos = colorEstadoGps();

  let extraClass = "";
  if (gpsEstado.error) extraClass = "pp-gps-danger";
  else if (gpsEstado.pausado) extraClass = "pp-gps-warn";
  else if (gpsEstado.activo) extraClass = "pp-gps-ok";
  else extraClass = "pp-gps-info";

  const div = document.createElement("div");
  div.id = "estadoGpsPatrullero";
  div.className = `pp-card ${extraClass}`;

  div.innerHTML = `
    <div class="pp-card-title">${estilos.titulo}</div>
    <div class="pp-card-body">
      <b>Modo:</b> ${escapeHtml(textoGpsModo())}<br>
      <b>Permiso:</b> ${escapeHtml(gpsEstado.permiso || "pendiente")}<br>
      <b>Última señal:</b> ${escapeHtml(
    gpsEstado.ultimaSenialMs
      ? new Date(gpsEstado.ultimaSenialMs).toLocaleString("es-AR")
      : "—"
  )}<br>
      <b>Precisión:</b> ${escapeHtml(
    gpsEstado.precisionM != null ? `${gpsEstado.precisionM} m` : "—"
  )}<br>
      <b>Velocidad:</b> ${escapeHtml(formatVelocidad(gpsEstado.velocidadMps))}<br>
      <b>Error:</b> ${escapeHtml(gpsEstado.error || "Sin errores")}
    </div>
  `;

  const contenedor = getStatusContainer();
  const banner = document.getElementById("bannerPatrullaActiva");

  if (banner && banner.parentNode === contenedor) {
    banner.insertAdjacentElement("afterend", div);
  } else {
    contenedor.appendChild(div);
  }

  renderControlesGPS();
  renderEstadoConexion();
  actualizarHeroOperativa();

  if (patrullaActivaActual) {
    actualizarMiniMapaConPosiciones({
      actualLat: Number(ultimaLatEnviada),
      actualLng: Number(ultimaLngEnviada),
      enviadaLat: Number(patrullaActivaActual?.trackingLat),
      enviadaLng: Number(patrullaActivaActual?.trackingLng),
      rutaPts: patrullaActivaActual?.rutaPts || []
    });
  }
}

function trackingEstaPausado() {
  return !!patrullaActivaActual?.trackingPausado;
}

function patrullaManualDisponible() {
  return !!(patrullaActivaActual && esPatrullaTrackeable(patrullaActivaActual));
}

function renderControlesGPS() {
  const existing = document.getElementById("controlesGpsPatrullero");
  if (existing) existing.remove();

  const div = document.createElement("div");
  div.id = "controlesGpsPatrullero";
  div.className = "pp-card";

  const disponible = patrullaManualDisponible();
  const deshabilitado = !disponible || gpsEstado.enviandoManual;
  const pausado = trackingEstaPausado();

  div.innerHTML = `
    <div class="pp-card-title">🎛️ Controles de patrulla</div>

    <div class="pp-controls">
      <button
        id="btnEnviarSenialAhora"
        type="button"
        class="pp-btn"
        ${deshabilitado || pausado ? "disabled" : ""}
      >
        📍 Enviar señal ahora
      </button>

      <button
        id="btnRefrescarUbicacion"
        type="button"
        class="pp-btn pp-btn-soft"
        ${deshabilitado || pausado ? "disabled" : ""}
      >
        🧭 Refrescar ubicación
      </button>

      <button
        id="${pausado ? "btnReanudarTracking" : "btnPausarTracking"}"
        type="button"
        class="pp-btn ${pausado ? "pp-btn-secondary" : "pp-btn-warning"}"
        ${!disponible ? "disabled" : ""}
      >
        ${pausado ? "▶️ Reanudar tracking" : "⏸️ Pausar tracking"}
      </button>

      <div class="pp-helper">
        ${escapeHtml(gpsEstado.ultimaAccionManual || "Sin acciones manuales recientes")}
      </div>
    </div>
  `;

  const contenedor = getStatusContainer();
  const estadoGps = document.getElementById("estadoGpsPatrullero");

  if (estadoGps && estadoGps.parentNode === contenedor) {
    estadoGps.insertAdjacentElement("afterend", div);
  } else {
    contenedor.appendChild(div);
  }
}

function asegurarMiniMapaUI() {
  const existente = document.getElementById("miniMapaPatrulleroWrap");
  if (existente) return existente;

  const wrap = document.createElement("div");
  wrap.id = "miniMapaPatrulleroWrap";
  wrap.className = "pp-card pp-section-gap";

  wrap.innerHTML = `
    <div class="pp-card-title">🗺️ Mini mapa de patrulla</div>

    <div class="pp-controls-2">
      <button
        id="btnCentrarMiniMapa"
        type="button"
        class="pp-btn pp-btn-soft"
      >
        🎯 Centrar mapa
      </button>

      <button
        id="btnSeguirMiniMapa"
        type="button"
        class="pp-btn pp-btn-secondary"
      >
        📍 Seguir ubicación: ON
      </button>
    </div>

    <div id="miniMapaPatrulleroInfo" class="pp-mini-info">
      Esperando posición...
    </div>

    <div id="miniMapaPatrullero" class="pp-mini-map"></div>
  `;

  const contenedor = getStatusContainer();
  const conexion = document.getElementById("estadoConexionPatrullero");

  if (conexion && conexion.parentNode === contenedor) {
    conexion.insertAdjacentElement("afterend", wrap);
  } else {
    contenedor.appendChild(wrap);
  }

  return wrap;
}

function destruirMiniMapaSiNoHayPatrulla() {
  if (miniMapa) {
    miniMapa.remove();
    miniMapa = null;
  }

  miniMapaMarcadorActual = null;
  miniMapaMarcadorEnviado = null;
  miniMapaLinea = null;
  miniMapaRuta = null;
  miniMapaMarcadorInicioRuta = null;
  miniMapaMarcadorFinRuta = null;

  const wrap = document.getElementById("miniMapaPatrulleroWrap");
  if (wrap) wrap.remove();

  miniMapaSeguirUbicacion = true;
}

function actualizarTextoBotonSeguirMiniMapa() {
  const btn = document.getElementById("btnSeguirMiniMapa");
  if (!btn) return;

  btn.textContent = miniMapaSeguirUbicacion
    ? "📍 Seguir ubicación: ON"
    : "📍 Seguir ubicación: OFF";
}

function centrarMiniMapaEnPosicion() {
  if (!miniMapa) return;

  const actualDisponible =
    Number.isFinite(ultimaLatEnviada) && Number.isFinite(ultimaLngEnviada);

  const enviadaDisponible =
    Number.isFinite(Number(patrullaActivaActual?.trackingLat)) &&
    Number.isFinite(Number(patrullaActivaActual?.trackingLng));

  if (actualDisponible) {
    miniMapa.setView([ultimaLatEnviada, ultimaLngEnviada], 17);
    return;
  }

  if (enviadaDisponible) {
    miniMapa.setView(
      [Number(patrullaActivaActual.trackingLat), Number(patrullaActivaActual.trackingLng)],
      16
    );
  }
}


function inicializarMiniMapa() {
  if (!patrullaActivaActual) {
    destruirMiniMapaSiNoHayPatrulla();
    return;
  }

  asegurarMiniMapaUI();

  const el = document.getElementById("miniMapaPatrullero");
  if (!el) return;

  if (miniMapa) {
    setTimeout(() => miniMapa.invalidateSize(), 100);
    return;
  }

  miniMapa = L.map(el, {
    zoomControl: true
  }).setView([-33.0, -60.0], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(miniMapa);

  actualizarTextoBotonSeguirMiniMapa();

  setTimeout(() => miniMapa.invalidateSize(), 120);
}

function actualizarInfoMiniMapa({
  actualLat = null,
  actualLng = null,
  enviadaLat = null,
  enviadaLng = null,
  rutaPts = []
} = {}) {
  const info = document.getElementById("miniMapaPatrulleroInfo");
  if (!info) return;

  const fmt = (n) => Number.isFinite(n) ? n.toFixed(6) : "—";
  const rutaValida = obtenerRutaRecienteValida(rutaPts);

  const inicio = rutaValida.length ? rutaValida[0] : null;
  const fin = rutaValida.length ? rutaValida[rutaValida.length - 1] : null;

  info.innerHTML = `
    <b>Actual:</b> ${fmt(actualLat)}, ${fmt(actualLng)}<br>
    <b>Última enviada:</b> ${fmt(enviadaLat)}, ${fmt(enviadaLng)}<br>
    <b>Inicio ruta:</b> ${inicio ? `${fmt(inicio.lat)}, ${fmt(inicio.lng)}` : "—"}<br>
    <b>Fin ruta:</b> ${fin ? `${fmt(fin.lat)}, ${fmt(fin.lng)}` : "—"}<br>
    <b>Puntos de ruta:</b> ${rutaValida.length}
  `;
}


function obtenerRutaRecienteValida(rutaPts = [], maxPts = 40) {
  if (!Array.isArray(rutaPts)) return [];

  return rutaPts
    .map(p => ({
      lat: Number(p?.lat),
      lng: Number(p?.lng),
      ts: Number(p?.ts || 0)
    }))
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .sort((a, b) => a.ts - b.ts)
    .slice(-maxPts);
}


function actualizarMiniMapaConPosiciones({
  actualLat = null,
  actualLng = null,
  enviadaLat = null,
  enviadaLng = null,
  rutaPts = []
} = {}) {
  if (!patrullaActivaActual) {
    destruirMiniMapaSiNoHayPatrulla();
    return;
  }

  if (typeof L === "undefined") {
    console.warn("Leaflet no está cargado en el panel patrullero.");
    return;
  }

  inicializarMiniMapa();
  if (!miniMapa) return;

  const rutaValida = obtenerRutaRecienteValida(rutaPts);

  actualizarInfoMiniMapa({
    actualLat,
    actualLng,
    enviadaLat,
    enviadaLng,
    rutaPts: rutaValida
  });

  const puntosBounds = [];

  if (rutaValida.length >= 2) {
    const coordsRuta = rutaValida.map(p => [p.lat, p.lng]);

    if (!miniMapaRuta) {
      miniMapaRuta = L.polyline(coordsRuta, {
        weight: 4,
        opacity: 0.85
      }).addTo(miniMapa);
    } else {
      miniMapaRuta.setLatLngs(coordsRuta);
    }

    coordsRuta.forEach(p => puntosBounds.push(p));

    const inicio = rutaValida[0];
    const fin = rutaValida[rutaValida.length - 1];

    if (!miniMapaMarcadorInicioRuta) {
      miniMapaMarcadorInicioRuta = L.circleMarker([inicio.lat, inicio.lng], {
        radius: 7,
        weight: 2
      }).addTo(miniMapa);
    } else {
      miniMapaMarcadorInicioRuta.setLatLng([inicio.lat, inicio.lng]);
    }
    miniMapaMarcadorInicioRuta.bindPopup("🏁 Inicio de ruta");

    if (!miniMapaMarcadorFinRuta) {
      miniMapaMarcadorFinRuta = L.circleMarker([fin.lat, fin.lng], {
        radius: 7,
        weight: 2
      }).addTo(miniMapa);
    } else {
      miniMapaMarcadorFinRuta.setLatLng([fin.lat, fin.lng]);
    }
    miniMapaMarcadorFinRuta.bindPopup("📍 Fin de ruta");
  } else {
    if (miniMapaRuta) {
      miniMapa.removeLayer(miniMapaRuta);
      miniMapaRuta = null;
    }

    if (miniMapaMarcadorInicioRuta) {
      miniMapa.removeLayer(miniMapaMarcadorInicioRuta);
      miniMapaMarcadorInicioRuta = null;
    }

    if (miniMapaMarcadorFinRuta) {
      miniMapa.removeLayer(miniMapaMarcadorFinRuta);
      miniMapaMarcadorFinRuta = null;
    }
  }

  if (Number.isFinite(actualLat) && Number.isFinite(actualLng)) {
    if (!miniMapaMarcadorActual) {
      miniMapaMarcadorActual = L.marker([actualLat, actualLng]).addTo(miniMapa);
    } else {
      miniMapaMarcadorActual.setLatLng([actualLat, actualLng]);
    }
    miniMapaMarcadorActual.bindPopup("📍 Ubicación actual");
    puntosBounds.push([actualLat, actualLng]);
  }

  if (Number.isFinite(enviadaLat) && Number.isFinite(enviadaLng)) {
    if (!miniMapaMarcadorEnviado) {
      miniMapaMarcadorEnviado = L.circleMarker([enviadaLat, enviadaLng], {
        radius: 8,
        weight: 2
      }).addTo(miniMapa);
    } else {
      miniMapaMarcadorEnviado.setLatLng([enviadaLat, enviadaLng]);
    }
    miniMapaMarcadorEnviado.bindPopup("🛰️ Última posición enviada");
    puntosBounds.push([enviadaLat, enviadaLng]);
  }

  const usarLineaSimple = rutaValida.length < 2;

  if (
    usarLineaSimple &&
    Number.isFinite(actualLat) &&
    Number.isFinite(actualLng) &&
    Number.isFinite(enviadaLat) &&
    Number.isFinite(enviadaLng)
  ) {
    const coordsLinea = [
      [actualLat, actualLng],
      [enviadaLat, enviadaLng]
    ];

    if (!miniMapaLinea) {
      miniMapaLinea = L.polyline(coordsLinea, {
        weight: 3,
        opacity: 0.8
      }).addTo(miniMapa);
    } else {
      miniMapaLinea.setLatLngs(coordsLinea);
    }
  } else if (miniMapaLinea) {
    miniMapa.removeLayer(miniMapaLinea);
    miniMapaLinea = null;
  }

  if (miniMapaSeguirUbicacion) {
    if (rutaValida.length === 1) {
      const unico = rutaValida[0];

      if (!miniMapaMarcadorInicioRuta) {
        miniMapaMarcadorInicioRuta = L.circleMarker([unico.lat, unico.lng], {
          radius: 7,
          weight: 2
        }).addTo(miniMapa);
      } else {
        miniMapaMarcadorInicioRuta.setLatLng([unico.lat, unico.lng]);
      }
      miniMapaMarcadorInicioRuta.bindPopup("🏁 Inicio / fin de ruta");

      if (miniMapaMarcadorFinRuta) {
        miniMapa.removeLayer(miniMapaMarcadorFinRuta);
        miniMapaMarcadorFinRuta = null;
      }

      puntosBounds.push([unico.lat, unico.lng]);
    }
    if (Number.isFinite(actualLat) && Number.isFinite(actualLng)) {
      miniMapa.setView([actualLat, actualLng], 17);
    } else if (puntosBounds.length === 1) {
      miniMapa.setView(puntosBounds[0], 16);
    } else if (puntosBounds.length > 1) {
      miniMapa.fitBounds(puntosBounds, { padding: [30, 30] });
    }
  }

  actualizarTextoBotonSeguirMiniMapa();
  setTimeout(() => miniMapa?.invalidateSize(), 80);

}

function renderBotones(item, tipoLista) {
  const estado = String(item.estado || "pendiente").toLowerCase();
  const tengoOtraActiva = !!patrullaActivaActual && patrullaActivaActual.id !== item.id;

  if (tipoLista === "disponibles") {
    if (tengoOtraActiva || patrullaActivaActual) {
      return `
        <button class="btn-disabled" disabled>
          Ya tenés una patrulla activa
        </button>
      `;
    }

    return `
      <button class="btnAceptar" data-action="aceptar" data-id="${item.id}">
        ✅ Aceptar servicio
      </button>
    `;
  }

  if (tipoLista === "activas") {
    if (estado === "asignada" || estado === "aceptada") {
      return `
        <button class="btnCamino" data-action="camino" data-id="${item.id}">
          🚗 Salir al lugar
        </button>
      `;
    }

    if (estado === "en_camino") {
      return `
        <button class="btnIniciar" data-action="iniciar" data-id="${item.id}">
          ▶️ Iniciar patrulla
        </button>
      `;
    }

    if (estado === "en_curso") {
      return `
        <button class="btnFinalizar" data-action="finalizar" data-id="${item.id}">
          🏁 Finalizar patrulla
        </button>
      `;
    }
  }

  return "";
}

function renderCard(item, tipoLista) {
  const campo = item.nombreCampo || item.campo || item.establecimiento || "Campo sin nombre";
  const motivo = item.motivo || item.tipo || item.tipoSolicitud || "Patrulla";
  const prioridad = item.prioridad || "Media";
  const detalle = item.detalle || item.descripcion || "Sin detalle";
  const ubicacion = item.ubicacion || item.direccion || item.potrero || item.referenciaLugar || "-";
  const estado = item.estado || "pendiente";
  const distanciaSugerida = Number(item.sugeridoDistanciaM || 0);
  const trackingTxt = Number.isFinite(item.trackingUltimaActualizacionMs)
    ? new Date(item.trackingUltimaActualizacionMs).toLocaleString("es-AR")
    : "—";

  return `
    <div class="solicitud">
      <div class="solicitud-head">
        <div class="solicitud-main">
          <h3>${escapeHtml(campo)}</h3>
        </div>
        <span class="estado ${escapeHtml(estado)}">${escapeHtml(renderEstadoBonito(estado))}</span>
      </div>

      <div class="solicitud-meta">
        ${badgePrioridad(prioridad)}
      </div>

      <div class="solicitud-datos">
        <div class="solicitud-item">
          <span class="solicitud-item-label">Motivo</span>
          <span class="solicitud-item-value">${escapeHtml(String(motivo).replaceAll("_", " "))}</span>
        </div>

        <div class="solicitud-item">
          <span class="solicitud-item-label">Ubicación</span>
          <span class="solicitud-item-value">${escapeHtml(ubicacion)}</span>
        </div>

        <div class="solicitud-item solicitud-item-full">
          <span class="solicitud-item-label">Detalle</span>
          <span class="solicitud-item-value">${escapeHtml(detalle)}</span>
        </div>

        <div class="solicitud-item">
          <span class="solicitud-item-label">Duración estimada</span>
          <span class="solicitud-item-value">${escapeHtml(item.duracionHoras || "-")} h</span>
        </div>

        <div class="solicitud-item">
          <span class="solicitud-item-label">Distancia sugerida</span>
          <span class="solicitud-item-value">${distanciaSugerida ? `${distanceSafe(distanciaSugerida)} m` : "—"}</span>
        </div>

        <div class="solicitud-item">
          <span class="solicitud-item-label">Tracking</span>
          <span class="solicitud-item-value">${escapeHtml(trackingTxt)}</span>
        </div>

        <div class="solicitud-item">
          <span class="solicitud-item-label">Aceptada</span>
          <span class="solicitud-item-value">${escapeHtml(formatFecha(item.aceptadaEn || item.aceptadaAt))}</span>
        </div>

        <div class="solicitud-item">
          <span class="solicitud-item-label">En camino</span>
          <span class="solicitud-item-value">${escapeHtml(formatFecha(item.salidaAlLugarEn))}</span>
        </div>

        <div class="solicitud-item">
          <span class="solicitud-item-label">Inicio</span>
          <span class="solicitud-item-value">${escapeHtml(formatFecha(item.inicioPatrullaAt || item.iniciadaEn))}</span>
        </div>

        <div class="solicitud-item">
          <span class="solicitud-item-label">Fin</span>
          <span class="solicitud-item-value">${escapeHtml(formatFecha(item.finalizadaEn || item.finPatrullaAt))}</span>
        </div>
      </div>

      <div class="actions">
        ${renderBotones(item, tipoLista)}
      </div>
    </div>
  `;
}

function renderLista(contenedor, items, tipoLista, textoVacio) {
  if (!contenedor) return;

  if (!items.length) {
    let icono = "📭";

    if (tipoLista === "activas") icono = "🚓";
    if (tipoLista === "historial") icono = "📚";

    contenedor.innerHTML = `
      <div class="empty fade-in-up">
        <div class="empty-icon">${icono}</div>
        <div class="empty-title">${escapeHtml(textoVacio)}</div>
        <div class="empty-subtitle">Cuando haya información disponible, la vas a ver acá.</div>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = items
    .map((item, index) => {
      return `<div class="fade-in-up" style="animation-delay:${index * 70}ms">${renderCard(item, tipoLista)}</div>`;
    })
    .join("");
}

function textoHeroGps() {
  if (gpsEstado.error) return "Error";
  if (gpsEstado.pausado) return "Pausado";
  if (gpsEstado.activo) return "Activo";
  return "Inactivo";
}

function actualizarHeroOperativa() {
  if (!heroTitulo || !heroTexto || !heroBadge || !heroEstadoActual || !heroCampoActual || !heroGpsEstado) return;

  const tieneActiva = !!patrullaActivaActual;
  const estado = String(patrullaActivaActual?.estado || "").toLowerCase();

  const campo =
    patrullaActivaActual?.nombreCampo ||
    patrullaActivaActual?.campo ||
    patrullaActivaActual?.establecimiento ||
    "—";

  heroGpsEstado.textContent = textoHeroGps();

  if (!tieneActiva) {
    heroTitulo.textContent = "Disponible para patrullaje";
    heroTexto.textContent = "No tenés una patrulla activa en este momento. Podés revisar nuevas solicitudes disponibles.";
    heroBadge.textContent = "🟢 Disponible";
    heroBadge.className = "hero-pill hero-pill-ok";
    heroEstadoActual.textContent = "Sin patrulla activa";
    heroCampoActual.textContent = "—";
    return;
  }

  if (estado === "aceptada" || estado === "asignada") {
    heroTitulo.textContent = "Patrulla aceptada";
    heroTexto.textContent = "Ya tomaste un servicio. El siguiente paso es salir al lugar para comenzar la operación.";
    heroBadge.textContent = "🔵 Preparado";
    heroBadge.className = "hero-pill hero-pill-info";
    heroEstadoActual.textContent = "Aceptada";
    heroCampoActual.textContent = campo;
    return;
  }

  if (estado === "en_camino") {
    heroTitulo.textContent = "En camino al objetivo";
    heroTexto.textContent = "Estás desplazándote al lugar asignado. Mantené el tracking activo y monitoreá la ubicación.";
    heroBadge.textContent = "🟡 En camino";
    heroBadge.className = "hero-pill hero-pill-warn";
    heroEstadoActual.textContent = "En camino";
    heroCampoActual.textContent = campo;
    return;
  }

  if (estado === "en_curso") {
    heroTitulo.textContent = "Patrulla en curso";
    heroTexto.textContent = "La patrulla está activa. Podés seguir el recorrido, pausar tracking o finalizar cuando corresponda.";
    heroBadge.textContent = "🟢 En curso";
    heroBadge.className = "hero-pill hero-pill-ok";
    heroEstadoActual.textContent = "En curso";
    heroCampoActual.textContent = campo;
    return;
  }

  if (estado === "finalizada") {
    heroTitulo.textContent = "Servicio finalizado";
    heroTexto.textContent = "La última patrulla fue completada. Ya podés revisar historial o aceptar un nuevo servicio.";
    heroBadge.textContent = "⚪ Finalizada";
    heroBadge.className = "hero-pill hero-pill-neutral";
    heroEstadoActual.textContent = "Finalizada";
    heroCampoActual.textContent = campo;
    return;
  }

  heroTitulo.textContent = "Estado operativo";
  heroTexto.textContent = "Revisá el panel para continuar con la gestión de solicitudes y patrullas.";
  heroBadge.textContent = "ℹ️ Operativo";
  heroBadge.className = "hero-pill hero-pill-info";
  heroEstadoActual.textContent = patrullaActivaActual?.estado || "—";
  heroCampoActual.textContent = campo;

  const hero = document.getElementById("heroOperativa");
  if (hero) {
    hero.classList.remove("hero-pulse");
    void hero.offsetWidth;
    hero.classList.add("hero-pulse");
  }
  actualizarNextAction();
  actualizarSmartSummary();
}

function actualizarNextAction() {
  if (!nextActionTitle || !nextActionText || !nextActionBadge || !nextActionBtn) return;

  const estado = String(patrullaActivaActual?.estado || "").toLowerCase();

  if (!patrullaActivaActual) {
    nextActionTitle.textContent = "Revisar solicitudes disponibles";
    nextActionText.textContent = "No tenés una patrulla activa. Podés aceptar un nuevo servicio.";
    nextActionBadge.textContent = "Disponible";
    nextActionBadge.className = "next-action-badge next-ok";
    nextActionBtn.textContent = "Ir a disponibles";
    nextActionBtn.dataset.target = "secDisponibles";
    return;
  }

  if (estado === "asignada" || estado === "aceptada") {
    nextActionTitle.textContent = "Salir al lugar";
    nextActionText.textContent = "Ya aceptaste una patrulla. El siguiente paso es dirigirte al objetivo.";
    nextActionBadge.textContent = "Acción requerida";
    nextActionBadge.className = "next-action-badge next-info";
    nextActionBtn.textContent = "Ir a activas";
    nextActionBtn.dataset.target = "secActivas";
    return;
  }

  if (estado === "en_camino") {
    nextActionTitle.textContent = "Iniciar patrulla";
    nextActionText.textContent = "Ya estás en camino. Cuando corresponda, iniciá formalmente la patrulla.";
    nextActionBadge.textContent = "En camino";
    nextActionBadge.className = "next-action-badge next-warn";
    nextActionBtn.textContent = "Ver patrulla activa";
    nextActionBtn.dataset.target = "secActivas";
    return;
  }

  if (estado === "en_curso") {
    nextActionTitle.textContent = "Continuar operativo";
    nextActionText.textContent = "La patrulla está en curso. Mantené el tracking activo y finalizá cuando corresponda.";
    nextActionBadge.textContent = "Operando";
    nextActionBadge.className = "next-action-badge next-ok";
    nextActionBtn.textContent = "Ver operativo";
    nextActionBtn.dataset.target = "secActivas";
    return;
  }

  if (estado === "finalizada") {
    nextActionTitle.textContent = "Revisar historial o tomar una nueva patrulla";
    nextActionText.textContent = "La última patrulla fue finalizada correctamente.";
    nextActionBadge.textContent = "Finalizada";
    nextActionBadge.className = "next-action-badge next-neutral";
    nextActionBtn.textContent = "Ir a historial";
    nextActionBtn.dataset.target = "secHistorial";
    return;
  }

  nextActionTitle.textContent = "Continuar gestión";
  nextActionText.textContent = "Revisá el panel para seguir con la operación.";
  nextActionBadge.textContent = "Operativo";
  nextActionBadge.className = "next-action-badge next-info";
  nextActionBtn.textContent = "Ver activas";
  nextActionBtn.dataset.target = "secActivas";
}

function actualizarSmartSummary() {
  if (!smartDisponibles || !smartActivas || !smartHistorial || !smartGps || !smartCampo) return;

  smartGps.textContent = textoHeroGps();

  const campo =
    patrullaActivaActual?.nombreCampo ||
    patrullaActivaActual?.campo ||
    patrullaActivaActual?.establecimiento ||
    "—";

  smartCampo.textContent = campo;
}

function scrollToSection(sectionId) {
  const el = document.getElementById(sectionId);
  if (!el) return;

  el.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function setActiveTab(tabId) {
  [tabDisponibles, tabActivas, tabHistorial].forEach(tab => {
    if (!tab) return;
    tab.classList.remove("active");
  });

  const active = document.getElementById(tabId);
  if (active) active.classList.add("active");
}

function actualizarTabSegunScroll() {
  const secDisponibles = document.getElementById("secDisponibles");
  const secActivas = document.getElementById("secActivas");
  const secHistorial = document.getElementById("secHistorial");

  const sections = [
    { id: "tabDisponibles", sectionId: "secDisponibles", el: secDisponibles },
    { id: "tabActivas", sectionId: "secActivas", el: secActivas },
    { id: "tabHistorial", sectionId: "secHistorial", el: secHistorial }
  ].filter(s => s.el);

  let selected = sections[0];

  for (const sec of sections) {
    const rect = sec.el.getBoundingClientRect();
    if (rect.top <= 180) {
      selected = sec;
    }
  }

  if (selected) {
    setActiveTab(selected.id);

    sections.forEach(sec => {
      sec.el.classList.remove("section-focus");
    });

    selected.el.classList.add("section-focus");
  }
}

async function verificarSiYaTienePatrullaActiva() {
  if (!currentUser) return;

  const q = query(
    collection(db, "solicitudesPatrulla"),
    where("patrulleroExternoId", "==", currentUser.uid),
    limit(20)
  );

  const snap = await getDocs(q);

  const activas = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(esPatrullaActivaDeEstePatrullero);

  patrullaActivaActual = obtenerPatrullaPrincipal(activas);
  renderBannerPatrullaActiva();
  actualizarHeroOperativa();
}

async function enviarTrackingPosicion(position) {
  if (!currentUser || !trackingSolicitudId || !patrullaActivaActual) return;
  if (!esPatrullaTrackeable(patrullaActivaActual)) return;

  const lat = Number(position?.coords?.latitude);
  const lng = Number(position?.coords?.longitude);
  const accuracy = Number(position?.coords?.accuracy || 0);
  const speed = Number(position?.coords?.speed || 0);
  const heading = Number(position?.coords?.heading || 0);
  const nowMs = Date.now();

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const pasoTiempo = nowMs - ultimoTrackingMs;
  const pasoDistancia =
    Number.isFinite(ultimaLatEnviada) && Number.isFinite(ultimaLngEnviada)
      ? calcularDistanciaMetros(ultimaLatEnviada, ultimaLngEnviada, lat, lng)
      : 999999;

  const debeEnviar =
    ultimoTrackingMs === 0 ||
    pasoTiempo >= 15000 ||
    pasoDistancia >= 25;

  if (!debeEnviar) return;

  const refDoc = doc(db, "solicitudesPatrulla", trackingSolicitudId);

  await updateDoc(refDoc, {
    trackingActivo: true,
    trackingLat: lat,
    trackingLng: lng,
    trackingAccuracyM: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
    trackingVelocidadMps: Number.isFinite(speed) ? speed : 0,
    trackingRumboDeg: Number.isFinite(heading) ? heading : 0,
    trackingUltimaActualizacionMs: nowMs,
    trackingActualizadoPor: "externo",
    trackingActualizadoPorUid: currentUser.uid,
    rutaPts: arrayUnion({
      lat,
      lng,
      ts: nowMs
    })
  });

  ultimoTrackingMs = nowMs;
  ultimaLatEnviada = lat;
  ultimaLngEnviada = lng;

  gpsEstado.activo = true;
  gpsEstado.permiso = "concedido";
  gpsEstado.ultimaSenialMs = nowMs;
  gpsEstado.precisionM = Number.isFinite(accuracy) ? Math.round(accuracy) : null;
  gpsEstado.velocidadMps = Number.isFinite(speed) ? speed : 0;
  gpsEstado.error = "";
  gpsEstado.pausado = false;
  gpsEstado.modo = String(patrullaActivaActual?.estado || "inactivo").toLowerCase();

  renderEstadoGPS();
  renderEstadoConexion();

  actualizarMiniMapaConPosiciones({
    actualLat: lat,
    actualLng: lng,
    enviadaLat: lat,
    enviadaLng: lng,
    rutaPts: [
      ...(Array.isArray(patrullaActivaActual?.rutaPts) ? patrullaActivaActual.rutaPts : []),
      { lat, lng, ts: nowMs }
    ]
  });
}

function iniciarTrackingDePatrulla(item) {
  if (!item || !esPatrullaTrackeable(item)) {
    detenerTracking();
    return;
  }

  if (!soportaGeolocalizacion()) {
    gpsEstado.activo = false;
    gpsEstado.permiso = "no soportado";
    gpsEstado.error = "El navegador no soporta geolocalización.";
    gpsEstado.modo = "sin_soporte";
    renderEstadoGPS();
    console.warn("El navegador no soporta geolocalización.");
    return;
  }

  const mismoTrackingActivo = geoWatchId !== null && trackingSolicitudId === item.id;
  if (mismoTrackingActivo) {
    renderEstadoGPS();
    return;
  }

  detenerTracking();

  trackingSolicitudId = item.id;
  gpsEstado.activo = false;
  gpsEstado.permiso = "solicitando";
  gpsEstado.error = "";
  gpsEstado.modo = String(item.estado || "inactivo").toLowerCase();
  renderEstadoGPS();

  geoWatchId = navigator.geolocation.watchPosition(
    async (position) => {
      try {
        await enviarTrackingPosicion(position);
      } catch (error) {
        console.error("Error enviando tracking:", error);
        gpsEstado.activo = false;
        gpsEstado.error = error?.message || "No se pudo enviar la ubicación.";
        renderEstadoGPS();
      }
    },
    (error) => {
      console.error("Error de geolocalización:", error);

      gpsEstado.activo = false;
      gpsEstado.permiso = error?.code === 1 ? "denegado" : "concedido";
      gpsEstado.error =
        error?.code === 1
          ? "Permiso de ubicación denegado."
          : error?.code === 2
            ? "No se pudo obtener la ubicación."
            : error?.code === 3
              ? "Tiempo de espera agotado para obtener GPS."
              : "Error de geolocalización.";

      renderEstadoGPS();

      if (error?.code === 1) {
        alert("Debés permitir la ubicación para enviar patrulla en vivo.");
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000
    }
  );
}

function obtenerPosicionActualUnaVez() {
  return new Promise((resolve, reject) => {
    if (!soportaGeolocalizacion()) {
      reject(new Error("El navegador no soporta geolocalización."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  });
}

async function enviarSenialManual({ refrescar = false } = {}) {
  if (!patrullaActivaActual || !esPatrullaTrackeable(patrullaActivaActual)) {
    alert("No tenés una patrulla activa en camino o en curso.");
    return;
  }

  try {
    gpsEstado.enviandoManual = true;
    gpsEstado.error = "";
    gpsEstado.ultimaAccionManual = refrescar
      ? "Solicitando refresco manual de ubicación..."
      : "Enviando señal manual...";
    renderEstadoGPS();

    const position = await obtenerPosicionActualUnaVez();

    if (refrescar) {
      ultimoTrackingMs = 0;
      ultimaLatEnviada = null;
      ultimaLngEnviada = null;
    }

    trackingSolicitudId = patrullaActivaActual.id;
    await enviarTrackingPosicion(position);

    gpsEstado.permiso = "concedido";
    gpsEstado.ultimaAccionManual = refrescar
      ? "Ubicación refrescada manualmente."
      : "Señal manual enviada correctamente.";
    renderEstadoGPS();
  } catch (error) {
    console.error("Error en envío manual de GPS:", error);

    gpsEstado.activo = false;
    gpsEstado.permiso = error?.code === 1 ? "denegado" : gpsEstado.permiso;
    gpsEstado.error =
      error?.code === 1
        ? "Permiso de ubicación denegado."
        : error?.code === 2
          ? "No se pudo obtener la ubicación."
          : error?.code === 3
            ? "Tiempo agotado al intentar obtener ubicación."
            : (error?.message || "No se pudo enviar la señal manual.");
    gpsEstado.ultimaAccionManual = "Falló el envío manual.";
    renderEstadoGPS();
  } finally {
    gpsEstado.enviandoManual = false;
    renderEstadoGPS();
  }
}


function evaluarTrackingAutomatico() {
  if (patrullaActivaActual && esPatrullaTrackeable(patrullaActivaActual)) {
    gpsEstado.modo = String(patrullaActivaActual.estado || "inactivo").toLowerCase();
    gpsEstado.pausado = !!patrullaActivaActual.trackingPausado;

    if (gpsEstado.pausado) {
      detenerTracking();
      gpsEstado.pausado = true;
      gpsEstado.ultimaAccionManual = "Tracking pausado manualmente.";
      renderEstadoGPS();

      actualizarMiniMapaConPosiciones({
        actualLat: Number(ultimaLatEnviada),
        actualLng: Number(ultimaLngEnviada),
        enviadaLat: Number(patrullaActivaActual?.trackingLat),
        enviadaLng: Number(patrullaActivaActual?.trackingLng)
      });
      return;
    }

    renderEstadoGPS();
    iniciarTrackingDePatrulla(patrullaActivaActual);
  } else {
    detenerTracking();
    gpsEstado.pausado = false;
    renderEstadoGPS();
    destruirMiniMapaSiNoHayPatrulla();
  }
}

function escucharSolicitudes() {
  limpiarListeners();

  const qDisponibles = query(
    collection(db, "solicitudesPatrulla"),
    orderBy("creadoEn", "desc")
  );

  unsubDisponibles = onSnapshot(qDisponibles, (snap) => {
    const all = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    const disponibles = all.filter(puedeVerComoDisponible);

    countDisponibles.textContent = disponibles.length;
    if (kpiDisponibles) kpiDisponibles.textContent = disponibles.length;
    if (smartDisponibles) smartDisponibles.textContent = disponibles.length;

    renderLista(
      listaDisponibles,
      disponibles,
      "disponibles",
      patrullaActivaActual
        ? "Ya tenés una patrulla activa. Finalizala para tomar otra."
        : "No hay solicitudes disponibles."
    );
  }, (err) => {
    console.error("Error cargando disponibles:", err);
    listaDisponibles.innerHTML = `
      <div class="empty fade-in-up">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Error cargando solicitudes</div>
        <div class="empty-subtitle">Revisá la conexión o intentá nuevamente.</div>
      </div>
    `;
  });

  const qActivas = query(
    collection(db, "solicitudesPatrulla"),
    where("patrulleroExternoId", "==", currentUser.uid),
    orderBy("creadoEn", "desc")
  );

  unsubActivas = onSnapshot(qActivas, (snap) => {
    const all = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    const activas = ordenarActivas(all.filter(esPatrullaActivaDeEstePatrullero));

    patrullaActivaActual = obtenerPatrullaPrincipal(activas);
    renderBannerPatrullaActiva();
    evaluarTrackingAutomatico();
    actualizarHeroOperativa();

    if (patrullaActivaActual) {
      actualizarMiniMapaConPosiciones({
        actualLat: Number(ultimaLatEnviada),
        actualLng: Number(ultimaLngEnviada),
        enviadaLat: Number(patrullaActivaActual.trackingLat),
        enviadaLng: Number(patrullaActivaActual.trackingLng),
        rutaPts: patrullaActivaActual.rutaPts || []
      });
    } else {
      destruirMiniMapaSiNoHayPatrulla();
    }

    countActivas.textContent = activas.length;
    if (kpiActivas) kpiActivas.textContent = activas.length;
    if (smartActivas) smartActivas.textContent = activas.length;

    renderLista(
      listaActivas,
      activas,
      "activas",
      "No tenés patrullas activas."
    );
  }, (err) => {
    console.error("Error cargando activas:", err);
        listaActivas.innerHTML = `
      <div class="empty fade-in-up">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Error cargando patrullas activas</div>
        <div class="empty-subtitle">No se pudo obtener la información actual del operativo.</div>
      </div>
    `;
  });

  const qHistorial = query(
    collection(db, "solicitudesPatrulla"),
    where("patrulleroExternoId", "==", currentUser.uid),
    orderBy("creadoEn", "desc")
  );

  unsubHistorial = onSnapshot(qHistorial, (snap) => {
    const all = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    const historial = all
      .filter(esPatrullaFinalizadaDeEstePatrullero)
      .sort((a, b) => {
        const aTime = a.finalizadaEn?.toDate ? a.finalizadaEn.toDate().getTime() : 0;
        const bTime = b.finalizadaEn?.toDate ? b.finalizadaEn.toDate().getTime() : 0;
        return bTime - aTime;
      });

    countHistorial.textContent = historial.length;
    if (kpiHistorial) kpiHistorial.textContent = historial.length;
    if (smartHistorial) smartHistorial.textContent = historial.length;

    renderLista(
      listaHistorial,
      historial,
      "historial",
      "Todavía no tenés patrullas finalizadas."
    );
  }, (err) => {
    console.error("Error cargando historial:", err);
      listaHistorial.innerHTML = `
      <div class="empty fade-in-up">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Error cargando historial</div>
        <div class="empty-subtitle">No se pudo recuperar el historial del patrullero.</div>
      </div>
    `;
  });
}

async function aceptarPatrulla(id) {
  if (!currentUser) return;

  await verificarSiYaTienePatrullaActiva();

  if (patrullaActivaActual) {
    alert("Ya tenés una patrulla activa. Finalizala antes de aceptar otra.");
    return;
  }

  const refDoc = doc(db, "solicitudesPatrulla", id);

  await updateDoc(refDoc, {
    estado: "aceptada",
    tipoPatrullero: "externo",
    patrulleroExternoId: currentUser.uid,
    patrulleroExternoEmail: currentUser.email || "",
    patrulleroExternoNombre: `${perfilPatrullero?.nombre || ""} ${perfilPatrullero?.apellido || ""}`.trim(),
    aceptadaEn: serverTimestamp()
  });
}

async function salirAlLugar(id) {
  const refDoc = doc(db, "solicitudesPatrulla", id);

  await updateDoc(refDoc, {
    estado: "en_camino",
    salidaAlLugarEn: serverTimestamp(),
    trackingActivo: true,
    trackingPausado: false
  });
}

async function iniciarPatrulla(id) {
  const refDoc = doc(db, "solicitudesPatrulla", id);

  await updateDoc(refDoc, {
    estado: "en_curso",
    iniciadaEn: serverTimestamp(),
    inicioPatrullaAt: serverTimestamp(),
    trackingActivo: true,
    trackingPausado: false
  });
}

async function pausarTracking(id) {
  detenerTracking();

  const refDoc = doc(db, "solicitudesPatrulla", id);

  await updateDoc(refDoc, {
    trackingPausado: true,
    trackingActivo: false
  });

  gpsEstado.activo = false;
  gpsEstado.pausado = true;
  gpsEstado.ultimaAccionManual = "Tracking pausado manualmente.";
  renderEstadoGPS();
  renderEstadoConexion();



  actualizarMiniMapaConPosiciones({
    actualLat: Number(ultimaLatEnviada),
    actualLng: Number(ultimaLngEnviada),
    enviadaLat: Number(patrullaActivaActual?.trackingLat),
    enviadaLng: Number(patrullaActivaActual?.trackingLng)
  });
}


async function reanudarTracking(id) {
  const refDoc = doc(db, "solicitudesPatrulla", id);

  await updateDoc(refDoc, {
    trackingPausado: false,
    trackingActivo: true
  });

  gpsEstado.pausado = false;
  gpsEstado.ultimaAccionManual = "Tracking reanudado manualmente.";
  renderEstadoGPS();
  renderEstadoConexion();

  if (patrullaActivaActual && patrullaActivaActual.id === id) {
    iniciarTrackingDePatrulla({
      ...patrullaActivaActual,
      trackingPausado: false
    });
  }
}

async function finalizarPatrulla(id) {
  detenerTracking();

  const refDoc = doc(db, "solicitudesPatrulla", id);

  await updateDoc(refDoc, {
    estado: "finalizada",
    finalizadaEn: serverTimestamp(),
    finPatrullaAt: serverTimestamp(),
    trackingActivo: false,
    trackingPausado: false
  });

  destruirMiniMapaSiNoHayPatrulla();
}

document.body.addEventListener("click", async (e) => {

  const btnCentrarMiniMapa = e.target.closest("#btnCentrarMiniMapa");
  if (btnCentrarMiniMapa) {
    centrarMiniMapaEnPosicion();
    return;
  }

  const btnSeguirMiniMapa = e.target.closest("#btnSeguirMiniMapa");
  if (btnSeguirMiniMapa) {
    miniMapaSeguirUbicacion = !miniMapaSeguirUbicacion;
    actualizarTextoBotonSeguirMiniMapa();

    if (miniMapaSeguirUbicacion) {
      centrarMiniMapaEnPosicion();
    }
    return;
  }
  const btnManualSenial = e.target.closest("#btnEnviarSenialAhora");
  if (btnManualSenial) {
    try {
      btnManualSenial.disabled = true;
      await enviarSenialManual({ refrescar: false });
    } finally {
      btnManualSenial.disabled = false;
    }
    return;
  }

  const btnManualRefresh = e.target.closest("#btnRefrescarUbicacion");
  if (btnManualRefresh) {
    try {
      btnManualRefresh.disabled = true;
      await enviarSenialManual({ refrescar: true });
    } finally {
      btnManualRefresh.disabled = false;
    }
    return;
  }

  const btnPausar = e.target.closest("#btnPausarTracking");
  if (btnPausar) {
    try {
      btnPausar.disabled = true;
      if (!patrullaActivaActual?.id) {
        alert("No hay patrulla activa para pausar.");
        return;
      }
      await pausarTracking(patrullaActivaActual.id);
    } finally {
      btnPausar.disabled = false;
    }
    return;
  }

  const btnReanudar = e.target.closest("#btnReanudarTracking");
  if (btnReanudar) {
    try {
      btnReanudar.disabled = true;
      if (!patrullaActivaActual?.id) {
        alert("No hay patrulla activa para reanudar.");
        return;
      }
      await reanudarTracking(patrullaActivaActual.id);
    } finally {
      btnReanudar.disabled = false;
    }
    return;
  }

  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (!id) return;

  try {
    btn.disabled = true;

    if (action === "aceptar") {
      await aceptarPatrulla(id);
    }

    if (action === "camino") {
      await salirAlLugar(id);
    }

    if (action === "iniciar") {
      await iniciarPatrulla(id);
    }

    if (action === "finalizar") {
      await finalizarPatrulla(id);
    }
  } catch (error) {
    console.error(`Error en acción patrullero [${action}] id=${id}:`, error);
    alert(`Error en acción [${action}]: ` + (error?.message || error));
  } finally {
    btn.disabled = false;
  }
});


document.getElementById("btnLogout")?.addEventListener("click", async () => {
  detenerTimerEstadoConexion();
  detenerTracking();
  await signOut(auth);
  window.location.href = "./login.html";
});

window.addEventListener("beforeunload", () => {
  detenerTimerEstadoConexion();
  detenerTracking();
});

goDisponibles?.addEventListener("click", () => {
  scrollToSection("secDisponibles");
  setActiveTab("tabDisponibles");
});

goActivas?.addEventListener("click", () => {
  scrollToSection("secActivas");
  setActiveTab("tabActivas");
});

goHistorial?.addEventListener("click", () => {
  scrollToSection("secHistorial");
  setActiveTab("tabHistorial");
});

tabDisponibles?.addEventListener("click", () => {
  scrollToSection("secDisponibles");
  setActiveTab("tabDisponibles");
});

tabActivas?.addEventListener("click", () => {
  scrollToSection("secActivas");
  setActiveTab("tabActivas");
});

tabHistorial?.addEventListener("click", () => {
  scrollToSection("secHistorial");
  setActiveTab("tabHistorial");
});

window.addEventListener("scroll", actualizarTabSegunScroll);

nextActionBtn?.addEventListener("click", () => {
  const target = nextActionBtn.dataset.target || "secDisponibles";
  scrollToSection(target);

  if (target === "secDisponibles") setActiveTab("tabDisponibles");
  if (target === "secActivas") setActiveTab("tabActivas");
  if (target === "secHistorial") setActiveTab("tabHistorial");
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    detenerTimerEstadoConexion();
    detenerTracking();
    limpiarListeners();
    window.location.href = "./login.html";
    return;
  }

  try {
    perfilPatrullero = await validarAccesoPatrullero(user);

    usuarioInfo.textContent =
      `Usuario: ${(perfilPatrullero?.nombre || "")} ${(perfilPatrullero?.apellido || "")}`.trim();

    renderEstadoGPS();
    renderEstadoConexion();
    actualizarHeroOperativa();
    iniciarTimerEstadoConexion();
    await verificarSiYaTienePatrullaActiva();
    escucharSolicitudes();
    setTimeout(() => actualizarTabSegunScroll(), 250);
  } catch (error) {
    console.error("Acceso denegado:", error);
    alert(error.message || "No tenés permisos para acceder a este panel.");
    detenerTracking();
    await signOut(auth);
    window.location.href = "./login.html";
  }
});

