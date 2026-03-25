// V35 FULL - Automatización comercial
console.log("V35 automatización comercial cargado");

const V35_REGLAS = {
  diasRenovacion: 7,
  diasMoraBloqueo: 30,
  prioridadCritica: "Crítica"
};

function sugerirAccionCliente({ estadoContrato, diasMora = 0 }) {
  if (diasMora >= V35_REGLAS.diasMoraBloqueo) {
    return "bloqueo_sugerido";
  }
  if (estadoContrato === "por_vencer") {
    return "recordatorio_renovacion";
  }
  if (estadoContrato === "vencido") {
    return "llamada_comercial";
  }
  return "seguimiento_normal";
}

function calcularPrioridadCliente({ estadoContrato, diasMora = 0 }) {
  if (diasMora >= V35_REGLAS.diasMoraBloqueo) return "Crítica";
  if (estadoContrato === "por_vencer") return "Alta";
  return "Media";
}

window.V35_REGLAS = V35_REGLAS;
window.sugerirAccionCliente = sugerirAccionCliente;
window.calcularPrioridadCliente = calcularPrioridadCliente;
