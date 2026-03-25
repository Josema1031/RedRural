import { app, auth, db } from "../../../firebase-init.js";
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    query,
    orderBy,
    onSnapshot,
    updateDoc,
    doc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ADMIN_UID = "mfCEucZxwne4vGJcMIvfm3hOe173";

const $ = (id) => document.getElementById(id);

const logEl = $("log");
const listaEl = $("listaPatrulleros");
const filtroEstadoEl = $("filtroEstado");

let unsuscribePatrulleros = null;

function log(msg) {
    logEl.textContent = msg;
}

function setEstadoLogin(texto) {
    $("estado").textContent = texto;
}

function setUIAuthed(isAuthed) {
    $("btnLogin").classList.toggle("hide", isAuthed);
    $("btnLogout").classList.toggle("hide", !isAuthed);
    $("btnRecargar").classList.toggle("hide", !isAuthed);
}

function escapeHtml(str = "") {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatFecha(value) {
    if (!value) return "Sin fecha";
    try {
        if (typeof value.toDate === "function") {
            return value.toDate().toLocaleString("es-AR");
        }
        return new Date(value).toLocaleString("es-AR");
    } catch {
        return "Sin fecha";
    }
}

function getEstadoClass(estado = "") {
    const e = (estado || "").toLowerCase();
    if (e === "aprobado") return "aprobado";
    if (e === "rechazado") return "rechazado";
    return "pendiente";
}

function filtrarItems(items, filtro) {
    if (filtro === "todos") return items;
    return items.filter((item) => (item.estado || "pendiente") === filtro);
}

function renderLista(items) {
    const filtro = filtroEstadoEl.value;
    const filtrados = filtrarItems(items, filtro);

    if (!filtrados.length) {
        listaEl.innerHTML = `
      <div class="empty-state">
        No hay postulaciones para el filtro seleccionado.
      </div>
    `;
        return;
    }

    listaEl.innerHTML = filtrados.map((item) => {
        const estado = item.estado || "pendiente";
        const docs = item.documentos || {};

        return `
      <article class="p-card" data-id="${item.id}">
        <div class="p-top">
          <div>
            <h3 class="p-nombre">${escapeHtml(item.nombre || "")} ${escapeHtml(item.apellido || "")}</h3>
            <p class="p-sub">
              DNI: ${escapeHtml(item.dni || "-")} · Tel: ${escapeHtml(item.telefono || "-")} · Email: ${escapeHtml(item.email || "-")}
            </p>
            <p class="small">
              Registrado: ${escapeHtml(formatFecha(item.createdAt))}
            </p>
          </div>

          <span class="estado-chip ${getEstadoClass(estado)}">
            ${escapeHtml(estado.toUpperCase())}
          </span>
        </div>

        <div class="p-grid">
          <div class="p-box">
            <h4>Experiencia</h4>
            <p><b>Localidad:</b> ${escapeHtml(item.localidad || "-")}</p>
            <p><b>Años:</b> ${escapeHtml(String(item.aniosExperiencia ?? "-"))}</p>
            <p><b>Disponibilidad:</b> ${escapeHtml(item.disponibilidad || "-")}</p>
            <p><b>Detalle:</b> ${escapeHtml(item.experiencia || "-")}</p>
          </div>

          <div class="p-box">
            <h4>Vehículo</h4>
            <p><b>Marca:</b> ${escapeHtml(item.vehiculoMarca || "-")}</p>
            <p><b>Modelo:</b> ${escapeHtml(item.vehiculoModelo || "-")}</p>
            <p><b>Dominio:</b> ${escapeHtml(item.vehiculoDominio || "-")}</p>
            <p><b>Año:</b> ${escapeHtml(String(item.vehiculoAnio ?? "-"))}</p>
          </div>
        </div>

        <div class="p-box">
          <h4>Documentación</h4>
          <div class="docs">
            ${docs.dniFrenteUrl ? `<a class="doc-link" href="${docs.dniFrenteUrl}" target="_blank" rel="noopener noreferrer">DNI frente</a>` : ""}
            ${docs.dniDorsoUrl ? `<a class="doc-link" href="${docs.dniDorsoUrl}" target="_blank" rel="noopener noreferrer">DNI dorso</a>` : ""}
            ${docs.antecedentesUrl ? `<a class="doc-link" href="${docs.antecedentesUrl}" target="_blank" rel="noopener noreferrer">Antecedentes</a>` : ""}
            ${docs.licenciaUrl ? `<a class="doc-link" href="${docs.licenciaUrl}" target="_blank" rel="noopener noreferrer">Licencia</a>` : ""}
            ${docs.fotoVehiculoUrl ? `<a class="doc-link" href="${docs.fotoVehiculoUrl}" target="_blank" rel="noopener noreferrer">Foto vehículo</a>` : ""}
          </div>
        </div>

        <div class="obs-wrap">
          <label for="obs-${item.id}"><b>Observación admin</b></label>
          <textarea id="obs-${item.id}" placeholder="Ej: documentación correcta, falta seguro, validar experiencia...">${escapeHtml(item.observacionAdmin || "")}</textarea>
        </div>

        <div class="p-actions">
          <button class="btn-aprobar" data-action="aprobar" data-id="${item.id}">Aprobar</button>
          <button class="btn-rechazar" data-action="rechazar" data-id="${item.id}">Rechazar</button>
          <button class="btn-guardar" data-action="guardar" data-id="${item.id}">Guardar observación</button>
        </div>
      </article>
    `;
    }).join("");
}

async function actualizarEstadoPatrullero(id, nuevoEstado) {
    const user = auth.currentUser;
    if (!user) {
        alert("Primero debés iniciar sesión.");
        return;
    }

    if (user.uid !== ADMIN_UID) {
        alert("Tu usuario no tiene permisos de administrador.");
        return;
    }

    const textarea = document.getElementById(`obs-${id}`);
    const observacionAdmin = textarea ? textarea.value.trim() : "";

    const refDoc = doc(db, "patrulleros_externos", id);

    await updateDoc(refDoc, {
        estado: nuevoEstado,
        activo: nuevoEstado === "aprobado",
        observacionAdmin,
        aprobadoPor: user.uid,
        aprobadoAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
}

async function guardarObservacion(id) {
    const user = auth.currentUser;
    if (!user) {
        alert("Primero debés iniciar sesión.");
        return;
    }

    if (user.uid !== ADMIN_UID) {
        alert("Tu usuario no tiene permisos de administrador.");
        return;
    }

    const textarea = document.getElementById(`obs-${id}`);
    const observacionAdmin = textarea ? textarea.value.trim() : "";

    const refDoc = doc(db, "patrulleros_externos", id);

    await updateDoc(refDoc, {
        observacionAdmin,
        updatedAt: serverTimestamp()
    });

    alert("Observación guardada.");
}

function escucharPatrulleros() {
    if (unsuscribePatrulleros) {
        unsuscribePatrulleros();
        unsuscribePatrulleros = null;
    }

    const q = query(
        collection(db, "patrulleros_externos"),
        orderBy("createdAt", "desc")
    );

    unsuscribePatrulleros = onSnapshot(q, (snap) => {
        const items = snap.docs.map((d) => ({
            id: d.id,
            ...d.data()
        }));

        renderLista(items);
        log(`✅ Postulaciones cargadas: ${items.length}`);
    }, (error) => {
        console.error(error);
        log("❌ Error al cargar postulaciones: " + (error?.message || error));
    });
}

$("btnLogin")?.addEventListener("click", async () => {
    try {
        const email = $("email").value.trim();
        const pass = $("pass").value;

        if (!email || !pass) {
            log("⚠️ Completá email y password.");
            return;
        }

        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        console.error(error);
        log("❌ Error login: " + (error?.message || error));
    }
});

$("btnLogout")?.addEventListener("click", async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error(error);
        log("❌ Error al cerrar sesión: " + (error?.message || error));
    }
});

$("btnRecargar")?.addEventListener("click", () => {
    escucharPatrulleros();
});

filtroEstadoEl?.addEventListener("change", () => {
    escucharPatrulleros();
});

listaEl?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!id) return;

    try {
        btn.disabled = true;

        if (action === "aprobar") {
            await actualizarEstadoPatrullero(id, "aprobado");
            alert("Patrullero aprobado correctamente.");
        }

        if (action === "rechazar") {
            await actualizarEstadoPatrullero(id, "rechazado");
            alert("Patrullero rechazado.");
        }

        if (action === "guardar") {
            await guardarObservacion(id);
        }
    } catch (error) {
        console.error(error);
        alert("Ocurrió un error: " + (error?.message || error));
    } finally {
        btn.disabled = false;
    }
});

onAuthStateChanged(auth, (user) => {
    if (!user) {
        setEstadoLogin("Estado: no logueado");
        setUIAuthed(false);
        listaEl.innerHTML = `
      <div class="empty-state">
        Iniciá sesión para ver las postulaciones.
      </div>
    `;
        log("Listo. Iniciá sesión para revisar patrulleros.");

        if (unsuscribePatrulleros) {
            unsuscribePatrulleros();
            unsuscribePatrulleros = null;
        }
        return;
    }

    setEstadoLogin(`Estado: logueado (${user.email})`);
    setUIAuthed(true);

    if (user.uid !== ADMIN_UID) {
        listaEl.innerHTML = `
      <div class="empty-state">
        Tu usuario está logueado, pero no tiene permisos de administrador.
      </div>
    `;
        log("⚠️ Logueado, pero NO sos admin.");
        return;
    }

    log("✅ Admin OK. Cargando postulaciones...");
    escucharPatrulleros();
});