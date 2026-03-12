import {
    auth,
    onAuthStateChanged,
    db,
    collection,
    getDocs
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

        map.setView([incidencia.lat, incidencia.lng], 16);

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
    if (!incidencias || incidencias.length === 0) return [];

    return [...incidencias]
        .map((item) => ({
            ...item,
            prioridadOperativa: calcularPrioridadOperativa(item)
        }))
        .sort((a, b) => b.prioridadOperativa - a.prioridadOperativa);
}

function limpiarPatrullajeOperativo() {
    patrullajeActivo = false;
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

    potreroSeleccionado = objetivo.potrero && objetivo.potrero.trim() !== "" ? objetivo.potrero : "Sin dato";

    if (objetivo.id) {
        incidenciaSeleccionadaId = objetivo.id;
    }

    if (objetivo.id && objetivo.lat && objetivo.lng) {
        enfocarIncidenciaEnMapa(objetivo.id);
    } else {
        const nombrePotrero = objetivo.potrero && objetivo.potrero.trim() !== "" ? objetivo.potrero : "Sin dato";
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
            <div class="titulo">${item.tipo || "Sin tipo"} - ${item.potrero || "Sin dato"}</div>
            <div class="meta">Fecha: ${item.fecha || "-"} | Guardia: ${item.guardia || "-"}</div>
            <div class="nivel">Prioridad operativa: ${item.prioridadOperativa}</div>
        `;

        div.addEventListener("click", () => {
            indiceObjetivoActual = index;
            renderPatrullajeOperativo();
            enfocarObjetivoPatrullaje(colaPatrullaje[indiceObjetivoActual]);
        });

        listaObjetivosPatrullaje.appendChild(div);
    });
}

function activarPatrullajeOperativo() {
    colaPatrullaje = construirColaPatrullaje(incidenciasFiltradasActuales);

    if (!colaPatrullaje.length) {
        limpiarPatrullajeOperativo();
        alert("No hay incidencias disponibles para patrullaje con los filtros actuales.");
        return;
    }

    patrullajeActivo = true;
    indiceObjetivoActual = 0;

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
      <div style="
        background: white;
        padding: 12px 14px;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.15);
        font-size: 13px;
        line-height: 1.6;
      ">
        <strong>Leyenda</strong><br>
        <div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#dc2626;margin-right:8px;"></span>Faltante de ganado</div>
        <div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#f97316;margin-right:8px;"></span>Huellas de vehículo</div>
        <div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#8b5e3c;margin-right:8px;"></span>Alambrado manipulado</div>
        <div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#2563eb;margin-right:8px;"></span>Tranquera abierta</div>
        <div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#7c3aed;margin-right:8px;"></span>Movimiento nocturno</div>
        <div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#16a34a;margin-right:8px;"></span>Rastros de arreo</div>
      </div>
    `;

        return div;
    };

    legend.addTo(map);
}

const potrerosConfig = [
    {
        nombre: "Potrero 1",
        descripcion: "Zona de control",
        riesgo: "bajo",
        color: "#16a34a",
        coordenadas: [
            [-33.1405, -59.3180],
            [-33.1405, -59.3120],
            [-33.1450, -59.3120],
            [-33.1450, -59.3180]
        ]
    },
    {
        nombre: "Potrero 2",
        descripcion: "Zona de riesgo medio",
        riesgo: "medio",
        color: "#f59e0b",
        coordenadas: [
            [-33.1455, -59.3180],
            [-33.1455, -59.3120],
            [-33.1500, -59.3120],
            [-33.1500, -59.3180]
        ]
    },
    {
        nombre: "Potrero 3",
        descripcion: "Zona de riesgo alto",
        riesgo: "alto",
        color: "#dc2626",
        coordenadas: [
            [-33.1505, -59.3180],
            [-33.1505, -59.3120],
            [-33.1550, -59.3120],
            [-33.1550, -59.3180]
        ]
    }
];

function dibujarPotreros() {
    poligonosPotreros = [];

    potrerosConfig.forEach((potrero) => {
        const poligono = L.polygon(potrero.coordenadas, {
            color: potrero.color,
            weight: 2,
            fillColor: potrero.color,
            fillOpacity: 0.15
        }).addTo(map);

        poligono.bindPopup(`
          <div style="min-width: 180px; line-height: 1.5;">
            <strong>${potrero.nombre}</strong><br>
            <b>Descripción:</b> ${potrero.descripcion}<br>
            <b>Nivel de riesgo:</b> ${potrero.riesgo}
          </div>
        `);

        poligono.on("click", () => {
            seleccionarPotreroDesdeMapa(potrero.nombre);
        });

        poligono.on("mouseover", () => {
            if (potreroSeleccionado !== potrero.nombre) {
                poligono.setStyle({
                    weight: 3,
                    fillOpacity: 0.22
                });
            }
        });

        poligono.on("mouseout", () => {
            if (potreroSeleccionado !== potrero.nombre) {
                poligono.setStyle({
                    color: potrero.color,
                    fillColor: potrero.color,
                    weight: 2,
                    fillOpacity: 0.15
                });
            }
        });

        poligonosPotreros.push({
            nombre: potrero.nombre,
            layer: poligono,
            colorOriginal: potrero.color,
            bounds: poligono.getBounds()
        });
    });
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
    }
}

async function cargarIncidencias(user) {
    try {
        const snapshot = await getDocs(incidenciasRef);
        todasLasIncidencias = [];

        snapshot.forEach((doc) => {
            const data = doc.data();

            if (data.productorId !== user.uid) return;

            todasLasIncidencias.push({
                id: doc.id,
                ...data
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
dibujarPotreros();

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        alert("Debe iniciar sesión en Red Rural");
        return;
    }

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