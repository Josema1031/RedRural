

import {
    auth,
    onAuthStateChanged,
    db,
    collection,
    getDocs,
    query,
    where,
    addDoc,
    deleteDoc,
    doc
} from "./firebase-sisg.js";

const incidenciasRef = collection(db, "seguridad_ganadera_incidencias");
const filtroTipo = document.getElementById("filtroTipo");
const resumenPotreros = document.getElementById("resumenPotreros");
const totalIncidenciasMapa = document.getElementById("totalIncidenciasMapa");
const totalPotrerosMapa = document.getElementById("totalPotrerosMapa");
const potreroMasAfectadoMapa = document.getElementById("potreroMasAfectadoMapa");
const riesgoGeneralMapa = document.getElementById("riesgoGeneralMapa");
const detallePotreroVacio = document.getElementById("detallePotreroVacio");
const detallePotreroContenido = document.getElementById("detallePotreroContenido");
const detalleNombrePotrero = document.getElementById("detalleNombrePotrero");
const detalleTotalIncidencias = document.getElementById("detalleTotalIncidencias");
const detalleNivelRiesgo = document.getElementById("detalleNivelRiesgo");
const detalleTipoFrecuente = document.getElementById("detalleTipoFrecuente");
const detalleFechaReciente = document.getElementById("detalleFechaReciente");
const detalleListaIncidencias = document.getElementById("detalleListaIncidencias");
const btnFiltrarPotrero = document.getElementById("btnFiltrarPotrero");
const btnRestablecerVista = document.getElementById("btnRestablecerVista");
const modoVisualizacion = document.getElementById("modoVisualizacion");
const historialTotalFechas = document.getElementById("historialTotalFechas");
const historialFechaReciente = document.getElementById("historialFechaReciente");
const historialFechaCritica = document.getElementById("historialFechaCritica");
const historialListaFechas = document.getElementById("historialListaFechas");
const btnExportarPDF = document.getElementById("btnExportarPDF");
const btnActivarPatrullaje = document.getElementById("btnActivarPatrullaje");
const btnSiguienteObjetivo = document.getElementById("btnSiguienteObjetivo");
const btnSalirPatrullaje = document.getElementById("btnSalirPatrullaje");
const estadoPatrullaje = document.getElementById("estadoPatrullaje");
const objetivoActualPatrullaje = document.getElementById("objetivoActualPatrullaje");
const totalObjetivosPatrullaje = document.getElementById("totalObjetivosPatrullaje");
const ultimaActualizacionPatrullaje = document.getElementById("ultimaActualizacionPatrullaje");
const listaObjetivosPatrullaje = document.getElementById("listaObjetivosPatrullaje");
const mapaShell = document.getElementById("mapaShell");
const btnPantallaCompletaMapa = document.getElementById("btnPantallaCompletaMapa");
const btnModoPotreros = document.getElementById("btnModoPotreros");
const btnGuardarPotreros = document.getElementById("btnGuardarPotreros");
const btnEditarPotreros = document.getElementById("btnEditarPotreros");
const btnEliminarPotrero = document.getElementById("btnEliminarPotrero");

const map = L.map("map").setView([-33.14, -59.31], 13);

// Capa estándar
const capaCalles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
});

// Capa topográfica
const capaTopografica = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    maxZoom: 17,
    attribution: "&copy; OpenTopoMap"
});

// Capa satelital / imagen
const capaSatelital = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19,
    attribution: "Tiles &copy; Esri"
});

// Capa inicial
capaCalles.addTo(map);

const capasBase = {
    "Mapa estándar": capaCalles,
    "Mapa topográfico": capaTopografica,
    "Vista satelital": capaSatelital
};

L.control.layers(capasBase, null, { collapsed: false }).addTo(map);

let todasLasIncidencias = [];
let marcadores = [];
let poligonosPotreros = [];
let incidenciasFiltradasActuales = [];
let potreroSeleccionado = null;
let marcadoresPorId = new Map();
let incidenciaSeleccionadaId = null;
let filtroPotreroActivo = null;
let grupoMarcadores = L.markerClusterGroup({
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    zoomToBoundsOnClick: true,
    disableClusteringAtZoom: 17
});
let capaHeatmap = null;
let patrullajeActivo = false;
let colaPatrullaje = [];
let indiceObjetivoActual = -1;

let patrulleroMarker = null;
let rutaPatrullajePolyline = null;
let rutaPatrullajeRecorrida = null;
let animacionPatrullajeFrame = null;
const ZOOM_PATRULLAJE = 20; //zoom del mapa para ver patrullero//
const DURACION_ANIMACION_PATRULLAJE = 2600;
const INTERVALO_PATRULLAJE_AUTO = 5000; //velocidad del patrullero//
const SEGUIR_PATRULLERO_EN_MOVIMIENTO = true;


let temporizadorPatrullajeAuto = null;
let patrullajeAutomaticoActivo = false;

