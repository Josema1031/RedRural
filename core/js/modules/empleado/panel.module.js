    import { auth, db } from "../../../firebase-init.js";
    import { onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
    import {
      collection, query, where, onSnapshot, orderBy,
      doc, updateDoc, setDoc, serverTimestamp, addDoc, getDoc, getDocs
    } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
    import { createTareaItem } from "./features/tareas.helpers.js";
    import { paintConnectionState, patrolStateColor, patrolStateText } from "./features/tracking.helpers.js";


    const empleadoDni = (localStorage.getItem("empleadoDni") || "").trim();
    const productorId = (localStorage.getItem("productorId") || "").trim();

    const sub = document.getElementById("sub");
    const listaTareas = document.getElementById("listaTareas");
    const listaAlertas = document.getElementById("listaAlertas");
    const listaPatrullas = document.getElementById("listaPatrullas");
    const estadoConexion = document.getElementById("estadoConexion");
    const countUrgentesEmpleado = document.getElementById("countUrgentesEmpleado");
    const countAsignadasEmpleado = document.getElementById("countAsignadasEmpleado");
    const alertaUrgenteEmpleado = document.getElementById("alertaUrgenteEmpleado");

    const btnIniciarPatrullaGps = document.getElementById("btnIniciarPatrullaGps");
    const btnFinalizarPatrullaGps = document.getElementById("btnFinalizarPatrullaGps");
    const tipoNovedadPatrulla = document.getElementById("tipoNovedadPatrulla");
    const msgPatrullaGps = document.getElementById("msgPatrullaGps");
    const btnSalirAlLugar = document.getElementById("btnSalirAlLugar");
    const obsFinalPatrulla = document.getElementById("obsFinalPatrulla");
    const motivoRechazoPatrulla = document.getElementById("motivoRechazoPatrulla");


    // ===============================
    // 🚨 INCIDENCIAS CARGADAS POR EMPLEADO
    // ===============================
    const incPotrero = document.getElementById("incPotrero");
    const incTipo = document.getElementById("incTipo");
    const incCantidad = document.getElementById("incCantidad");
    const incGravedad = document.getElementById("incGravedad");
    const incEstado = document.getElementById("incEstado");
    const incLat = document.getElementById("incLat");
    const incLng = document.getElementById("incLng");
    const incObservaciones = document.getElementById("incObservaciones");
    const btnUbicacionInc = document.getElementById("btnUbicacionInc");
    const btnGuardarIncidenciaEmpleado = document.getElementById("btnGuardarIncidenciaEmpleado");
    const msgIncEmpleado = document.getElementById("msgIncEmpleado");
    const estadoUbicacionInc = document.getElementById("estadoUbicacionInc");

    let potrerosEmpleado = [];
    let patrullaSeleccionadaId = null;
    let patrullaSeleccionadaData = null;
    let watchPatrullaId = null;
    let patrullaRutaPts = [];
    let patrullaLastPt = null;
    let patrullaDistanciaM = 0;
    let intervaloCronometro = null;
    let patrullaInicioMs = null;
    let mapaPatrulla = null;
    let marcadorPatrulla = null;
    let ultimasAsignacionesVistas = new Set();
    sub.textContent = empleadoDni ? `Sesión: DNI ${empleadoDni}` : "Sin sesión activa.";

    function actualizarEstadoConexion() {
      const offline = !navigator.onLine;
      const modoOffline = localStorage.getItem("modoOffline") === "1";
      paintConnectionState(estadoConexion, { offline, modoOffline });
    }

    actualizarEstadoConexion();
    window.addEventListener("online", () => { localStorage.setItem("modoOffline", "0"); actualizarEstadoConexion(); });
    window.addEventListener("offline", actualizarEstadoConexion);

    // Salida limpia
    document.getElementById("btnSalir").addEventListener("click", (e) => {
      const activo = localStorage.getItem("trackingActivo") === "1";
      if (activo) {
        const ok = confirm("El monitoreo está INICIADO. Si salís, el GPS puede cortarse. ¿Querés salir igual?");
        if (!ok) {
          e.preventDefault();
          return;
        }
        // ✅ NO borramos localStorage, así al volver reanuda
        return;
      }

      // salida limpia normal
      localStorage.removeItem("empleadoDni");
      localStorage.removeItem("empleadoDocId");
      localStorage.removeItem("productorId");
    });


    if (!empleadoDni || !productorId) {
      listaTareas.textContent = "Tenés que iniciar sesión.";
      listaAlertas.textContent = "Tenés que iniciar sesión.";
      // si querés: location.href = "./login.html";
    } else {
      // ✅ Asegurar auth anónimo (necesario para que Firestore reglas permitan leer)
      const asegurarAuth = async () => {
        if (auth.currentUser) return;
        await signInAnonymously(auth);
      };

      // ✅ Cuando ya hay auth, recién ahí escuchamos Firestore
      onAuthStateChanged(auth, async (user) => {
        try {
          if (!user) await asegurarAuth();

          await vincularAuthUidEmpleado(empleadoDni);
          await cargarPotrerosEmpleado();

          initMapaPatrulla();
          iniciarListeners();
          await restaurarPatrullaActiva();


        } catch (e) {
          console.error("Auth empleado:", e);
          listaTareas.textContent = "No se pudo iniciar sesión (auth).";
          listaAlertas.textContent = "No se pudo iniciar sesión (auth).";
        }
      });



      // ✅ Vincular el UID del Auth al DNI del empleado (solo si está vacío)
      async function vincularAuthUidEmpleado(dni) {
        const ref = doc(db, "employees", String(dni));
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          console.warn("No existe employees/" + dni + " (primero debe crearlo el productor)");
          return;
        }

        const data = snap.data();
        const uidActual = auth.currentUser?.uid;

        // si authUid está vacío, lo seteamos
        if (!data.authUid) {
          await updateDoc(ref, {
            authUid: uidActual,
            lastLogin: Date.now()
          });
          console.log("✅ authUid vinculado al empleado", dni, uidActual);
        } else {
          console.log("ℹ️ authUid ya estaba vinculado:", data.authUid);
        }
      }

      // ⛽ Carga de combustible por empleado
      const eVehiculo = document.getElementById("eVehiculo");
      const eLitros = document.getElementById("eLitros");
      const eCosto = document.getElementById("eCosto");
      const eOdom = document.getElementById("eOdom");
      const btnEmpleadoComb = document.getElementById("btnEmpleadoComb");
      const msgEmpleadoComb = document.getElementById("msgEmpleadoComb");

      function setMsgComb(txt, ok = true) {
        msgEmpleadoComb.textContent = txt;
        msgEmpleadoComb.style.color = ok ? "#14532d" : "#b91c1c";
        setTimeout(() => (msgEmpleadoComb.textContent = ""), 3000);
      }

      btnEmpleadoComb?.addEventListener("click", async () => {
        try {
          const veh = (eVehiculo?.value || "").trim();
          const litros = Number(eLitros?.value || 0);
          const costo = Number(eCosto?.value || 0);
          const odom = eOdom?.value ? Number(eOdom.value) : null;

          if (!veh) return setMsgComb("⚠️ Ingresá vehículo.", false);
          if (litros <= 0) return setMsgComb("⚠️ Litros inválidos.", false);

          await addDoc(collection(db, "combustible"), {
            productorId,
            vehiculo: veh,
            litros,
            costo,
            odometro: odom,
            fechaMs: Date.now(),
            createdAt: serverTimestamp(),
            cargadoPor: empleadoDni
          });

          eVehiculo.value = "";
          eLitros.value = "";
          eCosto.value = "";
          eOdom.value = "";
          setMsgComb(navigator.onLine ? "✅ Registrado." : "🟠 Guardado offline. Se sincronizará al volver internet.");
        } catch (e) {
          console.error(e);
          setMsgComb("❌ No se pudo registrar (permisos/reglas).", false);
        }
      });

      function setMsgInc(txt, ok = true) {
        msgIncEmpleado.textContent = txt;
        msgIncEmpleado.style.color = ok ? "#14532d" : "#b91c1c";
        setTimeout(() => (msgIncEmpleado.textContent = ""), 4000);
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

      async function cargarPotrerosEmpleado() {
        try {
          if (!productorId || !incPotrero) return;

          const qP = query(
            collection(db, "potreros"),
            where("productorId", "==", productorId)
          );

          const snap = await getDocs(qP);
          potrerosEmpleado = [];

          incPotrero.innerHTML = `
            <option value="">Seleccionar</option>
            <option value="Fuera de potrero">Fuera de potrero</option>
          `;

          snap.forEach((docSnap) => {
            const p = docSnap.data();
            potrerosEmpleado.push({ id: docSnap.id, ...p });

            const option = document.createElement("option");
            option.value = p.nombre || "Sin nombre";
            option.textContent = p.nombre || "Sin nombre";
            incPotrero.appendChild(option);
          });
        } catch (e) {
          console.error("Error cargando potreros para empleado:", e);
          incPotrero.innerHTML = `
            <option value="">Seleccionar</option>
            <option value="Fuera de potrero">Fuera de potrero</option>
          `;
        }
      }

      function detectarPotreroDesdeCoords(lat, lng) {
        if (!Array.isArray(potrerosEmpleado) || potrerosEmpleado.length === 0) return "";

        for (const potrero of potrerosEmpleado) {
          const coords = potrero.coordenadas || [];
          if (!Array.isArray(coords) || coords.length < 3) continue;

          const dentro = puntoDentroDePoligono(lat, lng, coords);
          if (dentro) {
            return potrero.nombre || "";
          }
        }

        return "Fuera de potrero";
      }

      function obtenerUbicacionIncidenciaEmpleado() {
        if (!navigator.geolocation) {
          estadoUbicacionInc.textContent = "La geolocalización no está disponible en este dispositivo.";
          return;
        }

        estadoUbicacionInc.textContent = "Obteniendo ubicación...";

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            incLat.value = lat;
            incLng.value = lng;

            const potreroDetectado = detectarPotreroDesdeCoords(lat, lng);
            if (potreroDetectado) {
              incPotrero.value = potreroDetectado;
            }

            estadoUbicacionInc.textContent = "Ubicación cargada correctamente.";
          },
          (error) => {
            console.error("Error obteniendo ubicación de incidencia:", error);

            switch (error.code) {
              case error.PERMISSION_DENIED:
                estadoUbicacionInc.textContent = "Permiso de ubicación denegado.";
                break;
              case error.POSITION_UNAVAILABLE:
                estadoUbicacionInc.textContent = "Ubicación no disponible.";
                break;
              case error.TIMEOUT:
                estadoUbicacionInc.textContent = "Tiempo agotado al obtener ubicación.";
                break;
              default:
                estadoUbicacionInc.textContent = "No se pudo obtener la ubicación.";
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      }

      btnUbicacionInc?.addEventListener("click", () => {
        obtenerUbicacionIncidenciaEmpleado();
      });

      btnSalirAlLugar?.addEventListener("click", async () => {
        await salirAlLugar();
      });

      btnIniciarPatrullaGps?.addEventListener("click", async () => {
        await iniciarGpsPatrulla();
      });

      btnFinalizarPatrullaGps?.addEventListener("click", async () => {
        await finalizarGpsPatrulla();
      });

      btnGuardarIncidenciaEmpleado?.addEventListener("click", async () => {
        try {
          const tipo = (incTipo?.value || "").trim();
          const gravedad = (incGravedad?.value || "").trim();
          const estado = (incEstado?.value || "").trim();
          const observaciones = (incObservaciones?.value || "").trim();

          const cantidad = incCantidad?.value ? Number(incCantidad.value) : null;
          const lat = incLat?.value !== "" ? Number(incLat.value) : null;
          const lng = incLng?.value !== "" ? Number(incLng.value) : null;

          if (!tipo) return setMsgInc("⚠️ Seleccioná el tipo de incidencia.", false);
          //if (!gravedad) return setMsgInc("⚠️ Seleccioná la gravedad.", false);//
          //if (!estado) return setMsgInc("⚠️ Seleccioná el estado.", false);//

          let potreroFinal = (incPotrero?.value || "").trim();

          if (lat != null && lng != null) {
            potreroFinal = detectarPotreroDesdeCoords(lat, lng) || potreroFinal || "Fuera de potrero";
          } else {
            potreroFinal = potreroFinal || "Fuera de potrero";
          }

          await addDoc(collection(db, "seguridad_ganadera_incidencias"), {
            productorId,
            empleadoDni,
            establecimiento: "",
            fecha: new Date().toISOString().split("T")[0],
            tipo,
            guardia: empleadoDni,
            cantidad,
            gravedad,
            estado,
            potrero: potreroFinal,
            lat,
            lng,
            evidencia: "",
            evidenciaUrl: "",
            respuestaAplicada: "Aviso interno",
            observaciones,
            creadoEn: serverTimestamp(),

            // extras útiles para trazabilidad
            cargadoPor: "empleado",
            cargadoPorDni: empleadoDni,
            origen: "panel_empleado"
          });

          incPotrero.value = "";
          incTipo.value = "";
          incCantidad.value = "";
          incGravedad.value = "";
          incEstado.value = "";
          incLat.value = "";
          incLng.value = "";
          incObservaciones.value = "";
          estadoUbicacionInc.textContent = "";

          setMsgInc(
            navigator.onLine
              ? "✅ Incidencia guardada correctamente."
              : "🟠 Incidencia guardada offline. Se sincronizará al volver internet."
          );
        } catch (e) {
          console.error("Error guardando incidencia del empleado:", e);
          setMsgInc("❌ No se pudo guardar la incidencia.", false);
        }
      });


      function estadoPatrullaColor(estado) {
        switch (estado) {
          case "pendiente":
            return "background:#fef3c7;color:#92400e;";
          case "aceptada":
            return "background:#dbeafe;color:#1d4ed8;";
          case "en_curso":
            return "background:#dcfce7;color:#166534;";
          case "finalizada":
            return "background:#e5e7eb;color:#374151;";
          case "cancelada":
            return "background:#fee2e2;color:#b91c1c;";
          default:
            return "background:#f3f4f6;color:#374151;";
        }
      }

      function estadoPatrullaTexto(estado) {
        switch (estado) {
          case "pendiente": return "Pendiente";
          case "aceptada": return "Aceptada";
          case "en_curso": return "En curso";
          case "finalizada": return "Finalizada";
          case "cancelada": return "Cancelada";
          default: return estado || "Sin estado";
        }
      }

      function initMapaPatrulla() {
        if (mapaPatrulla) return;

        mapaPatrulla = L.map("mapPatrulla").setView([-33, -59.3], 10);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap"
        }).addTo(mapaPatrulla);

        setTimeout(() => mapaPatrulla.invalidateSize(), 300);
      }

      function mostrarPatrullaEnMapa(data) {
        if (!mapaPatrulla) initMapaPatrulla();

        const lat = Number(data?.lat);
        const lng = Number(data?.lng);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        if (marcadorPatrulla) {
          marcadorPatrulla.setLatLng([lat, lng]);
        } else {
          marcadorPatrulla = L.marker([lat, lng]).addTo(mapaPatrulla);
        }

        marcadorPatrulla.bindPopup(`
    <b>🚓 ${String(data?.motivo || "Patrulla").replaceAll("_", " ")}</b><br>
    Campo: ${data?.nombreCampo || "Sin nombre"}<br>
    Prioridad: ${data?.prioridad || "media"}
  `);

        mapaPatrulla.setView([lat, lng], 15, { animate: true });
      }

      function setMsgPatrullaGps(texto, ok = true) {
        if (!msgPatrullaGps) return;
        msgPatrullaGps.textContent = texto;
        msgPatrullaGps.style.color = ok ? "#14532d" : "#b91c1c";
      }

      async function publicarUbicacionEmpleado(lat, lng, accuracy = null) {
        try {
          if (!empleadoDni || !productorId) return;

          await setDoc(doc(db, "empleados_tracking", empleadoDni), {
            empleadoDni,
            productorId,
            lat,
            lng,
            accuracy: accuracy ?? null,
            updatedAt: Date.now()
          }, { merge: true });
        } catch (e) {
          console.error("Error publicando ubicación del empleado:", e);
        }
      }

      function distMetrosPatrulla(lat1, lng1, lat2, lng2) {
        const R = 6371000;
        const toRad = (v) => (v * Math.PI) / 180;

        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);

        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
          Math.sin(dLng / 2) ** 2;

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c);
      }

      function calcularEtaMinutos(distanciaMetros) {
        // velocidad rural estimada simple: 40 km/h
        const velocidadMMin = 40000 / 60;
        if (!Number.isFinite(distanciaMetros) || distanciaMetros <= 0) return null;
        return Math.max(1, Math.round(distanciaMetros / velocidadMMin));
      }

      function actualizarUIEstadoPatrulla(data) {
        const estado = data?.estado || "pendiente";

        if (btnSalirAlLugar) btnSalirAlLugar.disabled = true;
        if (btnIniciarPatrullaGps) btnIniciarPatrullaGps.disabled = true;
        if (btnFinalizarPatrullaGps) btnFinalizarPatrullaGps.disabled = true;

        if (estado === "aceptada") {
          if (btnSalirAlLugar) btnSalirAlLugar.disabled = false;
        }

        if (estado === "en_camino") {
          if (btnIniciarPatrullaGps) btnIniciarPatrullaGps.disabled = false;
        }

        if (estado === "en_curso") {
          if (btnFinalizarPatrullaGps) btnFinalizarPatrullaGps.disabled = false;
        }

        if (estado === "finalizada" || estado === "cancelada" || estado === "pendiente") {
          if (btnSalirAlLugar) btnSalirAlLugar.disabled = true;
          if (btnIniciarPatrullaGps) btnIniciarPatrullaGps.disabled = true;
          if (btnFinalizarPatrullaGps) btnFinalizarPatrullaGps.disabled = true;
        }

        if (data?.estado === "en_curso") {
          iniciarCronometro();
        } else {
          detenerCronometro();
        }
      }

      function iniciarCronometro() {
        if (intervaloCronometro) {
          clearInterval(intervaloCronometro);
        }

        intervaloCronometro = setInterval(() => {
          if (!patrullaInicioMs) return;

          const ahora = Date.now();
          const diff = ahora - patrullaInicioMs;

          const segundos = Math.floor(diff / 1000) % 60;
          const minutos = Math.floor(diff / 60000) % 60;
          const horas = Math.floor(diff / 3600000);

          const texto = `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;

          if (msgPatrullaGps) {
            msgPatrullaGps.textContent = `🟢 Patrulla en curso • Tiempo: ${texto}`;
          }
        }, 1000);
      }

      function detenerCronometro() {
        if (intervaloCronometro) {
          clearInterval(intervaloCronometro);
          intervaloCronometro = null;
        }
      }

      function calcularImportePatrulla(data) {
        const base = 12000;

        const distanciaM = Number(data?.distanciaM || 0);
        const distanciaKm = distanciaM / 1000;

        const inicioMs = Number(data?.inicioMs || 0);
        const finMs = Number(data?.finMs || Date.now());
        const duracionMin = inicioMs > 0 ? Math.max(1, Math.round((finMs - inicioMs) / 60000)) : 0;

        const costoDistancia = Math.round(distanciaKm * 800);
        const costoTiempo = Math.round(duracionMin * 120);

        let subtotal = base + costoDistancia + costoTiempo;

        const prioridad = String(data?.prioridad || "media").toLowerCase();
        const tipoNovedadFinal = String(data?.tipoNovedadFinal || "sin_novedad").toLowerCase();

        if (prioridad === "alta") {
          subtotal = Math.round(subtotal * 1.25);
        }

        if (tipoNovedadFinal === "incidencia_grave") {
          subtotal = Math.round(subtotal * 1.20);
        }

        return {
          base,
          distanciaKm: Number(distanciaKm.toFixed(2)),
          duracionMin,
          costoDistancia,
          costoTiempo,
          prioridad,
          tipoNovedadFinal,
          total: subtotal
        };
      }

      function seleccionarPatrulla(docId, data) {
        patrullaSeleccionadaId = docId;
        patrullaSeleccionadaData = data;

        actualizarUIEstadoPatrulla(data);



        const motivo = String(data?.motivo || "Patrulla").replaceAll("_", " ");
        const campo = data?.nombreCampo || "Sin nombre";
        setMsgPatrullaGps(`✅ Patrulla seleccionada: ${motivo} • ${campo}`);

        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              publicarUbicacionEmpleado(
                pos.coords.latitude,
                pos.coords.longitude,
                Math.round(pos.coords.accuracy || 0)
              );
            },
            (err) => {
              console.error("No se pudo publicar ubicación inicial del empleado:", err);
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 10000
            }
          );
        }
      }

      async function salirAlLugar() {
        if (!patrullaSeleccionadaId || !patrullaSeleccionadaData) {
          setMsgPatrullaGps("⚠️ Primero seleccioná una patrulla.", false);
          return;
        }

        try {
          const latObj = Number(patrullaSeleccionadaData?.lat);
          const lngObj = Number(patrullaSeleccionadaData?.lng);

          let etaMin = null;

          if ("geolocation" in navigator && Number.isFinite(latObj) && Number.isFinite(lngObj)) {
            await new Promise((resolve) => {
              navigator.geolocation.getCurrentPosition(
                async (pos) => {
                  const latEmp = pos.coords.latitude;
                  const lngEmp = pos.coords.longitude;

                  await publicarUbicacionEmpleado(
                    latEmp,
                    lngEmp,
                    Math.round(pos.coords.accuracy || 0)
                  );

                  const dist = distMetrosPatrulla(latEmp, lngEmp, latObj, lngObj);
                  etaMin = calcularEtaMinutos(dist);
                  resolve();
                },
                (err) => {
                  console.error("No se pudo obtener GPS para ETA:", err);
                  resolve();
                },
                {
                  enableHighAccuracy: true,
                  timeout: 12000,
                  maximumAge: 5000
                }
              );
            });
          }

          await updateDoc(doc(db, "solicitudesPatrulla", patrullaSeleccionadaId), {
            estado: "en_camino",
            patrulleroDni: empleadoDni,
            enCaminoEn: serverTimestamp(),
            etaMin: etaMin
          });

          patrullaSeleccionadaData = {
            ...patrullaSeleccionadaData,
            estado: "en_camino",
            patrulleroDni: empleadoDni,
            etaMin: etaMin
          };

          actualizarUIEstadoPatrulla(patrullaSeleccionadaData);

          setMsgPatrullaGps(`🚗 En camino al lugar${etaMin ? ` • ETA aprox: ${etaMin} min` : ""}`);
        } catch (e) {
          console.error("Error al pasar a en_camino:", e);
          setMsgPatrullaGps("❌ No se pudo marcar salida al lugar.", false);
        }
      }

      async function iniciarGpsPatrulla(esRestauracion = false) {
        if (!patrullaSeleccionadaId || !patrullaSeleccionadaData) {
          setMsgPatrullaGps("⚠️ Primero seleccioná una solicitud.", false);
          return;
        }

        if (!("geolocation" in navigator)) {
          setMsgPatrullaGps("❌ Este dispositivo no tiene geolocalización.", false);
          return;
        }

        if (watchPatrullaId) {
          navigator.geolocation.clearWatch(watchPatrullaId);
          watchPatrullaId = null;
        }

        if (watchPatrullaId) {
          navigator.geolocation.clearWatch(watchPatrullaId);
          watchPatrullaId = null;
        }

        if (!esRestauracion) {
          patrullaRutaPts = [];
          patrullaLastPt = null;
          patrullaDistanciaM = 0;
          patrullaInicioMs = Date.now();
        } else {
          patrullaRutaPts = Array.isArray(patrullaRutaPts) ? patrullaRutaPts : [];
          patrullaDistanciaM = Number(patrullaDistanciaM || 0);
          patrullaInicioMs = Number(patrullaInicioMs || Date.now());
        }

        patrullaSeleccionadaData = {
          ...patrullaSeleccionadaData,
          estado: "en_curso",
          patrulleroDni: empleadoDni,
          trackingActivo: true
        };

        actualizarUIEstadoPatrulla(patrullaSeleccionadaData);

        if (btnSalirAlLugar) btnSalirAlLugar.disabled = true;

        try {
          const payload = {
            estado: "en_curso",
            patrulleroDni: empleadoDni,
            trackingActivo: true
          };

          if (!esRestauracion) {
            payload.iniciadaEn = serverTimestamp();
            payload.inicioMs = patrullaInicioMs;
          }

          await updateDoc(doc(db, "solicitudesPatrulla", patrullaSeleccionadaId), payload);
        } catch (e) {
          console.error("Error iniciando patrulla:", e);

          actualizarUIEstadoPatrulla({
            ...patrullaSeleccionadaData,
            estado: patrullaSeleccionadaData?.estado || "aceptada"
          });

          setMsgPatrullaGps("❌ No se pudo iniciar la patrulla.", false);
          return;
        }

        setMsgPatrullaGps("📡 Iniciando GPS de patrulla...");

        watchPatrullaId = navigator.geolocation.watchPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const t = Date.now();

            if (!patrullaLastPt) {
              patrullaLastPt = { lat, lng };
              patrullaRutaPts.push({ lat, lng, t });
            } else {
              const d = distMetrosPatrulla(patrullaLastPt.lat, patrullaLastPt.lng, lat, lng);
              if (d >= 15) {
                patrullaDistanciaM += d;
                patrullaLastPt = { lat, lng };
                patrullaRutaPts.push({ lat, lng, t });

                if (patrullaRutaPts.length > 150) {
                  patrullaRutaPts.splice(0, patrullaRutaPts.length - 150);
                }
              }
            }

            try {
              await updateDoc(doc(db, "solicitudesPatrulla", patrullaSeleccionadaId), {
                estado: "en_curso",
                patrulleroDni: empleadoDni,
                trackingActivo: true,
                trackingLat: lat,
                trackingLng: lng,
                trackingAccuracy: Math.round(pos.coords.accuracy || 0),
                trackingUltimaActualizacionMs: Date.now(),
                distanciaM: Math.round(patrullaDistanciaM),
                rutaPts: patrullaRutaPts
              });

              await publicarUbicacionEmpleado(lat, lng, Math.round(pos.coords.accuracy || 0));


              if (typeof mostrarPatrullaEnMapa === "function") {
                mostrarPatrullaEnMapa({
                  ...patrullaSeleccionadaData,
                  lat,
                  lng
                });
              }

              setMsgPatrullaGps(`✅ Patrullando... ${lat.toFixed(5)}, ${lng.toFixed(5)} • ${Math.round(patrullaDistanciaM)} m`);
            } catch (e) {
              console.error("Error actualizando GPS de patrulla:", e);
            }
          },
          (err) => {
            console.error("GPS patrulla error:", err);

            let msg = "❌ Error de GPS.";
            if (err?.code === 1) msg = "❌ Permiso denegado para GPS.";
            if (err?.code === 2) msg = "❌ No se pudo obtener señal GPS.";
            if (err?.code === 3) msg = "❌ Timeout GPS.";

            setMsgPatrullaGps(msg, false);
            btnIniciarPatrullaGps.disabled = false;
            btnFinalizarPatrullaGps.disabled = true;
          },
          {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 10000
          }
        );
      }

      async function finalizarGpsPatrulla() {
        if (!patrullaSeleccionadaId) {
          setMsgPatrullaGps("⚠️ No hay patrulla activa.", false);
          return;
        }

        if (watchPatrullaId) {
          navigator.geolocation.clearWatch(watchPatrullaId);
          watchPatrullaId = null;
        }
        patrullaSeleccionadaData = {
          ...patrullaSeleccionadaData,
          estado: "finalizada",
          patrulleroDni: empleadoDni,
          trackingActivo: false
        };

        actualizarUIEstadoPatrulla(patrullaSeleccionadaData);

        const tipoNovedad = tipoNovedadPatrulla?.value || "sin_novedad";
        const observacionFinal = (obsFinalPatrulla?.value || "").trim();

        const finMs = Date.now();

        const resumenCobro = calcularImportePatrulla({
          ...patrullaSeleccionadaData,
          distanciaM: Math.round(patrullaDistanciaM),
          inicioMs: patrullaInicioMs,
          finMs: finMs,
          tipoNovedadFinal: tipoNovedad
        });

        if ((tipoNovedad === "novedad_menor" || tipoNovedad === "incidencia_grave") && !observacionFinal) {
          alert("Debés escribir una observación final cuando hubo una novedad.");
          return;
        }

        try {
          await updateDoc(doc(db, "solicitudesPatrulla", patrullaSeleccionadaId), {
            estado: "finalizada",
            patrulleroDni: empleadoDni,
            finalizadaEn: serverTimestamp(),
            trackingActivo: false,
            distanciaM: Math.round(patrullaDistanciaM),
            rutaPts: patrullaRutaPts,
            inicioMs: patrullaInicioMs,
            finMs: finMs,
            observacionFinal: observacionFinal,
            tipoNovedadFinal: tipoNovedad,
            huboNovedad: tipoNovedad !== "sin_novedad",

            cobroCalculado: true,
            importeTotal: resumenCobro.total,
            tarifaBase: resumenCobro.base,
            duracionMin: resumenCobro.duracionMin,
            distanciaKm: resumenCobro.distanciaKm,
            costoDistancia: resumenCobro.costoDistancia,
            costoTiempo: resumenCobro.costoTiempo
          });

          detenerCronometro();

          patrullaSeleccionadaData = {
            ...patrullaSeleccionadaData,
            estado: "finalizada",
            patrulleroDni: empleadoDni,
            trackingActivo: false,
            distanciaM: Math.round(patrullaDistanciaM),
            rutaPts: patrullaRutaPts,
            inicioMs: patrullaInicioMs,
            finMs: finMs,
            observacionFinal: observacionFinal,
            tipoNovedadFinal: tipoNovedad,
            huboNovedad: tipoNovedad !== "sin_novedad",

            cobroCalculado: true,
            importeTotal: resumenCobro.total,
            tarifaBase: resumenCobro.base,
            duracionMin: resumenCobro.duracionMin,
            distanciaKm: resumenCobro.distanciaKm,
            costoDistancia: resumenCobro.costoDistancia,
            costoTiempo: resumenCobro.costoTiempo
          };


          actualizarUIEstadoPatrulla(patrullaSeleccionadaData);

          if (obsFinalPatrulla) obsFinalPatrulla.value = "";
          if (tipoNovedadPatrulla) tipoNovedadPatrulla.value = "sin_novedad";

          const txtCierre =
            tipoNovedad === "sin_novedad"
              ? "✅ Sin novedad"
              : tipoNovedad === "novedad_menor"
                ? "⚠️ Novedad menor"
                : "🚨 Incidencia grave";

          setMsgPatrullaGps(
            `🏁 Patrulla finalizada. ${txtCierre} • Total estimado: $${resumenCobro.total.toLocaleString("es-AR")}`
          );

        } catch (e) {
          console.error("Error finalizando patrulla:", e);
          setMsgPatrullaGps("❌ No se pudo finalizar la patrulla.", false);
        }
        alert(
          `Servicio finalizado\n\n` +
          `Tiempo: ${resumenCobro.duracionMin} min\n` +
          `Distancia: ${resumenCobro.distanciaKm} km\n` +
          `Importe estimado: $${resumenCobro.total.toLocaleString("es-AR")}`
        );
      }

      function prioridadPeso(prioridad) {
        switch ((prioridad || "").toLowerCase()) {
          case "alta":
            return 3;
          case "media":
            return 2;
          case "baja":
            return 1;
          default:
            return 0;
        }
      }

      function mostrarAlertaUrgenteVisual(texto) {
        if (!alertaUrgenteEmpleado) return;

        alertaUrgenteEmpleado.style.display = "block";
        alertaUrgenteEmpleado.textContent = texto;

        setTimeout(() => {
          if (alertaUrgenteEmpleado) {
            alertaUrgenteEmpleado.style.display = "none";
          }
        }, 5000);
      }

      async function restaurarPatrullaActiva() {
        try {
          const q = query(
            collection(db, "solicitudesPatrulla"),
            where("productorId", "==", productorId),
            where("patrulleroDni", "==", empleadoDni)
          );

          const snap = await getDocs(q);

          if (snap.empty) {
            console.log("No hay patrulla activa para restaurar.");
            return;
          }

          const candidatas = [];

          snap.forEach((docSnap) => {
            const data = docSnap.data();
            const estado = data?.estado || "";

            if (["asignada", "aceptada", "en_camino", "en_curso"].includes(estado)) {
              candidatas.push({
                id: docSnap.id,
                ...data
              });
            }
          });

          if (!candidatas.length) {
            console.log("No hay patrullas en estado restaurable.");
            return;
          }

          candidatas.sort((a, b) => {
            const ta = a?.creadoEn?.seconds || 0;
            const tb = b?.creadoEn?.seconds || 0;
            return tb - ta;
          });

          const patrulla = candidatas[0];

          patrullaSeleccionadaId = patrulla.id;
          patrullaSeleccionadaData = patrulla;

          seleccionarPatrulla(patrulla.id, patrulla);

          if (typeof mostrarPatrullaEnMapa === "function") {
            mostrarPatrullaEnMapa(patrulla);
          }

          if (patrulla.estado === "asignada") {
            setMsgPatrullaGps("📌 Tenés una asignación pendiente restaurada.");
            return;
          }

          if (patrulla.estado === "aceptada") {
            if (btnSalirAlLugar) btnSalirAlLugar.disabled = false;
            if (btnIniciarPatrullaGps) btnIniciarPatrullaGps.disabled = false;
            if (btnFinalizarPatrullaGps) btnFinalizarPatrullaGps.disabled = true;

            setMsgPatrullaGps("✅ Patrulla aceptada restaurada. Ya podés salir al lugar.");
            return;
          }

          if (patrulla.estado === "en_camino") {
            if (btnSalirAlLugar) btnSalirAlLugar.disabled = true;
            if (btnIniciarPatrullaGps) btnIniciarPatrullaGps.disabled = false;
            if (btnFinalizarPatrullaGps) btnFinalizarPatrullaGps.disabled = true;

            setMsgPatrullaGps("🚗 Patrulla en camino restaurada.");
            return;
          }

          if (patrulla.estado === "en_curso") {
            if (btnSalirAlLugar) btnSalirAlLugar.disabled = true;
            if (btnIniciarPatrullaGps) btnIniciarPatrullaGps.disabled = true;
            if (btnFinalizarPatrullaGps) btnFinalizarPatrullaGps.disabled = false;

            patrullaRutaPts = Array.isArray(patrulla.rutaPts) ? [...patrulla.rutaPts] : [];
            patrullaDistanciaM = Number(patrulla.distanciaM || 0);
            patrullaInicioMs = Number(patrulla.inicioMs || Date.now());

            if (patrullaRutaPts.length > 0) {
              const ultimo = patrullaRutaPts[patrullaRutaPts.length - 1];
              patrullaLastPt = {
                lat: Number(ultimo.lat),
                lng: Number(ultimo.lng)
              };
            } else if (
              Number.isFinite(Number(patrulla.trackingLat)) &&
              Number.isFinite(Number(patrulla.trackingLng))
            ) {
              patrullaLastPt = {
                lat: Number(patrulla.trackingLat),
                lng: Number(patrulla.trackingLng)
              };
            } else {
              patrullaLastPt = null;
            }

            setMsgPatrullaGps("🟢 Patrulla en curso restaurada. Reactivando GPS...");

            await iniciarGpsPatrulla(true);
          }
        } catch (e) {
          console.error("Error restaurando patrulla activa:", e);
        }
      }


      function iniciarListeners() {
        console.log("DEBUG iniciarListeners");
        console.log("productorId:", productorId);
        console.log("empleadoDni:", empleadoDni);
        console.log("listaTareas:", !!listaTareas);
        console.log("listaPatrullas:", !!listaPatrullas);
        console.log("listaAlertas:", !!listaAlertas);
        // ===============================
        // ✅ TAREAS
        // ===============================
        const qT = query(
          collection(db, "tareas"),
          where("productorId", "==", productorId),
          where("empleadoId", "==", empleadoDni),
          orderBy("timestamp", "desc")
        );

        onSnapshot(qT, (snap) => {
          listaTareas.innerHTML = "";

          if (snap.empty) {
            listaTareas.textContent = "No hay tareas asignadas.";
            return;
          }

          snap.forEach((d) => {
            const t = d.data();
            const div = createTareaItem({
              tarea: t,
              id: d.id,
              db,
              onError: () => alert("No se pudo marcar como realizada. Revisá permisos/reglas.")
            });
            listaTareas.appendChild(div);
          });
        }, (err) => {
          console.error("Snapshot tareas:", err);
          listaTareas.textContent = "Error cargando tareas (reglas/índices).";
        });

        // ===============================
        // 🚓 SOLICITUDES DE PATRULLA
        // ===============================
        const qP = query(
          collection(db, "solicitudesPatrulla"),
          where("productorId", "==", productorId),
          orderBy("creadoEn", "desc")
        );

        onSnapshot(qP, (snap) => {
          listaPatrullas.innerHTML = "";

          if (snap.empty) {
            listaPatrullas.innerHTML = `<div class="muted">No hay solicitudes de patrulla.</div>`;
            return;
          }

          const solicitudes = [];

          snap.forEach((docSnap) => {
            const p = docSnap.data();
            solicitudes.push({
              id: docSnap.id,
              ...p
            });
          });

          const urgentes = solicitudes.filter(s =>
            (s.prioridad || "").toLowerCase() === "alta" &&
            ["pendiente", "asignada", "aceptada", "en_camino"].includes(s.estado || "")
          );

          const asignadasAMi = solicitudes.filter(s =>
            (s.asignadoPatrulleroDni || "") === empleadoDni &&
            (s.estado || "") === "asignada"
          );

          if (countUrgentesEmpleado) countUrgentesEmpleado.textContent = urgentes.length;
          if (countAsignadasEmpleado) countAsignadasEmpleado.textContent = asignadasAMi.length;

          if (urgentes.length > 0 && alertaUrgenteEmpleado) {
            alertaUrgenteEmpleado.style.display = "block";
            alertaUrgenteEmpleado.textContent = "🚨 Hay patrullas urgentes pendientes";
          } else if (alertaUrgenteEmpleado) {
            alertaUrgenteEmpleado.style.display = "none";
          }

          asignadasAMi.forEach((s) => {
            if (!ultimasAsignacionesVistas.has(s.id)) {
              ultimasAsignacionesVistas.add(s.id);
              mostrarAlertaUrgenteVisual(`📢 Nueva asignación para vos: ${String(s.motivo || "Patrulla").replaceAll("_", " ")}`);
            }
          });

          solicitudes.sort((a, b) => {
            const pa = prioridadPeso(a.prioridad);
            const pb = prioridadPeso(b.prioridad);

            if (pb !== pa) return pb - pa;

            const da = Number.isFinite(Number(a.sugeridoDistanciaM)) ? Number(a.sugeridoDistanciaM) : 999999999;
            const db = Number.isFinite(Number(b.sugeridoDistanciaM)) ? Number(b.sugeridoDistanciaM) : 999999999;

            if (da !== db) return da - db;

            const ta = a?.creadoEn?.seconds || 0;
            const tb = b?.creadoEn?.seconds || 0;
            return tb - ta;
          });

          solicitudes.forEach((p) => {
            const estado = p.estado || "pendiente";

            const asignadoADni = p.asignadoPatrulleroDni || "";
            const esParaMi = !asignadoADni || asignadoADni === empleadoDni;
            if (!esParaMi) return;

            const prioridad = (p.prioridad || "media").toLowerCase();
            const distanciaSugerida = Number(p.sugeridoDistanciaM || 0);

            const esNuevaAsignacionParaMi =
              (p.estado === "asignada") &&
              (p.asignadoPatrulleroDni === empleadoDni);

            const div = document.createElement("div");
            div.className = "item";

            if (esNuevaAsignacionParaMi) {
              div.style.border = "2px solid #dc2626";
              div.style.boxShadow = "0 0 0 3px rgba(220,38,38,0.15)";
            }

            const badgePrioridad =
              prioridad === "alta"
                ? `<span style="background:#fee2e2;color:#991b1b;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:800;">🔴 Alta</span>`
                : prioridad === "media"
                  ? `<span style="background:#fef3c7;color:#92400e;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:800;">🟡 Media</span>`
                  : `<span style="background:#dcfce7;color:#166534;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:800;">🟢 Baja</span>`;

            div.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
      <strong>🚓 ${String(p.motivo || "Sin motivo").replaceAll("_", " ")}</strong>
      <span class="muted"><b>${estado}</b></span>
    </div>

    <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
      ${badgePrioridad}
    </div>

    <div class="muted" style="margin-top:6px;">Duración: ${p.duracionHoras || "-"} h</div>
    <div class="muted" style="margin-top:4px;">Detalle: ${p.detalle || "Sin detalle"}</div>
    <div class="muted" style="margin-top:4px;">Campo: ${p.nombreCampo || "Sin nombre"}</div>
    <div class="muted" style="margin-top:4px;">Distancia sugerida: ${distanciaSugerida ? `${distanciaSugerida} m` : "—"}</div>

    <div class="actions">
      ${estado === "pendiente"
                ? `<button class="btn-ok btn-aceptar">✅ Aceptar servicio</button>`
                : estado === "asignada" && asignadoADni === empleadoDni
                  ? `
            <button class="btn-ok btn-aceptar-asignacion">✅ Aceptar asignación</button>
            <button class="btn-rechazar-asignacion" style="background:#b91c1c;color:#fff;border:none;padding:8px 10px;border-radius:10px;font-weight:800;cursor:pointer;">
              ❌ Rechazar asignación
            </button>
          `
                  : ""
              }
    </div>
  `;

            const btnAceptar = div.querySelector(".btn-aceptar");
            if (btnAceptar) {
              btnAceptar.addEventListener("click", async () => {
                try {
                  btnAceptar.disabled = true;
                  btnAceptar.textContent = "Aceptando...";

                  await updateDoc(doc(db, "solicitudesPatrulla", p.id), {
                    estado: "aceptada",
                    patrulleroDni: empleadoDni,
                    aceptadaEn: serverTimestamp()
                  });

                  seleccionarPatrulla(p.id, {
                    ...p,
                    estado: "aceptada",
                    patrulleroDni: empleadoDni
                  });

                  if (typeof mostrarPatrullaEnMapa === "function") {
                    mostrarPatrullaEnMapa(p);
                  }
                } catch (e) {
                  console.error("Error al aceptar patrulla:", e);
                  btnAceptar.disabled = false;
                  btnAceptar.textContent = "✅ Aceptar servicio";
                  alert("No se pudo aceptar la solicitud.");
                }
              });
            }

            const btnAceptarAsignacion = div.querySelector(".btn-aceptar-asignacion");
            if (btnAceptarAsignacion) {
              btnAceptarAsignacion.addEventListener("click", async () => {
                try {
                  btnAceptarAsignacion.disabled = true;
                  btnAceptarAsignacion.textContent = "Aceptando...";

                  await updateDoc(doc(db, "solicitudesPatrulla", p.id), {
                    estado: "aceptada",
                    patrulleroDni: empleadoDni,
                    aceptadaEn: serverTimestamp()
                  });

                  seleccionarPatrulla(p.id, {
                    ...p,
                    estado: "aceptada",
                    patrulleroDni: empleadoDni
                  });

                  if (typeof mostrarPatrullaEnMapa === "function") {
                    mostrarPatrullaEnMapa(p);
                  }
                } catch (e) {
                  console.error("Error al aceptar asignación:", e);
                  btnAceptarAsignacion.disabled = false;
                  btnAceptarAsignacion.textContent = "✅ Aceptar asignación";
                  alert("No se pudo aceptar la asignación.");
                }
              });
            }

            const btnRechazarAsignacion = div.querySelector(".btn-rechazar-asignacion");
            if (btnRechazarAsignacion) {
              btnRechazarAsignacion.addEventListener("click", async () => {
                try {
                  const motivoRechazo = (motivoRechazoPatrulla?.value || "").trim();

                  btnRechazarAsignacion.disabled = true;
                  btnRechazarAsignacion.textContent = "Rechazando...";

                  await updateDoc(doc(db, "solicitudesPatrulla", p.id), {
                    estado: "pendiente",
                    asignadoPatrulleroDni: null,
                    asignadoEn: null,
                    rechazadaPorDni: empleadoDni,
                    rechazadaEn: serverTimestamp(),
                    motivoRechazo: motivoRechazo || ""
                  });

                  if (motivoRechazoPatrulla) motivoRechazoPatrulla.value = "";

                  if (patrullaSeleccionadaId === p.id) {
                    patrullaSeleccionadaId = null;
                    patrullaSeleccionadaData = null;
                  }

                  setMsgPatrullaGps("⏪ Asignación rechazada. La solicitud volvió a pendiente.", false);
                } catch (e) {
                  console.error("Error al rechazar asignación:", e);
                  btnRechazarAsignacion.disabled = false;
                  btnRechazarAsignacion.textContent = "❌ Rechazar asignación";
                  alert("No se pudo rechazar la asignación.");
                }
              });
            }

            div.addEventListener("click", () => {
              seleccionarPatrulla(p.id, p);

              if (typeof mostrarPatrullaEnMapa === "function") {
                mostrarPatrullaEnMapa(p);
              }
            });

            listaPatrullas.appendChild(div);
          });

        }, (err) => {
          console.error("Snapshot patrullas:", err);
          listaPatrullas.textContent = "Error cargando patrullas.";
        });
        // ===============================
        // ✅ ALERTAS
        // ===============================
        const qA = query(
          collection(db, "alertas"),
          where("productorId", "==", productorId),
          orderBy("timestamp", "desc")
        );

        onSnapshot(qA, (snap) => {
          listaAlertas.innerHTML = "";

          if (snap.empty) {
            listaAlertas.textContent = "Sin alertas.";
            return;
          }

          let cant = 0;
          snap.forEach((d) => {
            const a = d.data();
            const para = (a.para || "todos").toString().trim();

            if (para !== "todos" && para !== empleadoDni) return;

            cant++;
            const div = document.createElement("div");
            div.className = "item";
            div.innerHTML = `
        <div><b>🚨 ${a.tipo ?? "Alerta"}</b></div>
        <div class="muted">${a.descripcion ?? ""}</div>
      `;
            listaAlertas.appendChild(div);
          });

          if (cant === 0) listaAlertas.textContent = "Sin alertas.";
        }, (err) => {
          console.error("Snapshot alertas:", err);
          listaAlertas.textContent = "Error cargando alertas (reglas/índices).";
        });
      }

      // ===============================
      // 🚚 TRACKING CAMIÓN — OPCIÓN 2
      // - No se detiene por salir.
      // - Reanuda solo si estaba activo.
      // - WakeLock para evitar que el celular duerma.
      // ===============================
      let watchId = null;
      // ===============================
      // 📍 Ruta + Distancia (para guardar al detener)
      // ===============================
      let rutaPts = [];          // [{lat,lng,t}, ...]
      let lastPt = null;         // {lat,lng}
      let distanciaM = 0;        // acumulado
      let inicioMs = 0;

      const UMBRAL_METROS_GUARDAR = 5;   // evita ruido GPS
      const MAX_PUNTOS_GUARDAR = 2000;    // límite por seguridad (doc size)

      // Haversine
      function distMetros(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const toRad = (x) => x * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c);
      }


      const camionIdEl = document.getElementById("camionId");
      const btnStartTrack = document.getElementById("btnStartTrack");
      const btnStopTrack = document.getElementById("btnStopTrack");
      const msgTrack = document.getElementById("msgTrack");

      const TRACK_KEY = "trackingActivo";
      const TRACK_CAMION_KEY = "trackingCamionId";

      function setMsg(t, ok = true) {
        msgTrack.textContent = t;
        msgTrack.style.color = ok ? "#14532d" : "#b91c1c";
      }

      async function upsertCamion(camionId, payload) {
        await setDoc(doc(db, "camiones", camionId), payload, { merge: true });
      }

      // --------------------
      // Wake Lock
      // --------------------
      let wakeLock = null;

      async function activarWakeLock() {
        try {
          if ("wakeLock" in navigator) {
            wakeLock = await navigator.wakeLock.request("screen");
            console.log("✅ WakeLock activo");
          }
        } catch (e) {
          console.warn("WakeLock no disponible:", e);
        }
      }

      async function desactivarWakeLock() {
        try {
          if (wakeLock) {
            await wakeLock.release();
            wakeLock = null;
            console.log("⏹ WakeLock liberado");
          }
        } catch { }
      }

      // Si vuelve a primer plano y estaba activo, re-pedir WakeLock
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && localStorage.getItem(TRACK_KEY) === "1") {
          activarWakeLock();
        }
      });

      // --------------------
      // Start
      // --------------------
      btnStartTrack.addEventListener("click", async () => {
        const camionId = (camionIdEl.value || "").trim();
        if (!camionId) return setMsg("⚠️ Ingresá el ID/patente del camión.", false);

        if (!("geolocation" in navigator)) {
          return setMsg("❌ Este dispositivo no tiene geolocalización.", false);
        }

        // Persistir estado para reanudar
        localStorage.setItem(TRACK_KEY, "1");
        localStorage.setItem(TRACK_CAMION_KEY, camionId);
        await activarWakeLock();

        // Evitar doble tracking
        if (watchId) navigator.geolocation.clearWatch(watchId);

        btnStartTrack.disabled = true;
        btnStopTrack.disabled = false;

        setMsg("📡 Iniciando monitoreo...");

        // 🟢 Nuevo viaje
        rutaPts = [];
        lastPt = null;
        distanciaM = 0;
        inicioMs = Date.now();


        // Primer ping
        await upsertCamion(camionId, {
          productorId,
          camionId,
          empleadoDni,
          online: true,
          updatedAt: serverTimestamp(),
          lastSeen: Date.now()
        });

        watchId = navigator.geolocation.watchPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            // ✅ guardar ruta (local) + calcular distancia
            const t = Date.now();

            if (!lastPt) {
              lastPt = { lat, lng };
              rutaPts.push({ lat, lng, t });
            } else {
              const d = distMetros(lastPt.lat, lastPt.lng, lat, lng);
              if (d >= UMBRAL_METROS_GUARDAR) {
                distanciaM += d;
                lastPt = { lat, lng };
                rutaPts.push({ lat, lng, t });

                // límite (evita doc enorme)
                if (rutaPts.length > MAX_PUNTOS_GUARDAR) {
                  rutaPts.splice(0, rutaPts.length - MAX_PUNTOS_GUARDAR);
                }
              }
            }


            await upsertCamion(camionId, {
              productorId,
              camionId,
              empleadoDni,
              lat,
              lng,
              accuracy: Math.round(pos.coords.accuracy || 0),
              speed: pos.coords.speed ?? null,
              heading: pos.coords.heading ?? null,
              online: true,
              updatedAt: serverTimestamp(),
              lastSeen: Date.now()
            });

            setMsg(`✅ Enviando ubicación… (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
          },
          (err) => {
            console.error("GPS watch error:", err);

            let msg = "❌ Error de GPS. Activá permisos/ubicación del celular.";
            if (err?.code === 1) msg = "❌ Permiso denegado. Activá ubicación para este sitio.";
            if (err?.code === 2) msg = "❌ No se pudo obtener señal GPS. Probá al aire libre.";
            if (err?.code === 3) msg = "❌ Timeout GPS. Reintentá o movete a un lugar con mejor señal.";

            setMsg(msg, false);
            btnStartTrack.disabled = false;
            btnStopTrack.disabled = true;
          }
          ,
          {
            enableHighAccuracy: true,
            timeout: 20000,      // más tiempo
            maximumAge: 10000    // aceptá cache 10s
          }

        );
      });

      // --------------------
      // Stop (única forma de “detener” real)
      // --------------------
      btnStopTrack.addEventListener("click", async () => {
        const camionId = (camionIdEl.value || "").trim();

        localStorage.removeItem(TRACK_KEY);
        localStorage.removeItem(TRACK_CAMION_KEY);
        await desactivarWakeLock();

        if (watchId) {
          navigator.geolocation.clearWatch(watchId);
          watchId = null;
        }

        btnStartTrack.disabled = false;
        btnStopTrack.disabled = true;

        setMsg("⏹ Monitoreo detenido.");

        if (camionId) {
          try {
            await updateDoc(doc(db, "camiones", camionId), {
              online: false,
              updatedAt: serverTimestamp(),
              lastSeen: Date.now()
            });
          } catch (e) {
            console.warn("No pude marcar offline:", e);
          }
          // ✅ Guardar viaje al detener
          try {
            const finMs = Date.now();
            // ✅ forzar punto final si solo hay 1 punto
            if (rutaPts.length === 1 && lastPt) {
              rutaPts.push({ lat: lastPt.lat, lng: lastPt.lng, t: Date.now() });
            }

            // Solo guardo si tengo mínimo 2 puntos
            if (camionId && rutaPts.length >= 2 && inicioMs) {
              await addDoc(collection(db, "viajes_camiones"), {
                productorId,
                camionId,
                empleadoDni,
                inicioMs,
                finMs,
                distanciaM: Math.round(distanciaM),
                rutaPts: rutaPts
              });

            }
          } catch (e) {
            console.warn("No pude guardar el viaje:", e);
          }


        }
      });

      // --------------------
      // Auto-reanudar si estaba activo
      // --------------------
      const estabaActivo = localStorage.getItem(TRACK_KEY) === "1";
      const camionGuardado = (localStorage.getItem(TRACK_CAMION_KEY) || "").trim();

      if (estabaActivo && camionGuardado) {
        camionIdEl.value = camionGuardado;
        btnStartTrack.click();
      }

    }

    function initSwitchModulosEmpleado() {
      const botones = document.querySelectorAll(".switch-btn");
      const modulos = document.querySelectorAll(".modulo-empleado");

      botones.forEach((btn) => {
        btn.addEventListener("click", () => {
          const destino = btn.dataset.modulo;

          botones.forEach((b) => b.classList.remove("activo"));
          btn.classList.add("activo");

          modulos.forEach((mod) => {
            if (mod.id === destino) {
              mod.classList.remove("hidden-mod");
              mod.classList.add("visible-mod");
            } else {
              mod.classList.remove("visible-mod");
              mod.classList.add("hidden-mod");
            }
          });

          if (destino === "mod-operativo") {
            setTimeout(() => {
              if (mapaPatrulla) mapaPatrulla.invalidateSize();
            }, 200);
          }
        });
      });
    }

    initSwitchModulosEmpleado();
  
// panel.module.js

// Función para calcular distancia entre dos coordenadas (Haversine)
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Función Principal para el botón
async function calcularMasCercano() {
    console.log("Buscando empleado más cercano...");
    
    // 1. Obtenemos la ubicación del punto de auxilio (tu marcador en el mapa)
    if (!marcadorSelectorPatrulla) {
        alert("Primero selecciona un punto en el mapa");
        return;
    }
    const { lat, lng } = marcadorSelectorPatrulla.getLatLng();

    // 2. Buscamos empleados disponibles en Firebase
    try {
        const q = query(collection(db, "usuarios"), where("rol", "==", "empleado"), where("estado", "==", "disponible"));
        const snapshot = await getDocs(q);

        let masCercano = null;
        let distanciaMinima = Infinity;

        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.latitud && data.longitud) {
                const dist = calcularDistancia(lat, lng, data.latitud, data.longitud);
                if (dist < distanciaMinima) {
                    distanciaMinima = dist;
                    masCercano = { id: doc.id, ...data, distancia: dist };
                }
            }
        });

        if (masCercano) {
            console.log("Ganador:", masCercano.id, "a", masCercano.distancia.toFixed(2), "km");
            alert(`El más cercano es ${masCercano.nombre || masCercano.id} a ${masCercano.distancia.toFixed(2)} km`);
            
            // Opcional: llenar el campo de ID automáticamente
            const inputId = document.getElementById("idEmpleadoAsignar");
            if (inputId) inputId.value = masCercano.id;
        } else {
            alert("No se encontraron empleados con GPS activo y estado 'disponible'");
        }
    } catch (error) {
        console.error("Error en el cálculo:", error);
    }
}

// IMPORTANTE: Hacerla global para el botón HTML
window.calcularMasCercano = calcularMasCercano;