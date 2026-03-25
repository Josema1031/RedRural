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
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const listaDisponibles = document.getElementById("listaDisponibles");
const listaActivas = document.getElementById("listaActivas");
const listaHistorial = document.getElementById("listaHistorial");

const countDisponibles = document.getElementById("countDisponibles");
const countActivas = document.getElementById("countActivas");
const countHistorial = document.getElementById("countHistorial");
const usuarioInfo = document.getElementById("usuarioInfo");

let currentUser = null;
let unsubDisponibles = null;
let unsubActivas = null;
let unsubHistorial = null;

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

function renderEstado(estado = "") {
  return `<span class="estado ${estado}">${escapeHtml(estado || "sin_estado")}</span>`;
}

function renderCard(item, tipoLista) {
  const campo = item.campo || item.nombreCampo || item.establecimiento || "Campo sin nombre";
  const tipo = item.tipo || item.tipoSolicitud || "Patrulla";
  const prioridad = item.prioridad || "Normal";
  const ubicacion = item.ubicacion || item.direccion || item.potrero || "-";
  const detalle = item.detalle || item.descripcion || "-";

  return `
    <div class="solicitud">
      <h3>${escapeHtml(campo)}</h3>
      <p><b>Tipo:</b> ${escapeHtml(tipo)}</p>
      <p><b>Prioridad:</b> ${escapeHtml(prioridad)}</p>
      <p><b>Ubicación:</b> ${escapeHtml(ubicacion)}</p>
      <p><b>Detalle:</b> ${escapeHtml(detalle)}</p>
      <p><b>Estado:</b> ${renderEstado(item.estado || "pendiente")}</p>
      <p><b>Aceptada:</b> ${escapeHtml(formatFecha(item.aceptadaAt))}</p>
      <p><b>Inicio:</b> ${escapeHtml(formatFecha(item.inicioPatrullaAt))}</p>
      <p><b>Fin:</b> ${escapeHtml(formatFecha(item.finPatrullaAt))}</p>

      <div class="actions">
        ${tipoLista === "disponibles" ? `
          <button class="btnAceptar" data-action="aceptar" data-id="${item.id}">
            Aceptar
          </button>
        ` : ""}

        ${tipoLista === "activas" && item.estado === "asignada" ? `
          <button class="btnIniciar" data-action="iniciar" data-id="${item.id}">
            Iniciar patrulla
          </button>
        ` : ""}

        ${tipoLista === "activas" && item.estado === "en_proceso" ? `
          <button class="btnFinalizar" data-action="finalizar" data-id="${item.id}">
            Finalizar patrulla
          </button>
        ` : ""}
      </div>
    </div>
  `;
}

function renderLista(contenedor, items, tipoLista, textoVacio) {
  if (!items.length) {
    contenedor.innerHTML = `<div class="empty">${textoVacio}</div>`;
    return;
  }

  contenedor.innerHTML = items.map(item => renderCard(item, tipoLista)).join("");
}

function limpiarListeners() {
  if (unsubDisponibles) unsubDisponibles();
  if (unsubActivas) unsubActivas();
  if (unsubHistorial) unsubHistorial();

  unsubDisponibles = null;
  unsubActivas = null;
  unsubHistorial = null;
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

function escucharSolicitudes(user) {
  limpiarListeners();

  const qDisponibles = query(
    collection(db, "solicitudesPatrulla"),
    where("estado", "==", "pendiente")
  );

  unsubDisponibles = onSnapshot(qDisponibles, (snap) => {
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    countDisponibles.textContent = items.length;
    renderLista(
      listaDisponibles,
      items,
      "disponibles",
      "No hay solicitudes disponibles."
    );
  });

  const qActivas = query(
    collection(db, "solicitudesPatrulla"),
    where("patrulleroExternoId", "==", user.uid)
  );

  unsubActivas = onSnapshot(qActivas, (snap) => {
    const all = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    const activas = all.filter(item =>
      item.estado === "asignada" || item.estado === "en_proceso"
    );

    countActivas.textContent = activas.length;
    renderLista(
      listaActivas,
      activas,
      "activas",
      "No tenés patrullas activas."
    );
  });

  const qHistorial = query(
    collection(db, "solicitudesPatrulla"),
    where("patrulleroExternoId", "==", user.uid)
  );

  unsubHistorial = onSnapshot(qHistorial, (snap) => {
    const all = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    const historial = all
      .filter(item => item.estado === "finalizada")
      .sort((a, b) => {
        const aTime = a.finPatrullaAt?.toDate ? a.finPatrullaAt.toDate().getTime() : 0;
        const bTime = b.finPatrullaAt?.toDate ? b.finPatrullaAt.toDate().getTime() : 0;
        return bTime - aTime;
      });

    countHistorial.textContent = historial.length;
    renderLista(
      listaHistorial,
      historial,
      "historial",
      "Todavía no tenés patrullas finalizadas."
    );
  });
}

async function aceptarPatrulla(id) {
  if (!currentUser) return;

  const refDoc = doc(db, "solicitudesPatrulla", id);

  await updateDoc(refDoc, {
    estado: "asignada",
    patrulleroExternoId: currentUser.uid,
    patrulleroExternoEmail: currentUser.email || "",
    aceptadaAt: serverTimestamp()
  });
}

async function iniciarPatrulla(id) {
  const refDoc = doc(db, "solicitudesPatrulla", id);

  await updateDoc(refDoc, {
    estado: "en_proceso",
    inicioPatrullaAt: serverTimestamp()
  });
}

async function finalizarPatrulla(id) {
  const refDoc = doc(db, "solicitudesPatrulla", id);

  await updateDoc(refDoc, {
    estado: "finalizada",
    finPatrullaAt: serverTimestamp()
  });
}

document.body.addEventListener("click", async (e) => {
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

    if (action === "iniciar") {
      await iniciarPatrulla(id);
    }

    if (action === "finalizar") {
      await finalizarPatrulla(id);
    }
  } catch (error) {
    console.error("Error en acción patrullero:", error);
    alert("Ocurrió un error: " + (error?.message || error));
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("btnLogout").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./login.html";
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    limpiarListeners();
    window.location.href = "./login.html";
    return;
  }

  try {
    const perfil = await validarAccesoPatrullero(user);
    usuarioInfo.textContent = `Usuario: ${perfil.nombre || ""} ${perfil.apellido || ""}`.trim();
    escucharSolicitudes(user);
  } catch (error) {
    console.error("Acceso denegado:", error);
    alert(error.message || "No tenés permisos para acceder a este panel.");
    await signOut(auth);
    window.location.href = "./login.html";
  }
});