import { db, auth } from "../../firebase-init.js";
import { collection, addDoc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function getProductorId() {
  return auth.currentUser?.uid || localStorage.getItem("productorId") || "";
}

export async function registrarFactura(payload = {}) {
  const productorId = getProductorId();
  if (!productorId) throw new Error("No hay productor autenticado");

  const factura = {
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

export async function listarFacturas() {
  const productorId = getProductorId();
  const snap = await getDocs(collection(db, "facturas_clientes"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.productorId === productorId);
}
