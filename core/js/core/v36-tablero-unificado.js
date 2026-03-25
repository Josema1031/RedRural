// V36 FULL - Tablero unificado empresarial
console.log("V36 tablero unificado cargado");

const V36_ESTADO = {
  clientes: [],
  contratos: [],
  vencimientos: [],
  automatizaciones: [],
  operacion: []
};

function obtenerResumenEmpresarial(data = {}) {
  const clientesActivos = (data.clientes || []).filter(c => c.estado === "activo").length;
  const contratosVigentes = (data.contratos || []).filter(c => c.estado === "activo").length;
  const alertasAbiertas = (data.vencimientos || []).filter(v => v.activa).length;
  const facturacion = (data.contratos || []).reduce((acc, item) => acc + Number(item.monto || 0), 0);

  return {
    clientesActivos,
    contratosVigentes,
    alertasAbiertas,
    facturacion
  };
}

function unirCapasEmpresa({ clientes = [], contratos = [], vencimientos = [], automatizaciones = [] } = {}) {
  return clientes.map(cliente => {
    const contrato = contratos.find(c => c.clienteId === cliente.id) || {};
    const vencimiento = vencimientos.find(v => v.clienteId === cliente.id) || {};
    const automatizacion = automatizaciones.find(a => a.clienteId === cliente.id) || {};

    return {
      ...cliente,
      contratoEstado: contrato.estado || "sin_contrato",
      pagoEstado: contrato.pagoEstado || "sin_dato",
      prioridad: automatizacion.prioridad || vencimiento.prioridad || "media",
      accion: automatizacion.accion || "seguimiento_normal"
    };
  });
}

window.V36_ESTADO = V36_ESTADO;
window.obtenerResumenEmpresarial = obtenerResumenEmpresarial;
window.unirCapasEmpresa = unirCapasEmpresa;
