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

const STORAGE_KEY_INCIDENCIAS_PENDIENTES = "sisg_incidencias_pendientes";

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

function obtenerIncidenciasPendientes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_INCIDENCIAS_PENDIENTES) || "[]");
  } catch (error) {
    console.warn("No se pudieron leer incidencias pendientes:", error);
    return [];
  }
}

function guardarIncidenciasPendientes(lista) {
  localStorage.setItem(STORAGE_KEY_INCIDENCIAS_PENDIENTES, JSON.stringify(lista));
}

function agregarIncidenciaPendiente(incidencia) {
  const pendientes = obtenerIncidenciasPendientes();
  pendientes.push(incidencia);
  guardarIncidenciasPendientes(pendientes);
}

function generarIdLocal() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatearFecha(fecha) {
  if (!fecha) return "-";
  return fecha;
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

function renderizarCeldaFoto(item, origen = "firebase") {
  if (item.evidenciaUrl) {
    return `
  <a href="${item.evidenciaUrl}" target="_blank" rel="noopener noreferrer">
    <img src="${item.evidenciaUrl}" alt="Evidencia" class="sisg-thumb" />
  </a>
`;
  }

  if (origen === "local" && item.fotoPendiente) {
    return `<span style="font-size:12px;color:#b45309;font-weight:600;">Pendiente</span>`;
  }

  return "-";
}

function construirFilaIncidencia(item, origen = "firebase") {
  const fila = document.createElement("tr");

  const cargadoPorTexto =
    item.cargadoPor === "empleado"
      ? `Empleado ${item.cargadoPorDni || ""}`
      : "Productor";

  const estadoTexto =
    origen === "local"
      ? `${item.estado || "-"} (pendiente sync)`
      : (item.estado || "-");

  const fotoHtml = renderizarCeldaFoto(item, origen);

  fila.innerHTML = `
    <td>${formatearFecha(item.fecha)}</td>
    <td>${item.potrero || "-"}</td>
    <td>${item.tipo || "-"}</td>
    <td>${item.guardia || "-"}</td>
    <td>${item.cantidad ?? "-"}</td>
    <td>${estadoTexto}</td>
    <td>${item.gravedad || "-"}</td>
    <td>${fotoHtml}</td>
    <td>${cargadoPorTexto}</td>
  `;

  return fila;
}

async function renderTabla() {
  if (!tablaIncidenciasBody) return;

  tablaIncidenciasBody.innerHTML = "";

  if (!usuarioActual) {
    tablaIncidenciasBody.innerHTML = `
      <tr>
        <td colspan="9">Esperando autenticación del usuario...</td>
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

    const incidenciasFirebase = [];
    snapshot.forEach((docItem) => {
      incidenciasFirebase.push(docItem.data());
    });

    const pendientesLocales = obtenerIncidenciasPendientes()
      .filter((item) => item.productorId === usuarioActual.uid);

    if (!incidenciasFirebase.length && !pendientesLocales.length) {
      tablaIncidenciasBody.innerHTML = `
        <tr>
          <td colspan="9">No hay incidencias cargadas todavía.</td>
        </tr>
      `;
      return;
    }

    pendientesLocales
      .slice()
      .reverse()
      .forEach((item) => {
        tablaIncidenciasBody.appendChild(construirFilaIncidencia(item, "local"));
      });

    incidenciasFirebase.forEach((item) => {
      tablaIncidenciasBody.appendChild(construirFilaIncidencia(item, "firebase"));
    });

  } catch (error) {
    console.error("Error al cargar incidencias:", error);

    const pendientesLocales = usuarioActual
      ? obtenerIncidenciasPendientes().filter((item) => item.productorId === usuarioActual.uid)
      : [];

    if (pendientesLocales.length) {
      pendientesLocales
        .slice()
        .reverse()
        .forEach((item) => {
          tablaIncidenciasBody.appendChild(construirFilaIncidencia(item, "local"));
        });
      return;
    }

    tablaIncidenciasBody.innerHTML = `
      <tr>
        <td colspan="9">Error al cargar incidencias desde Firebase.</td>
      </tr>
    `;
  }
}

async function sincronizarIncidenciasPendientes() {
  if (!navigator.onLine || !usuarioActual) return;

  const pendientes = obtenerIncidenciasPendientes();
  if (!pendientes.length) return;

  const restantes = [];

  for (const item of pendientes) {
    try {
      if (item.fotoPendiente) {
        restantes.push(item);
        continue;
      }

      const datosFirestore = {
        productorId: item.productorId,
        establecimiento: item.establecimiento || "",
        fecha: item.fecha || "",
        tipo: item.tipo || "",
        guardia: item.guardia || "",
        cantidad: item.cantidad ?? null,
        gravedad: item.gravedad || "",
        estado: item.estado || "Abierta",
        potrero: item.potrero || "Fuera de potrero",
        lat: item.lat ?? null,
        lng: item.lng ?? null,
        evidencia: item.evidencia || "",
        evidenciaUrl: item.evidenciaUrl || "",
        respuestaAplicada: item.respuestaAplicada || "",
        observaciones: item.observaciones || "",
        cargadoPor: item.cargadoPor || "productor",
        cargadoPorDni: item.cargadoPorDni || "",
        sincronizadoDesdeOffline: true,
        creadoEn: serverTimestamp()
      };

      await addDoc(incidenciasRef, datosFirestore);
    } catch (error) {
      console.warn("No se pudo sincronizar incidencia pendiente:", error);
      restantes.push(item);
    }
  }

  guardarIncidenciasPendientes(restantes);
  await renderTabla();

  if (!restantes.length) {
    mostrarMensaje("Las incidencias pendientes se sincronizaron correctamente.", "ok");
  } else {
    mostrarMensaje("Algunas incidencias siguen pendientes de sincronización.", "error");
  }
}

onAuthStateChanged(auth, async (user) => {
  usuarioActual = user;

  if (user) {
    await obtenerCampoProductor(user.uid);
    await cargarPotrerosEnSelect(user.uid);
    await renderTabla();
    await sincronizarIncidenciasPendientes();
  } else if (tablaIncidenciasBody) {
    tablaIncidenciasBody.innerHTML = `
      <tr>
        <td colspan="9">Debés iniciar sesión para ver las incidencias.</td>
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

      const incidenciaBase = {
        productorId: usuarioActual.uid,
        establecimiento: document.getElementById("establecimiento")?.value.trim() || "",
        fecha: document.getElementById("fecha")?.value || "",
        tipo: document.getElementById("tipo")?.value || "",
        guardia: document.getElementById("guardia")?.value.trim() || "",
        cantidad: document.getElementById("cantidad")?.value
          ? Number(document.getElementById("cantidad").value)
          : null,
        gravedad: document.getElementById("gravedad")?.value || "",
        estado: document.getElementById("estado")?.value || "Abierta",
        potrero: tieneCoordenadas
          ? potreroDetectado
          : (potreroManual || "Fuera de potrero"),
        lat: latValor,
        lng: lngValor,
        evidencia: document.getElementById("evidencia")?.value.trim() || "",
        evidenciaUrl: "",
        respuestaAplicada: document.getElementById("respuestaAplicada")?.value || "",
        observaciones: document.getElementById("observaciones")?.value.trim() || "",
        cargadoPor: "productor",
        cargadoPorDni: "",
        creadoEnCliente: new Date().toISOString()
      };

      if (!navigator.onLine) {
        const incidenciaOffline = {
          ...incidenciaBase,
          _localId: generarIdLocal(),
          offline: true,
          fotoPendiente: !!archivoFoto
        };

        agregarIncidenciaPendiente(incidenciaOffline);

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

        if (archivoFoto) {
          mostrarMensaje("Sin internet. La incidencia quedó guardada en este dispositivo. La foto no se subirá hasta implementar sincronización offline de archivos.", "error");
        } else {
          mostrarMensaje("Sin internet. La incidencia quedó guardada en este dispositivo y se enviará cuando vuelva la conexión.", "ok");
        }

        return;
      }

      let evidenciaUrl = "";

      if (archivoFoto) {
        evidenciaUrl = await subirFotoEvidencia(archivoFoto, usuarioActual.uid);
      }

      const nuevaIncidencia = {
        ...incidenciaBase,
        evidenciaUrl,
        creadoEn: serverTimestamp()
      };

      delete nuevaIncidencia.creadoEnCliente;

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

window.addEventListener("online", async () => {
  await sincronizarIncidenciasPendientes();
});