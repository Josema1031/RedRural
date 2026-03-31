    import { auth, db, firebaseConfig } from "../../../firebase-init.js?v=2";
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
    import { onAuthStateChanged, getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
    import {
      collection, query, where, onSnapshot, orderBy, limit,
      doc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp,
      getDocs, getDoc, addDoc
    } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
    import { runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
    import { setHoyMessage, renderMiniDashboardItem } from "./features/dashboard.helpers.js";
    import { getPatrullaEstadoClase, getPatrullaEstadoTexto, formatPatrullaResumenFinalizada } from "./features/patrullas.helpers.js";

    const secondaryApp = initializeApp(firebaseConfig, "secondary");
    const secondaryAuth = getAuth(secondaryApp);

    let mapaSelectorPatrulla = null;
    let marcadorSelectorPatrulla = null;
    let mapaPatrullaVivo = null;
    let marcadorPatrullaVivo = null;
    let solicitudPatrullaSeleccionadaId = null;
    let solicitudPatrullaSeleccionadaData = null;
    let patrulleroMasCercanoData = null;
    let lineaRutaPatrullaVivo = null;

    let productorId = null;

    const btnCancelarPatrulla = document.getElementById("btnCancelarPatrulla");
    const btnWhatsappPatrullero = document.getElementById("btnWhatsappPatrullero");
    const btnPdfPatrulla = document.getElementById("btnPdfPatrulla");
    const patrulleroCercanoBox = document.getElementById("patrulleroCercanoBox");
    const btnCalcularPatrulleroCercano = document.getElementById("btnCalcularPatrulleroCercano");
    const btnSugerirAsignacionPatrulla = document.getElementById("btnSugerirAsignacionPatrulla");
    let historialPatrullasCache = [];

    const listaHistorialPatrullas = document.getElementById("listaHistorialPatrullas");
    const filtroPatrullaCampo = document.getElementById("filtroPatrullaCampo");
    const filtroPatrullaEstado = document.getElementById("filtroPatrullaEstado");
    const btnFiltrarHistorialPatrullas = document.getElementById("btnFiltrarHistorialPatrullas");
    const btnLimpiarHistorialPatrullas = document.getElementById("btnLimpiarHistorialPatrullas");
    const patrullasPendientesCount = document.getElementById("patrullasPendientesCount");
    const patrullasAceptadasCount = document.getElementById("patrullasAceptadasCount");
    const patrullasEnCursoCount = document.getElementById("patrullasEnCursoCount");
    const patrullasFinalizadasCount = document.getElementById("patrullasFinalizadasCount");
    const patrullasUrgentesCount = document.getElementById("patrullasUrgentesCount");
    const listaPatrullasCriticas = document.getElementById("listaPatrullasCriticas");
    const listaPatrullasActivas = document.getElementById("listaPatrullasActivas");

    // =========================
    // 1) GATE POR AUTH
    // =========================
    let planActual = "free"; // default

    // =========================
    // ✅ ADMIN: tu UID
    // =========================
    // 🔴 Reemplazá por TU UID real (Firebase Auth UID)
    const ADMIN_UIDS = new Set([
      "mfCEucZxwne4vGJcMIvfm3hOe173"
    ]);

    function soyAdmin() {
      return auth.currentUser && ADMIN_UIDS.has(auth.currentUser.uid);
    }


    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        alert("Debes iniciar sesión como Productor.");
        window.location.href = "login.html";
        return;
      }

      productorId = user.uid;
      localStorage.setItem("productorId", productorId);

      // ✅ asegurar doc de productor y leer plan
      await asegurarPlanProductor();
      renderAdminBox();
      iniciarPanel();
      initGanado();
      refrescarStockGanado();
      cargarUltimosEventosGanado();
    });

    async function asegurarPlanProductor() {
      const ref = doc(db, "productores", productorId);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        await setDoc(ref, {
          plan: "free",
          creadoEn: serverTimestamp(),
          actualizadoEn: serverTimestamp()
        });
        planActual = "free";
      } else {
        planActual = (snap.data().plan || "free").toLowerCase();
      }

      // refrescar badge/estado en UI
      renderBannerPlan();
      aplicarBloqueosPorPlan();

    }

    function renderBannerPlan() {
      const t = document.getElementById("planTitulo");
      const s = document.getElementById("planSub");
      const btnAdmin = document.getElementById("btnSimularPro");
      const btnPlan = document.getElementById("btnProWhats");

      if (!t || !s) return;

      if (planActual === "pro") {
        t.textContent = "Plan: PRO ✅";
        s.textContent = "Tracking de camiones y alertas a vecinos habilitadas.";
        btnAdmin && (btnAdmin.style.display = "none");

        if (btnPlan) btnPlan.textContent = "Volver a FREE";
      } else {
        t.textContent = "Plan: FREE 🆓";
        s.textContent = "FREE bloquea: 🚚 Camiones y 📲 Alertas a vecinos. Pasate a PRO para habilitar seguridad total.";
        btnAdmin && (btnAdmin.style.display = "inline-block");

        if (btnPlan) btnPlan.textContent = "Pasar a PRO";
      }
    }

    document.getElementById("btnComoActivarPro")?.addEventListener("click", () => {
      alert(
        `✅ Cómo activar PRO ($50.000/mes)

1) Realizá el pago por Mercado Pago / Transferencia.
2) Enviame el comprobante.
3) Te activo el plan PRO en el sistema.

📌 PRO habilita:
• 🚚 Tracking de camiones en tiempo real
• 📲 Alertas a vecinos
• Seguridad y control total

(En breve agregaremos pago automático.)`
      );
    });

    // ✅ botón oculto para pruebas: activar PRO
    document.getElementById("btnSimularPro")?.addEventListener("click", async () => {
      try {
        const ref = doc(db, "productores", productorId);
        await setDoc(ref, { plan: "pro", actualizadoEn: serverTimestamp() }, { merge: true });
        planActual = "pro";
        renderBannerPlan();
        alert("✅ PRO activado (modo admin/prueba).");
      } catch (e) {
        console.error(e);
        alert("No se pudo activar PRO.");
      }
    });

    // =========================
    // ✅ WHATSAPP: solicitar PRO
    // =========================
    const NUMERO_WHATSAPP_PRO = "5492644429649"; // AR + 9 + 264... (sin 0 y sin 15)

    function abrirWhatsAppSolicitudPro() {
      const user = auth.currentUser;
      if (!user) {
        alert("Tenés que iniciar sesión para solicitar PRO.");
        return;
      }

      const uid = user.uid;
      const email = user.email || "sin-email";

      const texto =
        `Hola! Quiero activar PLAN PRO en Red Rural.\n` +
        `UID: ${uid}\n` +
        `Email: ${email}\n` +
        `Fecha: ${new Date().toLocaleString("es-AR")}\n` +
        `Plan actual: ${String(planActual || "free").toUpperCase()}`;

      const url = `https://wa.me/${NUMERO_WHATSAPP_PRO}?text=${encodeURIComponent(texto)}`;
      window.open(url, "_blank");
    }

    function abrirWhatsAppCancelarPro() {
      const user = auth.currentUser;
      if (!user) {
        alert("Tenés que iniciar sesión para solicitar la baja.");
        return;
      }

      const uid = user.uid;
      const email = user.email || "sin-email";

      const texto =
        `Hola! Quiero VOLVER A FREE (cancelar PRO) en Red Rural.\n` +
        `UID: ${uid}\n` +
        `Email: ${email}\n` +
        `Fecha: ${new Date().toLocaleString("es-AR")}\n` +
        `Plan actual: ${String(planActual || "free").toUpperCase()}`;

      const url = `https://wa.me/${NUMERO_WHATSAPP_PRO}?text=${encodeURIComponent(texto)}`;
      window.open(url, "_blank");
    }

    // Botón del banner (ya existe en tu HTML)
    document.getElementById("btnProWhats")?.addEventListener("click", () => {
      const esPro = String(planActual).toLowerCase() === "pro";

      if (!esPro) {
        // FREE → solicitar PRO
        abrirWhatsAppSolicitudPro();
        return;
      }

      // PRO → solicitar volver a FREE (cancelación)
      abrirWhatsAppCancelarPro();
    });


    function renderAdminBox() {
      const box = document.getElementById("adminProBox");
      if (!box) return;
      box.style.display = soyAdmin() ? "block" : "none";
    }

    async function setPlanUsuario(uid, nuevoPlan) {
      const ref = doc(db, "productores", uid);
      await setDoc(ref, { plan: nuevoPlan, actualizadoEn: serverTimestamp() }, { merge: true });
    }

    document.getElementById("adminActivarPro")?.addEventListener("click", async () => {
      try {
        if (!soyAdmin()) return alert("No sos admin.");
        const uid = document.getElementById("adminUidInput").value.trim();
        if (!uid) return alert("Pegá el UID del productor.");

        await setPlanUsuario(uid, "pro");
        alert("✅ PRO habilitado para: " + uid);
      } catch (e) {
        console.error(e);
        alert("❌ No se pudo activar PRO.");
      }
    });

    document.getElementById("adminPonerFree")?.addEventListener("click", async () => {
      try {
        if (!soyAdmin()) return alert("No sos admin.");
        const uid = document.getElementById("adminUidInput").value.trim();
        if (!uid) return alert("Pegá el UID del productor.");

        await setPlanUsuario(uid, "free");
        alert("✅ Usuario vuelto a FREE: " + uid);
      } catch (e) {
        console.error(e);
        alert("❌ No se pudo volver a FREE.");
      }
    });

    /* ============================================================
   📌 HOY — DASHBOARD (engagement diario)
   Lee Firestore y arma resumen para entrar todos los días
   ========================================================== */

    function inicioDelDiaMs() {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }

    function hace24hMs() {
      return Date.now() - (24 * 60 * 60 * 1000);
    }

    function setHoyMsg(txt, ok = true) {
      const el = document.getElementById("hoyMsg");
      if (!el) return;
      setHoyMessage(el, txt, ok);
      setTimeout(() => (el.textContent = ""), 3500);
    }

    function renderMiniItem(titulo, subtitulo) {
      return renderMiniDashboardItem(titulo, subtitulo);
    }

    async function actualizarHoy() {
      if (!productorId) return;

      const elEmp = document.getElementById("hoyEmpleados");
      const elPen = document.getElementById("hoyPendientes");
      const elAl24 = document.getElementById("hoyAlertas24");
      const elCam = document.getElementById("hoyCaminosMalos");
      const elOff = document.getElementById("hoyCamionesOff");

      const listaPend = document.getElementById("hoyListaPendientes");
      const listaAl = document.getElementById("hoyListaAlertas");

      const inicioMs = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
      const desde24 = Date.now() - (24 * 60 * 60 * 1000);

      try {
        // 1) Empleados (query por productorId)
        const qE = query(collection(db, "employees"), where("productorId", "==", productorId));
        const sE = await getDocs(qE);
        elEmp.textContent = sE.size;

        // 2) Tareas pendientes (query por productorId + completada)
        const qT = query(
          collection(db, "tareas"),
          where("productorId", "==", productorId),
          where("completada", "==", false)
        );
        const sT = await getDocs(qT);
        elPen.textContent = sT.size;

        // Pendientes críticos (máx 6)
        const pendientes = [];
        sT.forEach((d) => pendientes.push({ id: d.id, ...d.data() }));

        const prio = (p) => (p === "Alta" ? 3 : p === "Media" ? 2 : 1);
        pendientes.sort((a, b) => {
          const pa = prio(a.prioridad), pb = prio(b.prioridad);
          if (pb !== pa) return pb - pa;
          const ta = a.timestamp?.seconds || 0;
          const tb = b.timestamp?.seconds || 0;
          return tb - ta;
        });

        listaPend.innerHTML = "";
        if (pendientes.length === 0) {
          listaPend.innerHTML = `<small class="muted">✅ No tenés pendientes. Excelente.</small>`;
        } else {
          pendientes.slice(0, 6).forEach((t) => {
            const cat = t.categoria ? `• ${t.categoria}` : "";
            const pr = t.prioridad ? `• ${t.prioridad}` : "";
            const emp = t.empleadoId ? `• DNI ${t.empleadoId}` : "• (sin asignar)";
            listaPend.innerHTML += `
          <div class="item-simple" style="align-items:flex-start;">
            <div class="item-info">
              <strong>📝 ${t.texto || "(sin texto)"}</strong><br>
              <small>${cat} ${pr} ${emp}</small>
            </div>
            <span class="chip-categoria">HOY</span>
          </div>
        `;
          });
        }

        // 3) Alertas 24h (query por productorId)
        const qA = query(
          collection(db, "alertas"),
          where("productorId", "==", productorId)
        );
        const sA = await getDocs(qA);

        let cant24 = 0;
        const alertas = [];
        sA.forEach((d) => {
          const a = d.data();
          const f = a.fecha || 0;
          if (f >= desde24) cant24++;
          alertas.push({ id: d.id, ...a });
        });

        elAl24.textContent = cant24;

        alertas.sort((a, b) => (b.fecha || 0) - (a.fecha || 0));
        listaAl.innerHTML = "";
        if (alertas.length === 0) {
          listaAl.innerHTML = `<small class="muted">Sin alertas todavía.</small>`;
        } else {
          alertas.slice(0, 6).forEach((a) => {
            const ft = a.fecha ? new Date(a.fecha).toLocaleString("es-AR") : "";
            listaAl.innerHTML += `
          <div class="item-simple" style="align-items:flex-start;">
            <div class="item-info">
              <strong>🚨 ${a.tipo || "Alerta"}</strong><br>
              <small>${a.descripcion || ""} • ${ft}</small>
            </div>
            <span class="chip-categoria">HOY</span>
          </div>
        `;
          });
        }

        // 4) Caminos “malos” hoy (complicado / intransitable)
        // OJO: caminos es read público, pero igual filtramos por productorId para HOY
        const qC = query(
          collection(db, "caminos"),
          where("productorId", "==", productorId)
        );
        const sC = await getDocs(qC);

        let malos = 0;
        sC.forEach((d) => {
          const c = d.data();
          const f = c.fecha || 0;
          const est = (c.estado || "").toString().toLowerCase();
          if (f >= inicioMs && (est === "complicado" || est === "intransitable")) malos++;
        });
        elCam.textContent = malos;

        // 5) Camiones offline (query por productorId)
        const qM = query(
          collection(db, "camiones"),
          where("productorId", "==", productorId)
        );
        const sM = await getDocs(qM);

        let off = 0;
        sM.forEach((d) => {
          const c = d.data();
          if (c.online === false) off++;
        });
        elOff.textContent = off;

        // mensaje OK
        const el = document.getElementById("hoyMsg");
        if (el) {
          el.textContent = "✅ HOY actualizado.";
          el.style.color = "#166534";
          setTimeout(() => (el.textContent = ""), 2500);
        }

      } catch (e) {
        console.error("Error actualizarHoy:", e);
        const el = document.getElementById("hoyMsg");
        if (el) {
          el.textContent = "❌ No se pudo actualizar HOY (permisos/índices).";
          el.style.color = "#b91c1c";
        }
      }
    }


    // ===============================
    // ✅ PARTE DIARIO + RACHA (streak)
    // Colección: partesDiarios
    // DocID: `${productorId}_${YYYYMMDD}`
    // ===============================
    function ymdKeyHoy() {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}${m}${day}`; // "20260304"
    }

    function setPdMsg(txt, ok = true) {
      const el = document.getElementById("pdMsg");
      if (!el) return;
      el.textContent = txt;
      el.style.color = ok ? "#166534" : "#b91c1c";
      setTimeout(() => (el.textContent = ""), 3500);
    }

    async function cargarParteHoyYActualizarRacha() {
      if (!productorId) return;

      const parteId = `${productorId}_${ymdKeyHoy()}`;
      const refHoy = doc(db, "partesDiarios", parteId);
      const snapHoy = await getDoc(refHoy);

      // Mostrar si ya existe parte hoy
      if (snapHoy.exists()) {
        const data = snapHoy.data();
        const ultimo = document.getElementById("pdUltimo");
        if (ultimo) {
          ultimo.textContent =
            `Hoy ✅ — ${data.estado || "normal"} — Lluvia: ${data.lluviaMm ?? 0} mm — ${data.nota || ""}`;
        }
      } else {
        const ultimo = document.getElementById("pdUltimo");
        if (ultimo) ultimo.textContent = "Hoy: pendiente ⏳ (completalo)";
      }

      // Calcular racha simple: buscamos hacia atrás hasta cortar
      let streak = 0;
      for (let i = 0; i < 365; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);

        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const key = `${y}${m}${day}`;

        const ref = doc(db, "partesDiarios", `${productorId}_${key}`);
        const s = await getDoc(ref);

        if (s.exists()) streak++;
        else break;
      }

      const elRacha = document.getElementById("pdRacha");
      if (elRacha) elRacha.textContent = `${streak} día(s)`;
    }

    async function guardarParteHoy() {
      try {
        if (!productorId) return;

        const lluviaMm = Number(document.getElementById("pdLluvia")?.value || 0);
        const estado = document.getElementById("pdEstado")?.value || "normal";
        const nota = (document.getElementById("pdNota")?.value || "").trim();

        const parteId = `${productorId}_${ymdKeyHoy()}`;

        await setDoc(doc(db, "partesDiarios", parteId), {
          productorId,
          fechaKey: ymdKeyHoy(),
          fechaMs: Date.now(),
          lluviaMm: isFinite(lluviaMm) ? lluviaMm : 0,
          estado,
          nota,
          createdAt: serverTimestamp(),
        }, { merge: true });

        setPdMsg("✅ Parte diario guardado.");
        await cargarParteHoyYActualizarRacha();
      } catch (e) {
        console.error(e);
        setPdMsg("❌ No se pudo guardar el parte (reglas/permisos).", false);
      }
    }

    function initParteDiario() {
      document.getElementById("btnGuardarParte")?.addEventListener("click", guardarParteHoy);
    }

    function initHoy() {
      const btn = document.getElementById("btnHoyRefrescar");
      btn?.addEventListener("click", actualizarHoy);

      // ✅ NUEVO
      initParteDiario();
      cargarParteHoyYActualizarRacha();

      // accesos rápidos (usa el nav existente)
      document.getElementById("btnHoyIrTareas")?.addEventListener("click", () => {
        document.querySelector('[data-target="sec-tareas"]')?.click();
      });
      document.getElementById("btnHoyIrCaminos")?.addEventListener("click", () => {
        document.querySelector('[data-target="sec-caminos"]')?.click();
      });
      document.getElementById("btnHoyIrAlertas")?.addEventListener("click", () => {
        document.querySelector('[data-target="sec-alertas"]')?.click();
      });
      document.getElementById("btnHoyIrCamiones")?.addEventListener("click", () => {
        document.querySelector('[data-target="sec-camiones"]')?.click();
      });
    }

    function initMapaSelectorPatrulla() {
      if (mapaSelectorPatrulla) {
        setTimeout(() => mapaSelectorPatrulla.invalidateSize(), 200);
        return;
      }

      const el = document.getElementById("mapSelectorPatrulla");
      if (!el || typeof L === "undefined") return;

      mapaSelectorPatrulla = L.map("mapSelectorPatrulla").setView([-33.1416, -59.3097], 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
      }).addTo(mapaSelectorPatrulla);

      mapaSelectorPatrulla.on("click", (e) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        const inputLat = document.getElementById("latPatrulla");
        const inputLng = document.getElementById("lngPatrulla");

        if (inputLat) inputLat.value = lat.toFixed(6);
        if (inputLng) inputLng.value = lng.toFixed(6);

        if (marcadorSelectorPatrulla) {
          marcadorSelectorPatrulla.setLatLng([lat, lng]);
        } else {
          marcadorSelectorPatrulla = L.marker([lat, lng]).addTo(mapaSelectorPatrulla);
        }

        marcadorSelectorPatrulla.bindPopup("📍 Punto de patrulla seleccionado").openPopup();
      });

      setTimeout(() => mapaSelectorPatrulla.invalidateSize(), 300);
    }

    function actualizarMapaSelectorPatrulla(lat, lng) {
      if (!mapaSelectorPatrulla || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

      if (marcadorSelectorPatrulla) {
        marcadorSelectorPatrulla.setLatLng([lat, lng]);
      } else {
        marcadorSelectorPatrulla = L.marker([lat, lng]).addTo(mapaSelectorPatrulla);
      }

      mapaSelectorPatrulla.setView([lat, lng], 15, { animate: true });
    }

    function initMapaPatrullaVivo() {
      if (mapaPatrullaVivo) {
        setTimeout(() => mapaPatrullaVivo.invalidateSize(), 200);
        return;
      }

      const el = document.getElementById("mapPatrullaVivo");
      if (!el || typeof L === "undefined") return;

      mapaPatrullaVivo = L.map("mapPatrullaVivo").setView([-33.1416, -59.3097], 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
      }).addTo(mapaPatrullaVivo);

      setTimeout(() => mapaPatrullaVivo.invalidateSize(), 300);
    }

    function actualizarMapaPatrullaVivo(data) {
      if (!mapaPatrullaVivo) initMapaPatrullaVivo();

      const lat = Number(data?.trackingLat ?? data?.lat);
      const lng = Number(data?.trackingLng ?? data?.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      if (marcadorPatrullaVivo) {
        marcadorPatrullaVivo.setLatLng([lat, lng]);
      } else {
        marcadorPatrullaVivo = L.marker([lat, lng]).addTo(mapaPatrullaVivo);
      }

      const motivo = String(data?.motivo || "Patrulla").replaceAll("_", " ");
      const estado = data?.estado || "sin_estado";
      const distancia = Math.round(Number(data?.distanciaM || 0));

      marcadorPatrullaVivo.bindPopup(`
    <b>🚓 ${motivo}</b><br>
    Estado: ${estado}<br>
    Distancia: ${distancia} m
  `);

      if (lineaRutaPatrullaVivo) {
        mapaPatrullaVivo.removeLayer(lineaRutaPatrullaVivo);
        lineaRutaPatrullaVivo = null;
      }

      if (Array.isArray(data?.rutaPts) && data.rutaPts.length > 1) {
        const puntos = data.rutaPts
          .filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)))
          .map(p => [Number(p.lat), Number(p.lng)]);

        if (puntos.length > 1) {
          lineaRutaPatrullaVivo = L.polyline(puntos, {
            weight: 4,
            opacity: 0.8
          }).addTo(mapaPatrullaVivo);

          const grupo = L.featureGroup([marcadorPatrullaVivo, lineaRutaPatrullaVivo]);
          mapaPatrullaVivo.fitBounds(grupo.getBounds(), { padding: [20, 20] });
          return;
        }
      }

      mapaPatrullaVivo.setView([lat, lng], 15, { animate: true });
    }

    async function renderPatrullaVivo(data) {
      const estadoEl = document.getElementById("estadoPatrullaVivo");
      const datosEl = document.getElementById("datosPatrullaVivo");

      if (!estadoEl || !datosEl) return;

      const estado = data?.estado || "sin_estado";
      const motivo = String(data?.motivo || "Patrulla").replaceAll("_", " ");
      const patrulleroDni = data?.patrulleroDni || "";
      const distancia = Math.round(Number(data?.distanciaM || 0));
      const campo = data?.nombreCampo || "Sin nombre";
      const prioridad = data?.prioridad || "media";
      const prioridadHtml =
        prioridad === "alta"
          ? `<span style="background:#fee2e2;color:#991b1b;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:800;">🔴 Alta</span>`
          : prioridad === "media"
            ? `<span style="background:#fef3c7;color:#92400e;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:800;">🟡 Media</span>`
            : `<span style="background:#dcfce7;color:#166534;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:800;">🟢 Baja</span>`;
      const etaMin = Number(data?.etaMin || 0);
      const observacionFinal = data?.observacionFinal || "Sin observaciones finales";
      const sugeridoPatrulleroDni = data?.sugeridoPatrulleroDni || "Sin sugerencia";
      const sugeridoDistanciaM = Number(data?.sugeridoDistanciaM || 0);
      const rechazadaPorDni = data?.rechazadaPorDni || "—";
      const motivoRechazo = data?.motivoRechazo || "—";

      let ultimaActTxt = "Sin actualización";
      if (Number.isFinite(data?.trackingUltimaActualizacionMs)) {
        ultimaActTxt = new Date(data.trackingUltimaActualizacionMs).toLocaleString("es-AR");
      }

      let patrulleroTexto = "Sin asignar";
      let telefonoPatrullero = "";

      if (patrulleroDni) {
        try {
          const empSnap = await getDoc(doc(db, "employees", patrulleroDni));
          if (empSnap.exists()) {
            const emp = empSnap.data();
            patrulleroTexto = `${emp?.nombre || "Sin nombre"} (${patrulleroDni})`;
            telefonoPatrullero = String(emp?.telefono || "").replace(/\D/g, "");
          } else {
            patrulleroTexto = patrulleroDni;
          }
        } catch (e) {
          console.error("Error leyendo empleado patrullero:", e);
          patrulleroTexto = patrulleroDni;
        }
      }

      estadoEl.textContent = `Estado: ${estado} • Motivo: ${motivo}`;


      datosEl.innerHTML = `
          <div><strong>Campo:</strong> ${campo}</div>
          <div><strong>Patrullero:</strong> ${patrulleroTexto}</div>
         <div><strong>Prioridad:</strong> ${prioridadHtml}</div>
          <div><strong>Distancia:</strong> ${distancia} m</div>
          <div><strong>ETA:</strong> ${etaMin ? `${etaMin} min` : "—"}</div>
          <div><strong>Última actualización:</strong> ${ultimaActTxt}</div>
          <div><strong>Observación final:</strong> ${observacionFinal}</div>
          <div><strong>Sugerido:</strong> ${sugeridoPatrulleroDni}</div>
          <div><strong>Distancia sugerida:</strong> ${sugeridoDistanciaM ? `${sugeridoDistanciaM} m` : "—"}</div>
          <div><strong>Rechazada por:</strong> ${rechazadaPorDni}</div>
          <div><strong>Motivo rechazo:</strong> ${motivoRechazo}</div>
        `;

      if (btnWhatsappPatrullero) {
        if (telefonoPatrullero) {
          const mensaje = encodeURIComponent(`Hola, te contacto desde Red Rural por la patrulla del campo ${campo}.`);
          btnWhatsappPatrullero.href = `https://wa.me/${telefonoPatrullero}?text=${mensaje}`;
          btnWhatsappPatrullero.style.pointerEvents = "auto";
          btnWhatsappPatrullero.style.opacity = "1";
        } else {
          btnWhatsappPatrullero.href = "#";
          btnWhatsappPatrullero.style.pointerEvents = "none";
          btnWhatsappPatrullero.style.opacity = ".6";
        }
      }

      actualizarMapaPatrullaVivo(data);
    }
    async function descargarInformePatrullaPDF(data) {
      try {
        if (!data) {
          alert("Primero seleccioná una patrulla.");
          return;
        }

        const { jsPDF } = window.jspdf;
        const docPdf = new jsPDF();

        const motivo = String(data?.motivo || "Patrulla").replaceAll("_", " ");
        const estado = data?.estado || "sin_estado";
        const prioridad = data?.prioridad || "media";
        const campo = data?.nombreCampo || "Sin nombre";
        const detalle = data?.detalle || "Sin detalle";
        const patrulleroDni = data?.patrulleroDni || "Sin asignar";
        const distancia = Math.round(Number(data?.distanciaM || 0));
        const observacionFinal = data?.observacionFinal || "Sin observaciones finales";

        let patrulleroNombre = "Sin asignar";
        let patrulleroTelefono = "";

        if (data?.patrulleroDni) {
          try {
            const empSnap = await getDoc(doc(db, "employees", data.patrulleroDni));
            if (empSnap.exists()) {
              const emp = empSnap.data();
              patrulleroNombre = emp?.nombre || patrulleroDni;
              patrulleroTelefono = emp?.telefono || "";
            } else {
              patrulleroNombre = patrulleroDni;
            }
          } catch (e) {
            console.error("Error leyendo empleado para PDF:", e);
            patrulleroNombre = patrulleroDni;
          }
        }

        const creadoEn = data?.creadoEn?.seconds
          ? new Date(data.creadoEn.seconds * 1000).toLocaleString("es-AR")
          : "Sin fecha";

        const finalizadaEn = data?.finalizadaEn?.seconds
          ? new Date(data.finalizadaEn.seconds * 1000).toLocaleString("es-AR")
          : "Sin finalizar";

        const inicioMs = data?.inicioMs ? new Date(data.inicioMs).toLocaleString("es-AR") : "Sin inicio";
        const finMs = data?.finMs ? new Date(data.finMs).toLocaleString("es-AR") : "Sin fin";

        let y = 20;

        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(16);
        docPdf.text("Informe de Patrulla Rural", 14, y);

        y += 10;
        docPdf.setFont("helvetica", "normal");
        docPdf.setFontSize(11);
        docPdf.text(`Fecha de emisión: ${new Date().toLocaleString("es-AR")}`, 14, y);

        y += 12;
        docPdf.setFont("helvetica", "bold");
        docPdf.text("Datos del servicio", 14, y);

        y += 8;
        docPdf.setFont("helvetica", "normal");
        docPdf.text(`Campo: ${campo}`, 14, y); y += 7;
        docPdf.text(`Motivo: ${motivo}`, 14, y); y += 7;
        docPdf.text(`Estado: ${estado}`, 14, y); y += 7;
        docPdf.text(`Prioridad: ${prioridad}`, 14, y); y += 7;
        docPdf.text(`Detalle: ${detalle}`, 14, y); y += 7;
        docPdf.text(`Fecha de solicitud: ${creadoEn}`, 14, y); y += 7;
        docPdf.text(`Inicio patrulla: ${inicioMs}`, 14, y); y += 7;
        docPdf.text(`Fin patrulla: ${finMs}`, 14, y); y += 7;
        docPdf.text(`Fecha finalización: ${finalizadaEn}`, 14, y); y += 7;
        docPdf.text(`Distancia recorrida: ${distancia} m`, 14, y);

        y += 10;
        docPdf.setFont("helvetica", "bold");
        docPdf.text("Datos del patrullero", 14, y);

        y += 8;
        docPdf.setFont("helvetica", "normal");
        docPdf.text(`Nombre: ${patrulleroNombre}`, 14, y); y += 7;
        docPdf.text(`DNI: ${patrulleroDni}`, 14, y); y += 7;
        docPdf.text(`Teléfono: ${patrulleroTelefono || "Sin teléfono"}`, 14, y);

        y += 10;
        docPdf.setFont("helvetica", "bold");
        docPdf.text("Observación final", 14, y);

        y += 8;
        docPdf.setFont("helvetica", "normal");

        const obsLines = docPdf.splitTextToSize(observacionFinal, 180);
        docPdf.text(obsLines, 14, y);
        y += obsLines.length * 7;

        y += 10;
        docPdf.setFontSize(10);
        docPdf.text("Documento generado automáticamente por Red Rural.", 14, y);

        const nombreArchivo = `informe_patrulla_${campo.replace(/\s+/g, "_")}_${Date.now()}.pdf`;
        docPdf.save(nombreArchivo);

      } catch (error) {
        console.error("Error generando PDF de patrulla:", error);
        alert("No se pudo generar el PDF.");
      }
    }

    async function renderHistorialPatrullas(lista) {
      if (!listaHistorialPatrullas) return;

      if (!Array.isArray(lista) || lista.length === 0) {
        listaHistorialPatrullas.innerHTML = `<small class="muted">No hay patrullas para mostrar.</small>`;
        return;
      }

      const htmlParts = [];

      for (const item of lista) {
        const motivo = String(item?.motivo || "Sin motivo").replaceAll("_", " ");
        const estado = item?.estado || "sin_estado";
        const campo = item?.nombreCampo || "Sin nombre";
        const distancia = Math.round(Number(item?.distanciaM || 0));
        const observacionFinal = item?.observacionFinal || "Sin observaciones finales";
        const prioridad = item?.prioridad || "media";
        const prioridadLabel =
          prioridad === "alta"
            ? "🔴 Alta"
            : prioridad === "media"
              ? "🟡 Media"
              : "🟢 Baja";
        const motivoRechazo = item?.motivoRechazo || "";
        const patrulleroDni = item?.patrulleroDni || "";

        let fechaTxt = "Sin fecha";
        if (item?.creadoEn?.seconds) {
          fechaTxt = new Date(item.creadoEn.seconds * 1000).toLocaleString("es-AR");
        }

        let patrulleroTexto = "Sin asignar";
        if (patrulleroDni) {
          try {
            const empSnap = await getDoc(doc(db, "employees", patrulleroDni));
            if (empSnap.exists()) {
              const emp = empSnap.data();
              patrulleroTexto = `${emp?.nombre || "Sin nombre"} (${patrulleroDni})`;
            } else {
              patrulleroTexto = patrulleroDni;
            }
          } catch (e) {
            console.error("Error leyendo empleado del historial:", e);
            patrulleroTexto = patrulleroDni;
          }
        }

        htmlParts.push(`
      <div class="item-patrulla" data-historial-id="${item.id}">
        <div class="item-patrulla-top">
          <strong>🚓 ${motivo}</strong>
          <span class="${getClaseEstadoPatrulla(estado)}">${getTextoEstadoPatrulla(estado)}</span>
        </div>

        <div style="margin-top:6px;"><small><strong>Campo:</strong> ${campo}</small></div>
        <div style="margin-top:4px;"><small><strong>Patrullero:</strong> ${patrulleroTexto}</small></div>
        <div style="margin-top:4px;"><small><strong>Prioridad:</strong> ${prioridadLabel}</small></div>
        <div style="margin-top:4px;"><small><strong>Distancia:</strong> ${distancia} m</small></div>
        <div style="margin-top:4px;"><small><strong>Observación:</strong> ${observacionFinal}</small></div>
       ${formatearResumenPatrullaFinalizada(item)}
       <div style="margin-top:4px;"><small><strong>Motivo rechazo:</strong> ${motivoRechazo || "—"}</small></div>
        <div style="margin-top:4px;"><small><strong>Fecha:</strong> ${fechaTxt}</small></div>

        <div class="fila" style="margin-top:10px;">
          <button class="btn-secundario btn-ver-patrulla" type="button">👁 Ver</button>
          <button class="btn-primario btn-pdf-patrulla-item" type="button">📄 PDF</button>
        </div>
      </div>
    `);
      }

      listaHistorialPatrullas.innerHTML = htmlParts.join("");

      const items = listaHistorialPatrullas.querySelectorAll(".item-patrulla");

      items.forEach((el) => {
        const id = el.getAttribute("data-historial-id");
        const data = lista.find(x => x.id === id);
        if (!data) return;

        const btnVer = el.querySelector(".btn-ver-patrulla");
        const btnPdf = el.querySelector(".btn-pdf-patrulla-item");

        btnVer?.addEventListener("click", async () => {
          solicitudPatrullaSeleccionadaId = id;
          solicitudPatrullaSeleccionadaData = data;
          await renderPatrullaVivo(data);
          initMapaPatrullaVivo();
          document.getElementById("sec-hoy")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });

        btnPdf?.addEventListener("click", async () => {
          await descargarInformePatrullaPDF(data);
        });
      });
    }

    function escucharHistorialPatrullas() {
      if (!productorId || !listaHistorialPatrullas) return;

      const q = query(
        collection(db, "solicitudesPatrulla"),
        where("productorId", "==", productorId)
      );

      onSnapshot(q, async (snap) => {
        const docs = [];

        snap.forEach((docSnap) => {
          docs.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });

        docs.sort((a, b) => {
          const aTime = a?.creadoEn?.seconds || 0;
          const bTime = b?.creadoEn?.seconds || 0;
          return bTime - aTime;
        });

        historialPatrullasCache = docs;
        await aplicarFiltrosHistorialPatrullas();
        await renderTableroOperativoPatrullas(docs);
      }, (error) => {
        console.error("Error al leer historial de patrullas:", error);
        listaHistorialPatrullas.innerHTML = `<small style="color:#b91c1c;">❌ No se pudo cargar el historial.</small>`;
      });
    }

    async function aplicarFiltrosHistorialPatrullas() {
      let lista = [...historialPatrullasCache];

      const campoTxt = (filtroPatrullaCampo?.value || "").trim().toLowerCase();
      const estadoSel = (filtroPatrullaEstado?.value || "").trim().toLowerCase();

      if (campoTxt) {
        lista = lista.filter(item =>
          String(item?.nombreCampo || "").toLowerCase().includes(campoTxt)
        );
      }

      if (estadoSel) {
        lista = lista.filter(item =>
          String(item?.estado || "").toLowerCase() === estadoSel
        );
      }

      await renderHistorialPatrullas(lista);
    }

    async function renderTableroOperativoPatrullas(lista) {
      if (!Array.isArray(lista)) lista = [];

      const pendientes = lista.filter(x => (x.estado || "pendiente") === "pendiente").length;
      const aceptadas = lista.filter(x => x.estado === "aceptada").length;
      const enCurso = lista.filter(x => x.estado === "en_curso").length;
      const finalizadas = lista.filter(x => x.estado === "finalizada").length;
      const urgentes = lista.filter(x =>
        (x.prioridad || "").toLowerCase() === "alta" &&
        ["pendiente", "asignada", "aceptada", "en_camino", "en_curso"].includes(x.estado || "")
      ).length;

      if (patrullasPendientesCount) patrullasPendientesCount.textContent = pendientes;
      if (patrullasAceptadasCount) patrullasAceptadasCount.textContent = aceptadas;
      if (patrullasEnCursoCount) patrullasEnCursoCount.textContent = enCurso;
      if (patrullasFinalizadasCount) patrullasFinalizadasCount.textContent = finalizadas;
      if (patrullasUrgentesCount) patrullasUrgentesCount.textContent = urgentes;

      if (!listaPatrullasActivas) return;

      const activas = lista
        .filter(x => ["asignada", "aceptada", "en_camino", "en_curso"].includes(x.estado || ""))
        .sort((a, b) => {
          const pa = (a.prioridad === "alta" ? 3 : a.prioridad === "media" ? 2 : 1);
          const pb = (b.prioridad === "alta" ? 3 : b.prioridad === "media" ? 2 : 1);

          if (pb !== pa) return pb - pa;

          const ta = a?.creadoEn?.seconds || 0;
          const tb = b?.creadoEn?.seconds || 0;
          return tb - ta;
        });

      if (activas.length === 0) {
        listaPatrullasActivas.innerHTML = `<small class="muted">No hay patrullas activas en este momento.</small>`;
        return;
      }

      const bloques = [];

      for (const item of activas) {
        const motivo = String(item?.motivo || "Sin motivo").replaceAll("_", " ");
        const campo = item?.nombreCampo || "Sin nombre";
        const estado = item?.estado || "sin_estado";
        const distancia = Math.round(Number(item?.distanciaM || 0));
        const patrulleroDni = item?.patrulleroDni || "";
        const prioridad = item?.prioridad || "media";
        const prioridadLabel =
          prioridad === "alta"
            ? "🔴 Alta"
            : prioridad === "media"
              ? "🟡 Media"
              : "🟢 Baja";
        let patrulleroTexto = "Sin asignar";
        if (patrulleroDni) {
          try {
            const empSnap = await getDoc(doc(db, "employees", patrulleroDni));
            if (empSnap.exists()) {
              const emp = empSnap.data();
              patrulleroTexto = `${emp?.nombre || "Sin nombre"} (${patrulleroDni})`;
            } else {
              patrulleroTexto = patrulleroDni;
            }
          } catch (e) {
            console.error("Error leyendo patrullero en tablero:", e);
            patrulleroTexto = patrulleroDni;
          }
        }

        bloques.push(`
      <div class="item-patrulla" data-activa-id="${item.id}">
        <div class="item-patrulla-top">
          <strong>🚓 ${motivo}</strong>
          <span class="${getClaseEstadoPatrulla(estado)}">${getTextoEstadoPatrulla(estado)}</span>
        </div>

        <div style="margin-top:6px;"><small><strong>Campo:</strong> ${campo}</small></div>
        <div style="margin-top:4px;"><small><strong>Patrullero:</strong> ${patrulleroTexto}</small></div>
        <div style="margin-top:4px;"><small><strong>Prioridad:</strong> ${prioridadLabel}</small></div>
        <div style="margin-top:4px;"><small><strong>Distancia:</strong> ${distancia} m</small></div>

        <div class="fila" style="margin-top:10px;">
          <button class="btn-secundario btn-ver-activa" type="button">👁 Ver en vivo</button>
        </div>
      </div>
    `);
      }

      listaPatrullasActivas.innerHTML = bloques.join("");

      const items = listaPatrullasActivas.querySelectorAll(".item-patrulla");

      items.forEach((el) => {
        const id = el.getAttribute("data-activa-id");
        const data = activas.find(x => x.id === id);
        if (!data) return;

        el.querySelector(".btn-ver-activa")?.addEventListener("click", async () => {
          solicitudPatrullaSeleccionadaId = id;
          solicitudPatrullaSeleccionadaData = data;
          await renderPatrullaVivo(data);
          initMapaPatrullaVivo();
          document.getElementById("sec-hoy")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });

      const criticas = lista
        .filter(x =>
          (x.prioridad || "").toLowerCase() === "alta" &&
          ["pendiente", "asignada", "aceptada", "en_camino", "en_curso"].includes(x.estado || "")
        )
        .sort((a, b) => {
          const ta = a?.creadoEn?.seconds || 0;
          const tb = b?.creadoEn?.seconds || 0;
          return tb - ta;
        });

      if (listaPatrullasCriticas) {
        if (!criticas.length) {
          listaPatrullasCriticas.innerHTML = `<small class="muted">Sin urgencias activas.</small>`;
        } else {
          listaPatrullasCriticas.innerHTML = criticas.map(item => `
              <div class="item-patrulla">
                <div class="item-patrulla-top">
                  <strong>🚨 ${String(item.motivo || "Patrulla").replaceAll("_", " ")}</strong>
                  <span class="${getClaseEstadoPatrulla(item.estado || "pendiente")}">${getTextoEstadoPatrulla(item.estado || "pendiente")}</span>
                </div>
                <div style="margin-top:6px;"><small><strong>Campo:</strong> ${item.nombreCampo || "Sin nombre"}</small></div>
                <div style="margin-top:4px;"><small><strong>Distancia sugerida:</strong> ${item.sugeridoDistanciaM ? `${item.sugeridoDistanciaM} m` : "—"}</small></div>
              </div>
            `).join("");
        }
      }
    }

    function distanciaMetros(lat1, lng1, lat2, lng2) {
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

    async function calcularPatrulleroMasCercano() {
      if (!solicitudPatrullaSeleccionadaData) {
        if (patrulleroCercanoBox) {
          patrulleroCercanoBox.innerHTML = `<small style="color:#b91c1c;">❌ Primero seleccioná una solicitud.</small>`;
        }
        return;
      }

      const latObj = Number(solicitudPatrullaSeleccionadaData?.lat);
      const lngObj = Number(solicitudPatrullaSeleccionadaData?.lng);

      if (!Number.isFinite(latObj) || !Number.isFinite(lngObj)) {
        patrulleroCercanoBox.innerHTML = `<small style="color:#b91c1c;">❌ La solicitud no tiene coordenadas válidas.</small>`;
        return;
      }

      patrulleroCercanoBox.innerHTML = `<small class="muted">Calculando patrullero más cercano...</small>`;

      try {
        const snap = await getDocs(query(
          collection(db, "empleados_tracking"),
          where("productorId", "==", productorId)
        ));

        const candidatos = [];

        snap.forEach((docSnap) => {
          const t = docSnap.data();
          const lat = Number(t?.lat);
          const lng = Number(t?.lng);

          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

          const d = distanciaMetros(latObj, lngObj, lat, lng);

          candidatos.push({
            id: docSnap.id,
            ...t,
            distanciaM: d
          });
        });

        if (!candidatos.length) {
          patrulleroMasCercanoData = null;
          patrulleroCercanoBox.innerHTML = `<small class="muted">No hay ubicaciones activas de empleados todavía.</small>`;
          return;
        }

        candidatos.sort((a, b) => a.distanciaM - b.distanciaM);
        const mejor = candidatos[0];
        patrulleroMasCercanoData = mejor;

        let nombre = mejor.empleadoDni || mejor.id;
        try {
          const empSnap = await getDoc(doc(db, "employees", mejor.empleadoDni || mejor.id));
          if (empSnap.exists()) {
            const emp = empSnap.data();
            nombre = `${emp?.nombre || nombre} (${mejor.empleadoDni || mejor.id})`;
          }
        } catch (e) {
          console.error("Error leyendo empleado cercano:", e);
        }

        patrulleroCercanoBox.innerHTML = `
              <div class="item-patrulla">
                <div class="item-patrulla-top">
                  <strong>👮 ${nombre}</strong>
                  <span class="estado-patrulla estado-aceptada">Más cercano</span>
                </div>
                <div style="margin-top:6px;"><small><strong>Distancia estimada:</strong> ${mejor.distanciaM} m</small></div>
                <div style="margin-top:4px;"><small><strong>Última actualización:</strong> ${new Date(mejor.updatedAt || Date.now()).toLocaleString("es-AR")}</small></div>
              </div>
            `;
      } catch (e) {
        console.error("Error calculando patrullero más cercano:", e);
        patrulleroMasCercanoData = null;
        patrulleroCercanoBox.innerHTML = `<small style="color:#b91c1c;">❌ No se pudo calcular el patrullero más cercano.</small>`;
      }
    }

    async function sugerirAsignacionPatrulla() {
      if (!solicitudPatrullaSeleccionadaId || !solicitudPatrullaSeleccionadaData) {
        alert("Primero seleccioná una solicitud.");
        return;
      }

      if (!patrulleroMasCercanoData) {
        alert("Primero calculá el patrullero más cercano.");
        return;
      }

      try {
        await updateDoc(doc(db, "solicitudesPatrulla", solicitudPatrullaSeleccionadaId), {
          sugeridoPatrulleroDni: patrulleroMasCercanoData.empleadoDni || patrulleroMasCercanoData.id,
          sugeridoDistanciaM: patrulleroMasCercanoData.distanciaM,
          sugeridoEn: serverTimestamp(),

          estado: "asignada",
          asignadoPatrulleroDni: patrulleroMasCercanoData.empleadoDni || patrulleroMasCercanoData.id,
          asignadoEn: serverTimestamp()
        });

        alert("✅ Sugerencia de asignación guardada.");
      } catch (e) {
        console.error("Error sugiriendo asignación:", e);
        alert("❌ No se pudo guardar la sugerencia.");
      }
    }

    function initPatrullas() {
      const btnPatrulla = document.getElementById("btnPatrulla");
      const formPatrulla = document.getElementById("formPatrulla");
      const btnEnviar = document.getElementById("enviarPatrulla");
      const msg = document.getElementById("msgPatrulla");
      const btnUbicacion = document.getElementById("btnUbicacionPatrulla");
      const inputLat = document.getElementById("latPatrulla");
      const inputLng = document.getElementById("lngPatrulla");
      const inputNombreCampo = document.getElementById("nombreCampoPatrulla");

      if (!btnPatrulla || !formPatrulla || !btnEnviar || !msg) return;

      btnPatrulla.addEventListener("click", () => {
        formPatrulla.classList.toggle("hidden-block");

        if (!formPatrulla.classList.contains("hidden-block")) {
          initMapaSelectorPatrulla();
        }
      });

      if (btnUbicacion) {
        btnUbicacion.addEventListener("click", () => {
          if (!navigator.geolocation) {
            msg.textContent = "❌ Tu navegador no permite geolocalización.";
            msg.style.color = "#b91c1c";
            return;
          }

          msg.textContent = "Obteniendo ubicación...";
          msg.style.color = "#14532d";

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              inputLat.value = pos.coords.latitude;
              inputLng.value = pos.coords.longitude;

              initMapaSelectorPatrulla();
              actualizarMapaSelectorPatrulla(pos.coords.latitude, pos.coords.longitude);

              msg.textContent = "✅ Ubicación cargada correctamente.";
              msg.style.color = "#166534";
            },


            (error) => {
              console.error("Error obteniendo ubicación:", error);
              msg.textContent = "❌ No se pudo obtener la ubicación.";
              msg.style.color = "#b91c1c";
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            }
          );
        });
      }

      if (inputLat && inputLng) {
        const syncMapaDesdeInputs = () => {
          const lat = Number(inputLat.value);
          const lng = Number(inputLng.value);

          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            initMapaSelectorPatrulla();
            actualizarMapaSelectorPatrulla(lat, lng);
          }
        };

        inputLat.addEventListener("change", syncMapaDesdeInputs);
        inputLng.addEventListener("change", syncMapaDesdeInputs);
      }

      btnEnviar.addEventListener("click", async () => {
        const motivo = document.getElementById("motivoPatrulla")?.value || "";
        const duracion = document.getElementById("duracionPatrulla")?.value || "";
        const detalle = document.getElementById("detallePatrulla")?.value?.trim() || "";
        const prioridad = document.getElementById("prioridadPatrulla").value;

        const nombreCampo = inputNombreCampo?.value?.trim() || "Campo sin nombre";
        const lat = Number(inputLat?.value);
        const lng = Number(inputLng?.value);

        if (!productorId) {
          msg.textContent = "❌ No se encontró el productor logueado.";
          msg.style.color = "#b91c1c";
          return;
        }

        try {
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            msg.textContent = "❌ Tenés que cargar la ubicación del lugar a patrullar.";
            msg.style.color = "#b91c1c";
            return;
          }
          msg.textContent = "Enviando solicitud...";
          msg.style.color = "#14532d";

          await addDoc(collection(db, "solicitudesPatrulla"), {
            productorId,
            motivo,
            duracionHoras: Number(duracion),
            detalle,
            prioridad,
            nombreCampo,
            lat,
            lng,
            estado: "pendiente",
            creadoEn: serverTimestamp()
          });

          msg.textContent = "✅ Solicitud de patrulla enviada correctamente.";
          msg.style.color = "#166534";

          document.getElementById("motivoPatrulla").value = "movimiento_sospechoso";
          document.getElementById("duracionPatrulla").value = "1";
          document.getElementById("detallePatrulla").value = "";
          inputNombreCampo.value = "";
          inputLat.value = "";
          inputLng.value = "";
          if (marcadorSelectorPatrulla && mapaSelectorPatrulla) {
            mapaSelectorPatrulla.removeLayer(marcadorSelectorPatrulla);
            marcadorSelectorPatrulla = null;
          }
          formPatrulla.classList.add("hidden-block");


        } catch (error) {
          console.error("Error al guardar solicitud de patrulla:", error);
          msg.textContent = "❌ No se pudo enviar la solicitud.";
          msg.style.color = "#b91c1c";
        }
      });

      if (btnCancelarPatrulla) {
        btnCancelarPatrulla.addEventListener("click", async () => {
          if (!solicitudPatrullaSeleccionadaId) {
            msg.textContent = "❌ Primero seleccioná una solicitud en 'Mis solicitudes de patrulla'.";
            msg.style.color = "#b91c1c";
            return;
          }

          const confirmar = confirm("¿Querés cancelar esta patrulla?");
          if (!confirmar) return;

          try {
            await updateDoc(doc(db, "solicitudesPatrulla", solicitudPatrullaSeleccionadaId), {
              estado: "cancelada",
              canceladaEn: serverTimestamp(),
              trackingActivo: false
            });

            msg.textContent = "✅ Patrulla cancelada correctamente.";
            msg.style.color = "#166534";
          } catch (e) {
            console.error("Error cancelando patrulla:", e);
            msg.textContent = "❌ No se pudo cancelar la patrulla.";
            msg.style.color = "#b91c1c";
          }


        });
      }

      if (btnPdfPatrulla) {
        btnPdfPatrulla.addEventListener("click", async () => {
          if (!solicitudPatrullaSeleccionadaData) {
            msg.textContent = "❌ Primero seleccioná una solicitud en 'Mis solicitudes de patrulla'.";
            msg.style.color = "#b91c1c";
            return;
          }

          await descargarInformePatrullaPDF(solicitudPatrullaSeleccionadaData);
        });
      }
      btnFiltrarHistorialPatrullas?.addEventListener("click", async () => {
        await aplicarFiltrosHistorialPatrullas();
      });

      btnLimpiarHistorialPatrullas?.addEventListener("click", async () => {
        if (filtroPatrullaCampo) filtroPatrullaCampo.value = "";
        if (filtroPatrullaEstado) filtroPatrullaEstado.value = "";
        await aplicarFiltrosHistorialPatrullas();
      });

      btnCalcularPatrulleroCercano?.addEventListener("click", async () => {
        await calcularPatrulleroMasCercano();
      });

      btnSugerirAsignacionPatrulla?.addEventListener("click", async () => {
        await sugerirAsignacionPatrulla();
      });
    }
    function getClaseEstadoPatrulla(estado) {
      const claseBase = getPatrullaEstadoClase(estado);
      const mapa = {
        "st-pendiente": "estado-patrulla estado-pendiente",
        "st-asignada": "estado-patrulla estado-aceptada",
        "st-aceptada": "estado-patrulla estado-aceptada",
        "st-en-camino": "estado-patrulla estado-aceptada",
        "st-en-curso": "estado-patrulla estado-en-curso",
        "st-finalizada": "estado-patrulla estado-finalizada",
        "st-cancelada": "estado-patrulla estado-cancelada",
        "st-default": "estado-patrulla estado-finalizada"
      };
      return mapa[claseBase] || "estado-patrulla estado-finalizada";
    }

    function getTextoEstadoPatrulla(estado) {
      return getPatrullaEstadoTexto(estado);
    }

    function formatearResumenPatrullaFinalizada(p) {
      if (!p || p.estado !== "finalizada") return "";

      const tipoNovedad = p.tipoNovedadFinal || "sin_novedad";
      const txtNovedad =
        tipoNovedad === "sin_novedad"
          ? "✅ Sin novedad"
          : tipoNovedad === "novedad_menor"
            ? "⚠️ Novedad menor"
            : "🚨 Incidencia grave";

      const observacion = (p.observacionFinal || "").trim() || "Sin observación";
      const alertaExtra =
        tipoNovedad === "incidencia_grave"
          ? `<div style="margin-top:8px;padding:10px;border-radius:10px;background:#fee2e2;color:#991b1b;font-weight:800;">🚨 Incidencia grave detectada</div>`
          : "";

      const resumenBase = formatPatrullaResumenFinalizada({
        ...p,
        patrulleroNombre: p.patrulleroNombre,
        patrulleroDni: p.patrulleroDni,
        distanciaM: Number(p.distanciaKm || 0) * 1000,
        duracionMin: p.duracionMin || 0,
      });

      return `
    <div style="margin-top:10px;padding:10px;border:1px solid #d1d5db;border-radius:10px;background:#f8fafc;">
      <div style="font-weight:700;margin-bottom:6px;">📋 Resumen</div>
      <div><small><b>Cierre:</b> ${txtNovedad}</small></div>
      <div><small><b>Observación:</b> ${observacion}</small></div>
      <div><small><b>Base:</b> ${resumenBase}</small></div>
      <div><small><b>Total:</b> $${(p.importeTotal || 0).toLocaleString("es-AR")}</small></div>
      ${alertaExtra}
    </div>
  `;
    }

    function escucharSolicitudesPatrulla() {
      const cont = document.getElementById("listaSolicitudesPatrulla");
      if (!cont || !productorId) return;

      const q = query(
        collection(db, "solicitudesPatrulla"),
        where("productorId", "==", productorId)
      );

      onSnapshot(q, (snap) => {
        if (snap.empty) {
          cont.innerHTML = `<small class="muted">Todavía no hay solicitudes cargadas.</small>`;

          return;
        }

        const docs = [];
        snap.forEach(docSnap => {
          docs.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });

        docs.sort((a, b) => {
          const aTime = a?.creadoEn?.seconds || 0;
          const bTime = b?.creadoEn?.seconds || 0;
          return bTime - aTime;
        });

        cont.innerHTML = docs.map(item => {
          const motivo = item.motivo || "Sin motivo";
          const detalle = item.detalle || "Sin detalle";
          const duracion = item.duracionHoras || "-";
          const estado = item.estado || "pendiente";
          const prioridad = item.prioridad || "media";
          const estadoClase = getClaseEstadoPatrulla(estado);
          const estadoTexto = getTextoEstadoPatrulla(estado);

          let fechaTxt = "Sin fecha";
          if (item?.creadoEn?.seconds) {
            fechaTxt = new Date(item.creadoEn.seconds * 1000).toLocaleString("es-AR");
          }

          return `
  <div class="item-patrulla" data-solicitud-id="${item.id}">
          <div class="item-patrulla-top">
            <strong>🚓 ${motivo.replaceAll("_", " ")}</strong>
            <span class="${estadoClase}">${estadoTexto}</span>
          </div>

          <div style="margin-top:6px;">
            <small><strong>Duración:</strong> ${duracion} h</small>
          </div>

          <div style="margin-top:4px;">
            <small><strong>Detalle:</strong> ${detalle}</small>
          </div>

          <div style="margin-top:4px;">
            <small><strong>Prioridad:</strong> ${prioridad}</small>
          </div>

          <div style="margin-top:4px;">
            <small><strong>Fecha:</strong> ${fechaTxt}</small>
          </div>
        </div>
      `;


        }).join("");
        const items = cont.querySelectorAll(".item-patrulla");

        items.forEach((el) => {
          el.addEventListener("click", () => {
            const id = el.getAttribute("data-solicitud-id");
            const data = docs.find(d => d.id === id);
            if (!data) return;

            solicitudPatrullaSeleccionadaId = id;
            solicitudPatrullaSeleccionadaData = data;

            renderPatrullaVivo(data);
            initMapaPatrullaVivo();
          });
        });
        if (solicitudPatrullaSeleccionadaId) {
          const actual = docs.find(d => d.id === solicitudPatrullaSeleccionadaId);
          if (actual) {
            solicitudPatrullaSeleccionadaData = actual;
            renderPatrullaVivo(actual);
          }
        }
      }, (error) => {
        console.error("Error al leer solicitudes de patrulla:", error);
        cont.innerHTML = `<small style="color:#b91c1c;">❌ No se pudieron cargar las solicitudes.</small>`;
      });
    }
    // =========================
    // 2) NAVEGACIÓN ENTRE SECCIONES
    // =========================
    function navegar() {
      const botones = document.querySelectorAll(".nav-btn");
      const secciones = document.querySelectorAll("section");

      botones.forEach(btn => {
        btn.addEventListener("click", () => {
          const target = btn.dataset.target;

          botones.forEach(b => b.classList.remove("activo"));
          btn.classList.add("activo");

          secciones.forEach(sec => {
            if (sec.id === target) {
              sec.classList.remove("hidden");
              setTimeout(() => sec.classList.add("visible"), 10);
            } else {
              sec.classList.remove("visible");
              setTimeout(() => sec.classList.add("hidden"), 150);
            }
          });

          // Mapas
          if (target === "sec-marcaciones-online") {
            setTimeout(() => {
              initMapaMarcaciones();
              actualizarMarcacionesMapa();
              if (mapaMarcaciones) mapaMarcaciones.invalidateSize();
            }, 200);
          }

          if (target === "sec-caminos") {
            setTimeout(() => {
              initMapaCaminos();
              if (mapaCaminos) mapaCaminos.invalidateSize();
            }, 200);
          }

          if (target === "sec-camiones") {
            setTimeout(() => {
              initMapaCamiones();
              if (mapaCamiones) mapaCamiones.invalidateSize();
            }, 200);
          }

          if (target === "sec-hoy") {
            setTimeout(() => {
              actualizarHoy();
              cargarParteHoyYActualizarRacha();
            }, 150);
          }
        });
      });

      // estado inicial
      secciones.forEach(sec => sec.classList.add("hidden"));
      const primera = document.getElementById("sec-hoy");
      primera.classList.remove("hidden");
      primera.classList.add("visible");
    }
    navegar();

    let viajesCache = []; // [{id, ...data}]

    function msInicioDia(dateStr) {
      // dateStr: "YYYY-MM-DD"
      if (!dateStr) return null;
      const [y, m, d] = dateStr.split("-").map(Number);
      return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
    }
    function msFinDia(dateStr) {
      if (!dateStr) return null;
      const [y, m, d] = dateStr.split("-").map(Number);
      return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
    }
    function fmtMinutos(min) {
      if (!isFinite(min) || min < 0) return "—";
      const h = Math.floor(min / 60);
      const m = Math.round(min % 60);
      return h > 0 ? `${h} h ${m} min` : `${m} min`;
    }

    function renderViajes(lista, listaViajesEl, resumenEl) {
      listaViajesEl.innerHTML = "";

      if (!lista.length) {
        resumenEl.textContent = "Sin recorridos para ese filtro.";
        return;
      }

      // resumen
      const totalKm = lista.reduce((acc, v) => acc + (Number(v.distanciaM) || 0), 0) / 1000;
      const totalMin = lista.reduce((acc, v) => {
        const ini = Number(v.inicioMs) || 0;
        const fin = Number(v.finMs) || 0;
        if (!ini || !fin || fin <= ini) return acc;
        return acc + (fin - ini) / 60000;
      }, 0);

      resumenEl.textContent = `Mostrando ${lista.length} recorrido(s) — Total: ${totalKm.toFixed(2)} km — Tiempo: ${fmtMinutos(totalMin)}`;

      // lista
      lista.forEach((v) => {
        const iniTxt = v.inicioMs ? new Date(v.inicioMs).toLocaleString("es-AR") : "—";
        const finTxt = v.finMs ? new Date(v.finMs).toLocaleString("es-AR") : "—";
        const durMin = (v.inicioMs && v.finMs && v.finMs > v.inicioMs) ? (v.finMs - v.inicioMs) / 60000 : null;

        listaViajesEl.innerHTML += `
      <div class="item-simple viaje-item">
  <div class="item-info viaje-info">
    <strong>🚚 ${v.camionId || "—"}</strong><br>
    <small>Chofer DNI: ${v.empleadoDni || "—"}</small><br>
    <small>Inicio: ${iniTxt}</small><br>
    <small>Fin: ${finTxt}</small><br>
    <small><b>Distancia:</b> ${fmtKm(v.distanciaM)} km</small><br>
    <small><b>Tiempo:</b> ${durMin != null ? fmtMinutos(durMin) : "—"}</small>
  </div>

  <div class="item-acciones viaje-acciones">
    <button class="btn-secundario" data-verviaje="${v.id}">Ver ruta</button>
    <button class="btn-mini" data-pdfviaje="${v.id}">📄 Exportar PDF</button>
  </div>

      </div>
    `;
      });
    }

    function exportarViajePDF(v) {
      // jsPDF UMD
      const { jsPDF } = window.jspdf || {};
      if (!jsPDF) {
        alert("No se cargó jsPDF. Revisá que agregaste el <script> de jsPDF.");
        return;
      }

      const docp = new jsPDF();
      const iniTxt = v.inicioMs ? new Date(v.inicioMs).toLocaleString("es-AR") : "—";
      const finTxt = v.finMs ? new Date(v.finMs).toLocaleString("es-AR") : "—";
      const km = (Number(v.distanciaM) || 0) / 1000;
      const durMin = (v.inicioMs && v.finMs && v.finMs > v.inicioMs) ? (v.finMs - v.inicioMs) / 60000 : null;

      docp.setFontSize(14);
      docp.text("Red Rural — Recorrido de camión", 14, 18);

      docp.setFontSize(11);
      docp.text(`Patente / Camión: ${v.camionId || "—"}`, 14, 30);
      docp.text(`Chofer DNI: ${v.empleadoDni || "—"}`, 14, 37);
      docp.text(`Inicio: ${iniTxt}`, 14, 44);
      docp.text(`Fin: ${finTxt}`, 14, 51);
      docp.text(`Distancia: ${km.toFixed(2)} km`, 14, 58);
      docp.text(`Tiempo: ${durMin != null ? fmtMinutos(durMin) : "—"}`, 14, 65);

      const pts = Array.isArray(v.rutaPts) ? v.rutaPts.length : 0;
      docp.text(`Puntos de ruta: ${pts}`, 14, 72);

      // mini resumen de primer/último punto
      const p1 = v.rutaPts?.[0];
      const p2 = v.rutaPts?.[v.rutaPts?.length - 1];
      if (p1 && p2) {
        docp.text(`Inicio GPS: ${Number(p1.lat).toFixed(5)}, ${Number(p1.lng).toFixed(5)}`, 14, 82);
        docp.text(`Fin GPS: ${Number(p2.lat).toFixed(5)}, ${Number(p2.lng).toFixed(5)}`, 14, 89);
      }

      docp.save(`recorrido_${v.camionId || "camion"}_${v.id}.pdf`);
    }

    function aplicarFiltrosYRender(listaViajesEl, resumenEl) {
      const patente = (document.getElementById("filtroPatente")?.value || "").trim();
      const desde = document.getElementById("filtroDesde")?.value || "";
      const hasta = document.getElementById("filtroHasta")?.value || "";

      const desdeMs = msInicioDia(desde);
      const hastaMs = msFinDia(hasta);

      let filtrados = [...viajesCache];

      if (patente) filtrados = filtrados.filter(v => (v.camionId || "") === patente);

      if (desdeMs != null) filtrados = filtrados.filter(v => (Number(v.inicioMs) || 0) >= desdeMs);
      if (hastaMs != null) filtrados = filtrados.filter(v => (Number(v.inicioMs) || 0) <= hastaMs);

      renderViajes(filtrados, listaViajesEl, resumenEl);
    }

    function escucharViajesCamiones() {
      if (!productorId) return;

      const msgViajes = document.getElementById("msgViajes");
      const listaViajes = document.getElementById("listaViajes");
      const resumenEl = document.getElementById("resumenViajes");

      if (!msgViajes || !listaViajes || !resumenEl) return;

      msgViajes.style.color = "#4b5563";
      msgViajes.textContent = "Cargando recorridos...";

      // botones filtro (una sola vez)
      document.getElementById("btnAplicarFiltrosViajes")?.addEventListener("click", () => {
        aplicarFiltrosYRender(listaViajes, resumenEl);
      });
      document.getElementById("btnLimpiarFiltrosViajes")?.addEventListener("click", () => {
        const fp = document.getElementById("filtroPatente");
        const fd = document.getElementById("filtroDesde");
        const fh = document.getElementById("filtroHasta");
        if (fp) fp.value = "";
        if (fd) fd.value = "";
        if (fh) fh.value = "";
        aplicarFiltrosYRender(listaViajes, resumenEl);
      });

      const qV = query(
        collection(db, "viajes_camiones"),
        where("productorId", "==", productorId),
        orderBy("inicioMs", "desc")
      );

      onSnapshot(qV, (snap) => {
        if (snap.empty) {
          viajesCache = [];
          msgViajes.textContent = "Todavía no hay recorridos guardados.";
          resumenEl.textContent = "";
          listaViajes.innerHTML = "";
          return;
        }

        msgViajes.textContent = `Recorridos: ${snap.size}`;

        viajesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // render inicial (sin filtros o con filtros actuales)
        aplicarFiltrosYRender(listaViajes, resumenEl);

        // delegación de eventos: ver ruta + pdf
        listaViajes.onclick = (e) => {
          const btnRuta = e.target.closest("button[data-verviaje]");
          const btnPdf = e.target.closest("button[data-pdfviaje]");

          if (btnRuta) {
            const id = btnRuta.getAttribute("data-verviaje");
            const v = viajesCache.find(x => x.id === id);
            if (!v) return;
            dibujarRutaGuardadaEnMapa(v);
            return;
          }

          if (btnPdf) {
            const id = btnPdf.getAttribute("data-pdfviaje");
            const v = viajesCache.find(x => x.id === id);
            if (!v) return;
            exportarViajePDF(v);
            return;
          }
        };
      }, (err) => {
        console.error("Snapshot viajes:", err);
        msgViajes.style.color = "#b91c1c";
        msgViajes.textContent = "Error cargando recorridos (reglas/índices).";
      });
    }
    // =========================
    // 3) INICIO DEL PANEL
    // =========================
    function iniciarPanel() {
      cargarEmpleados();
      escucharTareas();
      escucharMarcacionesOnline();
      escucharVecinos();
      escucharVecinosParaAlertas();
      escucharAlertas();

      // ✅ AHORA sí (porque ya existe la función global)
      escucharCamiones();
      escucharViajesCamiones();
      initCalculadora();
      initClima();
      initHoy();
      initPatrullas();
      initMapaPatrullaVivo();
      escucharSolicitudesPatrulla();
      escucharHistorialPatrullas();
      actualizarHoy();
      limpiarRutaGuardada();
      initGestion(); // ✅ nuevo
      setTimeout(() => {
        initMapaMarcaciones();
        initMapaCaminos();
      }, 300);

      setTimeout(() => marcarChipActivo("filtroTodos"), 350);

      document.getElementById("btnLimpiarRuta")?.addEventListener("click", () => {
        limpiarRutaGuardada();
      });
      document.getElementById("caminoEstado").dispatchEvent(new Event("change"));
    }
    /* ============================================================
   🚚 CAMIONES (TRACKING REALTIME)
   ============================================================ */
    let mapaCamiones = null;
    // ✅ Capa para “ruta guardada” (recorrido histórico seleccionado)
    let capaRutaGuardada = null;
    let polyRutaGuardada = null;
    let markerInicio = null;
    let markerFin = null;
    let capaCamiones = null;
    const markersCamiones = new Map(); // camionId -> marker
    // 🧭 RUTAS (recorrido) por camión
    let capaRutasCamiones = null;

    // camionId -> { latlngs: [ [lat,lng], ... ], polyline: L.Polyline }
    const rutasCamiones = new Map();

    // (opcional) para no llenar de puntos si manda muy seguido
    const UMBRAL_METROS_RUTA = 20;     // agrega punto si se movió +20m
    const MAX_PUNTOS_RUTA = 800;       // límite por camión (performance)


    function initMapaCamiones() {
      // ✅ si el div no está, salimos sin romper
      const mapDiv = document.getElementById("mapCamiones");
      if (!mapDiv) return;

      if (mapaCamiones) return;

      mapaCamiones = L.map("mapCamiones").setView([-33, -59.3], 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapaCamiones);

      // ✅ primero rutas, después marcadores (para que el marker quede arriba)
      capaRutasCamiones = L.layerGroup().addTo(mapaCamiones);
      capaCamiones = L.layerGroup().addTo(mapaCamiones);
      // ✅ capa para ruta guardada (arriba del tile, debajo de markers)
      if (!capaRutaGuardada) capaRutaGuardada = L.layerGroup().addTo(mapaCamiones);
    }
    function renderCamionItem(c) {
      const upd = c.lastSeen ? new Date(c.lastSeen).toLocaleString("es-AR") : "—";
      const onlineTxt = c.online ? "🟢 Online" : "🔴 Offline";
      const accTxt = (c.accuracy != null) ? `• ±${c.accuracy}m` : "";
      return `
    <div class="item-simple">
      <div class="item-info">
        <strong>🚚 ${c.camionId ?? "(sin ID)"}</strong><br>
        <small>Chofer DNI: ${c.empleadoDni ?? "—"}</small><br>
        <small>${onlineTxt} • Último ping: ${upd} ${accTxt}</small>
      </div>
      <button class="btn-secundario" data-zoom="${c.camionId ?? ""}">Ver</button>
    </div>
  `;
    }

    function distMetros(lat1, lng1, lat2, lng2) {
      // Haversine
      const R = 6371000;
      const toRad = (x) => (x * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    function upsertRutaCamion(camionId, lat, lng) {
      if (!mapaCamiones || !capaRutasCamiones) return;

      const key = camionId;
      if (!rutasCamiones.has(key)) {
        const latlngs = [[lat, lng]];
        const poly = L.polyline(latlngs, {
          weight: 4,
          opacity: 0.9
        }).addTo(capaRutasCamiones);

        rutasCamiones.set(key, { latlngs, polyline: poly });
        return;
      }

      const obj = rutasCamiones.get(key);
      const last = obj.latlngs[obj.latlngs.length - 1];
      const d = distMetros(last[0], last[1], lat, lng);

      // ✅ evita agregar puntos “pegados” (ruido GPS)
      if (d < UMBRAL_METROS_RUTA) return;

      obj.latlngs.push([lat, lng]);

      // ✅ límite por rendimiento
      if (obj.latlngs.length > MAX_PUNTOS_RUTA) {
        obj.latlngs.splice(0, obj.latlngs.length - MAX_PUNTOS_RUTA);
      }

      obj.polyline.setLatLngs(obj.latlngs);
    }

    function borrarRutaCamion(camionId) {
      const obj = rutasCamiones.get(camionId);
      if (!obj) return;
      if (capaRutasCamiones) capaRutasCamiones.removeLayer(obj.polyline);
      rutasCamiones.delete(camionId);
    }

    function upsertMarkerCamion(c) {
      if (!mapaCamiones || !capaCamiones) return;

      const camionId = c.camionId;
      if (!camionId) return;

      if (typeof c.lat !== "number" || typeof c.lng !== "number") return;

      // ✅ dibujar recorrido
      upsertRutaCamion(camionId, c.lat, c.lng);

      const popup = `
    <b>🚚 ${camionId}</b><br>
    Chofer: ${c.empleadoDni ?? "—"}<br>
    Estado: ${c.online ? "🟢 Online" : "🔴 Offline"}<br>
    Precisión: ${c.accuracy ?? "—"} m
  `;

      if (markersCamiones.has(camionId)) {
        const m = markersCamiones.get(camionId);
        m.setLatLng([c.lat, c.lng]);
        m.setPopupContent(popup);
      } else {
        const m = L.marker([c.lat, c.lng]).addTo(capaCamiones);
        m.bindPopup(popup);
        markersCamiones.set(camionId, m);
      }
    }

    function limpiarMarkersNoPresentes(setIdsActuales) {
      for (const [id, marker] of markersCamiones.entries()) {
        if (!setIdsActuales.has(id)) {
          capaCamiones.removeLayer(marker);
          markersCamiones.delete(id);

          // ✅ borrar ruta también
          borrarRutaCamion(id);
        }
      }
    }

    function fmtKm(m) {
      const km = (m || 0) / 1000;
      return km.toFixed(2).replace(".", ",");
    }
    // ============================================================
    // 🚨 ALERTA AUTOMÁTICA: CAMIÓN DETENIDO
    // ============================================================
    const STOP_MIN_MS = 15 * 60 * 1000;     // 15 minutos detenido (ajustable)
    const STOP_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutos de cooldown por camión
    const SPEED_MOVING_MS = 1.0;            // >1 m/s (~3.6 km/h) lo considero "moviendo"
    const MIN_MOVE_METERS = 35;             // si se mueve >35m, lo considero "moviendo"

    const lastPosByCamion = new Map();      // camionId -> {lat,lng}
    const lastMoveAtByCamion = new Map();   // camionId -> ms
    function keyStopAlert(camionId) {
      return `RR_STOP_ALERT_${productorId || "noProd"}_${camionId}`;
    }

    function yaSeAlertoReciente(camionId, nowMs) {
      const k = keyStopAlert(camionId);
      const last = Number(localStorage.getItem(k) || 0);
      return last && (nowMs - last) < STOP_COOLDOWN_MS;
    }

    function marcarAlerta(camionId, nowMs) {
      localStorage.setItem(keyStopAlert(camionId), String(nowMs));
    }

    async function chequearCamionDetenido(c) {
      // c = doc.data() de "camiones"
      const camionId = c.camionId;
      if (!camionId) return;

      // si está offline, no dispares (es normal)
      if (!c.online) return;

      // tomamos como referencia el último ping real
      const nowMs = Number(c.lastSeen) || Date.now();

      // 1) detectamos si "se movió" por velocidad o por distancia
      const speed = (typeof c.speed === "number") ? c.speed : null;

      let seMueve = false;

      if (speed != null && speed > SPEED_MOVING_MS) seMueve = true;

      const prev = lastPosByCamion.get(camionId);
      if (prev && typeof c.lat === "number" && typeof c.lng === "number") {
        const d = distMetros(prev.lat, prev.lng, c.lat, c.lng);
        if (d > MIN_MOVE_METERS) seMueve = true;
      }

      // actualizar caches
      if (typeof c.lat === "number" && typeof c.lng === "number") {
        lastPosByCamion.set(camionId, { lat: c.lat, lng: c.lng });
      }

      if (seMueve) {
        lastMoveAtByCamion.set(camionId, nowMs);
        return; // si se mueve, no es detenido
      }

      // si no se movió, calculamos hace cuánto fue el último movimiento
      const lastMove = lastMoveAtByCamion.get(camionId) || nowMs;
      const detenidoMs = nowMs - lastMove;

      // si todavía no pasó el umbral, no hacemos nada
      if (detenidoMs < STOP_MIN_MS) return;

      // evitar spam
      if (yaSeAlertoReciente(camionId, nowMs)) return;

      // armamos descripción
      const min = Math.round(detenidoMs / 60000);
      const chofer = c.empleadoDni ? `DNI ${c.empleadoDni}` : "—";
      const desc = `🚚 Camión ${camionId} detenido hace ${min} min. Chofer: ${chofer}. Último ping: ${new Date(nowMs).toLocaleString("es-AR")}`;

      try {
        await guardarAlertaFirestore("Camión detenido", desc);
        marcarAlerta(camionId, nowMs);
        console.log("✅ Alerta automática guardada:", desc);
      } catch (e) {
        console.warn("⚠️ No pude guardar alerta automática:", e);
      }
    }
    function escucharCamiones() {
      if (!productorId) return;

      const msgCamiones = document.getElementById("msgCamiones");
      const listaCamiones = document.getElementById("listaCamiones");

      // ✅ Guard: si no existe la sección, no rompas
      if (!msgCamiones || !listaCamiones) {
        console.warn("Faltan elementos de Camiones (msgCamiones/listaCamiones).");
        return;
      }

      const qC = query(collection(db, "camiones"), where("productorId", "==", productorId));

      onSnapshot(qC, (snap) => {
        initMapaCamiones();

        listaCamiones.innerHTML = "";
        msgCamiones.style.color = "#4b5563";

        if (snap.empty) {
          msgCamiones.textContent = "No hay camiones transmitiendo todavía.";
          if (capaCamiones) capaCamiones.clearLayers();
          markersCamiones.clear();
          return;
          if (capaRutasCamiones) capaRutasCamiones.clearLayers();
          rutasCamiones.clear();

        }

        const idsActuales = new Set();
        const camiones = [];

        snap.forEach((d) => {
          const c = d.data();
          camiones.push(c);
          if (c.camionId) idsActuales.add(c.camionId);
          upsertMarkerCamion(c);
          // ✅ ALERTA automática por camión detenido
          chequearCamionDetenido(c);
        });

        limpiarMarkersNoPresentes(idsActuales);

        camiones
          .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
          .forEach((c) => {
            listaCamiones.innerHTML += renderCamionItem(c);
          });

        msgCamiones.textContent = `Camiones encontrados: ${camiones.length}`;

        listaCamiones.querySelectorAll("button[data-zoom]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-zoom");
            const marker = markersCamiones.get(id);
            if (!marker) return;
            mapaCamiones.setView(marker.getLatLng(), 16, { animate: true });
            marker.openPopup();
          });
        });

        // ✅ poblar selector de patentes (si existe)
        const sel = document.getElementById("filtroPatente");
        if (sel) {
          const actual = sel.value;
          const patentes = snap.docs.map(d => d.id).sort();

          sel.innerHTML = `<option value="">🚚 Todas las patentes</option>` + patentes
            .map(p => `<option value="${p}">${p}</option>`)
            .join("");

          // mantener selección si estaba
          if (patentes.includes(actual)) sel.value = actual;
        }


      }, (err) => {
        console.error("Snapshot camiones:", err);
        msgCamiones.style.color = "#b91c1c";
        msgCamiones.textContent = "Error escuchando camiones (permisos/reglas/índices).";
      });
    }

    function limpiarRutaGuardada() {
      if (!capaRutaGuardada) return;
      capaRutaGuardada.clearLayers();
      polyRutaGuardada = null;
      markerInicio = null;
      markerFin = null;
    }

    function dibujarRutaGuardadaEnMapa(viaje) {
      initMapaCamiones();
      if (!mapaCamiones || !capaRutaGuardada) return;

      limpiarRutaGuardada();

      const ruta = Array.isArray(viaje.rutaPts) ? viaje.rutaPts : (Array.isArray(viaje.ruta) ? viaje.ruta : []);

      if (ruta.length < 2) {
        alert("Este recorrido no tiene suficientes puntos para dibujar.");
        return;
      }

      // ruta guardada viene como: [{lat,lng,t}, ...]
      const latlngs = ruta
        .filter(p => typeof p.lat === "number" && typeof p.lng === "number")
        .map(p => [p.lat, p.lng]);

      if (latlngs.length < 2) {
        alert("Recorrido inválido.");
        return;
      }

      // ✅ Polyline del recorrido guardado
      polyRutaGuardada = L.polyline(latlngs, {
        weight: 5,
        opacity: 0.95,
        dashArray: "10 8" // se distingue del tracking en vivo
      }).addTo(capaRutaGuardada);

      // ✅ Inicio y fin
      const ini = latlngs[0];
      const fin = latlngs[latlngs.length - 1];

      markerInicio = L.circleMarker(ini, { radius: 7, weight: 2 }).addTo(capaRutaGuardada);
      markerFin = L.circleMarker(fin, { radius: 7, weight: 2 }).addTo(capaRutaGuardada);

      const km = viaje.distanciaM ? (viaje.distanciaM / 1000) : null;

      markerInicio.bindPopup(`🟢 Inicio<br>🚚 ${viaje.camionId || "—"}<br>👤 DNI: ${viaje.empleadoDni || "—"}`);
      markerFin.bindPopup(`🔴 Fin<br>${km != null ? `📏 ${km.toFixed(2)} km` : ""}`);

      // ✅ Zoom automático a toda la ruta
      mapaCamiones.fitBounds(polyRutaGuardada.getBounds(), { padding: [20, 20] });

      // opcional: abrir popup inicio
      markerInicio.openPopup();
    }
    /* ============================================================
       EMPLEADOS (FIREBASE)
    ============================================================ */
    const msgEmpleado = document.getElementById("msgEmpleado");
    const listaEmpleados = document.getElementById("listaEmpleados");

    async function cargarEmpleados() {
      if (!productorId) return;

      listaEmpleados.innerHTML = "<small>Cargando...</small>";

      const ref = collection(db, "employees");
      const q = query(ref, where("productorId", "==", productorId));
      const snap = await getDocs(q);

      listaEmpleados.innerHTML = "";
      if (snap.empty) {
        listaEmpleados.innerHTML = "<small>No hay empleados cargados.</small>";
      }

      snap.forEach(s => {
        const e = s.data();
        const item = document.createElement("div");
        item.className = "item-simple";

        item.innerHTML = `
          <div class="item-info">
            <strong>👷 ${e.dni}</strong><br>
            <small>${e.nombre ?? ""}</small>
          </div>
          <span class="chip chip-verde">Activo</span>
        `;

        listaEmpleados.appendChild(item);
      });

      // cargar select tareas
      const sel = document.getElementById("tareaEmpleado");
      sel.innerHTML = `<option value="">(sin asignar)</option>`;
      snap.forEach(s => {
        const e = s.data();
        sel.innerHTML += `<option value="${e.dni}">${e.dni}</option>`;
      });
    }

    document.getElementById("btnAgregarEmpleado").addEventListener("click", async () => {
      const nombre = document.getElementById("empNombre").value.trim();
      const dni = document.getElementById("empDni").value.trim().replace(/\D/g, "");
      const telefono = document.getElementById("empTelefono").value.trim();
      const clave = document.getElementById("empClave").value.trim(); // ✅ clave Firestore

      if (!nombre || !dni || !telefono || !clave) {
        msgEmpleado.textContent = "⚠️ Completá todos los campos.";
        msgEmpleado.style.color = "#b91c1c";
        return;
      }

      try {
        // ✅ Guardar empleado por DNI (docId = DNI)
        await setDoc(doc(db, "employees", dni), {
          productorId,
          nombre,
          dni,
          telefono,
          clave,          // ✅ se guarda en Firestore
          activo: true,
          timestamp: serverTimestamp(),
          authUid: null   // opcional, por compatibilidad con rules
        });

        msgEmpleado.style.color = "#166534";
        msgEmpleado.textContent = "✅ Empleado agregado (Exitosamente).";

        document.getElementById("empNombre").value = "";
        document.getElementById("empDni").value = "";
        document.getElementById("empTelefono").value = "";
        document.getElementById("empClave").value = "";

        cargarEmpleados();
      } catch (e) {
        console.error(e);
        msgEmpleado.style.color = "#b91c1c";
        msgEmpleado.textContent = "❌ Error al registrar empleado.";
      }
    });
    /* ============================================================
       TAREAS
    ============================================================ */
    const listaTareas = document.getElementById("listaTareas");
    const msgTareas = document.getElementById("msgTareas");

    document.getElementById("btnAgregarTarea").addEventListener("click", agregarTarea);

    async function agregarTarea() {
      const texto = document.getElementById("nuevaTareaTexto").value.trim();
      const categoria = document.getElementById("tareaCategoria").value;
      const prioridad = document.getElementById("tareaPrioridad").value;
      const empleadoId = document.getElementById("tareaEmpleado").value || null;

      if (!texto) {
        msgTareas.textContent = "⚠️ Escribí la tarea.";
        msgTareas.style.color = "#b91c1c";
        return;
      }

      await addDoc(collection(db, "tareas"), {
        productorId,
        texto,
        categoria,
        prioridad,
        empleadoId,
        completada: false,
        timestamp: serverTimestamp()
      });

      document.getElementById("nuevaTareaTexto").value = "";
      msgTareas.style.color = "#166534";
      msgTareas.textContent = "✅ Tarea guardada.";
    }

    function escucharTareas() {
      if (!productorId) return;
      const qT = query(collection(db, "tareas"), where("productorId", "==", productorId));

      onSnapshot(qT, snap => {
        listaTareas.innerHTML = "";
        if (snap.empty) {
          listaTareas.innerHTML = "<small>No hay tareas.</small>";
          return;
        }

        snap.forEach(docSnap => {
          const t = docSnap.data();

          const item = document.createElement("div");
          item.className = "item-simple";

          item.innerHTML = `
            <div class="item-info">
              <strong>${t.texto}</strong><br>
              <span class="chip-categoria">${t.categoria}</span>
              <span class="chip-prioridad-${t.prioridad.toLowerCase()}">${t.prioridad}</span><br>
              <small>Asignado a: ${t.empleadoId ?? "(sin asignar)"}</small><br>
              <small>${t.completada ? "✔ Completada" : "Pendiente"}</small>
            </div>
          `;

          const btn = document.createElement("button");
          btn.className = "btn-secundario";
          btn.textContent = t.completada ? "Realizada" : "Pendiente";
          btn.addEventListener("click", async () => {
            await updateDoc(doc(db, "tareas", docSnap.id), {
              completada: !t.completada
            });
          });

          item.appendChild(btn);
          listaTareas.appendChild(item);
        });
      });
    }

    /* ============================================================
       MAPA MARCACIONES (simple)
    ============================================================ */
    let mapaMarcaciones = null;
    let capaMarcadores = null;
    let marcacionesOnline = [];

    function initMapaMarcaciones() {
      // ✅ si el div no está, no inicializamos (evita Map container not found)
      const mapDiv = document.getElementById("mapMarcaciones");
      if (!mapDiv) return;

      if (mapaMarcaciones) return;

      mapaMarcaciones = L.map("mapMarcaciones").setView([-33, -59.3], 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapaMarcaciones);
      capaMarcadores = L.layerGroup().addTo(mapaMarcaciones);

      // ✅ cuando se muestra la sección, Leaflet necesita recalcular tamaños
      setTimeout(() => mapaMarcaciones.invalidateSize(), 350);
    }


    function actualizarMarcacionesMapa() {
      if (!mapaMarcaciones || !capaMarcadores) return;
      capaMarcadores.clearLayers();
      marcacionesOnline.forEach(m => {
        if (!m.lat || !m.lng) return;
        L.marker([m.lat, m.lng]).addTo(capaMarcadores);
      });
    }

    function escucharMarcacionesOnline() {
      if (!productorId) return;
      const qM = query(collection(db, "marcaciones"), where("productorId", "==", productorId));

      onSnapshot(qM, snap => {
        marcacionesOnline = [];

        snap.forEach(s => {
          const d = s.data();
          marcacionesOnline.push({
            lat: Number(d.lat),
            lng: Number(d.lng),
            fechaNum: d.timestamp?.seconds ?? 0,
            dni: d.dni,
            tipo: d.tipo
          });
        });

        actualizarMarcacionesMapa();
      });
    }

    /* ============================================================
       CAMINOS (Puntos + Tramos + Filtros + Alias)
    ============================================================ */
    let mapaCaminos = null;
    let modoCamino = "punto";
    let tramoActual = [];

    let capaTramos = null;
    let capaPuntosCaminos = null;

    let filtroEstado = "todos";
    let unsubscribeCaminos = null; // ✅ evita listeners duplicados

    const coloresCamino = {
      transitable: "#16a34a",
      complicado: "#eab308",
      intransitable: "#dc2626"
    };

    // ===============================
    // 📍 GPS: centrar mapa + arrancar donde estás
    // ===============================
    let miUbicacionMarker = null;

    function pedirUbicacionActual(opts = { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }) {
      return new Promise((resolve, reject) => {
        if (!("geolocation" in navigator)) {
          reject(new Error("Geolocalización no disponible en este dispositivo."));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, opts);
      });
    }

    async function centrarEnMiUbicacion() {
      try {
        mostrarMensaje("📡 Buscando tu ubicación...", "#14532d");

        const pos = await pedirUbicacionActual();
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = Math.round(pos.coords.accuracy || 0);

        if (!mapaCaminos) return;

        // mover el mapa
        mapaCaminos.setView([lat, lng], 15, { animate: true });

        // marcador de mi ubicación (solo visual)
        if (miUbicacionMarker) {
          miUbicacionMarker.setLatLng([lat, lng]);
        } else {
          miUbicacionMarker = L.circleMarker([lat, lng], {
            radius: 8,
            weight: 2,
            color: "#111827",
            fillOpacity: 0.95
          }).addTo(mapaCaminos);

          miUbicacionMarker.bindPopup(`📍 Estás acá<br><small>Precisión aprox: ${acc} m</small>`);
        }

        mostrarMensaje("✅ Ubicación encontrada", "#166534");
      } catch (e) {
        console.error("GPS error:", e);
        mostrarMensaje("❌ No pude obtener tu ubicación. Activá GPS y permisos.", "#b91c1c");
      }
    }

    function initMapaCaminos() {
      if (mapaCaminos) return;
      if (!productorId) return;

      // ✅ si el div no está, salimos sin romper
      const mapDiv = document.getElementById("mapCaminos");
      if (!mapDiv) return;

      mapaCaminos = L.map("mapCaminos").setView([-33, -59.3], 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapaCaminos);

      capaTramos = L.layerGroup().addTo(mapaCaminos);
      capaPuntosCaminos = L.layerGroup().addTo(mapaCaminos);

      mapaCaminos.on("click", manejarClickMapa);

      cargarCaminosGuardados();
      setTimeout(() => mapaCaminos.invalidateSize(), 400);

      // ⚠️ si querés auto-centrar, lo hacemos SOLO cuando el mapa ya existe:
      // setTimeout(() => centrarEnMiUbicacion(), 600);
    }
    // ✅ intentar centrar automáticamente al iniciar el mapa (si el usuario permite)
    // setTimeout(() => centrarEnMiUbicacion(), 600);
    const btnModoPunto = document.getElementById("btnModoPunto");
    const btnModoTramo = document.getElementById("btnModoTramo");
    const btnGuardarTramo = document.getElementById("btnGuardarTramo");
    const btnCentrar = document.getElementById("btnCentrarUbicacion");
    if (btnCentrar) btnCentrar.onclick = () => centrarEnMiUbicacion();


    btnModoPunto.onclick = () => {
      modoCamino = "punto";
      btnGuardarTramo.style.display = "none";
      tramoActual = [];
      if (capaTramos) capaTramos.clearLayers();
    };

    btnModoTramo.onclick = () => {
      modoCamino = "tramo";
      tramoActual = [];
      btnGuardarTramo.style.display = "inline-block";
      if (capaTramos) capaTramos.clearLayers();
    };

    function manejarClickMapa(e) {
      const estado = document.getElementById("caminoEstado").value;
      const latlng = [e.latlng.lat, e.latlng.lng];

      if (modoCamino === "punto") guardarPunto(latlng, estado);
      if (modoCamino === "tramo") {
        tramoActual.push(latlng);
        dibujarTramoTemporal();
      }
    }

    async function guardarPunto(latlng, estado) {
      const alias = prompt("Nombre del lugar (opcional): ej. Puente, Entrada Potrero 3")?.trim() || "";

      try {
        await addDoc(collection(db, "caminos"), {
          productorId,
          tipo: "punto",
          estado,
          alias,
          lat: latlng[0],
          lng: latlng[1],
          fecha: Date.now(),
          timestamp: serverTimestamp()
        });

        mostrarMensaje("✅ Punto guardado", "#166534");
      } catch (err) {
        console.error(err);
        mostrarMensaje("❌ Error al guardar el punto", "#b91c1c");
      }
    }

    btnGuardarTramo.onclick = async () => {
      const estado = document.getElementById("caminoEstado").value;

      if (tramoActual.length < 2) {
        mostrarMensaje("⚠️ Necesitás al menos 2 puntos para un tramo", "#b91c1c");
        return;
      }

      try {
        const alias = prompt("Nombre del tramo (opcional): ej. Camino al galpón")?.trim() || "";

        await addDoc(collection(db, "caminos"), {
          productorId,
          tipo: "tramo",
          estado,
          alias,
          puntos: tramoActual,
          fecha: Date.now(),
          timestamp: serverTimestamp()
        });

        tramoActual = [];
        if (capaTramos) capaTramos.clearLayers();

        mostrarMensaje("✅ Tramo guardado", "#166534");
      } catch (err) {
        console.error(err);
        mostrarMensaje("❌ Error al guardar tramo", "#b91c1c");
      }
    };

    function dibujarTramoTemporal() {
      if (!capaTramos) return;
      capaTramos.clearLayers();

      if (tramoActual.length >= 2) {
        L.polyline(tramoActual, {
          color: "#6b7280",
          weight: 3,
          dashArray: "6,4"
        }).addTo(capaTramos);
      }
    }

    function marcarChipActivo(id) {
      document.querySelectorAll(".filtro-chip").forEach(c => c.classList.remove("activo"));
      document.getElementById(id).classList.add("activo");
    }

    document.getElementById("filtroTodos").onclick = () => {
      filtroEstado = "todos";
      marcarChipActivo("filtroTodos");
      cargarCaminosGuardados();
    };
    document.getElementById("filtroTransitable").onclick = () => {
      filtroEstado = "transitable";
      marcarChipActivo("filtroTransitable");
      cargarCaminosGuardados();
    };
    document.getElementById("filtroComplicado").onclick = () => {
      filtroEstado = "complicado";
      marcarChipActivo("filtroComplicado");
      cargarCaminosGuardados();
    };
    document.getElementById("filtroIntransitable").onclick = () => {
      filtroEstado = "intransitable";
      marcarChipActivo("filtroIntransitable");
      cargarCaminosGuardados();
    };

    // ✅ ESTA ES LA FUNCIÓN CLAVE (corrigida)
    function cargarCaminosGuardados() {
      if (!productorId) return;
      if (!capaPuntosCaminos || !capaTramos) return;

      // ✅ evita múltiples listeners cada vez que tocás un filtro
      if (typeof unsubscribeCaminos === "function") unsubscribeCaminos();

      const q = query(
        collection(db, "caminos"),
        where("productorId", "==", productorId)
      );

      unsubscribeCaminos = onSnapshot(q, (snap) => {
        capaPuntosCaminos.clearLayers();
        capaTramos.clearLayers();

        snap.forEach((docSnap) => {
          const d = docSnap.data();

          if (filtroEstado !== "todos" && d.estado !== filtroEstado) return;

          const color = coloresCamino[d.estado];
          const fechaTxt = new Date(d.fecha).toLocaleString("es-AR");

          if (d.tipo === "punto") {
            const marker = L.circleMarker([d.lat, d.lng], {
              radius: 9,
              color: "#1f2937",
              weight: 2,
              fillColor: color,
              fillOpacity: 0.95
            }).addTo(capaPuntosCaminos);

            const aliasTxt = d.alias ? `<b>📍 ${d.alias}</b><br>` : "";
            const titulo = d.alias ? `📍 ${d.alias}` : formaEstado(d.estado);

            marker.bindTooltip(titulo, {
              direction: "top",
              offset: [0, -12],
              opacity: 0.9,
              className: "tooltip-camino"
            });

            const latTxt = Number(d.lat).toFixed(6);
            const lngTxt = Number(d.lng).toFixed(6);
            const gmaps = `https://www.google.com/maps?q=${latTxt},${lngTxt}`;

            marker.bindPopup(`
              ${aliasTxt}
              <b>${formaEstado(d.estado)}</b><br>
              ${fechaTxt}<br>
              <small>Punto</small><br>
              <small><b>Coord:</b> ${latTxt}, ${lngTxt}</small><br><br>

              <button onclick="copiarCoord('${latTxt},${lngTxt}')">📋 Copiar coord</button>
              <a href="${gmaps}" target="_blank">🧭 Abrir Maps</a>
              <br><br>

              <button onclick="cambiarEstadoCamino('${docSnap.id}')">Cambiar estado</button>
              <button onclick="borrarCamino('${docSnap.id}')">🗑️ Eliminar</button>

            `);
          }

          if (d.tipo === "tramo") {
            const poly = L.polyline(d.puntos, {
              color,
              weight: d.estado === "intransitable" ? 6 : d.estado === "complicado" ? 5 : 4,
              opacity: 0.9,
              dashArray: d.estado === "complicado" ? "6,4" : null
            }).addTo(capaTramos);

            const tituloTramo = d.alias ? `🛣️ ${d.alias}` : formaEstado(d.estado);

            poly.bindTooltip(tituloTramo, {
              direction: "center",
              opacity: 0.9,
              className: "tooltip-camino"
            });

            const p0 = d.puntos?.[0];
            const p1 = d.puntos?.[d.puntos.length - 1];

            const ini = p0 ? `${Number(p0[0]).toFixed(6)}, ${Number(p0[1]).toFixed(6)}` : "-";
            const fin = p1 ? `${Number(p1[0]).toFixed(6)}, ${Number(p1[1]).toFixed(6)}` : "-";

            const distKm = calcularDistanciaTramoKM(d.puntos || []);
            const aliasTxt = d.alias ? `<b>🛣️ ${d.alias}</b><br>` : "";

            poly.bindPopup(`
              ${aliasTxt}
              <b>${formaEstado(d.estado)}</b><br>
              ${fechaTxt}<br>
              <small>Tramo</small><br>
              <small><b>Inicio:</b> ${ini}</small><br>
              <small><b>Fin:</b> ${fin}</small><br>
              <small><b>Dist:</b> ${distKm.toFixed(2)} km</small><br><br>

              <button onclick="copiarCoord('${ini}')">📋 Copiar inicio</button>
              <button onclick="copiarCoord('${fin}')">📋 Copiar fin</button>
              <br><br>

              <button onclick="cambiarEstadoCamino('${docSnap.id}')">Cambiar estado</button>
            `);
          }
        });

      }, (err) => {
        console.error("Error escuchando caminos:", err);
        mostrarMensaje("❌ Sin permisos para leer caminos. Revisá reglas Firestore.", "#b91c1c");
      });
    }

    function formaEstado(e) {
      return e === "transitable" ? "🟢 Transitable"
        : e === "complicado" ? "🟡 Complicado"
          : "🔴 Intransitable";
    }

    function haversineKM(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const toRad = x => x * Math.PI / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return 2 * R * Math.asin(Math.sqrt(a));
    }

    function calcularDistanciaTramoKM(puntos) {
      if (!Array.isArray(puntos) || puntos.length < 2) return 0;
      let total = 0;
      for (let i = 1; i < puntos.length; i++) {
        const [lat1, lon1] = puntos[i - 1];
        const [lat2, lon2] = puntos[i];
        total += haversineKM(lat1, lon1, lat2, lon2);
      }
      return total;
    }

    // funciones globales para el popup
    window.cambiarEstadoCamino = async (id) => {
      const nuevo = prompt("Nuevo estado: transitable / complicado / intransitable");
      if (!["transitable", "complicado", "intransitable"].includes(nuevo)) {
        alert("Estado inválido");
        return;
      }
      await updateDoc(doc(db, "caminos", id), { estado: nuevo });
    };

    window.borrarCamino = async (id) => {
      if (!confirm("¿Eliminar este punto/tramo de camino?")) return;
      try {
        await deleteDoc(doc(db, "caminos", id));
        mostrarMensaje("🗑️ Camino eliminado", "#b91c1c");
      } catch (e) {
        console.error("Error borrando camino:", e);
        alert("No se pudo eliminar (revisá permisos/reglas).");
      }
    };


    window.copiarCoord = async (txt) => {
      try {
        await navigator.clipboard.writeText(txt);
        mostrarMensaje("✅ Coordenadas copiadas: " + txt, "#166534");
      } catch (e) {
        const ta = document.createElement("textarea");
        ta.value = txt;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        mostrarMensaje("✅ Coordenadas copiadas: " + txt, "#166534");
      }
    };

    // borrar caminos de hoy (solo del productor)
    document.getElementById("btnBorrarMisCaminosHoy").onclick = async () => {
      if (!confirm("¿Borrar SOLO tus caminos del día de hoy?")) return;

      const inicio = new Date();
      inicio.setHours(0, 0, 0, 0);
      const inicioMs = inicio.getTime();

      const q = query(
        collection(db, "caminos"),
        where("productorId", "==", productorId)
      );

      const snap = await getDocs(q);

      const batch = writeBatch(db);
      snap.forEach(docSnap => {
        const d = docSnap.data();
        if (d.fecha >= inicioMs) batch.delete(docSnap.ref);
      });

      await batch.commit();
      mostrarMensaje("✅ Se borraron tus caminos de HOY", "#166534");
    };

    function mostrarMensaje(msg, color = "#000") {
      const div = document.getElementById("msgCaminos");
      if (!div) return;
      div.textContent = msg;
      div.style.color = color;
      setTimeout(() => div.textContent = "", 3500);
    }

    document.getElementById("caminoEstado").addEventListener("change", e => {
      const est = e.target.value;
      const prev = document.getElementById("estadoPreview");

      if (est === "transitable") { prev.textContent = "🟢 Transitable"; prev.style.background = "#dcfce7"; }
      if (est === "complicado") { prev.textContent = "🟡 Complicado"; prev.style.background = "#fef9c3"; }
      if (est === "intransitable") { prev.textContent = "🔴 Intransitable"; prev.style.background = "#fee2e2"; }
    });
    /* ============================================================
       VECINOS (FIRESTORE) ✅
       Colección: "vecinos"
       Campos: productorId, nombre, telefono, timestamp
    ============================================================ */

    const msgVecinos = document.getElementById("msgVecinos");
    const listaVecinos = document.getElementById("listaVecinos");

    function normalizarTel(tel) {
      // deja solo números, útil para wa.me
      return (tel || "").toString().replace(/\D/g, "");
    }

    function validarTelAR(tel) {
      // No es obligatorio, pero ayuda.
      // En Argentina suele ser 549 + código área + número (10 a 13 dígitos aprox)
      return tel.length >= 10;
    }

    function mostrarMsg(el, texto, color = "#14532d", ms = 3500) {
      if (!el) return;
      el.textContent = texto;
      el.style.color = color;
      if (ms) setTimeout(() => el.textContent = "", ms);
    }

    async function agregarVecino() {
      const nombre = document.getElementById("vecinoNombre").value.trim();
      const telRaw = document.getElementById("vecinoTelefono").value.trim();
      const telefono = normalizarTel(telRaw);

      if (!productorId) return;

      if (!nombre || !telefono) {
        mostrarMsg(msgVecinos, "⚠️ Completá nombre y teléfono.", "#b91c1c");
        return;
      }

      if (!validarTelAR(telefono)) {
        mostrarMsg(msgVecinos, "⚠️ Teléfono inválido. Usá formato numérico (ej: 5493444xxxxxx).", "#b91c1c");
        return;
      }

      try {
        // Usamos el teléfono como ID del documento para evitar duplicados
        await setDoc(doc(db, "vecinos", `${productorId}_${telefono}`), {
          productorId,
          nombre,
          telefono,
          timestamp: serverTimestamp()
        });

        mostrarMsg(msgVecinos, "✅ Vecino agregado correctamente.", "#166534");

        document.getElementById("vecinoNombre").value = "";
        document.getElementById("vecinoTelefono").value = "";
      } catch (e) {
        console.error("Error al agregar vecino:", e);
        mostrarMsg(msgVecinos, "❌ No se pudo agregar el vecino (revisá permisos/reglas).", "#b91c1c", 5000);
      }
    }

    function escucharVecinos() {
      if (!productorId) return;

      const qV = query(
        collection(db, "vecinos"),
        where("productorId", "==", productorId)
      );

      onSnapshot(qV, (snap) => {
        listaVecinos.innerHTML = "";

        if (snap.empty) {
          listaVecinos.innerHTML = "<small>No hay vecinos cargados.</small>";
          return;
        }

        snap.forEach((docSnap) => {
          const v = docSnap.data();

          const item = document.createElement("div");
          item.className = "item-simple";

          item.innerHTML = `
        <div class="item-info">
          <strong>🤝 ${v.nombre || ""}</strong><br>
          <small>${v.telefono || ""}</small>
        </div>
      `;

          // WhatsApp
          const btnWA = document.createElement("a");
          btnWA.className = "btn-secundario";
          btnWA.textContent = "WhatsApp";
          btnWA.href = `https://wa.me/${normalizarTel(v.telefono)}?text=${encodeURIComponent(
            "Hola " + (v.nombre || "") + ", te contacto desde Red Rural."
          )}`;
          btnWA.target = "_blank";

          // Editar
          const btnEdit = document.createElement("button");
          btnEdit.className = "btn-secundario";
          btnEdit.textContent = "Editar";
          btnEdit.onclick = () => editarVecino(docSnap.id, v);

          // Eliminar
          const btnDel = document.createElement("button");
          btnDel.className = "btn-secundario";
          btnDel.textContent = "Eliminar";
          btnDel.onclick = () => eliminarVecino(docSnap.id, v);

          item.appendChild(btnWA);
          item.appendChild(btnEdit);
          item.appendChild(btnDel);

          listaVecinos.appendChild(item);
        });

      }, (err) => {
        console.error("Error escuchando vecinos:", err);
        listaVecinos.innerHTML = "<small>❌ Sin permisos para leer vecinos (revisá reglas).</small>";
      });
    }


    async function eliminarVecino(docId, v) {
      if (!confirm(`¿Eliminar a ${v.nombre || "este vecino"}?`)) return;
      try {
        await deleteDoc(doc(db, "vecinos", docId));
        mostrarMsg(msgVecinos, "🗑️ Vecino eliminado.", "#b91c1c");
      } catch (e) {
        console.error("Error eliminando vecino:", e);
        mostrarMsg(msgVecinos, "❌ No se pudo eliminar (permisos/reglas).", "#b91c1c", 5000);
      }
    }

    async function editarVecino(docId, v) {
      const nuevoNombre = prompt("Nuevo nombre:", v.nombre || "");
      if (nuevoNombre === null) return;

      const telNuevoRaw = prompt("Nuevo teléfono (solo números):", v.telefono || "");
      if (telNuevoRaw === null) return;

      const telNuevo = normalizarTel(telNuevoRaw);

      if (!nuevoNombre.trim() || !telNuevo.trim()) {
        mostrarMsg(msgVecinos, "⚠️ Nombre y teléfono son obligatorios.", "#b91c1c");
        return;
      }
      if (!validarTelAR(telNuevo)) {
        mostrarMsg(msgVecinos, "⚠️ Teléfono inválido.", "#b91c1c");
        return;
      }

      try {
        // ✅ Caso 1: No cambió el teléfono → update normal
        if (telNuevo === (v.telefono || "")) {
          await updateDoc(doc(db, "vecinos", docId), {
            nombre: nuevoNombre.trim(),
            telefono: telNuevo,
            timestamp: serverTimestamp()
          });
          mostrarMsg(msgVecinos, "✅ Vecino actualizado.", "#166534");
          return;
        }

        // ✅ Caso 2 (tu caso): el ID del doc usa teléfono → hay que “mover” el doc
        // vos creás con ID `${productorId}_${telefono}` :contentReference[oaicite:5]{index=5}
        const nuevoId = `${productorId}_${telNuevo}`;

        const batch = writeBatch(db);
        batch.set(doc(db, "vecinos", nuevoId), {
          productorId,
          nombre: nuevoNombre.trim(),
          telefono: telNuevo,
          timestamp: serverTimestamp()
        });
        batch.delete(doc(db, "vecinos", docId));
        await batch.commit();

        mostrarMsg(msgVecinos, "✅ Vecino actualizado (teléfono cambiado).", "#166534");
      } catch (e) {
        console.error("Error editando vecino:", e);
        mostrarMsg(msgVecinos, "❌ No se pudo editar (permisos/reglas).", "#b91c1c", 5000);
      }
    }


    /* ============================================================
   ✅ UI: VECINOS SELECCIONABLES PARA ALERTAS
    ============================================================ */

    const listaVecinosAlertas = document.getElementById("listaVecinosAlertas");
    const btnSelTodosVecinos = document.getElementById("btnSelTodosVecinos");
    const btnSelNingunoVecinos = document.getElementById("btnSelNingunoVecinos");

    let vecinosCacheAlertas = []; // [{id, nombre, tel}]

    function renderVecinosParaAlertas() {
      if (!listaVecinosAlertas) return;

      if (!vecinosCacheAlertas.length) {
        listaVecinosAlertas.innerHTML = "<small>No hay vecinos cargados.</small>";
        return;
      }

      listaVecinosAlertas.innerHTML = "";

      vecinosCacheAlertas.forEach((v, i) => {
        const item = document.createElement("div");
        item.className = "item-simple";
        item.style.alignItems = "flex-start";

        item.innerHTML = `
      <label style="display:flex; gap:10px; width:100%; cursor:pointer;">
        <input class="chk-vecino-alerta" type="checkbox" data-tel="${v.tel}" style="margin-top:4px;">
        <div class="item-info">
          <strong>🤝 ${v.nombre}</strong><br>
          <small>${v.tel}</small>
        </div>
      </label>
    `;

        listaVecinosAlertas.appendChild(item);
      });
    }

    function setTodosVecinosAlertas(valor) {
      document.querySelectorAll(".chk-vecino-alerta").forEach(chk => chk.checked = valor);
    }

    btnSelTodosVecinos?.addEventListener("click", () => setTodosVecinosAlertas(true));
    btnSelNingunoVecinos?.addEventListener("click", () => setTodosVecinosAlertas(false));

    function obtenerTelefonosSeleccionadosDesdeUI() {
      const tels = [];
      document.querySelectorAll(".chk-vecino-alerta").forEach(chk => {
        if (chk.checked) {
          const tel = chk.dataset.tel;
          if (tel) tels.push(tel);
        }
      });
      return tels;
    }

    // ✅ escucha vecinos y llena el selector visual de alertas
    function escucharVecinosParaAlertas() {
      if (!productorId) return;

      const qV = query(collection(db, "vecinos"), where("productorId", "==", productorId));

      onSnapshot(qV, (snap) => {
        vecinosCacheAlertas = [];

        snap.forEach((docSnap) => {
          const v = docSnap.data();
          const tel = normalizarTel(v.telefono);
          if (tel) vecinosCacheAlertas.push({
            id: docSnap.id,
            nombre: v.nombre || "Vecino",
            tel
          });
        });

        renderVecinosParaAlertas();
        // por defecto: no selecciona ninguno (si querés que seleccione todos, cambialo a true)
        setTodosVecinosAlertas(false);
      }, (err) => {
        console.error("Error vecinos para alertas:", err);
        if (listaVecinosAlertas) listaVecinosAlertas.innerHTML = "<small>❌ Sin permisos para leer vecinos.</small>";
      });
    }
    /* ============================================================
       ALERTAS (FIRESTORE + ENVÍO POR WHATSAPP) ✅
       Guarda en colección "alertas" y prepara envío a vecinos
    ============================================================ */

    const msgAlertas = document.getElementById("msgAlertas");
    const listaAlertas = document.getElementById("listaAlertas");


    async function guardarAlertaFirestore(tipo, descripcion) {
      // guarda la alerta para historial
      return await addDoc(collection(db, "alertas"), {
        productorId,
        tipo,
        descripcion,
        fecha: Date.now(),
        timestamp: serverTimestamp()
      });
    }

    function escucharAlertas() {
      if (!productorId) return;

      const qA = query(
        collection(db, "alertas"),
        where("productorId", "==", productorId)
      );

      onSnapshot(qA, (snap) => {
        listaAlertas.innerHTML = "";
        if (snap.empty) {
          listaAlertas.innerHTML = "<small>No hay alertas enviadas.</small>";
          return;
        }

        snap.forEach((docSnap) => {
          const a = docSnap.data();
          const fechaTxt = a.fecha ? new Date(a.fecha).toLocaleString("es-AR") : "";

          const item = document.createElement("div");
          item.className = "item-simple";
          item.innerHTML = `
        <div class="item-info">
          <strong>🚨 ${a.tipo || "Alerta"}</strong><br>
          <small>${a.descripcion || ""}</small><br>
          <small>${fechaTxt}</small>
        </div>
      `;

          listaAlertas.appendChild(item);
        });
      });
    }

    async function obtenerTelefonosVecinos() {
      const q = query(collection(db, "vecinos"), where("productorId", "==", productorId));
      const snap = await getDocs(q);
      const tels = [];
      snap.forEach((d) => {
        const tel = normalizarTel(d.data().telefono);
        if (tel) tels.push(tel);
      });
      return tels;
    }

    function abrirWhatsAppLista(telefonos, mensaje) {
      // Evita abrir 30 ventanas de golpe: las abre escalonadas.
      // Aun así, el navegador puede bloquear si no permitís popups.
      const msg = encodeURIComponent(mensaje);
      telefonos.forEach((tel, i) => {
        setTimeout(() => {
          window.open(`https://wa.me/${tel}?text=${msg}`, "_blank");
        }, i * 350);
      });
    }

    document.getElementById("btnAgregarVecino").addEventListener("click", agregarVecino);

    document.getElementById("btnEnviarAlerta").addEventListener("click", async () => {
      const tipo = document.getElementById("alertaTipo").value;
      const descripcion = document.getElementById("alertaDescripcion").value.trim();

      if (!descripcion) {
        mostrarMsg(msgAlertas, "⚠️ Completá la descripción de la alerta.", "#b91c1c");
        return;
      }

      if (!productorId) return;

      try {
        // 1) Guardar alerta en Firestore
        await guardarAlertaFirestore(tipo, descripcion);

        // 2) Traer vecinos y abrir WhatsApp
        const telsVecinos = obtenerTelefonosSeleccionadosDesdeUI();


        if (!telsVecinos.length) {
          mostrarMsg(msgAlertas, "⚠️ Alerta guardada, pero no hay vecinos cargados para enviar.", "#b45309", 6000);
          document.getElementById("alertaDescripcion").value = "";
          return;
        }

        const mensaje = `🚨 ALERTA RED RURAL\nTipo: ${tipo}\nDetalle: ${descripcion}\n\n📍 Esta alerta fue emitida desde el Panel del Productor para advertir una situación en la zona.`;
        abrirWhatsAppLista(telsVecinos, mensaje);

        mostrarMsg(msgAlertas, `✅ Alerta guardada y lista para enviar a ${telsVecinos.length} vecino(s).`, "#166534", 6000);

        document.getElementById("alertaDescripcion").value = "";
      } catch (e) {
        console.error("Error enviando alerta:", e);
        mostrarMsg(msgAlertas, "❌ Error al enviar alerta (revisá permisos/reglas).", "#b91c1c", 6000);
      }
    });

    function initGestion() {
      // --- refs UI
      const gHectareas = document.getElementById("gHectareas");
      const gCabezas = document.getElementById("gCabezas");
      const msgFicha = document.getElementById("msgFicha");
      const btnGuardarFicha = document.getElementById("btnGuardarFicha");
      const btnRefrescarFicha = document.getElementById("btnRefrescarFicha");

      const vPatente = document.getElementById("vPatente");
      const vTipo = document.getElementById("vTipo");
      const btnAgregarVehiculo = document.getElementById("btnAgregarVehiculo");
      const msgVehiculos = document.getElementById("msgVehiculos");
      const listaVehiculos = document.getElementById("listaVehiculos");

      const cVehiculo = document.getElementById("cVehiculo");
      const cLitros = document.getElementById("cLitros");
      const cCosto = document.getElementById("cCosto");
      const cOdom = document.getElementById("cOdom");
      const btnCargarCombustible = document.getElementById("btnCargarCombustible");
      const msgCombustible = document.getElementById("msgCombustible");
      const listaCombustible = document.getElementById("listaCombustible");

      if (!productorId) return;

      const setMsg = (el, txt, ok = true) => {
        if (!el) return;
        el.textContent = txt;
        el.style.color = ok ? "#166534" : "#b91c1c";
        setTimeout(() => (el.textContent = ""), 3000);
      };

      // =========================
      // 1) Ficha del campo (doc fijo)
      // =========================
      const refFicha = doc(db, "gestion_campos", productorId);

      async function refrescarFicha() {
        try {
          const snap = await getDoc(refFicha);
          if (!snap.exists()) return;
          const d = snap.data();
          if (gHectareas) gHectareas.value = d.hectareas ?? "";
          if (gCabezas) gCabezas.value = d.cabezas ?? "";
        } catch (e) {
          console.error(e);
          setMsg(msgFicha, "❌ No se pudo leer la ficha.", false);
        }
      }

      btnGuardarFicha?.addEventListener("click", async () => {
        try {
          const hect = Number(gHectareas?.value || 0);
          const cab = Number(gCabezas?.value || 0);

          await setDoc(refFicha, {
            productorId,
            hectareas: hect,
            cabezas: cab,
            updatedAt: serverTimestamp(),
            updatedBy: "productor"
          }, { merge: true });

          setMsg(msgFicha, "✅ Ficha guardada.");
        } catch (e) {
          console.error(e);
          setMsg(msgFicha, "❌ No se pudo guardar (permisos/reglas).", false);
        }
      });

      btnRefrescarFicha?.addEventListener("click", refrescarFicha);

      // auto carga
      refrescarFicha();

      // =========================
      // 2) Vehículos
      // =========================
      const qVeh = query(
        collection(db, "vehiculos"),
        where("productorId", "==", productorId),
        orderBy("createdAt", "desc")
      );

      btnAgregarVehiculo?.addEventListener("click", async () => {
        try {
          const pat = (vPatente?.value || "").trim();
          const tipo = (vTipo?.value || "camioneta").trim();
          if (!pat) return setMsg(msgVehiculos, "⚠️ Ingresá patente/ID.", false);

          await addDoc(collection(db, "vehiculos"), {
            productorId,
            patente: pat,
            tipo,
            activo: true,
            createdAt: serverTimestamp()
          });

          vPatente.value = "";
          setMsg(msgVehiculos, "✅ Vehículo agregado.");
        } catch (e) {
          console.error(e);
          setMsg(msgVehiculos, "❌ No se pudo agregar (permisos/índices).", false);
        }
      });

      onSnapshot(qVeh, (snap) => {
        // lista + combo
        if (listaVehiculos) listaVehiculos.innerHTML = "";
        if (cVehiculo) cVehiculo.innerHTML = `<option value="">Elegir vehículo…</option>`;

        snap.forEach((d) => {
          const v = d.data();
          const pat = v.patente || "(sin patente)";
          const tipo = v.tipo || "";
          const activo = v.activo !== false;

          // combo
          if (cVehiculo) {
            const op = document.createElement("option");
            op.value = pat;
            op.textContent = `${pat} (${tipo})`;
            cVehiculo.appendChild(op);
          }

          // lista
          if (listaVehiculos) {
            const div = document.createElement("div");
            div.className = "item-simple";
            div.innerHTML = `
          <div class="item-info">
            <strong>🚜 ${pat}</strong><br>
            <small>${tipo} • ${activo ? "activo" : "inactivo"}</small>
          </div>
          
        `;
            listaVehiculos.appendChild(div);
          }
        });
      });

      // =========================
      // 3) Combustible (listado + carga)
      // =========================
      const qComb = query(
        collection(db, "combustible"),
        where("productorId", "==", productorId),
        orderBy("fechaMs", "desc")
      );

      btnCargarCombustible?.addEventListener("click", async () => {
        try {
          const veh = (cVehiculo?.value || "").trim();
          const litros = Number(cLitros?.value || 0);
          const costo = Number(cCosto?.value || 0);
          const odom = cOdom?.value ? Number(cOdom.value) : null;

          if (!veh) return setMsg(msgCombustible, "⚠️ Elegí un vehículo.", false);
          if (litros <= 0) return setMsg(msgCombustible, "⚠️ Litros inválidos.", false);

          await addDoc(collection(db, "combustible"), {
            productorId,
            empleadoDni: "productor",          // ✅ agregar (string)
            vehiculo: veh,
            litros,
            costo,
            odometro: odom,
            fechaMs: Date.now(),
            createdAt: serverTimestamp(),
            cargadoPor: "productor"
          });


          cLitros.value = "";
          cCosto.value = "";
          cOdom.value = "";
          setMsg(msgCombustible, "✅ Carga registrada.");
        } catch (e) {
          console.error(e);
          setMsg(msgCombustible, "❌ No se pudo registrar (permisos/índices).", false);
        }
      });

      onSnapshot(qComb, (snap) => {
        if (!listaCombustible) return;
        listaCombustible.innerHTML = "";

        if (snap.empty) {
          listaCombustible.innerHTML = `<small class="muted">Todavía no hay cargas.</small>`;
          return;
        }

        snap.forEach((d) => {
          const c = d.data();
          const f = c.fechaMs ? new Date(c.fechaMs).toLocaleString("es-AR") : "";
          const div = document.createElement("div");
          div.className = "item-simple";
          div.innerHTML = `
        <div class="item-info">
          <strong>⛽ ${c.vehiculo || ""} • ${Number(c.litros || 0)} L</strong><br>
          <small>$${Number(c.costo || 0)} ${c.odometro ? "• KM: " + c.odometro : ""} • ${f} • Cargado Por: ${c.cargadoPor || "-"}</small>
        </div>
        <span class="chip-categoria">OK</span>
      `;
          listaCombustible.appendChild(div);
        });
      });


    }

    function setGMsg(txt, ok = true) {
      const el = document.getElementById("gMsg");
      if (!el) return;
      el.textContent = txt;
      el.style.color = ok ? "#166534" : "#b91c1c";
      setTimeout(() => (el.textContent = ""), 3500);
    }

    function stockHTML(stock = {}) {
      const s = {
        terneros: stock.terneros || 0,
        vacas: stock.vacas || 0,
        novillos: stock.novillos || 0,
        toros: stock.toros || 0,
        vaquillonas: stock.vaquillonas || 0,
      };
      return `
    Terneros: <b>${s.terneros}</b> • Vacas: <b>${s.vacas}</b> • Novillos: <b>${s.novillos}</b><br>
    Toros: <b>${s.toros}</b> • Vaquillonas: <b>${s.vaquillonas}</b>
  `;
    }

    async function refrescarStockGanado() {
      const pid = auth.currentUser?.uid;
      if (!pid) return;

      const ref = doc(db, "ganado_stock", pid);
      const snap = await getDoc(ref);
      const box = document.getElementById("gStock");

      if (!snap.exists()) {
        box.innerHTML = "Aún no hay stock. Registrá tu primer evento.";
        return;
      }
      box.innerHTML = stockHTML(snap.data().stock || {});
    }

    async function cargarUltimosEventosGanado() {
      const pid = auth.currentUser?.uid;
      if (!pid) return;

      const qE = query(
        collection(db, "ganado_eventos"),
        where("productorId", "==", pid),
        orderBy("fechaMs", "desc"),
        limit(7)
      );

      const snap = await getDocs(qE);
      const box = document.getElementById("gEventos");

      if (snap.empty) {
        box.textContent = "Sin eventos registrados.";
        return;
      }

      let html = "";
      snap.forEach(d => {
        const e = d.data();
        const fecha = new Date(e.fechaMs).toLocaleString();
        const mov = e.tipo === "movimiento" ? ` • ${e.origen || "?"} → ${e.destino || "?"}` : "";
        html += `• <b>${e.tipo}</b> ${e.cantidad} ${e.categoria}${mov}<br><span class="muted">${fecha} ${e.nota ? "• " + e.nota : ""}</span><br><br>`;
      });
      box.innerHTML = html;
    }

    async function guardarEventoGanado() {
      try {
        const pid = auth.currentUser?.uid;
        if (!pid) return setGMsg("❌ No hay sesión.", false);

        const tipo = document.getElementById("gTipo").value;
        const categoria = document.getElementById("gCategoria").value;
        const cantidad = Number(document.getElementById("gCantidad").value || 0);
        const origen = (document.getElementById("gOrigen").value || "").trim();
        const destino = (document.getElementById("gDestino").value || "").trim();
        const nota = (document.getElementById("gNota").value || "").trim();

        if (cantidad <= 0) return setGMsg("⚠️ Cantidad inválida.", false);
        if (tipo === "movimiento" && (!origen || !destino)) return setGMsg("⚠️ En movimiento, completá origen y destino.", false);

        const delta =
          (tipo === "nacimiento") ? +cantidad :
            (tipo === "muerte") ? -cantidad :
              (tipo === "venta") ? -cantidad :
                0; // movimiento no cambia stock

        const stockRef = doc(db, "ganado_stock", pid);

        await runTransaction(db, async (tx) => {
          const stockSnap = await tx.get(stockRef);
          const stock = stockSnap.exists() ? (stockSnap.data().stock || {}) : {};

          const actual = Number(stock[categoria] || 0);
          const nuevo = actual + delta;

          if (nuevo < 0) {
            throw new Error("STOCK_NEGATIVO");
          }

          // 1) Guardar evento
          const evRef = doc(collection(db, "ganado_eventos"));
          tx.set(evRef, {
            productorId: pid,
            tipo,
            categoria,
            cantidad,
            origen: origen || null,
            destino: destino || null,
            nota: nota || "",
            fechaMs: Date.now(),
            createdAt: serverTimestamp(),
          });

          // 2) Actualizar stock (si corresponde)
          if (tipo !== "movimiento") {
            tx.set(stockRef, {
              productorId: pid,
              updatedAt: serverTimestamp(),
              stock: {
                ...stock,
                [categoria]: nuevo
              }
            }, { merge: true });
          }
        });

        setGMsg("✅ Evento registrado.");
        document.getElementById("gCantidad").value = "";
        document.getElementById("gDestino").value = "";
        document.getElementById("gNota").value = "";

        await refrescarStockGanado();
        await cargarUltimosEventosGanado();

      } catch (e) {
        console.error(e);
        if (String(e.message) === "STOCK_NEGATIVO") {
          setGMsg("❌ No podés dejar stock negativo. Revisá cantidad/categoría.", false);
        } else {
          setGMsg("❌ No se pudo registrar (permisos o índice).", false);
        }
      }
    }

    function initGanado() {
      document.getElementById("btnGuardarGanado")?.addEventListener("click", guardarEventoGanado);
      document.getElementById("btnRefrescarStock")?.addEventListener("click", async () => {
        await refrescarStockGanado();
        await cargarUltimosEventosGanado();
      });
    }


    function initCalculadora() {
      const ha = document.getElementById("calcHa");
      const kgHa = document.getElementById("calcKgHa");
      const agroUnidad = document.getElementById("agroUnidad");
      const agroTitulo = document.getElementById("agroTitulo");
      const btnTotal = document.getElementById("btnCalcTotal");

      const btnTotalClear = document.getElementById("btnCalcTotalClear");
      const resTotal = document.getElementById("resCalcTotal");

      const nkg = document.getElementById("calcNkg");
      const btnUrea = document.getElementById("btnCalcUrea");
      const btnUreaClear = document.getElementById("btnCalcUreaClear");
      const resUrea = document.getElementById("resCalcUrea");
      // 🐄 Ganadería: MS
      const ganPeso = document.getElementById("ganPeso");
      const ganPorcMS = document.getElementById("ganPorcMS");
      const ganCabezas = document.getElementById("ganCabezas");
      const btnMS = document.getElementById("btnCalcMS");
      const btnMSClear = document.getElementById("btnCalcMSClear");
      const resMS = document.getElementById("resCalcMS");


      // ✅ Guard: si la sección no está (por algún error), no rompe
      if (!btnTotal || !btnUrea || !btnMS) return;

      const fmt = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);

      function actualizarUIAgroUnidad() {
        const unidad = agroUnidad?.value || "kg";
        const uHaTxt = unidad === "l" ? "L/ha" : "kg/ha";
        const uTotTxt = unidad === "l" ? "Litros" : "kg";

        if (agroTitulo) agroTitulo.textContent = `🧪 Fertilizante total (${uHaTxt} → ${uTotTxt})`;

        // cambia el placeholder del input de dosis
        if (kgHa) kgHa.placeholder = `Dosis ${uHaTxt} (ej: ${unidad === "l" ? "8" : "120"})`;
      }
      if (agroUnidad) {
        agroUnidad.addEventListener("change", actualizarUIAgroUnidad);
        actualizarUIAgroUnidad(); // estado inicial apenas carga
      }


      btnTotal.addEventListener("click", () => {
        const haVal = Number(ha.value);
        const kgHaVal = Number(kgHa.value);

        if (!haVal || !kgHaVal || haVal <= 0 || kgHaVal <= 0) {
          resTotal.style.color = "#b91c1c";
          resTotal.textContent = "⚠️ Completá hectáreas y kg/ha con valores mayores a 0.";
          return;
        }

        const total = haVal * kgHaVal;

        const unidad = agroUnidad?.value || "kg"; // por si no existiera, cae en kg
        const uTxt = unidad === "l" ? "Litros" : "kg";
        const uHaTxt = unidad === "l" ? "L/ha" : "kg/ha";

        resTotal.style.color = "#166534";
        resTotal.textContent = `✅ Total: ${fmt(total)} ${uTxt} (para ${fmt(haVal)} ha a ${fmt(kgHaVal)} ${uHaTxt}).`;

      });

      btnTotalClear.addEventListener("click", () => {
        ha.value = "";
        kgHa.value = "";
        if (agroUnidad) agroUnidad.value = "kg";
        resTotal.textContent = "";

      });

      btnUrea.addEventListener("click", () => {
        const nVal = Number(nkg.value);
        if (!nVal || nVal <= 0) {
          resUrea.style.color = "#b91c1c";
          resUrea.textContent = "⚠️ Ingresá kg de N total (mayor a 0).";
          return;
        }

        const ureaKg = nVal / 0.46;
        resUrea.style.color = "#166534";
        resUrea.textContent = `✅ Urea necesaria: ${fmt(ureaKg)} kg (para aportar ${fmt(nVal)} kg de N).`;
      });

      btnUreaClear.addEventListener("click", () => {
        nkg.value = "";
        resUrea.textContent = "";
      });

      // ✅ Consumo de Materia Seca
      btnMS.addEventListener("click", () => {
        const pv = Number(ganPeso.value);
        const porc = Number(ganPorcMS.value);
        const cab = Number(ganCabezas.value);

        if (!pv || !porc || !cab || pv <= 0 || porc <= 0 || cab <= 0) {
          resMS.style.color = "#b91c1c";
          resMS.textContent = "⚠️ Completá peso, %MS y cabezas con valores mayores a 0.";
          return;
        }

        const msPorCabDia = pv * (porc / 100);
        const totalDia = msPorCabDia * cab;
        const totalMes = totalDia * 30;

        resMS.style.color = "#166534";
        resMS.textContent =
          `✅ MS por animal/día: ${fmt(msPorCabDia)} kg • Total/día: ${fmt(totalDia)} kg • Total/mes: ${fmt(totalMes)} kg`;
      });

      btnMSClear.addEventListener("click", () => {
        ganPeso.value = "";
        ganPorcMS.value = "";
        ganCabezas.value = "";
        resMS.textContent = "";
      });

    }

    function initClima() {
      const inpLugar = document.getElementById("climaLugar");
      const btnBuscar = document.getElementById("btnClimaBuscar");
      const btnGPS = document.getElementById("btnClimaGPS");
      const msg = document.getElementById("msgClima");

      const actualBody = document.getElementById("climaActualBody");
      const alertasBody = document.getElementById("climaAlertasBody");
      const diasBody = document.getElementById("clima7diasBody");

      if (!btnBuscar || !btnGPS || !msg || !actualBody || !alertasBody || !diasBody) return;

      const setMsg = (t, c = "#14532d") => { msg.textContent = t; msg.style.color = c; };

      const fmt = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(n);

      // ✅ Open-Meteo Geocoding: https://geocoding-api.open-meteo.com/v1/search (name=...) :contentReference[oaicite:0]{index=0}
      async function geocodeLugar(texto) {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(texto)}&count=5&language=es&format=json`;
        const r = await fetch(url);
        const data = await r.json();
        const first = data?.results?.[0];
        if (!first) return null;
        return {
          name: `${first.name}${first.admin1 ? ", " + first.admin1 : ""}${first.country ? ", " + first.country : ""}`,
          lat: first.latitude,
          lon: first.longitude,
          tz: first.timezone
        };
      }

      // ✅ Forecast API base: https://api.open-meteo.com/v1/forecast ... :contentReference[oaicite:1]{index=1}
      async function pedirPronostico(lat, lon, timezone = "auto") {
        const url =
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${encodeURIComponent(lat)}` +
          `&longitude=${encodeURIComponent(lon)}` +
          `&timezone=${encodeURIComponent(timezone)}` +
          `&current=temperature_2m,wind_speed_10m,precipitation,weather_code` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code` +
          `&forecast_days=7`;

        const r = await fetch(url);
        if (!r.ok) throw new Error("No se pudo obtener pronóstico");
        return await r.json();
      }


      function codeToText(code) {
        // Mapa simple (podemos ampliarlo después)
        const m = {
          0: "Despejado",
          1: "Mayormente despejado",
          2: "Parcialmente nublado",
          3: "Nublado",
          45: "Niebla",
          48: "Niebla con escarcha",
          51: "Llovizna leve",
          53: "Llovizna",
          55: "Llovizna intensa",
          61: "Lluvia leve",
          63: "Lluvia",
          65: "Lluvia intensa",
          71: "Nieve leve",
          73: "Nieve",
          75: "Nieve intensa",
          95: "Tormenta"
        };
        return m[code] ?? `Código ${code}`;
      }

      function render(data, tituloLugar) {
        // ACTUAL
        const c = data.current;
        if (!c) {
          actualBody.innerHTML = "No hay datos actuales.";
          return;
        }

        const t = c.temperature_2m;
        const viento = c.wind_speed_10m;
        const precip = c.precipitation;
        const wc = c.weather_code;

        actualBody.innerHTML = `
      <div><b>📍 ${tituloLugar}</b></div>
      <div>🌡️ Temp: <b>${fmt(t)}°C</b></div>
      <div>💨 Viento: <b>${fmt(viento)} km/h</b></div>
      <div>🌧️ Precip: <b>${fmt(precip)} mm</b></div>
      <div>🧾 Estado: <b>${codeToText(wc)}</b></div>
    `;

        // 7 DÍAS
        const d = data.daily;
        if (!d?.time?.length) {
          diasBody.innerHTML = "No hay pronóstico diario.";
          return;
        }

        const rows = d.time.map((date, i) => {
          const tmin = d.temperature_2m_min?.[i];
          const tmax = d.temperature_2m_max?.[i];
          const p = d.precipitation_sum?.[i];
          const w = d.wind_speed_10m_max?.[i];
          const wcD = d.weather_code?.[i];

          const f = new Date(date + "T00:00:00");
          const dia = f.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "2-digit" });

          return `
        <div class="item-simple" style="gap:14px;">
          <div class="item-info">
            <strong>${dia}</strong><br>
            <small>${codeToText(wcD)}</small><br>
            <small>🌡️ ${fmt(tmin)}° / ${fmt(tmax)}° • 🌧️ ${fmt(p)} mm • 💨 ${fmt(w)} km/h</small>
          </div>
        </div>
      `;
        }).join("");

        diasBody.innerHTML = rows;

        // ALERTAS (reglas simples)
        const alerts = [];
        const hoyP = d.precipitation_sum?.[0] ?? 0;
        const hoyMin = d.temperature_2m_min?.[0];
        const hoyV = d.wind_speed_10m_max?.[0] ?? 0;

        if (hoyP >= 20) alerts.push("🌧️ Lluvia fuerte hoy (≥ 20 mm): planificá labores / caminos.");
        if (hoyMin != null && hoyMin <= 0) alerts.push("❄️ Riesgo de helada (mín ≤ 0°C).");
        if (hoyV >= 40) alerts.push("💨 Viento fuerte (≥ 40 km/h): ojo fumigación / incendios.");

        alertasBody.innerHTML = alerts.length
          ? `<ul style="margin:0; padding-left:18px;">${alerts.map(a => `<li>${a}</li>`).join("")}</ul>`
          : "✅ Sin alertas destacadas.";
      }

      async function usarGPS() {
        try {
          setMsg("📡 Buscando tu ubicación...", "#14532d");
          const pos = await pedirUbicacionActual();
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;

          const data = await pedirPronostico(lat, lon, "auto");
          render(data, "Mi ubicación");
          setMsg("✅ Clima actualizado (GPS).", "#166534");
        } catch (e) {
          console.error(e);
          setMsg("❌ No pude obtener el clima por GPS. Revisá permisos/ubicación.", "#b91c1c");
        }
      }

      async function buscarLugar() {
        const texto = (inpLugar.value || "").trim();
        if (!texto) {
          setMsg("⚠️ Escribí un lugar (ej: Gualeguay, Entre Ríos).", "#b91c1c");
          return;
        }

        try {
          setMsg("🔎 Buscando lugar...", "#14532d");
          const loc = await geocodeLugar(texto);
          if (!loc) {
            setMsg("❌ No encontré ese lugar. Probá agregando provincia/país.", "#b91c1c");
            return;
          }
          setMsg("📡 Consultando pronóstico...", "#14532d");
          const data = await pedirPronostico(loc.lat, loc.lon, loc.tz || "auto");
          render(data, loc.name);
          setMsg("✅ Clima actualizado.", "#166534");
        } catch (e) {
          console.error(e);
          setMsg("❌ Error consultando clima. Probá de nuevo.", "#b91c1c");
        }
      }

      btnBuscar.addEventListener("click", buscarLugar);
      btnGPS.addEventListener("click", usarGPS);

      // carga inicial: si querés que arranque con GPS, descomentá:
      // usarGPS();
    }

    function aplicarBloqueosPorPlan() {
      const esFree = planActual !== "pro";

      // ======================
      // NAV PRINCIPAL
      // ======================
      const navCamiones = document.querySelector('[data-target="sec-camiones"]');
      const navAlertas = document.querySelector('[data-target="sec-alertas"]');

      if (navCamiones) navCamiones.style.display = esFree ? "none" : "flex";
      if (navAlertas) navAlertas.style.display = esFree ? "none" : "flex";

      // ======================
      // ACCESOS RÁPIDOS HOY
      // ======================
      const btnHoyCamiones = document.getElementById("btnHoyIrCamiones");
      const btnHoyAlertas = document.getElementById("btnHoyIrAlertas");

      if (btnHoyCamiones) btnHoyCamiones.style.display = esFree ? "none" : "inline-flex";
      if (btnHoyAlertas) btnHoyAlertas.style.display = esFree ? "none" : "inline-flex";

      // ======================
      // SECCIONES (seguridad extra)
      // ======================<nav class="nav-panel"
      const secCamiones = document.getElementById("sec-camiones");
      const secAlertas = document.getElementById("sec-alertas");

      if (secCamiones && esFree) secCamiones.classList.add("hidden");
      if (secAlertas && esFree) secAlertas.classList.add("hidden");
    }
  
