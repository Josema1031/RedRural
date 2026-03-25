import { db, auth } from "../../firebase-init.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function getProductorId() {
  return auth.currentUser?.uid || "";
}

function estadoFromCount(count) {
  if (count > 0) return { resultado: "OK", resultadoClass: "ok", observacion: "Con datos cargados" };
  return { resultado: "REVISAR", resultadoClass: "warn", observacion: "Sin registros todavía" };
}

export async function ejecutarValidacionFinal() {
  const productorId = getProductorId();
  if (!productorId) throw new Error("No hay productor autenticado");

  const colecciones = [
    { nombre: "clientes_contratos", label: "Clientes / contratos" },
    { nombre: "pagos_clientes", label: "Pagos" },
    { nombre: "facturas_clientes", label: "Facturas" },
    { nombre: "costos_operativos", label: "Costos" }
  ];

  const detalle = [];
  const counts = {};

  for (const item of colecciones) {
    const snap = await getDocs(query(collection(db, item.nombre), where("productorId", "==", productorId)));
    counts[item.nombre] = snap.size;
    const estado = estadoFromCount(snap.size);
    detalle.push({
      coleccion: item.label,
      registros: snap.size,
      resultado: estado.resultado,
      resultadoClass: estado.resultadoClass,
      observacion: estado.observacion
    });
  }

  const estadoGeneral = detalle.some(x => x.resultado === "REVISAR") ? "parcial" : "completo";

  return {
    resumen: {
      clientes: counts["clientes_contratos"] || 0,
      pagos: counts["pagos_clientes"] || 0,
      facturas: counts["facturas_clientes"] || 0,
      costos: counts["costos_operativos"] || 0,
      estadoGeneral
    },
    checklist: {
      auth: "OK",
      clientes: counts["clientes_contratos"] > 0 ? "OK" : "REVISAR",
      pagos: counts["pagos_clientes"] > 0 ? "OK" : "REVISAR",
      facturas: counts["facturas_clientes"] > 0 ? "OK" : "REVISAR",
      costos: counts["costos_operativos"] > 0 ? "OK" : "REVISAR",
      finanzas: (counts["facturas_clientes"] > 0 && counts["costos_operativos"] > 0) ? "OK" : "REVISAR"
    },
    detalle
  };
}
