// V34 FULL - Alertas y vencimientos
console.log("V34 alertas y vencimientos cargado");

const V34_REGLAS = {
  diasAvisoVencimiento: 7,
  diasMoraCritica: 30
};

function calcularSemaforoContrato(fechaVencimiento) {
  if (!fechaVencimiento) return "sin_fecha";
  const hoy = new Date();
  const venc = new Date(fechaVencimiento + "T00:00:00");
  const dias = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));
  if (dias < 0) return "vencido";
  if (dias <= V34_REGLAS.diasAvisoVencimiento) return "por_vencer";
  return "activo";
}

function detectarMora(diasPendiente) {
  if (diasPendiente >= V34_REGLAS.diasMoraCritica) return "critica";
  if (diasPendiente > 0) return "pendiente";
  return "al_dia";
}

window.V34_REGLAS = V34_REGLAS;
window.calcularSemaforoContrato = calcularSemaforoContrato;
window.detectarMora = detectarMora;
