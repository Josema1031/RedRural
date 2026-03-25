import { db, auth } from "../../firebase-init.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function getProductorId() {
  return auth.currentUser?.uid || localStorage.getItem("productorId") || "";
}

export async function calcularPanelGerencial() {
  const productorId = getProductorId();
  let clientes = 0, ingresos = 0, costos = 0;

  const clientesSnap = await getDocs(collection(db, "clientes_contratos"));
  clientesSnap.forEach(d => { if (d.data().productorId === productorId) clientes += 1; });

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

  return { clientes, ingresos, costos, margen: ingresos - costos };
}
