import {
  auth,
  onAuthStateChanged,
  db,
  storage,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  where,
  ref,
  uploadBytes,
  getDownloadURL
} from "./firebase-sisg.js";

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const form = document.getElementById("formIncidencia");
const tablaIncidenciasBody = document.getElementById("tablaIncidenciasBody");
const mensajeIncidencia = document.getElementById("mensajeIncidencia");

const btnUbicacion = document.getElementById("btnUbicacion");
const estadoUbicacion = document.getElementById("estadoUbicacion");

const fotoEvidenciaInput = document.getElementById("fotoEvidencia");
const previewEvidencia = document.getElementById("previewEvidencia");
const imgPreviewEvidencia = document.getElementById("imgPreviewEvidencia");

const incidenciasRef = collection(db, "seguridad_ganadera_incidencias");

let usuarioActual = null;

const inputFecha = document.getElementById("fecha");
if (inputFecha && !inputFecha.value) {
  inputFecha.value = new Date().toISOString().split("T")[0];
}

function mostrarMensaje(texto, tipo = "ok") {
  if (!mensajeIncidencia) return;
  mensajeIncidencia.textContent = texto;
  mensajeIncidencia.className = `sisg-feedback ${tipo}`;
  mensajeIncidencia.style.display = "block";
}

function limpiarMensaje() {
  if (!mensajeIncidencia) return;
  mensajeIncidencia.textContent = "";
  mensajeIncidencia.className = "sisg-feedback";
  mensajeIncidencia.style.display = "none";
}

function limpiarPreview() {
  if (imgPreviewEvidencia) imgPreviewEvidencia.src = "";
  if (previewEvidencia) previewEvidencia.style.display = "none";
}

function mostrarPreviewArchivo(file) {
  if (!file || !imgPreviewEvidencia || !previewEvidencia) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    imgPreviewEvidencia.src = e.target.result;
    previewEvidencia.style.display = "block";
  };
  reader.readAsDataURL(file);
}

function obtenerUbicacionActual() {
  if (!estadoUbicacion) return;

  if (!navigator.geolocation) {
    estadoUbicacion.textContent = "La geolocalización no está disponible en este dispositivo.";
    return;
  }

  estadoUbicacion.textContent = "Obteniendo ubicación...";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latInput = document.getElementById("lat");
      const lngInput = document.getElementById("lng");

      if (latInput) latInput.value = position.coords.latitude;
      if (lngInput) lngInput.value = position.coords.longitude;

      estadoUbicacion.textContent = "Ubicación cargada correctamente.";
    },
    (error) => {
      console.error("Error obteniendo ubicación:", error);

      switch (error.code) {
        case error.PERMISSION_DENIED:
          estadoUbicacion.textContent = "Permiso de ubicación denegado.";
          break;
        case error.POSITION_UNAVAILABLE:
          estadoUbicacion.textContent = "Ubicación no disponible.";
          break;
        case error.TIMEOUT:
          estadoUbicacion.textContent = "Tiempo de espera agotado al obtener ubicación.";
          break;
        default:
          estadoUbicacion.textContent = "No se pudo obtener la ubicación.";
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

async function obtenerCampoProductor(uid) {
  try {
    const refDoc = doc(db, "gestion_campos", uid);
    const snap = await getDoc(refDoc);

    if (snap.exists()) {
      const datos = snap.data();
      const establecimientoInput = document.getElementById("establecimiento");

      if (establecimientoInput && datos.nombreCampo) {
        establecimientoInput.value = datos.nombreCampo;
      }
    }
  } catch (error) {
    console.error("Error cargando datos del campo:", error);
  }
}

function formatearFecha(fecha) {
  if (!fecha) return "-";
  return fecha;
}

async function subirFotoEvidencia(file, uid) {
  if (!file) return "";

  const nombreSeguro = file.name.replace(/\s+/g, "_");
  const timestamp = Date.now();
  const ruta = `sisg-evidencias/${uid}/${timestamp}_${nombreSeguro}`;

  const storageRef = ref(storage, ruta);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  return url;
}

async function renderTabla() {
  if (!tablaIncidenciasBody) return;

  tablaIncidenciasBody.innerHTML = "";

  if (!usuarioActual) {
    tablaIncidenciasBody.innerHTML = `
      <tr>
        <td colspan="7">Esperando autenticación del usuario...</td>
      </tr>
    `;
    return;
  }

  try {
    const q = query(
      incidenciasRef,
      where("productorId", "==", usuarioActual.uid),
      orderBy("creadoEn", "desc")
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      tablaIncidenciasBody.innerHTML = `
        <tr>
          <td colspan="7">No hay incidencias cargadas todavía.</td>
        </tr>
      `;
      return;
    }

    snapshot.forEach((docItem) => {
      const item = docItem.data();

      const fila = document.createElement("tr");
      fila.innerHTML = `
  <td>${formatearFecha(item.fecha)}</td>
  <td>${item.potrero || "-"}</td>
  <td>${item.tipo || "-"}</td>
  <td>${item.guardia || "-"}</td>
  <td>${item.cantidad ?? "-"}</td>
  <td>${item.estado || "-"}</td>
  <td>${item.gravedad || "-"}</td>
  <td>${item.cargadoPor === "empleado" ? "Empleado " + (item.cargadoPorDni || "") : "Productor"}</td>
  
`;

      tablaIncidenciasBody.appendChild(fila);
    });
  } catch (error) {
    console.error("Error al cargar incidencias:", error);
    tablaIncidenciasBody.innerHTML = `
      <tr>
        <td colspan="7">Error al cargar incidencias desde Firebase.</td>
      </tr>
    `;
  }
}

onAuthStateChanged(auth, async (user) => {
  usuarioActual = user;

  if (user) {
    await obtenerCampoProductor(user.uid);
    await cargarPotrerosEnSelect(user.uid);
    await renderTabla();
  } else if (tablaIncidenciasBody) {
    tablaIncidenciasBody.innerHTML = `
      <tr>
        <td colspan="7">Debés iniciar sesión para ver las incidencias.</td>
      </tr>
    `;
  }
});

if (fotoEvidenciaInput) {
  fotoEvidenciaInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) {
      mostrarPreviewArchivo(file);
    } else {
      limpiarPreview();
    }
  });
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