function crearIconoPatrullero() {
    return L.divIcon({
        className: "icono-patrullero-custom",
        html: `
            <div class="patrullero-wrap">
                <div class="patrullero-pulso"></div>
                <div class="patrullero-icono">🚓</div>
            </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19]
    });
}

function limpiarPatrulleroVisual() {
    if (animacionPatrullajeFrame) {
        cancelAnimationFrame(animacionPatrullajeFrame);
        animacionPatrullajeFrame = null;
    }

    if (patrulleroMarker && map.hasLayer(patrulleroMarker)) {
        map.removeLayer(patrulleroMarker);
    }

    if (rutaPatrullajePolyline && map.hasLayer(rutaPatrullajePolyline)) {
        map.removeLayer(rutaPatrullajePolyline);
    }

    if (rutaPatrullajeRecorrida && map.hasLayer(rutaPatrullajeRecorrida)) {
        map.removeLayer(rutaPatrullajeRecorrida);
    }

    patrulleroMarker = null;
    rutaPatrullajePolyline = null;
    rutaPatrullajeRecorrida = null;
}

function dibujarRutaPatrullajeVisual() {
    if (!colaPatrullaje || colaPatrullaje.length === 0) return;

    const puntos = colaPatrullaje
        .filter(item => item.lat && item.lng)
        .map(item => [item.lat, item.lng]);

    if (puntos.length === 0) return;

    if (rutaPatrullajePolyline && map.hasLayer(rutaPatrullajePolyline)) {
        map.removeLayer(rutaPatrullajePolyline);
    }

    if (rutaPatrullajeRecorrida && map.hasLayer(rutaPatrullajeRecorrida)) {
        map.removeLayer(rutaPatrullajeRecorrida);
    }

    rutaPatrullajePolyline = L.polyline(puntos, {
        weight: 4,
        opacity: 0.8,
        dashArray: "8,8"
    }).addTo(map);

    rutaPatrullajeRecorrida = L.polyline([], {
        weight: 5,
        opacity: 0.95
    }).addTo(map);
}

function actualizarPatrulleroVisualInstantaneo(objetivo) {
    if (!objetivo || !objetivo.lat || !objetivo.lng) return;

    const destino = [objetivo.lat, objetivo.lng];

    if (!patrulleroMarker) {
        patrulleroMarker = L.marker(destino, {
            icon: crearIconoPatrullero()
        }).addTo(map);
    } else {
        patrulleroMarker.setLatLng(destino);
    }

    const puntosRecorridos = colaPatrullaje
        .slice(0, indiceObjetivoActual + 1)
        .filter(item => item.lat && item.lng)
        .map(item => [item.lat, item.lng]);

    if (rutaPatrullajeRecorrida) {
        rutaPatrullajeRecorrida.setLatLngs(puntosRecorridos);
    }
}

function animarPatrulleroHaciaObjetivo(objetivo) {
    if (!objetivo || !objetivo.lat || !objetivo.lng) return;

    const destino = [objetivo.lat, objetivo.lng];

    if (!patrulleroMarker) {
        patrulleroMarker = L.marker(destino, {
            icon: crearIconoPatrullero()
        }).addTo(map);

        patrulleroMarker.bindPopup(`
    <strong>Patrullero operativo</strong><br>
    Objetivo: ${objetivo.tipo || "Sin tipo"}<br>
    Sector: ${objetivo.potrero || "Sin dato"}<br>
    Estado: En patrullaje
`);

        if (rutaPatrullajeRecorrida) {
            rutaPatrullajeRecorrida.setLatLngs([destino]);
        }
        return;
    }

    const origenLatLng = patrulleroMarker.getLatLng();
    const origen = [origenLatLng.lat, origenLatLng.lng];
    const duracion = DURACION_ANIMACION_PATRULLAJE;
    const inicio = performance.now();

    function paso(tiempo) {
        const progreso = Math.min((tiempo - inicio) / duracion, 1);

        const lat = origen[0] + (destino[0] - origen[0]) * progreso;
        const lng = origen[1] + (destino[1] - origen[1]) * progreso;

        patrulleroMarker.setLatLng([lat, lng]);

        if (SEGUIR_PATRULLERO_EN_MOVIMIENTO) {
            map.panTo([lat, lng], {
                animate: false
            });
        }

        const puntosBase = colaPatrullaje
            .slice(0, indiceObjetivoActual)
            .filter(item => item.lat && item.lng)
            .map(item => [item.lat, item.lng]);

        if (rutaPatrullajeRecorrida) {
            rutaPatrullajeRecorrida.setLatLngs([...puntosBase, [lat, lng]]);
        }

        if (progreso < 1) {
            animacionPatrullajeFrame = requestAnimationFrame(paso);
        } else {
            animacionPatrullajeFrame = null;
        }
    }

    if (animacionPatrullajeFrame) {
        cancelAnimationFrame(animacionPatrullajeFrame);
    }

    animacionPatrullajeFrame = requestAnimationFrame(paso);
}

map.addLayer(grupoMarcadores);

function limpiarMarcadores() {
    marcadores.forEach(marker => {
        if (map.hasLayer(marker)) {
            map.removeLayer(marker);
        }
    });

    marcadores = [];
    marcadoresPorId = new Map();

    if (grupoMarcadores) {
        grupoMarcadores.clearLayers();
    }
}

function limpiarHeatmap() {
    if (capaHeatmap && map.hasLayer(capaHeatmap)) {
        map.removeLayer(capaHeatmap);
    }
    capaHeatmap = null;
}

function renderizarHeatmap(incidencias) {
    limpiarHeatmap();

    const puntosHeat = incidencias
        .filter(item => item.lat && item.lng)
        .map(item => {
            let intensidad = 0.4;

            switch (item.tipo) {
                case "Faltante de ganado":
                    intensidad = 1.0;
                    break;
                case "Movimiento nocturno":
                    intensidad = 0.8;
                    break;
                case "Rastros de arreo":
                    intensidad = 0.7;
                    break;
                case "Huellas de vehículo":
                    intensidad = 0.6;
                    break;
                case "Alambrado manipulado":
                    intensidad = 0.6;
                    break;
                case "Tranquera abierta":
                    intensidad = 0.5;
                    break;
                default:
                    intensidad = 0.4;
            }

            return [item.lat, item.lng, intensidad];
        });

    if (puntosHeat.length === 0) return;

    capaHeatmap = L.heatLayer(puntosHeat, {
        radius: 28,
        blur: 22,
        maxZoom: 17,
        minOpacity: 0.35
    });

    capaHeatmap.addTo(map);
}

function resetearEstiloPotreros() {
    poligonosPotreros.forEach((item) => {
        item.layer.setStyle({
            color: item.colorOriginal,
            fillColor: item.colorOriginal,
            weight: 2,
            fillOpacity: 0.15
        });
    });
}

function enfocarPotreroSeleccionado(nombrePotrero, cantidad = 0) {
    if (!nombrePotrero) return;

    incidenciaSeleccionadaId = null;

    const potreroEncontrado = poligonosPotreros.find(
        (item) => item.nombre === nombrePotrero
    );

    const incidenciasPotrero = obtenerIncidenciasDePotrero(nombrePotrero);

    potreroSeleccionado = nombrePotrero;

    if (!potreroEncontrado) {
        renderDetallePotrero(nombrePotrero, incidenciasPotrero);

        document.querySelectorAll(".potrero-card").forEach((card) => {
            card.classList.toggle("activo", card.dataset.potrero === nombrePotrero);
        });

        return;
    }

    resetearEstiloPotreros();

    potreroEncontrado.layer.setStyle({
        color: "#111827",
        fillColor: "#dc2626",
        weight: 4,
        fillOpacity: 0.35
    });

    if (potreroEncontrado.bounds) {
        map.fitBounds(potreroEncontrado.bounds, { padding: [40, 40] });
    }

    potreroEncontrado.layer.bindPopup(`
      <div style="min-width: 180px; line-height: 1.5;">
        <strong>${nombrePotrero}</strong><br>
        <b>Incidencias:</b> ${cantidad || incidenciasPotrero.length}
      </div>
    `).openPopup();

    document.querySelectorAll(".potrero-card").forEach((card) => {
        card.classList.toggle("activo", card.dataset.potrero === nombrePotrero);
    });

    renderDetallePotrero(nombrePotrero, incidenciasPotrero);
}

function ajustarVistaMapa(incidencias) {
    const puntosValidos = incidencias
        .filter(item => item.lat && item.lng)
        .map(item => [item.lat, item.lng]);

    if (puntosValidos.length === 0) {
        centrarEnPotreroMasAfectado(incidencias);
        return;
    }

    if (puntosValidos.length === 1) {
        map.setView(puntosValidos[0], 15);
        return;
    }

    const bounds = L.latLngBounds(puntosValidos);
    map.fitBounds(bounds, { padding: [40, 40] });
}

function renderResumenPotreros(incidencias) {
    if (!resumenPotreros) return;

    resumenPotreros.innerHTML = "";

    if (incidencias.length === 0) {
        resumenPotreros.innerHTML = `
      <div class="potrero-card">
        <strong>Sin datos</strong>
        No hay incidencias para mostrar.
      </div>
    `;
        return;
    }

    const conteo = {};

    incidencias.forEach((item) => {
        const potrero = item.potrero && item.potrero.trim() !== "" ? item.potrero : "Sin dato";
        conteo[potrero] = (conteo[potrero] || 0) + 1;
    });

    const ranking = Object.entries(conteo)
        .map(([potrero, cantidad]) => ({ potrero, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad);

    ranking.forEach(({ potrero, cantidad }, index) => {
        const riesgo = calcularNivelRiesgo(cantidad);

        const card = document.createElement("div");
        card.className = `potrero-card ${riesgo.claseCard}`;
        card.dataset.potrero = potrero;

        if (potreroSeleccionado === potrero) {
            card.classList.add("activo");
        }

        card.innerHTML = `
      <strong>#${index + 1} - ${potrero}</strong>
      ${cantidad} incidencia${cantidad !== 1 ? "s" : ""}
      <div class="riesgo-texto ${riesgo.claseTexto}">
        ${riesgo.texto}
      </div>
    `;

        card.addEventListener("click", () => {
            enfocarPotreroSeleccionado(potrero, cantidad);
        });

        resumenPotreros.appendChild(card);
    });
}

function calcularNivelRiesgo(cantidad) {
    if (cantidad <= 1) {
        return {
            claseCard: "riesgo-bajo",
            claseTexto: "bajo",
            texto: "Riesgo bajo"
        };
    }

    if (cantidad <= 3) {
        return {
            claseCard: "riesgo-medio",
            claseTexto: "medio",
            texto: "Riesgo medio"
        };
    }

    return {
        claseCard: "riesgo-alto",
        claseTexto: "alto",
        texto: "Riesgo alto"
    };
}

function limpiarDetallePotrero() {
    if (!detallePotreroVacio || !detallePotreroContenido) return;
    incidenciaSeleccionadaId = null;
    detallePotreroVacio.style.display = "block";
    detallePotreroContenido.style.display = "none";

    if (detalleNombrePotrero) detalleNombrePotrero.textContent = "-";
    if (detalleTotalIncidencias) detalleTotalIncidencias.textContent = "0";
    if (detalleNivelRiesgo) detalleNivelRiesgo.textContent = "Sin datos";
    if (detalleTipoFrecuente) detalleTipoFrecuente.textContent = "-";
    if (detalleFechaReciente) detalleFechaReciente.textContent = "-";
    if (detalleListaIncidencias) detalleListaIncidencias.innerHTML = "";
}

function limpiarHistorialTemporal() {
    if (historialTotalFechas) historialTotalFechas.textContent = "0";
    if (historialFechaReciente) historialFechaReciente.textContent = "-";
    if (historialFechaCritica) historialFechaCritica.textContent = "-";
    if (historialListaFechas) historialListaFechas.innerHTML = "";
}

function renderHistorialTemporal(incidencias) {
    if (!historialListaFechas) return;

    if (!incidencias || incidencias.length === 0) {
        limpiarHistorialTemporal();
        return;
    }

    const conteoPorFecha = {};

    incidencias.forEach((item) => {
        const fechaClave = normalizarFechaClave(item.fecha);
        if (!fechaClave) return;

        if (!conteoPorFecha[fechaClave]) {
            conteoPorFecha[fechaClave] = [];
        }

        conteoPorFecha[fechaClave].push(item);
    });

    const fechasOrdenadas = Object.keys(conteoPorFecha).sort((a, b) => {
        const fechaA = normalizarFechaParaOrden(a);
        const fechaB = normalizarFechaParaOrden(b);

        if (!fechaA && !fechaB) return 0;
        if (!fechaA) return 1;
        if (!fechaB) return -1;

        return fechaB - fechaA;
    });

    if (fechasOrdenadas.length === 0) {
        limpiarHistorialTemporal();
        return;
    }

    const fechaReciente = fechasOrdenadas[0];

    let fechaCritica = fechasOrdenadas[0];
    let mayorCantidad = conteoPorFecha[fechaCritica].length;

    fechasOrdenadas.forEach((fecha) => {
        const cantidad = conteoPorFecha[fecha].length;
        if (cantidad > mayorCantidad) {
            fechaCritica = fecha;
            mayorCantidad = cantidad;
        }
    });

    historialTotalFechas.textContent = fechasOrdenadas.length;
    historialFechaReciente.textContent = formatearFechaVisible(fechaReciente);
    historialFechaCritica.textContent = `${formatearFechaVisible(fechaCritica)} (${mayorCantidad})`;

    historialListaFechas.innerHTML = "";

    fechasOrdenadas.slice(0, 7).forEach((fecha) => {
        const incidenciasFecha = conteoPorFecha[fecha];
        const tipos = {};

        incidenciasFecha.forEach((item) => {
            const tipo = item.tipo && item.tipo.trim() !== "" ? item.tipo : "Sin dato";
            tipos[tipo] = (tipos[tipo] || 0) + 1;
        });

        let tipoPrincipal = "Sin dato";
        let tipoCantidad = 0;

        Object.entries(tipos).forEach(([tipo, cantidad]) => {
            if (cantidad > tipoCantidad) {
                tipoPrincipal = tipo;
                tipoCantidad = cantidad;
            }
        });

        const fila = document.createElement("div");
        fila.className = "historial-fecha-item";

        fila.innerHTML = `
            <div class="historial-fecha-titulo">${formatearFechaVisible(fecha)}</div>
            <div class="historial-fecha-meta">
                Incidencias: ${incidenciasFecha.length} | Tipo principal: ${tipoPrincipal}
            </div>
        `;

        historialListaFechas.appendChild(fila);
    });
}



function seleccionarPotreroDesdeParametro(nombrePotrero) {
    if (!nombrePotrero) return;

    const tarjetasPotrero = document.querySelectorAll("[data-potrero]");
    let encontrado = false;

    tarjetasPotrero.forEach((card) => {
        const nombre = card.getAttribute("data-potrero");
        if (nombre === nombrePotrero) {
            card.click();
            encontrado = true;
        }
    });

    if (!encontrado) {
        console.warn("No se encontró el potrero recibido por URL:", nombrePotrero);
    }
}

function marcarIncidenciaActivaEnDetalle(incidenciaId) {
    document.querySelectorAll(".detalle-item-incidencia").forEach((item) => {
        item.classList.toggle("activo", item.dataset.id === incidenciaId);
    });
}

function enfocarIncidenciaEnMapa(incidenciaId) {
    if (!incidenciaId) return;

    const incidencia = incidenciasFiltradasActuales.find(item => item.id === incidenciaId);
    if (!incidencia) return;

    incidenciaSeleccionadaId = incidenciaId;
    marcarIncidenciaActivaEnDetalle(incidenciaId);

    // Si tiene coordenadas y existe marcador, abrir el punto exacto
    if (incidencia.lat && incidencia.lng && marcadoresPorId.has(incidenciaId)) {
        const marker = marcadoresPorId.get(incidenciaId);

        map.setView([incidencia.lat, incidencia.lng], ZOOM_PATRULLAJE);

        setTimeout(() => {
            marker.openPopup();
        }, 250);

        return;
    }

    // Si no tiene coordenadas, mantener lógica de respaldo por potrero
    const nombrePotrero = incidencia.potrero && incidencia.potrero.trim() !== ""
        ? incidencia.potrero
        : "Sin dato";

    const incidenciasPotrero = incidenciasFiltradasActuales.filter((item) => {
        const nombre = item.potrero && item.potrero.trim() !== "" ? item.potrero : "Sin dato";
        return nombre === nombrePotrero;
    });

    enfocarPotreroSeleccionado(nombrePotrero, incidenciasPotrero.length);
}

function normalizarFechaParaOrden(fechaTexto) {
    if (!fechaTexto) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(fechaTexto)) {
        return new Date(`${fechaTexto}T00:00:00`);
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaTexto)) {
        const [dia, mes, anio] = fechaTexto.split("/");
        return new Date(`${anio}-${mes}-${dia}T00:00:00`);
    }

    const fecha = new Date(fechaTexto);
    return isNaN(fecha.getTime()) ? null : fecha;
}

function normalizarFechaClave(fechaTexto) {
    if (!fechaTexto) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(fechaTexto)) {
        return fechaTexto;
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaTexto)) {
        const [dia, mes, anio] = fechaTexto.split("/");
        return `${anio}-${mes}-${dia}`;
    }

    const fecha = new Date(fechaTexto);
    if (isNaN(fecha.getTime())) return null;

    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");

    return `${anio}-${mes}-${dia}`;
}

function formatearFechaVisible(fechaClave) {
    if (!fechaClave) return "-";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaClave)) return fechaClave;

    const [anio, mes, dia] = fechaClave.split("-");
    return `${dia}/${mes}/${anio}`;
}

function obtenerFechaHoraActual() {
    const ahora = new Date();

    const dia = String(ahora.getDate()).padStart(2, "0");
    const mes = String(ahora.getMonth() + 1).padStart(2, "0");
    const anio = ahora.getFullYear();
    const horas = String(ahora.getHours()).padStart(2, "0");
    const minutos = String(ahora.getMinutes()).padStart(2, "0");

    return `${dia}/${mes}/${anio} ${horas}:${minutos}`;
}

function calcularPrioridadOperativa(incidencia) {
    let puntaje = 0;

    switch (incidencia.tipo) {
        case "Faltante de ganado":
            puntaje += 100;
            break;
        case "Movimiento nocturno":
            puntaje += 85;
            break;
        case "Rastros de arreo":
            puntaje += 75;
            break;
        case "Huellas de vehículo":
            puntaje += 65;
            break;
        case "Alambrado manipulado":
            puntaje += 55;
            break;
        case "Tranquera abierta":
            puntaje += 45;
            break;
        default:
            puntaje += 30;
    }

    if (incidencia.lat && incidencia.lng) {
        puntaje += 10;
    }

    const fecha = normalizarFechaParaOrden(incidencia.fecha);
    if (fecha) {
        const ahora = new Date();
        const diffMs = ahora - fecha;
        const diffDias = diffMs / (1000 * 60 * 60 * 24);

        if (diffDias <= 1) puntaje += 30;
        else if (diffDias <= 3) puntaje += 20;
        else if (diffDias <= 7) puntaje += 10;
    }

    return puntaje;
}

function construirColaPatrullaje(incidencias) {
    if (!Array.isArray(incidencias) || incidencias.length === 0) return [];

    const incidenciasValidas = incidencias
        .filter(item => item.lat != null && item.lng != null)
        .map(item => {
            let prioridad = 1;

            if (item.gravedad === "Crítica") prioridad = 5;
            else if (item.gravedad === "Alta") prioridad = 4;
            else if (item.gravedad === "Media") prioridad = 3;
            else if (item.gravedad === "Baja") prioridad = 2;

            return {
                ...item,
                prioridadOperativa: prioridad
            };
        });

    // arma una ruta mixta: perímetro + incidencias
    return construirRutaMixtaPatrullaje(incidenciasValidas);
}

function limpiarPatrullajeOperativo() {
    detenerRecorridoAutomaticoPatrullaje();
    limpiarPatrulleroVisual();

    patrullajeActivo = false;
    patrullajeAutomaticoActivo = false;
    colaPatrullaje = [];
    indiceObjetivoActual = -1;

    if (estadoPatrullaje) estadoPatrullaje.textContent = "Inactivo";
    if (objetivoActualPatrullaje) objetivoActualPatrullaje.textContent = "-";
    if (totalObjetivosPatrullaje) totalObjetivosPatrullaje.textContent = "0";
    if (ultimaActualizacionPatrullaje) ultimaActualizacionPatrullaje.textContent = "-";
    if (listaObjetivosPatrullaje) listaObjetivosPatrullaje.innerHTML = "";
}

function enfocarObjetivoPatrullaje(objetivo) {
    if (!objetivo) return;

    animarPatrulleroHaciaObjetivo(objetivo);

    if (objetivo.lat && objetivo.lng) {
        map.flyTo([objetivo.lat, objetivo.lng], Math.max(map.getZoom(), ZOOM_PATRULLAJE), {
            animate: true,
            duration: 2.2
        });
    }

    potreroSeleccionado = objetivo.potrero && objetivo.potrero.trim() !== ""
        ? objetivo.potrero
        : "Sin dato";

    if (objetivo.id) {
        incidenciaSeleccionadaId = objetivo.id;
    }

    if (objetivo.id && objetivo.lat && objetivo.lng) {
        enfocarIncidenciaEnMapa(objetivo.id);
    } else {
        const nombrePotrero = objetivo.potrero && objetivo.potrero.trim() !== ""
            ? objetivo.potrero
            : "Sin dato";

        const incidenciasPotrero = obtenerIncidenciasDePotrero(nombrePotrero);
        enfocarPotreroSeleccionado(nombrePotrero, incidenciasPotrero.length);
    }

    document.querySelectorAll(".monitoreo-item").forEach((item, index) => {
        item.classList.toggle("activo", index === indiceObjetivoActual);
    });
}

function renderPatrullajeOperativo() {
    if (!listaObjetivosPatrullaje) return;

    if (!patrullajeActivo || colaPatrullaje.length === 0) {
        limpiarPatrullajeOperativo();
        return;
    }

    if (estadoPatrullaje) estadoPatrullaje.textContent = "Activo";
    if (totalObjetivosPatrullaje) totalObjetivosPatrullaje.textContent = String(colaPatrullaje.length);
    if (ultimaActualizacionPatrullaje) ultimaActualizacionPatrullaje.textContent = obtenerFechaHoraActual();

    const objetivoActual = colaPatrullaje[indiceObjetivoActual] || null;

    if (objetivoActualPatrullaje) {
        objetivoActualPatrullaje.textContent = objetivoActual
            ? `${objetivoActual.tipo || "Sin tipo"} - ${objetivoActual.potrero || "Sin dato"}`
            : "-";
    }

    listaObjetivosPatrullaje.innerHTML = "";

    colaPatrullaje.slice(0, 10).forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "monitoreo-item";

        if (index === indiceObjetivoActual) {
            div.classList.add("activo");
        }

       div.innerHTML = `
    <div class="titulo">
        ${item.tipo || "Sin tipo"} - ${item.potrero || "Sin dato"}
    </div>
    <div class="meta">
        Fecha: ${item.fecha || "-"} | Guardia: ${item.guardia || "-"}
    </div>
    <div class="nivel">
        ${item.esPuntoRuta ? "Ruta táctica" : "Incidencia prioritaria"}: ${item.prioridadOperativa}
    </div>
`;

        div.addEventListener("click", () => {
            indiceObjetivoActual = index;
            renderPatrullajeOperativo();
            enfocarObjetivoPatrullaje(colaPatrullaje[indiceObjetivoActual]);
        });

        listaObjetivosPatrullaje.appendChild(div);
    });
}

function obtenerCentroPotrero(potrero) {
    const coords = potrero?.coordenadas || [];
    if (!coords.length) return null;

    let sumaLat = 0;
    let sumaLng = 0;

    coords.forEach(p => {
        sumaLat += Number(p.lat || 0);
        sumaLng += Number(p.lng || 0);
    });

    return {
        lat: sumaLat / coords.length,
        lng: sumaLng / coords.length
    };
}

function obtenerPuntosPatrullajePotrero(potrero, salto = 2) {
    const coords = potrero?.coordenadas || [];
    if (!Array.isArray(coords) || coords.length < 3) return [];

    const puntos = [];

    for (let i = 0; i < coords.length; i += salto) {
        const p = coords[i];
        if (p?.lat != null && p?.lng != null) {
            puntos.push({
                lat: Number(p.lat),
                lng: Number(p.lng),
                tipo: "Recorrido perimetral",
                potrero: potrero.nombre || "Sin nombre",
                guardia: "Sistema",
                fecha: new Date().toISOString().split("T")[0],
                prioridadOperativa: "Patrullaje perimetral",
                esPuntoRuta: true
            });
        }
    }

    // cerrar recorrido volviendo al primer punto
    if (puntos.length > 0) {
        puntos.push({ ...puntos[0] });
    }

    return puntos;
}

function construirRutaMixtaPatrullaje(incidencias) {
    if (!Array.isArray(incidencias) || incidencias.length === 0) return [];

    const conteoPorPotrero = {};

    incidencias.forEach(item => {
        const nombre = item.potrero && item.potrero.trim() !== "" ? item.potrero : "Sin dato";
        conteoPorPotrero[nombre] = (conteoPorPotrero[nombre] || 0) + 1;
    });

    const rankingPotreros = Object.entries(conteoPorPotrero)
        .map(([nombre, cantidad]) => ({ nombre, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad);

    const ruta = [];

    rankingPotreros.forEach(({ nombre, cantidad }) => {
        const potrero = potrerosConfig.find(p => p.nombre === nombre);
        if (!potrero) return;

        // 1) puntos del perímetro del potrero
        const puntosPerimetro = obtenerPuntosPatrullajePotrero(potrero, 2);
        ruta.push(...puntosPerimetro);

        // 2) incidencias reales dentro de ese potrero
        const incidenciasPotrero = incidencias
            .filter(item => (item.potrero || "Sin dato") === nombre)
            .filter(item => item.lat != null && item.lng != null)
            .sort((a, b) => {
                const prioridadA = a.prioridadOperativa || 0;
                const prioridadB = b.prioridadOperativa || 0;
                return prioridadB - prioridadA;
            })
            .map(item => ({
                ...item,
                esPuntoRuta: false
            }));

        ruta.push(...incidenciasPotrero);

        // 3) centro del potrero como punto de control
        const centro = obtenerCentroPotrero(potrero);
        if (centro) {
            ruta.push({
                lat: centro.lat,
                lng: centro.lng,
                tipo: "Control central",
                potrero: nombre,
                guardia: "Sistema",
                fecha: new Date().toISOString().split("T")[0],
                prioridadOperativa: `Control del potrero (${cantidad} incidencias)`,
                esPuntoRuta: true
            });
        }
    });

    return ruta;
}

function activarPatrullajeOperativo() {
    colaPatrullaje = construirColaPatrullaje(incidenciasFiltradasActuales);

    if (!colaPatrullaje.length) {
        limpiarPatrullajeOperativo();
        alert("No hay incidencias disponibles para patrullaje con los filtros actuales.");
        return;
    }

    patrullajeActivo = true;
    patrullajeAutomaticoActivo = true;
    indiceObjetivoActual = 0;

    limpiarPatrulleroVisual();
    dibujarRutaPatrullajeVisual();
    renderPatrullajeOperativo();

    const primerObjetivo = colaPatrullaje[indiceObjetivoActual];
    if (primerObjetivo && primerObjetivo.lat && primerObjetivo.lng) {
        map.flyTo([primerObjetivo.lat, primerObjetivo.lng], ZOOM_PATRULLAJE, {
            animate: true,
            duration: 1.8
        });
    }
    abrirMapaEnPantallaCompleta();

    enfocarObjetivoPatrullaje(primerObjetivo);
    iniciarRecorridoAutomaticoPatrullaje();
}

function iniciarRecorridoAutomaticoPatrullaje() {
    detenerRecorridoAutomaticoPatrullaje();

    if (!patrullajeActivo || !patrullajeAutomaticoActivo || colaPatrullaje.length === 0) {
        return;
    }

    temporizadorPatrullajeAuto = setInterval(() => {
        if (!patrullajeActivo || !patrullajeAutomaticoActivo || colaPatrullaje.length === 0) {
            detenerRecorridoAutomaticoPatrullaje();
            return;
        }
        //velocidad de patrullero
        // //
        avanzarPatrullajeVirtual();
    }, INTERVALO_PATRULLAJE_AUTO);
}

function detenerRecorridoAutomaticoPatrullaje() {
    if (temporizadorPatrullajeAuto) {
        clearInterval(temporizadorPatrullajeAuto);
        temporizadorPatrullajeAuto = null;
    }
}

function avanzarPatrullajeVirtual() {
    if (!patrullajeActivo || colaPatrullaje.length === 0) return;

    if (indiceObjetivoActual < colaPatrullaje.length - 1) {
        indiceObjetivoActual += 1;
    } else {
        indiceObjetivoActual = 0; // vuelve a empezar la ronda
    }

    renderPatrullajeOperativo();
    enfocarObjetivoPatrullaje(colaPatrullaje[indiceObjetivoActual]);
}

function irAlSiguienteObjetivoPatrullaje() {
    if (!patrullajeActivo || colaPatrullaje.length === 0) return;

    if (indiceObjetivoActual < colaPatrullaje.length - 1) {
        indiceObjetivoActual += 1;
    } else {
        indiceObjetivoActual = 0;
    }

    renderPatrullajeOperativo();
    enfocarObjetivoPatrullaje(colaPatrullaje[indiceObjetivoActual]);

    if (patrullajeAutomaticoActivo) {
        iniciarRecorridoAutomaticoPatrullaje();
    }
}

function obtenerResumenTemporalPDF(incidencias) {
    if (!incidencias || incidencias.length === 0) {
        return {
            totalFechas: 0,
            fechaReciente: "-",
            fechaCritica: "-"
        };
    }

    const conteoPorFecha = {};

    incidencias.forEach((item) => {
        const fechaClave = normalizarFechaClave(item.fecha);
        if (!fechaClave) return;

        conteoPorFecha[fechaClave] = (conteoPorFecha[fechaClave] || 0) + 1;
    });

    const fechas = Object.keys(conteoPorFecha).sort((a, b) => {
        const fechaA = normalizarFechaParaOrden(a);
        const fechaB = normalizarFechaParaOrden(b);

        if (!fechaA && !fechaB) return 0;
        if (!fechaA) return 1;
        if (!fechaB) return -1;

        return fechaB - fechaA;
    });

    if (fechas.length === 0) {
        return {
            totalFechas: 0,
            fechaReciente: "-",
            fechaCritica: "-"
        };
    }

    let fechaCritica = fechas[0];
    let mayorCantidad = conteoPorFecha[fechaCritica];

    fechas.forEach((fecha) => {
        if (conteoPorFecha[fecha] > mayorCantidad) {
            fechaCritica = fecha;
            mayorCantidad = conteoPorFecha[fecha];
        }
    });

    return {
        totalFechas: fechas.length,
        fechaReciente: formatearFechaVisible(fechas[0]),
        fechaCritica: `${formatearFechaVisible(fechaCritica)} (${mayorCantidad})`
    };
}

function obtenerDetallePotreroSeleccionadoPDF() {
    if (!potreroSeleccionado) {
        return null;
    }

    const incidenciasPotrero = obtenerIncidenciasDePotrero(potreroSeleccionado);

    if (!incidenciasPotrero || incidenciasPotrero.length === 0) {
        return null;
    }

    const riesgo = calcularNivelRiesgo(incidenciasPotrero.length);
    const tipoFrecuente = obtenerTipoMasFrecuente(incidenciasPotrero);
    const fechaReciente = obtenerFechaMasReciente(incidenciasPotrero);

    return {
        nombre: potreroSeleccionado,
        total: incidenciasPotrero.length,
        riesgo: riesgo.texto,
        tipoFrecuente,
        fechaReciente
    };
}

function exportarInformePDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("No se pudo cargar la librería PDF.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const filtroActual = filtroTipo ? filtroTipo.value : "todos";
    const modoActual = modoVisualizacion ? modoVisualizacion.value : "marcadores";
    const totalIncidencias = incidenciasFiltradasActuales.length;

    const potrerosUnicos = new Set(
        incidenciasFiltradasActuales.map((item) =>
            item.potrero && item.potrero.trim() !== "" ? item.potrero : "Sin dato"
        )
    );

    const totalPotreros = potrerosUnicos.size;

    let conteo = {};
    incidenciasFiltradasActuales.forEach((item) => {
        const nombre = item.potrero && item.potrero.trim() !== "" ? item.potrero : "Sin dato";
        conteo[nombre] = (conteo[nombre] || 0) + 1;
    });

    let potreroCritico = "-";
    let mayorCantidad = 0;

    Object.entries(conteo).forEach(([potrero, cantidad]) => {
        if (cantidad > mayorCantidad) {
            potreroCritico = potrero;
            mayorCantidad = cantidad;
        }
    });

    const riesgoGeneral = calcularNivelRiesgo(totalIncidencias).texto;
    const resumenTemporal = obtenerResumenTemporalPDF(incidenciasFiltradasActuales);
    const detallePotrero = obtenerDetallePotreroSeleccionadoPDF();

    let y = 20;

    doc.setFontSize(18);
    doc.text("Informe de Riesgo Rural", 14, y);
    y += 10;

    doc.setFontSize(10);
    doc.text(`Fecha de generación: ${obtenerFechaHoraActual()}`, 14, y);
    y += 6;
    doc.text(`Filtro por tipo: ${filtroActual}`, 14, y);
    y += 6;
    doc.text(`Visualización: ${modoActual}`, 14, y);
    y += 10;

    doc.setFontSize(14);
    doc.text("Resumen general", 14, y);
    y += 8;

    doc.setFontSize(11);
    doc.text(`Total de incidencias: ${totalIncidencias}`, 14, y);
    y += 6;
    doc.text(`Potreros con incidencias: ${totalPotreros}`, 14, y);
    y += 6;
    doc.text(`Potrero más afectado: ${potreroCritico}`, 14, y);
    y += 6;
    doc.text(`Riesgo general: ${riesgoGeneral}`, 14, y);
    y += 10;

    doc.setFontSize(14);
    doc.text("Historial temporal", 14, y);
    y += 8;

    doc.setFontSize(11);
    doc.text(`Fechas con actividad: ${resumenTemporal.totalFechas}`, 14, y);
    y += 6;
    doc.text(`Fecha más reciente: ${resumenTemporal.fechaReciente}`, 14, y);
    y += 6;
    doc.text(`Fecha más crítica: ${resumenTemporal.fechaCritica}`, 14, y);
    y += 10;

    if (detallePotrero) {
        doc.setFontSize(14);
        doc.text("Potrero seleccionado", 14, y);
        y += 8;

        doc.setFontSize(11);
        doc.text(`Nombre: ${detallePotrero.nombre}`, 14, y);
        y += 6;
        doc.text(`Total incidencias: ${detallePotrero.total}`, 14, y);
        y += 6;
        doc.text(`Nivel de riesgo: ${detallePotrero.riesgo}`, 14, y);
        y += 6;
        doc.text(`Tipo más frecuente: ${detallePotrero.tipoFrecuente}`, 14, y);
        y += 6;
        doc.text(`Fecha más reciente: ${detallePotrero.fechaReciente}`, 14, y);
        y += 10;
    }

    doc.setFontSize(10);
    doc.text("Generado desde SISG Rural - Red Rural", 14, y);

    doc.save("informe-riesgo-rural.pdf");
}


function obtenerIncidenciasDePotrero(nombrePotrero, incidenciasBase = incidenciasFiltradasActuales) {
    if (!nombrePotrero) return [];

    return incidenciasBase.filter((item) => {
        const nombre = item.potrero && item.potrero.trim() !== "" ? item.potrero : "Sin dato";
        return nombre === nombrePotrero;
    });
}

function aplicarFiltroPotrero(nombrePotrero) {

    if (!nombrePotrero) return;

    filtroPotreroActivo = nombrePotrero;

    const incidenciasFiltradas = todasLasIncidencias.filter((item) => {
        const nombre = item.potrero && item.potrero.trim() !== "" ? item.potrero : "Sin dato";
        return nombre === nombrePotrero;
    });

    incidenciasFiltradasActuales = incidenciasFiltradas;

    renderizarMarcadores();
}

function restablecerVistaCompleta() {
    filtroPotreroActivo = null;
    incidenciasFiltradasActuales = todasLasIncidencias;
    potreroSeleccionado = null;
    incidenciaSeleccionadaId = null;

    renderizarMarcadores();
    limpiarDetallePotrero();
}

function seleccionarPotreroDesdeMapa(nombrePotrero) {
    if (!nombrePotrero) return;

    const incidenciasPotrero = obtenerIncidenciasDePotrero(nombrePotrero);
    const cantidad = incidenciasPotrero.length;

    incidenciaSeleccionadaId = null;
    potreroSeleccionado = nombrePotrero;

    enfocarPotreroSeleccionado(nombrePotrero, cantidad);

    document.querySelectorAll(".potrero-card").forEach((card) => {
        card.classList.toggle("activo", card.dataset.potrero === nombrePotrero);
    });

    renderDetallePotrero(nombrePotrero, incidenciasPotrero);
}

function obtenerTipoMasFrecuente(incidencias) {
    if (!incidencias || incidencias.length === 0) return "-";

    const conteo = {};

    incidencias.forEach((item) => {
        const tipo = item.tipo && item.tipo.trim() !== "" ? item.tipo : "Sin dato";
        conteo[tipo] = (conteo[tipo] || 0) + 1;
    });

    let tipoMayor = "-";
    let cantidadMayor = 0;

    Object.entries(conteo).forEach(([tipo, cantidad]) => {
        if (cantidad > cantidadMayor) {
            tipoMayor = tipo;
            cantidadMayor = cantidad;
        }
    });

    return tipoMayor;
}

function obtenerFechaMasReciente(incidencias) {
    if (!incidencias || incidencias.length === 0) return "-";

    const ordenadas = [...incidencias]
        .filter(item => item.fecha)
        .sort((a, b) => {
            const fechaA = normalizarFechaParaOrden(a.fecha);
            const fechaB = normalizarFechaParaOrden(b.fecha);

            if (!fechaA && !fechaB) return 0;
            if (!fechaA) return 1;
            if (!fechaB) return -1;

            return fechaB - fechaA;
        });

    return ordenadas.length > 0 ? (ordenadas[0].fecha || "-") : "-";
}

function renderDetallePotrero(nombrePotrero, incidenciasPotrero) {
    if (!detallePotreroVacio || !detallePotreroContenido) return;

    if (!incidenciasPotrero || incidenciasPotrero.length === 0) {
        limpiarDetallePotrero();
        return;
    }

    const riesgo = calcularNivelRiesgo(incidenciasPotrero.length);
    const tipoFrecuente = obtenerTipoMasFrecuente(incidenciasPotrero);
    const fechaReciente = obtenerFechaMasReciente(incidenciasPotrero);

    detallePotreroVacio.style.display = "none";
    detallePotreroContenido.style.display = "flex";

    detalleNombrePotrero.textContent = nombrePotrero || "-";
    detalleTotalIncidencias.textContent = incidenciasPotrero.length;
    detalleNivelRiesgo.textContent = riesgo.texto;
    detalleTipoFrecuente.textContent = tipoFrecuente;
    detalleFechaReciente.textContent = fechaReciente;

    const incidenciasOrdenadas = [...incidenciasPotrero].sort((a, b) => {
        const fechaA = normalizarFechaParaOrden(a.fecha);
        const fechaB = normalizarFechaParaOrden(b.fecha);

        if (!fechaA && !fechaB) return 0;
        if (!fechaA) return 1;
        if (!fechaB) return -1;

        return fechaB - fechaA;
    });

    detalleListaIncidencias.innerHTML = "";

    incidenciasOrdenadas.slice(0, 5).forEach((item) => {
        const fila = document.createElement("div");
        fila.className = "detalle-item-incidencia";
        fila.dataset.id = item.id || "";

        if (incidenciaSeleccionadaId && item.id === incidenciaSeleccionadaId) {
            fila.classList.add("activo");
        }

        fila.innerHTML = `
        <div class="fila-tipo">${item.tipo || "Sin tipo"}</div>
        <div class="fila-meta">
            Fecha: ${item.fecha || "-"} | Guardia: ${item.guardia || "-"} | Evidencia: ${item.evidencia || "-"}
        </div>
        <div class="fila-observacion">
            ${item.observaciones && item.observaciones.trim() !== "" ? item.observaciones : "Sin observaciones"}
        </div>
        <div class="fila-accion">
            ${item.lat && item.lng ? "Ver ubicación en mapa" : "Sin coordenadas precisas"}
        </div>
    `;

        fila.addEventListener("click", () => {
            if (!item.id) return;
            enfocarIncidenciaEnMapa(item.id);
        });

        detalleListaIncidencias.appendChild(fila);
    });
}

function resaltarPotreroMasAfectado(incidencias) {
    if (!incidencias || incidencias.length === 0) {
        resetearEstiloPotreros();
        limpiarDetallePotrero();
        return;
    }

    if (potreroSeleccionado) {
        const sigueVisible = incidencias.some((item) => {
            const nombre = item.potrero && item.potrero.trim() !== "" ? item.potrero : "Sin dato";
            return nombre === potreroSeleccionado;
        });

        if (sigueVisible) {
            const cantidad = incidencias.filter((item) => {
                const nombre = item.potrero && item.potrero.trim() !== "" ? item.potrero : "Sin dato";
                return nombre === potreroSeleccionado;
            }).length;

            enfocarPotreroSeleccionado(potreroSeleccionado, cantidad);
            return;
        } else {
            potreroSeleccionado = null;
        }
    }

    const conteo = {};

    incidencias.forEach((item) => {
        const potrero = item.potrero && item.potrero.trim() !== "" ? item.potrero : "Sin dato";
        conteo[potrero] = (conteo[potrero] || 0) + 1;
    });

    let potreroMasAfectado = null;
    let mayorCantidad = 0;

    Object.entries(conteo).forEach(([potrero, cantidad]) => {
        if (cantidad > mayorCantidad) {
            mayorCantidad = cantidad;
            potreroMasAfectado = potrero;
        }
    });

    resetearEstiloPotreros();

    poligonosPotreros.forEach((item) => {
        if (item.nombre === potreroMasAfectado) {
            item.layer.setStyle({
                color: "#7f1d1d",
                fillColor: "#dc2626",
                weight: 4,
                fillOpacity: 0.30
            });
        }
    });

    const incidenciasPotrero = obtenerIncidenciasDePotrero(potreroMasAfectado, incidencias);

    renderDetallePotrero(potreroMasAfectado, incidenciasPotrero);

    document.querySelectorAll(".potrero-card").forEach((card) => {
        card.classList.toggle("activo", card.dataset.potrero === potreroMasAfectado);
    });
}

function obtenerPotreroMasAfectado(incidencias) {
    if (!incidencias || incidencias.length === 0) return null;

    const conteo = {};

    incidencias.forEach((item) => {
        const potrero = item.potrero && item.potrero.trim() !== "" ? item.potrero : "Sin dato";
        conteo[potrero] = (conteo[potrero] || 0) + 1;
    });

    let potreroMasAfectado = null;
    let mayorCantidad = 0;

    Object.entries(conteo).forEach(([potrero, cantidad]) => {
        if (cantidad > mayorCantidad) {
            mayorCantidad = cantidad;
            potreroMasAfectado = potrero;
        }
    });

    return potreroMasAfectado;
}

function obtenerPotreroDesdeURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get("potrero");
}

function centrarEnPotreroMasAfectado(incidencias) {
    const nombrePotrero = obtenerPotreroMasAfectado(incidencias);

    if (!nombrePotrero) return false;

    const potreroEncontrado = poligonosPotreros.find(
        (item) => item.nombre === nombrePotrero
    );

    if (!potreroEncontrado || !potreroEncontrado.bounds) return false;

    map.fitBounds(potreroEncontrado.bounds, { padding: [40, 40] });
    return true;
}

function colorPorTipo(tipo) {
    switch (tipo) {
        case "Faltante de ganado":
            return "#dc2626"; // rojo
        case "Huellas de vehículo":
            return "#f97316"; // naranja
        case "Alambrado manipulado":
            return "#8b5e3c"; // marrón
        case "Tranquera abierta":
            return "#2563eb"; // azul
        case "Movimiento nocturno":
            return "#7c3aed"; // violeta
        case "Rastros de arreo":
            return "#16a34a"; // verde
        default:
            return "#475569"; // gris
    }
}

function crearIconoColor(color) {
    return L.divIcon({
        className: "custom-div-icon",
        html: `
      <div style="
        background:${color};
        width:18px;
        height:18px;
        border-radius:50%;
        border:3px solid white;
        box-shadow:0 0 0 2px rgba(0,0,0,0.2);
      "></div>
    `,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -10]
    });
}

function agregarLeyenda() {
    const legend = L.control({ position: "bottomright" });

    legend.onAdd = function () {
        const div = L.DomUtil.create("div", "info legend");

        div.innerHTML = `
            <div class="legend-toggle">📋 Leyenda</div>
            <div class="legend-body">
                <div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#dc2626;margin-right:8px;"></span>Faltante de ganado</div>
                <div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#f97316;margin-right:8px;"></span>Huellas de vehículo</div>
                <div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#8b5e3c;margin-right:8px;"></span>Alambrado manipulado</div>
                <div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#2563eb;margin-right:8px;"></span>Tranquera abierta</div>
                <div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#7c3aed;margin-right:8px;"></span>Movimiento nocturno</div>
                <div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#16a34a;margin-right:8px;"></span>Rastros de arreo</div>
            </div>
        `;

        if (window.innerWidth <= 760) {
            div.classList.remove("legend-expandida");
        } else {
            div.classList.add("legend-expandida");
        }

        const toggle = div.querySelector(".legend-toggle");
        toggle.addEventListener("click", () => {
            if (window.innerWidth <= 760) {
                div.classList.toggle("legend-expandida");
            }
        });

        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);

        return div;
    };

    legend.addTo(map);
}

let potrerosConfig = [];
let capaEditablePotreros = null;
let controlDibujoPotreros = null;
let modoEdicionPotrerosActivo = false;
let usuarioActualMapa = null;
let controlEdicionPotreros = null;
let modoEliminarPotreroActivo = false;

function redibujarPotrerosDesdeConfig() {
    poligonosPotreros = [];

    if (!capaEditablePotreros) return;

    capaEditablePotreros.clearLayers();

    potrerosConfig.forEach((potrero) => {
        if (!potrero.coordenadas || !Array.isArray(potrero.coordenadas) || potrero.coordenadas.length < 3) {
            return;
        }

        const coords = potrero.coordenadas.map((p) => [p.lat, p.lng]);

        const poligono = L.polygon(coords, {
            color: potrero.color || "#16a34a",
            weight: 2,
            fillColor: potrero.color || "#16a34a",
            fillOpacity: 0.15
        });

        poligono._potreroId = potrero.id || null;
        poligono._potreroNombre = potrero.nombre;

        poligono.on("click", () => {
            if (modoEliminarPotreroActivo) {
                eliminarPotreroSeleccionado(potrero.nombre);
                return;
            }

            seleccionarPotreroDesdeMapa(potrero.nombre);
        });

        poligono.bindTooltip(potrero.nombre || "Potrero sin nombre", {
            permanent: false,
            direction: "center"
        });

        poligono.addTo(capaEditablePotreros);

        poligonosPotreros.push({
            id: potrero.id || null,
            nombre: potrero.nombre,
            descripcion: potrero.descripcion || "",
            riesgo: potrero.riesgo || "bajo",
            colorOriginal: potrero.color || "#16a34a",
            layer: poligono,
            bounds: poligono.getBounds()
        });
    });
}

function inicializarEditorPotreros() {
    capaEditablePotreros = new L.FeatureGroup();
    map.addLayer(capaEditablePotreros);

    controlDibujoPotreros = new L.Control.Draw({
        draw: false,
        edit: false
    });

    map.on(L.Draw.Event.CREATED, (event) => {
        if (!modoEdicionPotrerosActivo) return;

        const layer = event.layer;
        const latlngs = layer.getLatLngs()[0];

        if (!latlngs || !latlngs[0] || latlngs[0].length < 3) {
            alert("El potrero debe tener al menos 3 puntos.");
            return;
        }

        const nombre = prompt("Ingresá el nombre del potrero:");
        if (!nombre || nombre.trim() === "") {
            alert("Debés ingresar un nombre.");
            return;
        }

        const color = prompt("Ingresá un color hexadecimal para el potrero (ejemplo: #16a34a):", "#16a34a") || "#16a34a";

        const coordenadas = latlngs.map((p) => ({
            lat: p.lat,
            lng: p.lng
        }));

        potrerosConfig.push({
            nombre: nombre.trim(),
            descripcion: "Potrero creado por el usuario",
            riesgo: "bajo",
            color: color.trim(),
            coordenadas
        });

        modoEdicionPotrerosActivo = false;
        redibujarPotrerosDesdeConfig();
        renderizarMarcadores();
        seleccionarPotreroDesdeMapa(nombre.trim());

        if (btnGuardarPotreros) {
            btnGuardarPotreros.style.display = "inline-flex";
        }
    });
}

function activarModoDibujoPotreros() {
    if (!map) return;

    modoEdicionPotrerosActivo = true;

    const drawer = new L.Draw.Polygon(map, {
        allowIntersection: false,
        showArea: true,
        shapeOptions: {
            color: "#166534",
            weight: 3
        }
    });

    drawer.enable();
}

function activarModoEdicionPotreros() {
    if (!map || !capaEditablePotreros) return;

    modoEliminarPotreroActivo = false;

    if (controlEdicionPotreros) {
        controlEdicionPotreros.disable();
    }

    controlEdicionPotreros = new L.EditToolbar.Edit(map, {
        featureGroup: capaEditablePotreros,
        selectedPathOptions: {
            maintainColor: true,
            opacity: 0.9,
            fillOpacity: 0.25
        }
    });

    controlEdicionPotreros.enable();

    if (btnGuardarPotreros) {
        btnGuardarPotreros.style.display = "inline-flex";
    }
}

function activarModoEliminarPotrero() {
    modoEliminarPotreroActivo = true;
    alert("Modo eliminar activado. Hacé clic sobre el potrero que querés borrar.");
}

function eliminarPotreroSeleccionado(nombrePotrero) {
    if (!nombrePotrero) return;

    const confirmar = confirm(`¿Querés eliminar el potrero "${nombrePotrero}"?`);
    if (!confirmar) {
        modoEliminarPotreroActivo = false;
        return;
    }

    potrerosConfig = potrerosConfig.filter((p) => p.nombre !== nombrePotrero);

    if (potreroSeleccionado === nombrePotrero) {
        potreroSeleccionado = null;
        filtroPotreroActivo = null;
        incidenciaSeleccionadaId = null;
        limpiarDetallePotrero();
        limpiarHistorialTemporal();
    }

    modoEliminarPotreroActivo = false;

    redibujarPotrerosDesdeConfig();
    renderizarMarcadores();

    if (btnGuardarPotreros) {
        btnGuardarPotreros.style.display = "inline-flex";
    }
}

function sincronizarPotrerosEditadosDesdeMapa() {
    if (!capaEditablePotreros) return;

    const nuevosPotreros = [];

    capaEditablePotreros.eachLayer((layer) => {
        if (!(layer instanceof L.Polygon)) return;

        const nombre = layer._potreroNombre;
        if (!nombre) return;

        const original = potrerosConfig.find((p) => p.nombre === nombre);
        if (!original) return;

        const latlngs = layer.getLatLngs()[0] || [];
        const coordenadas = latlngs.map((p) => ({
            lat: p.lat,
            lng: p.lng
        }));

        nuevosPotreros.push({
            ...original,
            coordenadas
        });
    });

    potrerosConfig = nuevosPotreros;
    redibujarPotrerosDesdeConfig();
    renderizarMarcadores();

    if (btnGuardarPotreros) {
        btnGuardarPotreros.style.display = "inline-flex";
    }
}

async function cargarPotrerosDesdeFirestore(uid) {
    try {
        const q = query(collection(db, "potreros"), where("productorId", "==", uid));
        const snapshot = await getDocs(q);

        potrerosConfig = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                nombre: data.nombre || "Sin nombre",
                descripcion: data.descripcion || "",
                riesgo: data.riesgo || "bajo",
                color: data.color || "#16a34a",
                coordenadas: data.coordenadas || []
            };
        });

        redibujarPotrerosDesdeConfig();
    } catch (error) {
        console.error("Error cargando potreros:", error);
    }
}

async function guardarPotrerosFirestore() {
    if (!usuarioActualMapa) {
        alert("No hay usuario autenticado.");
        return;
    }

    try {
        const q = query(collection(db, "potreros"), where("productorId", "==", usuarioActualMapa.uid));
        const snapshot = await getDocs(q);

        for (const item of snapshot.docs) {
            await deleteDoc(doc(db, "potreros", item.id));
        }

        for (const potrero of potrerosConfig) {
            await addDoc(collection(db, "potreros"), {
                productorId: usuarioActualMapa.uid,
                nombre: potrero.nombre,
                descripcion: potrero.descripcion || "",
                riesgo: potrero.riesgo || "bajo",
                color: potrero.color || "#16a34a",
                coordenadas: potrero.coordenadas || [],
                creadoEn: Date.now()
            });
        }

        alert("Potreros guardados correctamente.");
        btnGuardarPotreros.style.display = "none";
    } catch (error) {
        console.error("Error guardando potreros:", error);
        alert("No se pudieron guardar los potreros.");
    }
}

function crearContenidoPopup(data) {
    return `
    <div style="min-width: 240px; font-size: 13px; line-height: 1.5;">
      <div style="margin-bottom: 8px;">
        <strong style="font-size: 14px; color: #14532d;">Incidencia registrada</strong>
      </div>

      <div><strong>Tipo:</strong> ${data.tipo || "-"}</div>
      <div><strong>Potrero:</strong> ${data.potrero || "-"}</div>
      <div><strong>Guardia:</strong> ${data.guardia || "-"}</div>
      <div><strong>Fecha:</strong> ${data.fecha || "-"}</div>
      <div><strong>Establecimiento:</strong> ${data.establecimiento || "-"}</div>
      <div><strong>Cantidad:</strong> ${data.cantidad ?? "-"}</div>
      <div><strong>Evidencia:</strong> ${data.evidencia || "-"}</div>

      <div style="margin-top: 8px;">
        <strong>Observaciones:</strong>
        <div style="
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 8px;
          margin-top: 4px;
        ">
          ${data.observaciones && data.observaciones.trim() !== "" ? data.observaciones : "Sin observaciones"}
        </div>
      </div>
    </div>
  `;
}

function renderResumenGeneral(incidencias) {
    if (!totalIncidenciasMapa || !totalPotrerosMapa || !potreroMasAfectadoMapa || !riesgoGeneralMapa) return;

    if (incidencias.length === 0) {
        totalIncidenciasMapa.textContent = "0";
        totalPotrerosMapa.textContent = "0";
        potreroMasAfectadoMapa.textContent = "-";
        riesgoGeneralMapa.textContent = "Sin datos";
        return;
    }

    const conteo = {};

    incidencias.forEach((item) => {
        const potrero = item.potrero && item.potrero.trim() !== "" ? item.potrero : "Sin dato";
        conteo[potrero] = (conteo[potrero] || 0) + 1;
    });

    let potreroMayor = "-";
    let cantidadMayor = 0;

    Object.entries(conteo).forEach(([potrero, cantidad]) => {
        if (cantidad > cantidadMayor) {
            cantidadMayor = cantidad;
            potreroMayor = potrero;
        }
    });

    totalIncidenciasMapa.textContent = incidencias.length;
    totalPotrerosMapa.textContent = Object.keys(conteo).length;
    potreroMasAfectadoMapa.textContent = potreroMayor;

    if (incidencias.length <= 3) {
        riesgoGeneralMapa.textContent = "Bajo";
    } else if (incidencias.length <= 6) {
        riesgoGeneralMapa.textContent = "Medio";
    } else {
        riesgoGeneralMapa.textContent = "Alto";
    }
}


function renderizarMarcadores() {
    limpiarMarcadores();
    limpiarHeatmap();

    const tipoSeleccionado = filtroTipo.value;
    const modoSeleccionado = modoVisualizacion ? modoVisualizacion.value : "marcadores";

    let incidenciasBase = todasLasIncidencias;

    if (filtroPotreroActivo) {
        incidenciasBase = incidenciasBase.filter((item) => {
            const nombre = item.potrero && item.potrero.trim() !== "" ? item.potrero : "Sin dato";
            return nombre === filtroPotreroActivo;
        });
    }

    const incidenciasFiltradas = incidenciasBase.filter(item => {
        if (tipoSeleccionado === "todos") return true;
        return item.tipo === tipoSeleccionado;
    });

    incidenciasFiltradasActuales = incidenciasFiltradas;

    if (modoSeleccionado === "marcadores" || modoSeleccionado === "mixto") {
        incidenciasFiltradas.forEach((data) => {
            if (!data.lat || !data.lng) return;

            const color = colorPorTipo(data.tipo);
            const icono = crearIconoColor(color);

            const marker = L.marker([data.lat, data.lng], { icon: icono });

            marker.bindPopup(crearContenidoPopup(data));

            grupoMarcadores.addLayer(marker);
            marcadores.push(marker);

            if (data.id) {
                marcadoresPorId.set(data.id, marker);
            }
        });
    }

    if (modoSeleccionado === "heatmap" || modoSeleccionado === "mixto") {
        renderizarHeatmap(incidenciasFiltradas);
    }

    ajustarVistaMapa(incidenciasFiltradas);
    renderResumenPotreros(incidenciasFiltradas);
    renderResumenGeneral(incidenciasFiltradas);
    renderHistorialTemporal(incidenciasFiltradas);
    resaltarPotreroMasAfectado(incidenciasFiltradas);

    if (patrullajeActivo) {
        colaPatrullaje = construirColaPatrullaje(incidenciasFiltradas);

        if (colaPatrullaje.length === 0) {
            limpiarPatrullajeOperativo();
        } else {
            if (indiceObjetivoActual >= colaPatrullaje.length) {
                indiceObjetivoActual = 0;
            }

            renderPatrullajeOperativo();
        }
    }

    if (incidenciasFiltradas.length === 0) {
        potreroSeleccionado = null;
        incidenciaSeleccionadaId = null;
        limpiarDetallePotrero();
        limpiarHistorialTemporal();
        limpiarPatrullajeOperativo();
        actualizarBadgesMapaUI();
    }
}

function puntoDentroDePoligono(lat, lng, coordenadas) {
    let dentro = false;

    for (let i = 0, j = coordenadas.length - 1; i < coordenadas.length; j = i++) {
        const xi = coordenadas[i].lng;
        const yi = coordenadas[i].lat;
        const xj = coordenadas[j].lng;
        const yj = coordenadas[j].lat;

        const intersecta =
            ((yi > lat) !== (yj > lat)) &&
            (lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || 0.0000001) + xi);

        if (intersecta) dentro = !dentro;
    }

    return dentro;
}

function obtenerPotreroAutomaticoDeIncidencia(incidencia) {
    if (!incidencia || incidencia.lat == null || incidencia.lng == null) return null;

    const encontrado = potrerosConfig.find((potrero) => {
        const coords = potrero.coordenadas || [];
        if (!Array.isArray(coords) || coords.length < 3) return false;

        return puntoDentroDePoligono(incidencia.lat, incidencia.lng, coords);
    });

    return encontrado ? encontrado.nombre : null;
}

async function cargarIncidencias(user) {
    try {
        const snapshot = await getDocs(incidenciasRef);
        todasLasIncidencias = [];

        snapshot.forEach((doc) => {
            const data = doc.data();

            if (data.productorId !== user.uid) return;
            const potreroDetectado = obtenerPotreroAutomaticoDeIncidencia(data);

            todasLasIncidencias.push({
                id: doc.id,
                ...data,
                potrero: potreroDetectado || data.potrero || "Sin dato"
            });
        });

        renderizarMarcadores();

        const potreroDesdeURL = obtenerPotreroDesdeURL();
        if (potreroDesdeURL) {
            setTimeout(() => {
                seleccionarPotreroDesdeParametro(potreroDesdeURL);
            }, 100);
        }

    } catch (error) {
        console.error("Error cargando incidencias para el mapa:", error);
    }
}

if (filtroTipo) {
    filtroTipo.addEventListener("change", renderizarMarcadores);
}

if (modoVisualizacion) {
    modoVisualizacion.addEventListener("change", renderizarMarcadores);
}

agregarLeyenda();
inicializarEditorPotreros();
redibujarPotrerosDesdeConfig();



onAuthStateChanged(auth, async (user) => {
    if (!user) {
        alert("Debe iniciar sesión en Red Rural");
        return;
    }

    usuarioActualMapa = user;

    await cargarPotrerosDesdeFirestore(user.uid);
    await cargarIncidencias(user);
});

if (btnFiltrarPotrero) {

    btnFiltrarPotrero.addEventListener("click", () => {

        if (!potreroSeleccionado) return;

        aplicarFiltroPotrero(potreroSeleccionado);

    });

}

if (btnExportarPDF) {
    btnExportarPDF.addEventListener("click", exportarInformePDF);
}

if (btnActivarPatrullaje) {
    btnActivarPatrullaje.addEventListener("click", activarPatrullajeOperativo);
}

if (btnSiguienteObjetivo) {
    btnSiguienteObjetivo.addEventListener("click", irAlSiguienteObjetivoPatrullaje);
}

if (btnSalirPatrullaje) {
    btnSalirPatrullaje.addEventListener("click", limpiarPatrullajeOperativo);
}
if (btnRestablecerVista) {

    btnRestablecerVista.addEventListener("click", () => {

        restablecerVistaCompleta();

    });

}
if (btnEliminarPotrero) {
    btnEliminarPotrero.addEventListener("click", activarModoEliminarPotrero);
}

async function entrarPantallaCompleta(elemento) {
    if (elemento.requestFullscreen) {
        return elemento.requestFullscreen();
    }
    if (elemento.webkitRequestFullscreen) {
        return elemento.webkitRequestFullscreen();
    }
}

async function salirPantallaCompleta() {
    if (document.exitFullscreen) {
        return document.exitFullscreen();
    }
    if (document.webkitExitFullscreen) {
        return document.webkitExitFullscreen();
    }
}

function obtenerElementoFullscreen() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
}

async function alternarPantallaCompletaMapa() {
    if (!mapaShell) return;

    try {
        if (!obtenerElementoFullscreen()) {
            await entrarPantallaCompleta(mapaShell);
        } else {
            await salirPantallaCompleta();
        }
    } catch (error) {
        console.error("No se pudo cambiar a pantalla completa:", error);
    }
}

if (btnPantallaCompletaMapa && mapaShell) {
    btnPantallaCompletaMapa.addEventListener("click", alternarPantallaCompletaMapa);
}

if (btnModoPotreros) {
    btnModoPotreros.addEventListener("click", activarModoDibujoPotreros);
}

if (btnGuardarPotreros) {
    btnGuardarPotreros.addEventListener("click", async () => {
        sincronizarPotrerosEditadosDesdeMapa();
        await guardarPotrerosFirestore();

        if (controlEdicionPotreros) {
            controlEdicionPotreros.disable();
        }
    });
}

if (btnEditarPotreros) {
    btnEditarPotreros.addEventListener("click", activarModoEdicionPotreros);
}
function actualizarEstadoPantallaCompleta() {
    const estaEnPantallaCompleta = obtenerElementoFullscreen() === mapaShell;

    if (btnPantallaCompletaMapa) {
        btnPantallaCompletaMapa.textContent = estaEnPantallaCompleta
            ? "Salir pantalla completa"
            : "Pantalla completa";
    }

    setTimeout(() => {
        if (typeof map !== "undefined" && map) {
            map.invalidateSize();
        }
    }, 250);
}

document.addEventListener("fullscreenchange", actualizarEstadoPantallaCompleta);
document.addEventListener("webkitfullscreenchange", actualizarEstadoPantallaCompleta);

btnSalirPatrullaje?.addEventListener("click", () => {
    limpiarPatrullajeOperativo();

    if (grupoMarcadores && grupoMarcadores.getBounds && grupoMarcadores.getLayers().length) {
        map.fitBounds(grupoMarcadores.getBounds(), { padding: [30, 30] });
    }
});

btnSalirPatrullaje?.addEventListener("click", () => {
    limpiarPatrullajeOperativo();

    if (grupoMarcadores && grupoMarcadores.getBounds && grupoMarcadores.getLayers().length) {
        map.fitBounds(grupoMarcadores.getBounds(), { padding: [30, 30] });
    }
});

function abrirMapaEnPantallaCompleta() {

    const mapaShell = document.querySelector(".mapa-shell");

    if (!mapaShell) return;

    if (!document.fullscreenElement) {

        mapaShell.requestFullscreen?.()
            .catch(err => {
                console.log("No se pudo abrir pantalla completa", err);
            });

    }

}