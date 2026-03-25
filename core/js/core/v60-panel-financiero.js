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

function calcularEstadoPorSaldo(facturado = 0, pagado = 0) {
  const saldo = Math.max(0, Number(facturado || 0) - Number(pagado || 0));
  if (saldo <= 0) return { saldo, estado: "al_dia" };
  if (saldo > 0 && saldo <= Number(facturado || 0) * 0.5) return { saldo, estado: "atrasado" };
  return { saldo, estado: "moroso" };
}

export async function calcularPanelFinancieroCompleto() {
  const productorId = getProductorId();
  if (!productorId) throw new Error("No hay productor autenticado");

  const clientesSnap = await getDocs(query(collection(db, "clientes_contratos"), where("productorId", "==", productorId)));
  const facturasSnap = await getDocs(query(collection(db, "facturas_clientes"), where("productorId", "==", productorId)));
  const pagosSnap = await getDocs(query(collection(db, "pagos_clientes"), where("productorId", "==", productorId)));
  const costosSnap = await getDocs(query(collection(db, "costos_operativos"), where("productorId", "==", productorId)));

  const clientes = clientesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const facturas = facturasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const pagos = pagosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const costos = costosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const detalle = clientes.map(cliente => {
    const clienteId = cliente.id;
    const facturadoCalculado = facturas
      .filter(f => f.clienteContratoId === clienteId)
      .reduce((acc, x) => acc + Number(x.monto || 0), 0);

    const facturado = facturadoCalculado || Number(cliente.montoMensual || 0);

    const pagado = pagos
      .filter(p => p.clienteContratoId === clienteId)
      .reduce((acc, x) => acc + Number(x.monto || 0), 0);

    const saldoInfo = calcularEstadoPorSaldo(facturado, pagado);

    return {
      cliente: cliente.nombre || "",
      campo: cliente.campo || "",
      facturado,
      pagado,
      saldo: saldoInfo.saldo,
      estado: saldoInfo.estado
    };
  });

  const totalFacturado = detalle.reduce((acc, x) => acc + Number(x.facturado || 0), 0);
  const totalPagado = detalle.reduce((acc, x) => acc + Number(x.pagado || 0), 0);
  const saldoPendiente = detalle.reduce((acc, x) => acc + Number(x.saldo || 0), 0);
  const totalCostos = costos.reduce((acc, x) => acc + Number(x.costo || 0), 0);
  const margen = totalPagado - totalCostos;
  const rentabilidad = totalPagado > 0 ? Math.round((margen / totalPagado) * 100) : 0;

  let estadoGeneral = "estable";
  if (detalle.some(x => x.estado === "moroso")) estadoGeneral = "riesgo";
  else if (detalle.some(x => x.estado === "atrasado")) estadoGeneral = "atencion";

  return {
    resumen: {
      clientes: clientes.length,
      totalFacturado,
      totalPagado,
      totalCostos,
      saldoPendiente,
      margen,
      rentabilidad,
      estadoGeneral
    },
    detalle
  };
}
