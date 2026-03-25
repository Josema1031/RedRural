// V46 FULL - Rentabilidad por cliente
console.log("V46 rentabilidad cargada");

function calcularRentabilidadCliente(data = {}) {
  const facturado = Number(data.facturado || 0);
  const costo = Number(data.costo || 0);
  const margen = facturado - costo;
  const rentabilidad = facturado > 0 ? Math.round((margen / facturado) * 100) : 0;

  return {
    cliente: data.cliente || "",
    facturado,
    costo,
    margen,
    rentabilidad,
    estado: rentabilidad >= 30 ? "rentable" : (rentabilidad >= 10 ? "baja" : "revisar")
  };
}

function resumirRentabilidad(clientes = []) {
  const normalizados = clientes.map(calcularRentabilidadCliente);
  const margenTotal = normalizados.reduce((acc, c) => acc + c.margen, 0);
  const costoTotal = normalizados.reduce((acc, c) => acc + c.costo, 0);
  const promedio = normalizados.length
    ? Math.round(normalizados.reduce((acc, c) => acc + c.rentabilidad, 0) / normalizados.length)
    : 0;
  const clientesRentables = normalizados.filter(c => c.estado === "rentable").length;

  return {
    margenTotal,
    costoTotal,
    rentabilidadMedia: promedio,
    clientesRentables,
    ranking: normalizados.sort((a, b) => b.rentabilidad - a.rentabilidad)
  };
}

window.calcularRentabilidadCliente = calcularRentabilidadCliente;
window.resumirRentabilidad = resumirRentabilidad;
