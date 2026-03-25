// V49 FULL - Panel gerencial
console.log("V49 panel gerencial cargado");

function calcularPanelGerencial(data = {}) {
  const ingresos = Number(data.ingresos || 0);
  const costos = Number(data.costos || 0);
  const clientesActivos = Number(data.clientesActivos || 0);
  const clientesMora = Number(data.clientesMora || 0);
  const rentabilidadGlobal = ingresos > 0 ? Math.round(((ingresos - costos) / ingresos) * 100) : 0;

  return {
    ingresos,
    costos,
    margen: ingresos - costos,
    rentabilidadGlobal,
    clientesActivos,
    clientesMora
  };
}

function consolidarResumenGerencial(clientes = []) {
  const ingresos = clientes.reduce((acc, c) => acc + Number(c.ingresos || 0), 0);
  const costos = clientes.reduce((acc, c) => acc + Number(c.costos || 0), 0);
  const clientesActivos = clientes.filter(c => (c.estadoComercial || "").toLowerCase() === "activo").length;
  const clientesMora = clientes.filter(c => (c.estadoComercial || "").toLowerCase() === "mora").length;

  return calcularPanelGerencial({
    ingresos,
    costos,
    clientesActivos,
    clientesMora
  });
}

window.calcularPanelGerencial = calcularPanelGerencial;
window.consolidarResumenGerencial = consolidarResumenGerencial;
