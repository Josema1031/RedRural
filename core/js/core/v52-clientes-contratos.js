import { db, auth } from "../../firebase-init.js";
import {
  collection, addDoc, getDocs, updateDoc, doc,
  serverTimestamp, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function getProductorId() {
  return auth.currentUser?.uid || localStorage.getItem("productorId") || "";
}

export async function crearClienteContrato(payload = {}) {
  const productorId = getProductorId();
  if (!productorId) throw new Error("No hay productor autenticado");

  const cliente = {
    nombre: payload.nombre || "",
    campo: payload.campo || "",
    localidad: payload.localidad || "",
    plan: payload.plan || "Basico",
    estado: payload.estado || "activo",
    estadoComercial: payload.estadoComercial || "al_dia",
    montoMensual: Number(payload.montoMensual || 0),
    fechaInicio: payload.fechaInicio || "",
    fechaVencimiento: payload.fechaVencimiento || "",
    productorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, "clientes_contratos"), cliente);
  return { id: ref.id, ...cliente };
}

export async function listarClientesContratos() {
  const productorId = getProductorId();
  if (!productorId) throw new Error("No hay productor autenticado");

  const q = query(
    collection(db, "clientes_contratos"),
    where("productorId", "==", productorId),
    orderBy("campo", "asc")
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function actualizarEstadoContrato(id, estado) {
  const ref = doc(db, "clientes_contratos", id);
  await updateDoc(ref, {
    estado,
    updatedAt: serverTimestamp()
  });
  return true;
}

export function calcularEstadoContrato(fechaVencimiento = "") {
  if (!fechaVencimiento) return "sin_fecha";
  const hoy = new Date();
  const venc = new Date(fechaVencimiento + "T00:00:00");
  const diff = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "vencido";
  if (diff <= 7) return "por_vencer";
  return "activo";
}