async function detectarPotreroAutomaticamente(uid, lat, lng) {
  if (!uid || lat == null || lng == null) return "";

  try {
    const potrerosRef = collection(db, "potreros");
    const q = query(potrerosRef, where("productorId", "==", uid));
    const snapshot = await getDocs(q);

    let potreroDetectado = "";

    snapshot.forEach((docItem) => {
      if (potreroDetectado) return;

      const potrero = docItem.data();
      const coords = potrero.coordenadas || [];

      if (!Array.isArray(coords) || coords.length < 3) return;

      const dentro = puntoDentroDePoligono(lat, lng, coords);
      if (dentro) {
        potreroDetectado = potrero.nombre || "";
      }
    });

    return potreroDetectado || "Fuera de potrero";
  } catch (error) {
    console.error("Error detectando potrero automáticamente:", error);
    return "";
  }
}

async function cargarPotrerosEnSelect(uid) {
  const selectPotrero = document.getElementById("potrero");
  if (!selectPotrero || !uid) return;

  try {
    const potrerosRef = collection(db, "potreros");
    const q = query(potrerosRef, where("productorId", "==", uid));
    const snapshot = await getDocs(q);

    selectPotrero.innerHTML = `
      <option value="">Seleccionar</option>
      <option value="Fuera de potrero">Fuera de potrero</option>
    `;

    snapshot.forEach((docItem) => {
      const potrero = docItem.data();
      const nombre = potrero.nombre || "Sin nombre";

      const option = document.createElement("option");
      option.value = nombre;
      option.textContent = nombre;
      selectPotrero.appendChild(option);
    });
  } catch (error) {
    console.error("Error cargando potreros en el select:", error);
    selectPotrero.innerHTML = `
      <option value="">Seleccionar</option>
      <option value="Fuera de potrero">Fuera de potrero</option>
    `;
  }
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    limpiarMensaje();

    if (!usuarioActual) {
      mostrarMensaje("Todavía no se cargó la sesión del usuario. Esperá unos segundos e intentá nuevamente.", "error");
      return;
    }

    try {
      mostrarMensaje("Guardando incidencia...", "ok");

      const archivoFoto = fotoEvidenciaInput?.files?.[0] || null;
      let evidenciaUrl = "";

      if (archivoFoto) {
        evidenciaUrl = await subirFotoEvidencia(archivoFoto, usuarioActual.uid);
      }

      const latValor = document.getElementById("lat")?.value !== ""
        ? Number(document.getElementById("lat").value)
        : null;

      const lngValor = document.getElementById("lng")?.value !== ""
        ? Number(document.getElementById("lng").value)
        : null;

      const potreroManual = document.getElementById("potrero")?.value || "";
      const tieneCoordenadas = latValor != null && lngValor != null;

      const potreroDetectado = tieneCoordenadas
        ? await detectarPotreroAutomaticamente(usuarioActual.uid, latValor, lngValor)
        : "";

      const nuevaIncidencia = {
        productorId: usuarioActual.uid,
        establecimiento: document.getElementById("establecimiento")?.value.trim() || "",
        fecha: document.getElementById("fecha")?.value || "",

        tipo: document.getElementById("tipo")?.value || "",
        guardia: document.getElementById("guardia")?.value.trim() || "",
        cantidad: document.getElementById("cantidad")?.value
          ? Number(document.getElementById("cantidad").value)
          : null,
        gravedad: document.getElementById("gravedad")?.value || "",
        estado: document.getElementById("estado")?.value || "",
        potrero: tieneCoordenadas
          ? potreroDetectado
          : (potreroManual || "Fuera de potrero"),
        lat: latValor,
        lng: lngValor,

        evidencia: document.getElementById("evidencia")?.value.trim() || "",
        evidenciaUrl,
        respuestaAplicada: document.getElementById("respuestaAplicada")?.value || "",
        observaciones: document.getElementById("observaciones")?.value.trim() || "",
        creadoEn: serverTimestamp()
      };

      await addDoc(incidenciasRef, nuevaIncidencia);

      form.reset();

      if (inputFecha) {
        inputFecha.value = new Date().toISOString().split("T")[0];
      }

      await obtenerCampoProductor(usuarioActual.uid);
      await renderTabla();

      limpiarPreview();

      if (estadoUbicacion) {
        estadoUbicacion.textContent = "";
      }

      mostrarMensaje("Incidencia guardada correctamente con evidencia fotográfica.", "ok");
    } catch (error) {
      console.error("Error al guardar incidencia:", error);
      mostrarMensaje("Error al guardar la incidencia o subir la foto.", "error");
    }
  });
}

if (btnUbicacion) {
  btnUbicacion.addEventListener("click", obtenerUbicacionActual);
}