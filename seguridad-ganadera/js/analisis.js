import {
  auth,
  onAuthStateChanged,
  db,
  collection,
  getDocs,
  query,
  orderBy,
  where
} from "./firebase-sisg.js";

const incidenciasRef = collection(db, "seguridad_ganadera_incidencias");
const potrerosRef = collection(db, "potreros");

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

function detectarPotreroDesdeLista(lat, lng, potreros) {
  if (lat == null || lng == null) return null;

  const encontrado = potreros.find((potrero) => {
    const coords = potrero.coordenadas || [];
    if (!Array.isArray(coords) || coords.length < 3) return false;
    return puntoDentroDePoligono(lat, lng, coords);
  });

  return encontrado ? encontrado.nombre : "Fuera de potrero";
}

async function cargarPotrerosDelUsuario(uid) {
  const q = query(potrerosRef, where("productorId", "==", uid));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      nombre: data.nombre || "Sin nombre",
      coordenadas: data.coordenadas || []
    };
  });
}

function contarPorCampo(array, campo) {
  const conteo = {};
  array.forEach((item) => {
    const valor = item[campo] && item[campo].toString().trim() !== "" ? item[campo] : "Sin dato";
    conteo[valor] = (conteo[valor] || 0) + 1;
  });
  return conteo;
}

function obtenerMayor(conteo) {
  let claveMayor = "-";
  let valorMayor = 0;

  for (const clave in conteo) {
    if (conteo[clave] > valorMayor) {
      valorMayor = conteo[clave];
      claveMayor = clave;
    }
  }

  return claveMayor;
}

function actualizarBotonMapa(potrero) {
  const btnMapa = document.getElementById("btnVerPotreroMapa");
  if (!btnMapa) return;

  if (!potrero || potrero === "-" || potrero === "Sin dato") {
    btnMapa.style.display = "none";
    btnMapa.href = "mapas-riesgo.html";
    return;
  }

  const potreroParam = encodeURIComponent(potrero);
  btnMapa.href = `mapas-riesgo.html?potrero=${potreroParam}`;
  btnMapa.style.display = "inline-block";
}

function renderTablaAnalisis(datos) {
  const tabla = document.getElementById("tablaAnalisis");
  tabla.innerHTML = "";

  if (datos.length === 0) {
    tabla.innerHTML = `
      <tr>
        <td colspan="7">No hay incidencias registradas para analizar.</td>
      </tr>
    `;
    return;
  }

  datos.forEach((item) => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${item.establecimiento || "-"}</td>
      <td>${item.fecha || "-"}</td>
      <td>${item.potrero || "-"}</td>
      <td>${item.tipo || "-"}</td>
      <td>${item.guardia || "-"}</td>
      <td>${item.cantidad || "-"}</td>
      <td>${item.evidencia || "-"}</td>
    `;
    tabla.appendChild(fila);
  });
}

function generarResumen(datos, potreroMasAfectado, guardiaFrecuente, tipoMasComun) {

  const resumen = document.getElementById("resumenInterpretativo");

  if (datos.length === 0) {
    resumen.textContent = "Todavía no hay datos suficientes para generar una interpretación.";
    return;
  }

  resumen.innerHTML = `
  El análisis de los registros indica que el 
  <strong>${potreroMasAfectado}</strong> presenta la mayor concentración de incidencias.

  El tipo de evento más frecuente corresponde a 
  <strong>${tipoMasComun}</strong>.

  Las incidencias registradas han sido reportadas con mayor frecuencia por 
  <strong>${guardiaFrecuente}</strong>.

  Se recomienda reforzar recorridas preventivas en los sectores críticos del establecimiento.
  `;
}

function calcularRiesgo(totalIncidencias) {

  const estado = document.getElementById("estadoRiesgo");
  const detalle = document.getElementById("detalleRiesgo");

  if (totalIncidencias === 0) {
    estado.textContent = "Sin datos";
    estado.className = "riesgo-valor";
    detalle.textContent = "No existen incidencias registradas.";
    return;
  }

  if (totalIncidencias <= 2) {
    estado.textContent = "Riesgo bajo";
    estado.className = "riesgo-valor riesgo-bajo";
    detalle.textContent = "Nivel de eventos bajo. Situación controlada.";
    return;
  }

  if (totalIncidencias <= 5) {
    estado.textContent = "Riesgo medio";
    estado.className = "riesgo-valor riesgo-medio";
    detalle.textContent = "Se detecta recurrencia moderada de eventos.";
    return;
  }

  estado.textContent = "Riesgo alto";
  estado.className = "riesgo-valor riesgo-alto";
  detalle.textContent = "Alta recurrencia de incidencias. Se recomienda reforzar vigilancia.";
}

async function iniciarAnalisis(user) {
  try {
    const q = query(incidenciasRef, where("productorId", "==", user.uid), orderBy("creadoEn", "desc"));
    const snapshot = await getDocs(q);
    const potreros = await cargarPotrerosDelUsuario(user.uid);

   const datos = [];
snapshot.forEach((doc) => {
  const item = doc.data();

  const potreroDetectado =
    item.lat != null && item.lng != null
      ? detectarPotreroDesdeLista(item.lat, item.lng, potreros)
      : null;

  datos.push({
    ...item,
    potrero: potreroDetectado || item.potrero || "Fuera de potrero"
  });
});


    const totalIncidencias = datos.length;
    const potreroMasAfectado = obtenerMayor(contarPorCampo(datos, "potrero"));
    const guardiaFrecuente = obtenerMayor(contarPorCampo(datos, "guardia"));
    const tipoMasComun = obtenerMayor(contarPorCampo(datos, "tipo"));

    document.getElementById("totalIncidencias").textContent = totalIncidencias;
    document.getElementById("potreroMasAfectado").textContent = potreroMasAfectado;
    document.getElementById("guardiaFrecuente").textContent = guardiaFrecuente;
    document.getElementById("tipoMasComun").textContent = tipoMasComun;

    actualizarBotonMapa(potreroMasAfectado);

    renderTablaAnalisis(datos);
    generarResumen(datos, potreroMasAfectado, guardiaFrecuente, tipoMasComun);
    calcularRiesgo(totalIncidencias);
  } catch (error) {
    console.error("Error al analizar incidencias:", error);
  }
}

onAuthStateChanged(auth, async (user) => {
  console.log("Usuario autenticado en análisis:", user ? user.uid : null);

  if (!user) {
    document.getElementById("resumenInterpretativo").textContent =
      "No hay un usuario autenticado. Iniciá sesión en Red Rural.";
    return;
  }

  await iniciarAnalisis(user);
});