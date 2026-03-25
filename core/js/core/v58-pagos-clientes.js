import { db, auth } from "../../firebase-init.js";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function getProductorId() {
  return auth.currentUser?.uid || "";
}

export function calcularEstadoPagoCliente({ montoMensual = 0, totalPagado = 0 } = {}) {
  const saldo = Number(montoMensual || 0) - Number(totalPagado || 0);
  if (saldo <= 0) return "al_dia";
  if (saldo > 0 && saldo <= Number(montoMensual || 0) * 0.5) return "atrasado";
  if (saldo > Number(montoMensual || 0) * 0.5) return "moroso";
  return "pendiente";
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
    fechaPago: payload.fechaPago || "",
    observacion: payload.observacion || "",
    estado: "pagado",
    estadoComercial: "al_dia",
    productorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, "pagos_clientes"), pago);
  return { id: ref.id, ...pago };
}

export async function listarPagosCliente(clienteContratoId = "") {
  const productorId = getProductorId();
  if (!productorId) throw new Error("No hay productor autenticado");

  const pagosRef = collection(db, "pagos_clientes");
  const q = clienteContratoId
    ? query(
        pagosRef,
        where("productorId", "==", productorId),
        where("clienteContratoId", "==", clienteContratoId),
        orderBy("fechaPago", "desc")
      )
    : query(
        pagosRef,
        where("productorId", "==", productorId),
        orderBy("fechaPago", "desc")
      );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function actualizarEstadoComercialCliente(id, estadoComercial) {
  const productorId = getProductorId();
  if (!productorId) throw new Error("No hay productor autenticado");

  const ref = doc(db, "clientes_contratos", id);
  await updateDoc(ref, {
    estadoComercial,
    updatedAt: serverTimestamp()
  });
  return true;
}
