import { db, auth } from "../../firebase-init.js";
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function getProductorId() {
  return auth.currentUser?.uid || "";
}

export async function registrarFacturaCliente(payload = {}) {
  const productorId = getProductorId();
  if (!productorId) throw new Error("No hay productor autenticado");

  const factura = {
    clienteContratoId: payload.clienteContratoId || "",
    cliente: payload.cliente || "",
    campo: payload.campo || "",
    monto: Number(payload.monto || 0),
    fecha: payload.fecha || "",
    productorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, "facturas_clientes"), factura);
  return { id: ref.id, ...factura };
}

export async function listarFacturasCliente(clienteContratoId = "") {
  const productorId = getProductorId();
  if (!productorId) throw new Error("No hay productor autenticado");

  const facturasRef = collection(db, "facturas_clientes");
  const q = clienteContratoId
    ? query(
        facturasRef,
        where("productorId", "==", productorId),
        where("clienteContratoId", "==", clienteContratoId),
        orderBy("fecha", "desc")
      )
    : query(
        facturasRef,
        where("productorId", "==", productorId),
        orderBy("fecha", "desc")
      );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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

export function calcularEstadoComercial({ totalFacturado = 0, totalPagado = 0, montoMensual = 0 } = {}) {
  const base = totalFacturado > 0 ? totalFacturado : montoMensual;
  const saldoPendiente = Math.max(0, Number(base || 0) - Number(totalPagado || 0));

  if (saldoPendiente <= 0) return { saldoPendiente, estadoComercial: "al_dia" };
  if (saldoPendiente > 0 && saldoPendiente <= Number(base || 0) * 0.5) {
    return { saldoPendiente, estadoComercial: "atrasado" };
  }
  return { saldoPendiente, estadoComercial: "moroso" };
}

export async function obtenerResumenDeudaCliente(clienteContratoId = "", montoMensual = 0) {
  const facturas = await listarFacturasCliente(clienteContratoId);
  const pagos = await listarPagosCliente(clienteContratoId);

  const totalFacturado = facturas.reduce((acc, x) => acc + Number(x.monto || 0), 0);
  const totalPagado = pagos.reduce((acc, x) => acc + Number(x.monto || 0), 0);

  const resumen = calcularEstadoComercial({
    totalFacturado,
    totalPagado,
    montoMensual
  });

  return {
    totalFacturado,
    totalPagado,
    saldoPendiente: resumen.saldoPendiente,
    estadoComercial: resumen.estadoComercial
  };
}
