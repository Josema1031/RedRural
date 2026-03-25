// V45 FULL - Facturación y control económico
console.log("V45 facturación cargada");

function calcularResumenFacturacion(registros = []) {
  const totalFacturado = registros.reduce((acc, r) => acc + Number(r.monto || 0), 0);
  const totalCobrado = registros
    .filter(r => (r.estadoCobro || "").toLowerCase() === "cobrado")
    .reduce((acc, r) => acc + Number(r.monto || 0), 0);
  const totalPendiente = totalFacturado - totalCobrado;
  const tasaCobro = totalFacturado > 0 ? Math.round((totalCobrado / totalFacturado) * 100) : 0;

  return {
    totalFacturado,
    totalCobrado,
    totalPendiente,
    tasaCobro
  };
}

function normalizarRegistroFactura(data = {}) {
  return {
    cliente: data.cliente || "",
    periodo: data.periodo || "",
    monto: Number(data.monto || 0),
    estado: data.estado || "facturado",
    estadoCobro: data.estadoCobro || "pendiente",
    observacion: data.observacion || ""
  };
}

window.calcularResumenFacturacion = calcularResumenFacturacion;
window.normalizarRegistroFactura = normalizarRegistroFactura;
