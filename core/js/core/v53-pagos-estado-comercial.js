import { db, auth } from "../../firebase-init.js";
import {
  collection, addDoc, getDocs, updateDoc, doc,
  serverTimestamp, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function getProductorId() {
  return auth.currentUser?.uid || localStorage.getItem("productorId") || "";
}

export async function registrarPagoCliente(payload = {}) {
  const productorId = getProductorId();
  if (!productorId) throw new Error("No hay productor autenticado");

  const pago = {
    clienteContratoId: payload.clienteContratoId || "",
    cliente: payload.cliente || "",
    campo: payload.campo || "",
    monto: Number(payload.monto || 0),
    metodoPago: payload.metodoPago || "transferencia",
    estado: payload.estado || "pagado",
    fechaPago: payload.fechaPago || "",
    observacion: payload.observacion || "",
    productorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, "pagos_clientes"), pago);
  return { id: ref.id, ...pago };
}

export async function listarPagosCliente(clienteContratoId = "") {
  const productorId = getProductorId();
  const pagosRef = collection(db, "pagos_clientes");
  const q = clienteContratoId
    ? query(pagosRef, where("clienteContratoId", "==", clienteContratoId))
    : query(pagosRef, orderBy("fechaPago", "desc"));

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.productorId === productorId);
}

export function resumirPagos(pagos = [], montoMensual = 0) {
  const totalPagado = pagos.filter(p => String(p.estado || "").toLowerCase() === "pagado")
    .reduce((acc, p) => acc + Number(p.monto || 0), 0);
  const saldoPendiente = Number(montoMensual || 0) - totalPagado;
  let estadoComercial = "al_dia";
  if (saldoPendiente > 0) estadoComercial = "pendiente";
  if (saldoPendiente > Number(montoMensual || 0) * 0.5) estadoComercial = "moroso";
  return { totalPagado, saldoPendiente: Math.max(0, saldoPendiente), estadoComercial };
}

export async function actualizarEstadoComercialCliente(id, estadoComercial) {
  const ref = doc(db, "clientes_contratos", id);
  await updateDoc(ref, { estadoComercial, updatedAt: serverTimestamp() });
  return true;
}
