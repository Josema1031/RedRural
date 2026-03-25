import { db, auth } from "../../firebase-init.js";
import { collection, addDoc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function getProductorId() {
  return auth.currentUser?.uid || localStorage.getItem("productorId") || "";
}

export async function registrarCosto(payload = {}) {
  const productorId = getProductorId();
  if (!productorId) throw new Error("No hay productor autenticado");

  const costo = {
    cliente: payload.cliente || "",
    campo: payload.campo || "",
    costo: Number(payload.costo || 0),
    fecha: payload.fecha || "",
    productorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await addDoc(collection(db, "costos_operativos"), costo);
}

export async function calcularRentabilidad() {
  const productorId = getProductorId();
  let ingresos = 0;
  let costos = 0;

  const facturasSnap = await getDocs(collection(db, "facturas_clientes"));
  facturasSnap.forEach(d => {
    const x = d.data();
    if (x.productorId === productorId) ingresos += Number(x.monto || 0);
  });

  const costosSnap = await getDocs(collection(db, "costos_operativos"));
  costosSnap.forEach(d => {
    const x = d.data();
    if (x.productorId === productorId) costos += Number(x.costo || 0);
  });

  return { ingresos, costos, margen: ingresos - costos };
}
